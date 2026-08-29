import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { DeploymentEnvironment } from "../src/environment.ts";

const validEnvironment = {
  WEBMCPIFIER_API_ORIGIN: "https://api.webmcpifier.com",
  WEBMCPIFIER_DEMO_ORIGIN: "https://demo.webmcpifier.com",
  WEBMCPIFIER_RELEASE_COMMIT: "0123456789abcdef0123456789abcdef01234567",
  WEBMCPIFIER_RUNTIME_INTEGRITY: "sha384-dGVzdA==",
  WEBMCPIFIER_STUDIO_ORIGIN: "https://webmcpifier.com",
  WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: "first-party-token",
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: "third-party-token",
};

it.effect("decodes every required deployment input", () =>
  Effect.gen(function* () {
    const environment = yield* DeploymentEnvironment.parse(
      ConfigProvider.fromUnknown(validEnvironment),
    );
    assert.strictEqual(environment.WEBMCPIFIER_API_ORIGIN, validEnvironment.WEBMCPIFIER_API_ORIGIN);
    assert.strictEqual(
      environment.WEBMCPIFIER_RELEASE_COMMIT,
      validEnvironment.WEBMCPIFIER_RELEASE_COMMIT,
    );
  }),
);

it.effect("fails when any deployment input is absent", () =>
  Effect.gen(function* () {
    const missingToken = { ...validEnvironment } as Record<string, unknown>;
    delete missingToken.WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN;
    const result = yield* Effect.result(
      DeploymentEnvironment.parse(ConfigProvider.fromUnknown(missingToken)),
    );
    assert.isTrue(Result.isFailure(result));
  }),
);
