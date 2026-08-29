import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CAPABILITY_CONFIG_VERSION, RUNTIME_PATH, RUNTIME_VERSION } from "./constants.ts";
import { DraftRejected } from "./errors.ts";
import {
  CapabilityConfig,
  DraftCapability,
  PublicationInputs,
  PublishedCapability,
  ScanResult,
  type SemanticForm,
} from "./schema.ts";

const textEncoder = new TextEncoder();

export const canonicalFormSignature = (form: Omit<SemanticForm, "fingerprint">): string =>
  [
    form.formId,
    ...form.controls.map((control) =>
      [
        control.name,
        control.kind,
        control.required ? "required" : "optional",
        control.options.join(","),
      ].join(":"),
    ),
  ].join("|");

export const sha256Hex = (value: string): Effect.Effect<string> =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", textEncoder.encode(value))).pipe(
    Effect.map((bytes) =>
      Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join(""),
    ),
  );

const encodeBase64Url = (value: string): string =>
  btoa(String.fromCodePoint(...textEncoder.encode(value)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const inputSchemaFor = (config: CapabilityConfig): Readonly<Record<string, unknown>> => ({
  additionalProperties: false,
  properties: Object.fromEntries(
    config.tool.parameters.map((parameter) => [
      parameter.name,
      {
        description: parameter.description,
        ...(parameter.kind === "email" ? { format: "email" } : {}),
        ...(parameter.options.length > 0 ? { enum: parameter.options } : {}),
        title: parameter.title,
        type: "string",
      },
    ]),
  ),
  required: config.tool.parameters
    .filter((parameter) => parameter.required)
    .map((parameter) => parameter.name),
  type: "object",
});

const renderInstallSkill = (
  scriptTag: string,
  receiptUrl: string,
  config: CapabilityConfig,
): string => `---
name: install-webmcpifier-capability
description: Add the approved ${config.tool.name} WebMCP capability to ${config.target.origin}${config.target.pathname}.
---

# Install the approved WebMCP capability

Add exactly this tag to the HTML shell that serves ${config.target.pathname}:

\`\`\`html
${scriptTag}
\`\`\`

Keep the existing framework and deployment process. Locate the serving HTML shell, make this one source edit, run the project's existing checks, and deploy with its existing command.

Expected tool: \`${config.tool.name}\`

\`\`\`json
${JSON.stringify(inputSchemaFor(config), undefined, 2)}
\`\`\`

Stop and ask the user if the page origin or path differs, the form no longer has id or name \`${config.target.formId}\`, the repository has more than one plausible HTML shell, or deployment would require changing infrastructure.

After deployment, revisit ${config.target.origin}${config.target.pathname}. Confirm that \`${config.tool.name}\` has exactly the schema above. Then ask the browser agent: "Call ${config.tool.name} with obviously fictional values. Confirm the form is filled for review, focus is on Review request, and nothing was submitted."

Proof receipt: ${receiptUrl}
`;

export const publishCapability = (
  untrustedScan: unknown,
  untrustedDraft: unknown,
  untrustedInputs: unknown,
): Effect.Effect<PublishedCapability, DraftRejected> =>
  Effect.gen(function* () {
    const [scan, draft, inputs] = yield* Effect.all([
      Schema.decodeUnknownEffect(ScanResult)(untrustedScan),
      Schema.decodeUnknownEffect(DraftCapability)(untrustedDraft),
      Schema.decodeUnknownEffect(PublicationInputs)(untrustedInputs),
    ]).pipe(
      Effect.mapError(() => new DraftRejected({ message: "The publication request is invalid." })),
    );
    const form = scan.forms.find((candidate) => candidate.formId === draft.formId);
    if (form === undefined) {
      return yield* new DraftRejected({ message: "Choose a form from the current inspection." });
    }
    const controls = new Map(form.controls.map((control) => [control.name, control]));
    const hasInvalidBinding = draft.parameters.some((parameter) => {
      const control = controls.get(parameter.controlName);
      return control === undefined || control.kind !== parameter.kind;
    });
    if (hasInvalidBinding) {
      return yield* new DraftRejected({
        message: "One or more parameters no longer match the inspected form.",
      });
    }
    const config = yield* Schema.decodeUnknownEffect(CapabilityConfig)({
      capabilityId: inputs.capabilityId,
      proof: {
        endpoint: `${inputs.apiOrigin}/proof/events`,
        writeToken: inputs.writeToken,
      },
      runtime: {
        originTrialToken: inputs.originTrialToken,
        version: RUNTIME_VERSION,
      },
      target: {
        fingerprint: form.fingerprint,
        formId: form.formId,
        origin: scan.origin,
        pathname: scan.pathname,
      },
      tool: draft,
      version: CAPABILITY_CONFIG_VERSION,
    }).pipe(
      Effect.mapError(() => new DraftRejected({ message: "The approved contract is invalid." })),
    );
    const encodedConfig = encodeBase64Url(JSON.stringify(config));
    const scriptTag = `<script src="${inputs.studioOrigin}${RUNTIME_PATH}" data-webmcpifier="${encodedConfig}" integrity="${inputs.runtimeIntegrity}" crossorigin="anonymous" defer></script>`;
    const capabilityHash = yield* sha256Hex(JSON.stringify(config));
    const receiptUrl = `${inputs.studioOrigin}/receipt/${inputs.capabilityId}#${inputs.readToken}`;
    return yield* Schema.decodeUnknownEffect(PublishedCapability)({
      capabilityHash,
      config,
      installSkill: renderInstallSkill(scriptTag, receiptUrl, config),
      receiptUrl,
      scriptTag,
    }).pipe(
      Effect.mapError(
        () => new DraftRejected({ message: "The installation artifact is invalid." }),
      ),
    );
  });
