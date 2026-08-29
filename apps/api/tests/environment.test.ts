import { expect, it } from "@effect/vitest";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import { ApiInitialization, decodeApiEnvironment } from "../src/environment.ts";
import { apiWorkerImpl } from "../src/worker-impl.ts";

type WorkerEntry = typeof import("../src/worker.ts");
type Assert<T extends true> = T;
type WorkerEntryHasDefault = Assert<WorkerEntry extends { default: unknown } ? true : false>;

const workerEntryHasDefault: WorkerEntryHasDefault = true;

const validBindings = {
  API_ORIGIN: "https://api.webmcpifier.com",
  RELEASE_COMMIT: "0123456789abcdef0123456789abcdef01234567",
  RUNTIME_INTEGRITY: "sha384-dGVzdA==",
  STUDIO_ORIGIN: "https://webmcpifier.com",
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: "third-party-token",
};

const load = (bindings: unknown) => Schema.decodeUnknownEffect(ApiInitialization)(bindings);

it("retains the default export required by Alchemy's Worker bridge", () => {
  expect(workerEntryHasDefault).toBe(true);
});

it.effect("requires and Schema-decodes every API string binding at initialization", () =>
  Effect.gen(function* () {
    expect(yield* load(validBindings)).toEqual(validBindings);
    const worker = yield* apiWorkerImpl(validBindings);
    expect(Effect.isEffect(worker.fetch)).toBe(true);
    const missing = yield* Effect.exit(load({ ...validBindings, RELEASE_COMMIT: undefined }));
    expect(missing._tag).toBe("Failure");
  }),
);

it.effect("rejects a non-canonical Studio origin", () =>
  Effect.gen(function* () {
    const trailingSlash = yield* Effect.exit(
      load({ ...validBindings, STUDIO_ORIGIN: "https://webmcpifier.com/" }),
    );
    expect(trailingSlash._tag).toBe("Failure");
  }),
);

it.effect("requires both native Worker bindings", () =>
  Effect.gen(function* () {
    const browser = { quickAction: () => Promise.resolve(new Response()) };
    const proof = { getByName: () => ({}) };
    const decoded = yield* decodeApiEnvironment({
      ...validBindings,
      BROWSER: browser,
      PROOF: proof,
    });
    expect(decoded.BROWSER).toBe(browser);
    expect(decoded.PROOF).toBe(proof);

    const missingProof = yield* Effect.exit(
      decodeApiEnvironment({ ...validBindings, BROWSER: browser }),
    );
    expect(missingProof._tag).toBe("Failure");
  }),
);

it.effect("runs the Alchemy HttpEffect through request-scoped native bindings", () =>
  Effect.gen(function* () {
    const worker = yield* apiWorkerImpl(validBindings);
    const response = yield* worker.fetch.pipe(
      Effect.provideService(Cloudflare.Workers.WorkerEnvironment, {
        BROWSER: { quickAction: () => Promise.resolve(new Response()) },
        PROOF: { getByName: () => ({}) },
      }),
      Effect.provideService(
        HttpServerRequest.HttpServerRequest,
        HttpServerRequest.fromWeb(
          new Request("https://api.webmcpifier.com/not-found", {
            headers: { origin: validBindings.STUDIO_ORIGIN },
          }),
        ),
      ),
    );
    expect(response.status).toBe(404);
    expect(response.headers["x-webmcpifier-release"]).toBe(validBindings.RELEASE_COMMIT);
  }),
);
