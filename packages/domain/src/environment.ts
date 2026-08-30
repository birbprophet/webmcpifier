import * as Config from "effect/Config";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  AbsoluteHttpsOrigin,
  FirstPartyWebMcpOriginTrialToken,
  NonBlankString,
  SubresourceIntegrity,
  ThirdPartyWebMcpOriginTrialToken,
} from "./schema.ts";

export const ReleaseCommit = NonBlankString.check(
  Schema.makeFilter((value: string) => /^[0-9a-f]{40}$/u.test(value), {
    identifier: "webmcpifier/ReleaseCommit",
    message: "a full lowercase Git SHA-1",
  }),
);

export const DeploymentEnvironment = Config.all({
  WEBMCPIFIER_API_ORIGIN: Config.schema(AbsoluteHttpsOrigin, "WEBMCPIFIER_API_ORIGIN"),
  WEBMCPIFIER_DEMO_ORIGIN: Config.schema(AbsoluteHttpsOrigin, "WEBMCPIFIER_DEMO_ORIGIN"),
  WEBMCPIFIER_RELEASE_COMMIT: Config.schema(ReleaseCommit, "WEBMCPIFIER_RELEASE_COMMIT"),
  WEBMCPIFIER_RUNTIME_INTEGRITY: Config.schema(
    SubresourceIntegrity,
    "WEBMCPIFIER_RUNTIME_INTEGRITY",
  ),
  WEBMCPIFIER_STUDIO_ORIGIN: Config.schema(AbsoluteHttpsOrigin, "WEBMCPIFIER_STUDIO_ORIGIN"),
  WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: Config.schema(
    FirstPartyWebMcpOriginTrialToken,
    "WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN",
  ),
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: Config.schema(
    ThirdPartyWebMcpOriginTrialToken,
    "WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN",
  ),
});

export type DeploymentEnvironment = Effect.Success<typeof DeploymentEnvironment>;
