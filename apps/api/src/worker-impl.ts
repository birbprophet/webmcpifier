import { parsePublicTarget, WebMcpifierRpcs } from "@webmcpifier/domain";
import { remote } from "alchemy";
import type { HttpEffect } from "alchemy/Http";
import { RuntimeContext } from "alchemy/RuntimeContext";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as EffectHttp from "effect/unstable/http/HttpEffect";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { RpcSerialization, RpcServer } from "effect/unstable/rpc";
import {
  ApiEnvironment,
  ApiInitialization,
  decodeApiEnvironment,
  type ApiEnvironment as ApiEnvironmentType,
} from "./environment.ts";
import type { InvalidEnvironment } from "./errors.ts";
import { rpcHandlers } from "./handlers.ts";
import { CapabilityProof } from "./proof-durable-object.ts";
import {
  ProofTelemetryEvent,
  type ProofTelemetryEvent as ProofTelemetryEventType,
} from "./proof.ts";

const TELEMETRY_PATH = "/proof/events";
const RPC_PATHS = new Set(["/", "/rpc", "/rpc/"]);
const MAX_TELEMETRY_BYTES = 8_192;
const TELEMETRY_REQUEST_HEADERS = "content-type";
const RPC_REQUEST_HEADERS = "b3, content-type, traceparent";
const strict = { onExcessProperty: "error" } as const;

const HTTP_STATUS = {
  badRequest: 400,
  forbidden: 403,
  methodNotAllowed: 405,
  notFound: 404,
  rateLimited: 429,
} as const;

const jsonError = (error: string, status: number): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.jsonUnsafe({ error }, { status, headers: { "cache-control": "no-store" } });

const withCors = (
  response: HttpServerResponse.HttpServerResponse,
  origin: string,
): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.setHeaders(response, {
    "access-control-allow-origin": origin,
    vary: "Origin",
  });

const withRelease = (
  response: HttpServerResponse.HttpServerResponse,
  releaseCommit: string,
): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.setHeader(response, "x-webmcpifier-release", releaseCommit);

const preflight = (origin: string, requestHeaders: string): HttpServerResponse.HttpServerResponse =>
  HttpServerResponse.empty({
    headers: {
      "access-control-allow-headers": requestHeaders,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-origin": origin,
      vary: "Origin",
    },
  });

const decodeOrigin = (value: string | undefined): Effect.Effect<string | undefined> => {
  if (value === undefined) return Effect.succeed(undefined);
  return parsePublicTarget(value).pipe(
    Effect.match({
      onFailure: () => undefined,
      onSuccess: (target) => (value === target.origin ? target.origin : undefined),
    }),
  );
};

