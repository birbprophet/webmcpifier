import {
  AbsoluteHttpsOrigin,
  NonBlankString,
  ReleaseCommit,
  SubresourceIntegrity,
} from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { CapabilityProof } from "./proof-durable-object.ts";
import { InvalidEnvironment } from "./errors.ts";

export interface BrowserSnapshotBinding {
  readonly quickAction: (
    action: "snapshot",
    options: BrowserRunSnapshotOptions,
  ) => Promise<Response>;
}

const hasMethod = (value: unknown, name: PropertyKey): value is object =>
  typeof value === "object" && value !== null && typeof Reflect.get(value, name) === "function";

const BrowserBindingSchema = Schema.declare<BrowserSnapshotBinding>(
  (value): value is BrowserSnapshotBinding => hasMethod(value, "quickAction"),
  { identifier: "webmcpifier/BrowserSnapshotBinding" },
);

const ProofNamespaceSchema = Schema.declare<DurableObjectNamespace<CapabilityProof>>(
  (value): value is DurableObjectNamespace<CapabilityProof> => hasMethod(value, "getByName"),
  { identifier: "webmcpifier/ProofNamespace" },
);

export const ApiInitialization = Schema.Struct({
  API_ORIGIN: AbsoluteHttpsOrigin,
  RELEASE_COMMIT: ReleaseCommit,
  RUNTIME_INTEGRITY: SubresourceIntegrity,
  STUDIO_ORIGIN: AbsoluteHttpsOrigin,
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: NonBlankString,
});
export type ApiInitialization = typeof ApiInitialization.Type;

export const NativeBindings = Schema.Struct({
  BROWSER: BrowserBindingSchema,
  PROOF: ProofNamespaceSchema,
});
export type NativeBindings = typeof NativeBindings.Type;

export const decodeNativeBindings = (
  input: unknown,
): Effect.Effect<NativeBindings, InvalidEnvironment> =>
  Schema.decodeUnknownEffect(NativeBindings)(input).pipe(
    Effect.mapError(
      () => new InvalidEnvironment({ message: "The Worker bindings are incomplete or invalid." }),
    ),
  );

export const ApiEnvironment = Schema.Struct({
  API_ORIGIN: AbsoluteHttpsOrigin,
  BROWSER: BrowserBindingSchema,
  PROOF: ProofNamespaceSchema,
  RELEASE_COMMIT: ReleaseCommit,
  RUNTIME_INTEGRITY: SubresourceIntegrity,
  STUDIO_ORIGIN: AbsoluteHttpsOrigin,
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: NonBlankString,
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
