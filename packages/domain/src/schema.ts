import * as Schema from "effect/Schema";
import {
  CAPABILITY_CONFIG_VERSION,
  HTML_NAME_PATTERN,
  RUNTIME_VERSION,
  SCAN_LIMITS,
  TOOL_LIMITS,
  WEBMCP_TOOL_NAME_PATTERN,
} from "./constants.ts";

const nonBlank = (identifier: string) =>
  Schema.makeFilter((value: string) => value.trim().length > 0, {
    identifier,
    message: "a non-blank string",
  });

const matches = (pattern: RegExp, identifier: string, message: string) =>
  Schema.makeFilter((value: string) => pattern.test(value), {
    identifier,
    message,
  });

export const NonBlankString = Schema.String.check(nonBlank("webmcpifier/NonBlankString"));

const absoluteUrl = Schema.makeFilter(
  (value: string) => {
    try {
      return new URL(value).toString().length > 0;
    } catch {
      return false;
    }
  },
  {
    identifier: "webmcpifier/AbsoluteUrl",
    message: "an absolute URL",
  },
);

const absoluteHttpsOrigin = Schema.makeFilter(
  (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.origin === value;
    } catch {
      return false;
    }
  },
  {
    identifier: "webmcpifier/AbsoluteHttpsOrigin",
    message: "an HTTPS origin without a path",
  },
);

export const AbsoluteUrl = NonBlankString.check(absoluteUrl);
export const AbsoluteHttpsOrigin = NonBlankString.check(absoluteHttpsOrigin);
export const Pathname = NonBlankString.check(
  Schema.makeFilter((value: string) => value.startsWith("/"), {
    identifier: "webmcpifier/Pathname",
    message: "an absolute URL pathname",
  }),
);
export const OpaqueToken = NonBlankString.check(
  matches(/^[A-Za-z0-9_-]+$/u, "webmcpifier/OpaqueToken", "an opaque URL-safe token"),
);
export const SubresourceIntegrity = NonBlankString.check(
  matches(
    /^sha384-[A-Za-z0-9+/]+={0,2}$/u,
    "webmcpifier/SubresourceIntegrity",
    "a SHA-384 subresource integrity value",
  ),
);
export const Sha256Hex = Schema.String.check(
  matches(/^[0-9a-f]{64}$/u, "webmcpifier/Sha256Hex", "a lowercase SHA-256 digest"),
);

export const ToolName = NonBlankString.check(
  Schema.isMaxLength(TOOL_LIMITS.name),
  matches(
    WEBMCP_TOOL_NAME_PATTERN,
    "webmcpifier/ToolName",
    "letters, numbers, underscore, dash, or dot",
  ),
);
export type ToolName = typeof ToolName.Type;

export const ParameterName = NonBlankString.check(
  Schema.isMaxLength(TOOL_LIMITS.parameterName),
  matches(HTML_NAME_PATTERN, "webmcpifier/ParameterName", "a stable HTML-compatible name"),
);
export type ParameterName = typeof ParameterName.Type;

export const ToolDescription = NonBlankString.check(Schema.isMaxLength(TOOL_LIMITS.description));

export const ParameterDescription = NonBlankString.check(
  Schema.isMaxLength(TOOL_LIMITS.parameterDescription),
);

export const ControlKind = Schema.Literals(["text", "email", "tel", "textarea", "select", "radio"]);
export type ControlKind = typeof ControlKind.Type;

export const SubmitPolicy = Schema.Literals(["fill_for_review"]);
export type SubmitPolicy = typeof SubmitPolicy.Type;

export const ToolAnnotations = Schema.Struct({
  readOnlyHint: Schema.Literal(false),
  untrustedContentHint: Schema.Literal(false),
});
export type ToolAnnotations = typeof ToolAnnotations.Type;

const InventoryText = NonBlankString.check(Schema.isMaxLength(TOOL_LIMITS.description));

const uniqueStrings = Schema.makeFilter(
  (values: ReadonlyArray<string>) => new Set(values).size === values.length,
  {
    identifier: "webmcpifier/UniqueStrings",
    message: "unique values",
  },
);

export const SemanticControl = Schema.Struct({
  kind: ControlKind,
  label: InventoryText,
  name: ParameterName,
  options: Schema.Array(NonBlankString).check(
    Schema.isMaxLength(SCAN_LIMITS.controls),
    uniqueStrings,
  ),
  required: Schema.Boolean,
});
export type SemanticControl = typeof SemanticControl.Type;

const uniqueControlNames = Schema.makeFilter(
  (controls: ReadonlyArray<SemanticControl>) =>
    new Set(controls.map(({ name }) => name)).size === controls.length,
  {
    identifier: "webmcpifier/UniqueControlNames",
    message: "unique control names",
  },
);

export const SemanticForm = Schema.Struct({
  controls: Schema.Array(SemanticControl).check(
    Schema.isMaxLength(SCAN_LIMITS.controls),
    uniqueControlNames,
  ),
  fingerprint: Sha256Hex,
  formId: ParameterName,
  title: InventoryText,
});
export type SemanticForm = typeof SemanticForm.Type;

const uniqueFormIds = Schema.makeFilter(
  (forms: ReadonlyArray<SemanticForm>) =>
    new Set(forms.map(({ formId }) => formId)).size === forms.length,
  {
    identifier: "webmcpifier/UniqueFormIds",
    message: "unique form identifiers",
  },
);

export const ScanRequest = Schema.Struct({
  safetyBoundary: SubmitPolicy,
  task: NonBlankString.check(Schema.isMaxLength(TOOL_LIMITS.description)),
  url: NonBlankString,
});
export type ScanRequest = typeof ScanRequest.Type;