const readBoundedJson = (
  request: HttpServerRequest.HttpServerRequest,
): Effect.Effect<unknown, Error> =>
  Effect.tryPromise({
    catch: () => new Error("The telemetry body is invalid."),
    try: async () => {
      const declaredLength = Number(request.headers["content-length"] ?? 0);
      if (declaredLength > MAX_TELEMETRY_BYTES || !(request.source instanceof Request)) {
        throw new Error("The telemetry body is too large or unavailable.");
      }
      if (request.source.body === null) throw new Error("The telemetry body is required.");

      const reader = request.source.body.getReader();
      const chunks: Array<Uint8Array> = [];
      let size = 0;
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        size += next.value.byteLength;
        if (size > MAX_TELEMETRY_BYTES) {
          await reader.cancel();
          throw new Error("The telemetry body is too large.");
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
    },
  });

const telemetry = (request: HttpServerRequest.HttpServerRequest, environment: ApiEnvironmentType) =>
  Effect.gen(function* () {
    if (request.method !== "POST") {
      return jsonError("method_not_allowed", HTTP_STATUS.methodNotAllowed);
    }
    const eventOption = yield* readBoundedJson(request).pipe(
      Effect.flatMap((input) => Schema.decodeUnknownEffect(ProofTelemetryEvent)(input, strict)),
      Effect.option,
    );
    if (Option.isNone(eventOption)) return jsonError("invalid_event", HTTP_STATUS.badRequest);

    const event: ProofTelemetryEventType = eventOption.value;
    const requestOrigin = yield* decodeOrigin(request.headers.origin);
    if (requestOrigin !== event.origin) return jsonError("origin_forbidden", HTTP_STATUS.forbidden);

    const accepted = yield* environment.PROOF.getByName(event.capabilityId)
      .record(event)
      .pipe(Effect.option);
    if (Option.isNone(accepted)) {
      return withCors(jsonError("proof_unavailable", HTTP_STATUS.forbidden), event.origin);
    }
    if (!accepted.value) {
      return withCors(jsonError("rate_limited", HTTP_STATUS.rateLimited), event.origin);
    }
    return withCors(HttpServerResponse.empty(), event.origin);
  });

const rpcApplication = (environment: ApiEnvironmentType): ApiWorkerFetch =>
  Effect.flatten(RpcServer.toHttpEffect(WebMcpifierRpcs)).pipe(
    Effect.provide(Layer.mergeAll(rpcHandlers(environment), RpcSerialization.layerNdjson)),
  );

const dispatch = (
  request: HttpServerRequest.HttpServerRequest,
  environment: ApiEnvironmentType,
  rpc: ApiWorkerFetch,
): ApiWorkerFetch =>
  Effect.gen(function* () {
    const url = new URL(request.originalUrl);
    if (url.search.length > 0) return jsonError("query_not_allowed", HTTP_STATUS.badRequest);
    const requestOrigin = yield* decodeOrigin(request.headers.origin);

    if (request.method === "OPTIONS") {
      if (url.pathname === TELEMETRY_PATH && requestOrigin !== undefined) {
        return preflight(requestOrigin, TELEMETRY_REQUEST_HEADERS);
      }
      if (RPC_PATHS.has(url.pathname) && requestOrigin === environment.STUDIO_ORIGIN) {
        return preflight(requestOrigin, RPC_REQUEST_HEADERS);
      }
      return jsonError("origin_forbidden", HTTP_STATUS.forbidden);
    }
    if (url.pathname === TELEMETRY_PATH) return yield* telemetry(request, environment);
    if (!RPC_PATHS.has(url.pathname)) return jsonError("not_found", HTTP_STATUS.notFound);
    if (request.method !== "POST") {
      return jsonError("method_not_allowed", HTTP_STATUS.methodNotAllowed);
    }
    if (requestOrigin !== environment.STUDIO_ORIGIN) {
      return jsonError("origin_forbidden", HTTP_STATUS.forbidden);
    }
    return withCors(yield* rpc, environment.STUDIO_ORIGIN);
  });

export type ApiWorkerFetch = HttpEffect<RuntimeContext>;
export type ApiWorkerShape = { readonly fetch: ApiWorkerFetch };

export const makeApiWorker = (environment: ApiEnvironmentType): ApiWorkerShape => {
  const rpc = rpcApplication(environment);
  return {
    fetch: Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      return withRelease(yield* dispatch(request, environment, rpc), environment.RELEASE_COMMIT);
    }),
  };
};

export type ApiHandler = (request: Request) => Promise<Response>;

export const createApiHandler = (input: unknown): Effect.Effect<ApiHandler, InvalidEnvironment> =>
  decodeApiEnvironment(input).pipe(
    Effect.map((environment) =>
      EffectHttp.toWebHandler(
        makeApiWorker(environment).fetch.pipe(Effect.provide(RuntimeContext.phantom)),
      ),
    ),
  );

export const apiWorkerImpl = (input: unknown) =>
  Effect.gen(function* () {
    const strings = yield* Schema.decodeUnknownEffect(ApiInitialization)(input).pipe(
      Effect.mapError((error) => new Config.ConfigError(error)),
    );
    const browser = yield* Cloudflare.Browser("BROWSER").pipe(remote());
    const proof = yield* CapabilityProof;
    const environment = yield* Schema.decodeUnknownEffect(ApiEnvironment)({
      ...strings,
      BROWSER: browser,
      PROOF: proof,
    }).pipe(Effect.mapError((error) => new Config.ConfigError(error)));
    return makeApiWorker(environment);
  }).pipe(Effect.provide(Cloudflare.Workers.BrowserBinding));

export { ApiInitialization } from "./environment.ts";
