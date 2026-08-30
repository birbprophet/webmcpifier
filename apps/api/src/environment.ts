import {
  AbsoluteHttpsOrigin,
  ReleaseCommit,
  SubresourceIntegrity,
  ThirdPartyWebMcpOriginTrialToken,
} from "@webmcpifier/domain";
import type { BrowserClient } from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { CapabilityProofNamespace } from "./proof-durable-object.ts";
import { InvalidEnvironment } from "./errors.ts";

export type BrowserSnapshotBinding = Pick<BrowserClient, "snapshot">;

const hasMethod = (value: unknown, name: PropertyKey): value is object =>
  typeof value === "object" && value !== null && typeof Reflect.get(value, name) === "function";

const BrowserBindingSchema = Schema.declare<BrowserSnapshotBinding>(
  (value): value is BrowserSnapshotBinding => hasMethod(value, "snapshot"),
  { identifier: "webmcpifier/BrowserSnapshotBinding" },
);

const ProofNamespaceSchema = Schema.declare<CapabilityProofNamespace>(
  (value): value is CapabilityProofNamespace => hasMethod(value, "getByName"),
  { identifier: "webmcpifier/ProofNamespace" },
);

export const ApiInitialization = Schema.Struct({
  API_ORIGIN: AbsoluteHttpsOrigin,
  RELEASE_COMMIT: ReleaseCommit,
  RUNTIME_INTEGRITY: SubresourceIntegrity,
  STUDIO_ORIGIN: AbsoluteHttpsOrigin,
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: ThirdPartyWebMcpOriginTrialToken,
});
export type ApiInitialization = typeof ApiInitialization.Type;

export const ApiEnvironment = Schema.Struct({
  API_ORIGIN: AbsoluteHttpsOrigin,
  BROWSER: BrowserBindingSchema,
  PROOF: ProofNamespaceSchema,
  RELEASE_COMMIT: ReleaseCommit,
  RUNTIME_INTEGRITY: SubresourceIntegrity,
  STUDIO_ORIGIN: AbsoluteHttpsOrigin,
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: ThirdPartyWebMcpOriginTrialToken,
});
export type ApiEnvironment = typeof ApiEnvironment.Type;

export const decodeApiEnvironment = (
  input: unknown,
): Effect.Effect<ApiEnvironment, InvalidEnvironment> =>
  Schema.decodeUnknownEffect(ApiEnvironment)(input).pipe(
    Effect.mapError(
      () => new InvalidEnvironment({ message: "The Worker environment is incomplete or invalid." }),
    ),
  );
