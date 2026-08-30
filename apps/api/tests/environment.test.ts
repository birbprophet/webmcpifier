import { expect, it } from "@effect/vitest";
import { RuntimeContext } from "alchemy/RuntimeContext";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import { THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN } from "../../../test/origin-trial-token.ts";
import { ApiInitialization, decodeApiEnvironment } from "../src/environment.ts";
import { makeApiWorker } from "../src/worker-impl.ts";

type WorkerEntry = typeof import("../src/worker.ts");
type Assert<T extends true> = T;
type WorkerEntryHasDefault = Assert<WorkerEntry extends { default: unknown } ? true : false>;

const workerEntryHasDefault: WorkerEntryHasDefault = true;

const validBindings = {
  API_ORIGIN: "https://api.webmcpifier.com",
  RELEASE_COMMIT: "0123456789abcdef0123456789abcdef01234567",
  RUNTIME_INTEGRITY: "sha384-dGVzdA==",
  STUDIO_ORIGIN: "https://www.webmcpifier.com",
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN,
};

const load = (bindings: unknown) => Schema.decodeUnknownEffect(ApiInitialization)(bindings);

it("retains the default export required by Alchemy's Worker bridge", () => {
  expect(workerEntryHasDefault).toBe(true);
});

it.effect("requires and Schema-decodes every API string binding at initialization", () =>
  Effect.gen(function* () {
    expect(yield* load(validBindings)).toEqual(validBindings);
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
    const browser = { snapshot: () => Effect.die("not used") };
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

it.effect("runs the direct Alchemy HttpEffect with its decoded environment", () =>
  Effect.gen(function* () {
    const worker = makeApiWorker(
      yield* decodeApiEnvironment({
        ...validBindings,
        BROWSER: { snapshot: () => Effect.die("not used") },
        PROOF: { getByName: () => ({}) },
      }),
    );
    const response = yield* worker.fetch.pipe(
      Effect.provide(RuntimeContext.phantom),
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