export const ScanResult = Schema.Struct({
  forms: Schema.Array(SemanticForm).check(Schema.isMaxLength(SCAN_LIMITS.forms), uniqueFormIds),
  origin: AbsoluteHttpsOrigin,
  pathname: Pathname,
  screenshotDataUrl: NonBlankString.check(
    Schema.isMaxLength(Math.ceil((SCAN_LIMITS.pageBytes * 4) / 3) + 32),
    matches(
      /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/u,
      "webmcpifier/ScreenshotDataUrl",
      "a bounded JPEG or PNG data URL",
    ),
  ),
  title: InventoryText,
  url: AbsoluteUrl,
});
export type ScanResult = typeof ScanResult.Type;

export const ToolParameter = Schema.Struct({
  controlName: ParameterName,
  description: ParameterDescription,
  kind: ControlKind,
  name: ParameterName,
  options: Schema.Array(NonBlankString).check(
    Schema.isMaxLength(SCAN_LIMITS.controls),
    uniqueStrings,
  ),
  required: Schema.Boolean,
  title: InventoryText,
});
export type ToolParameter = typeof ToolParameter.Type;

const uniqueToolBindings = Schema.makeFilter(
  (parameters: ReadonlyArray<ToolParameter>) =>
    new Set(parameters.map(({ name }) => name)).size === parameters.length &&
    new Set(parameters.map(({ controlName }) => controlName)).size === parameters.length,
  {
    identifier: "webmcpifier/UniqueToolBindings",
    message: "unique parameter and control bindings",
  },
);

const ToolParameters = Schema.Array(ToolParameter).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(SCAN_LIMITS.controls),
  uniqueToolBindings,
);

export const DraftCapability = Schema.Struct({
  annotations: ToolAnnotations,
  description: ToolDescription,
  formId: ParameterName,
  name: ToolName,
  parameters: ToolParameters,
  submitPolicy: SubmitPolicy,
  title: InventoryText,
});
export type DraftCapability = typeof DraftCapability.Type;

export const CapabilityConfig = Schema.Struct({
  capabilityId: OpaqueToken,
  proof: Schema.Struct({
    endpoint: AbsoluteUrl,
    writeToken: OpaqueToken,
  }),
  runtime: Schema.Struct({
    originTrialToken: NonBlankString,
    version: Schema.Literal(RUNTIME_VERSION),
  }),
  target: Schema.Struct({
    fingerprint: Sha256Hex,
    formId: ParameterName,
    origin: AbsoluteHttpsOrigin,
    pathname: Pathname,
  }),
  tool: Schema.Struct({
    annotations: ToolAnnotations,
    description: ToolDescription,
    name: ToolName,
    parameters: ToolParameters,
    submitPolicy: SubmitPolicy,
    title: InventoryText,
  }),
  version: Schema.Literal(CAPABILITY_CONFIG_VERSION),
});
export type CapabilityConfig = typeof CapabilityConfig.Type;

export const PublicationInputs = Schema.Struct({
  apiOrigin: AbsoluteHttpsOrigin,
  capabilityId: OpaqueToken,
  originTrialToken: NonBlankString,
  readToken: OpaqueToken,
  runtimeIntegrity: SubresourceIntegrity,
  studioOrigin: AbsoluteHttpsOrigin,
  writeToken: OpaqueToken,
});
export type PublicationInputs = typeof PublicationInputs.Type;

export const PublicTarget = Schema.Struct({
  origin: AbsoluteHttpsOrigin,
  pathname: Pathname,
  url: AbsoluteUrl,
});
export type PublicTarget = typeof PublicTarget.Type;

export const PublishedCapability = Schema.Struct({
  capabilityHash: Sha256Hex,
  config: CapabilityConfig,
  installSkill: NonBlankString,
  receiptUrl: NonBlankString,
  scriptTag: NonBlankString,
});
export type PublishedCapability = typeof PublishedCapability.Type;

export const LatencyBuckets = Schema.Struct({
  atMost100Ms: Schema.Natural,
  atMost300Ms: Schema.Natural,
  atMost1000Ms: Schema.Natural,
  atMost3000Ms: Schema.Natural,
  over3000Ms: Schema.Natural,
});
export type LatencyBuckets = typeof LatencyBuckets.Type;

export const ProofSummary = Schema.Struct({
  aborts: Schema.Natural,
  capabilityHash: Sha256Hex,
  failures: Schema.Natural,
  invocations: Schema.Natural,
  lastSeenAt: Schema.String,
  latency: LatencyBuckets,
  origin: AbsoluteHttpsOrigin,
  runtimeVersion: NonBlankString,
  successes: Schema.Natural,
});
export type ProofSummary = typeof ProofSummary.Type;

export const ProofOutcome = Schema.Literals(["success", "failure", "abort"]);
export type ProofOutcome = typeof ProofOutcome.Type;

export const ProofEvent = Schema.Struct({
  capabilityHash: Sha256Hex,
  capabilityId: OpaqueToken,
  latencyMs: Schema.Number.check(Schema.isGreaterThanOrEqualTo(0)),
  origin: AbsoluteHttpsOrigin,
  outcome: ProofOutcome,
  runtimeVersion: NonBlankString,
  writeToken: OpaqueToken,
});
export type ProofEvent = typeof ProofEvent.Type;

export const PublishCapabilityRequest = Schema.Struct({
  draft: DraftCapability,
  scan: ScanResult,
});
export type PublishCapabilityRequest = typeof PublishCapabilityRequest.Type;

export const ProofSummaryRequest = Schema.Struct({
  capabilityId: OpaqueToken,
  readToken: OpaqueToken,
});
export type ProofSummaryRequest = typeof ProofSummaryRequest.Type;
