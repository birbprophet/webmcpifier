import { parsePublicTarget, WebMcpifierRpcs } from "@webmcpifier/domain";
import type { HttpEffect } from "alchemy/Http";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as EffectHttp from "effect/unstable/http/HttpEffect";
import { HttpServerError } from "effect/unstable/http/HttpServerError";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import {
  ApiInitialization,
  decodeApiEnvironment,
  decodeNativeBindings,
  type ApiEnvironment,
} from "./environment.ts";
import type { InvalidEnvironment } from "./errors.ts";
import { rpcHandlers } from "./handlers.ts";
import {
  ProofTelemetryEvent,
  type ProofTelemetryEvent as ProofTelemetryEventType,
} from "./proof.ts";

const TELEMETRY_PATH = "/proof/events";
const RPC_PATHS = new Set(["/", "/rpc"]);
const MAX_TELEMETRY_BYTES = 8_192;
const strict = { onExcessProperty: "error" } as const;

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

const withCors = (response: Response, origin: string): Response => {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const withRelease = (response: Response, releaseCommit: string): Response => {
  const headers = new Headers(response.headers);
  headers.set("x-webmcpifier-release", releaseCommit);
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const preflight = (origin: string): Response =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-origin": origin,
      "access-control-max-age": "86400",
      vary: "Origin",
    },
  });

const decodeOrigin = async (value: string | null): Promise<string | undefined> => {
  if (value === null) return undefined;
  try {
    const target = await Effect.runPromise(parsePublicTarget(value));
    return value === target.origin ? target.origin : undefined;
  } catch {
    return undefined;
  }
};

const readBoundedJson = async (request: Request): Promise<unknown> => {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_TELEMETRY_BYTES) throw new Error("body_too_large");
  if (request.body === null) throw new Error("body_required");
  const reader = request.body.getReader();
  const chunks: Array<Uint8Array> = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > MAX_TELEMETRY_BYTES) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
};

const telemetry = async (request: Request, environment: ApiEnvironment): Promise<Response> => {
  if (request.method !== "POST") return jsonError("method_not_allowed", 405);
  let event: ProofTelemetryEventType;
  try {
    event = await Schema.decodeUnknownPromise(
      ProofTelemetryEvent,
      strict,
    )(await readBoundedJson(request));
  } catch {
    return jsonError("invalid_event", 400);
  }
  const requestOrigin = await decodeOrigin(request.headers.get("origin"));
  if (requestOrigin !== event.origin) return jsonError("origin_forbidden", 403);
  try {
    const accepted = await environment.PROOF.getByName(event.capabilityId).record(event);
    if (!accepted) return withCors(jsonError("rate_limited", 429), event.origin);
    return withCors(new Response(null, { status: 204 }), event.origin);
  } catch {
    return withCors(jsonError("proof_unavailable", 403), event.origin);
  }
};

const serveRpc = (request: Request, environment: ApiEnvironment): Promise<Response> => {
  const application = Effect.flatten(RpcServer.toHttpEffect(WebMcpifierRpcs)).pipe(
    Effect.provide(Layer.mergeAll(rpcHandlers(environment), RpcSerialization.layerNdjson)),
  );
  return EffectHttp.toWebHandler(application)(request);
};

const dispatch = async (request: Request, environment: ApiEnvironment): Promise<Response> => {
  const url = new URL(request.url);
  if (url.search.length > 0) return jsonError("query_not_allowed", 400);
  const requestOrigin = await decodeOrigin(request.headers.get("origin"));

  if (request.method === "OPTIONS") {
    if (url.pathname === TELEMETRY_PATH && requestOrigin !== undefined)
      return preflight(requestOrigin);
    if (RPC_PATHS.has(url.pathname) && requestOrigin === environment.STUDIO_ORIGIN) {
      return preflight(requestOrigin);
    }
    return jsonError("origin_forbidden", 403);
  }
  if (url.pathname === TELEMETRY_PATH) return telemetry(request, environment);
  if (!RPC_PATHS.has(url.pathname)) return jsonError("not_found", 404);
  if (request.method !== "POST") return jsonError("method_not_allowed", 405);
  if (requestOrigin !== environment.STUDIO_ORIGIN) return jsonError("origin_forbidden", 403);

  try {
    return withCors(await serveRpc(request, environment), environment.STUDIO_ORIGIN);
  } catch {
    return jsonError("service_unavailable", 503);
  }
};

export type ApiHandler = (request: Request) => Promise<Response>;

export const createApiHandler = (input: unknown): Effect.Effect<ApiHandler, InvalidEnvironment> =>
  decodeApiEnvironment(input).pipe(
    Effect.map(
      (environment) => (request: Request) =>
        dispatch(request, environment).then((response) =>
          withRelease(response, environment.RELEASE_COMMIT),
        ),
    ),
  );

export type ApiWorkerFetch = HttpEffect<Cloudflare.Workers.WorkerEnvironment>;
export type ApiWorkerShape = { readonly fetch: ApiWorkerFetch };

export const apiWorkerImpl = (input: unknown): Effect.Effect<ApiWorkerShape, Config.ConfigError> =>
  Effect.gen(function* () {
    const strings = yield* Schema.decodeUnknownEffect(ApiInitialization)(input).pipe(
      Effect.mapError((error) => new Config.ConfigError(error)),
    );
    return {
      fetch: Effect.scoped(
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const webRequest = yield* HttpServerRequest.toWeb(request).pipe(
            Effect.mapError((reason) => new HttpServerError({ reason })),
          );
          const native = yield* decodeNativeBindings({
            ...(yield* Cloudflare.Workers.WorkerEnvironment),
          }).pipe(Effect.orDie);
          const handler = yield* createApiHandler({ ...strings, ...native }).pipe(Effect.orDie);
          const response = yield* Effect.promise(() => handler(webRequest));
          return HttpServerResponse.fromWeb(response);
        }),
      ),
    } satisfies ApiWorkerShape;
  });

export { ApiInitialization, NativeBindings } from "./environment.ts";
