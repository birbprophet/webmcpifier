import { assert, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import {
  FIRST_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN,
  THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN,
  webMcpOriginTrialTokenFixture,
} from "../../../test/origin-trial-token.ts";
import { DeploymentEnvironment } from "../src/environment.ts";

const validEnvironment = {
  WEBMCPIFIER_API_ORIGIN: "https://api.webmcpifier.com",
  WEBMCPIFIER_DEMO_ORIGIN: "https://demo.webmcpifier.com",
  WEBMCPIFIER_RELEASE_COMMIT: "0123456789abcdef0123456789abcdef01234567",
  WEBMCPIFIER_RUNTIME_INTEGRITY: "sha384-dGVzdA==",
  WEBMCPIFIER_STUDIO_ORIGIN: "https://webmcpifier.com",
  WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: FIRST_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN,
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN,
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

it.effect("rejects malformed, expired, and incorrectly scoped origin-trial tokens", () =>
  Effect.gen(function* () {
    const placeholder = yield* Effect.result(
      DeploymentEnvironment.parse(
        ConfigProvider.fromUnknown({
          ...validEnvironment,
          WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: "test-first-party-token",
        }),
      ),
    );
    const wrongScope = yield* Effect.result(
      DeploymentEnvironment.parse(
        ConfigProvider.fromUnknown({
          ...validEnvironment,
          WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: FIRST_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN,
        }),
      ),
    );
    const expired = yield* Effect.result(
      DeploymentEnvironment.parse(
        ConfigProvider.fromUnknown({
          ...validEnvironment,
          WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: webMcpOriginTrialTokenFixture(false, 1),
        }),
      ),
    );

    assert.isTrue(Result.isFailure(placeholder));
    assert.isTrue(Result.isFailure(wrongScope));
    assert.isTrue(Result.isFailure(expired));
  }),
);
