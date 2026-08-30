import {
  DraftCapability,
  DraftCapabilityChanges,
  NonBlankString,
  ProofSummaryRequest,
  SCAN_LIMITS,
  ScanRequest,
  type ScanResult,
  ToolParameter,
} from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { Subscription } from "foldkit";
import { Message, type Model, ReceiptReference, SAFETY_BOUNDARY } from "./main.ts";
import { getProofSummaryForAgent, inspectSiteForAgent } from "./rpc.ts";

export interface ToolExecuteOptions {
  readonly signal: AbortSignal;
}

export interface ModelContextTool {
  readonly annotations?: {
    readonly readOnlyHint?: boolean;
    readonly untrustedContentHint?: boolean;
  };
  readonly description: string;
  readonly execute: (inputObject: object, options?: ToolExecuteOptions) => Promise<unknown>;
  readonly inputSchema?: Record<string, unknown>;
  readonly name: string;
  readonly title?: string;
}

export interface ModelContext {
  readonly registerTool: (
    tool: ModelContextTool,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<void>;
}

interface WebMcpDocument extends Document {
  readonly modelContext?: ModelContext;
}

const AgentInspectInput = Schema.Struct({
  safety_boundary: ScanRequest.fields.safetyBoundary,
  task: ScanRequest.fields.task,
  url: ScanRequest.fields.url,
});

const AgentToolParameterInput = Schema.Struct({
  control_name: ToolParameter.fields.controlName,
  description: ToolParameter.fields.description,
  kind: ToolParameter.fields.kind,
  name: ToolParameter.fields.name,
  options: ToolParameter.fields.options,
  required: ToolParameter.fields.required,
  title: ToolParameter.fields.title,
});
const AgentToolParametersInput = Schema.Array(AgentToolParameterInput).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(SCAN_LIMITS.controls),
);
const AgentDraftInput = Schema.Struct({
  description: DraftCapability.fields.description,
  form_id: DraftCapability.fields.formId,
  name: DraftCapability.fields.name,
  parameters: AgentToolParametersInput,
  submit_policy: DraftCapability.fields.submitPolicy,
  title: DraftCapability.fields.title,
});
const AgentDraftChangesInput = Schema.Struct({
  description: Schema.optional(AgentDraftInput.fields.description),
  form_id: Schema.optional(AgentDraftInput.fields.form_id),
  name: Schema.optional(AgentDraftInput.fields.name),
  parameters: Schema.optional(AgentDraftInput.fields.parameters),
  submit_policy: Schema.optional(AgentDraftInput.fields.submit_policy),
  title: Schema.optional(AgentDraftInput.fields.title),
});
const EmptyInput = Schema.Record(Schema.String, Schema.Never);
const InstallSkillInput = Schema.Struct({
  stack_hint: Schema.optional(NonBlankString),
});

export const ToolContext = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Inspect") }),
  Schema.Struct({ _tag: Schema.Literal("Define") }),
  Schema.Struct({ _tag: Schema.Literal("Approve") }),
  Schema.Struct({ _tag: Schema.Literal("Install"), installSkill: Schema.String }),
  Schema.Struct({ _tag: Schema.Literal("Prove"), receipt: ReceiptReference }),
]);
export type ToolContext = typeof ToolContext.Type;
type Dispatch = (message: Message) => void;

const executionSignal = (
  options: ToolExecuteOptions | undefined,
  registrationSignal: AbortSignal,
): AbortSignal => options?.signal ?? registrationSignal;

const MODEL_CONTEXT_REGISTRATION_FAILED = "Browser-agent actions could not be registered.";
const AGENT_INSPECTION_FAILED = "The browser-agent inspection failed.";
const AGENT_PROOF_FAILED = "The browser-agent proof refresh failed.";
const STRICT_DECODING = { onExcessProperty: "error" } as const;

const inputSchema = (schema: Schema.Top): Record<string, unknown> => {
  const generated = Schema.toJsonSchemaDocument(schema, { additionalProperties: false });
  return Object.keys(generated.definitions).length === 0
    ? generated.schema
    : { ...generated.schema, $defs: generated.definitions };
};

const decodeInput = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: object,
): S["Type"] => Schema.decodeUnknownSync(schema, STRICT_DECODING)(input);

const parameterFromAgent = (
  input: typeof AgentToolParameterInput.Type,
): typeof ToolParameter.Type => ({
  controlName: input.control_name,
  description: input.description,
  kind: input.kind,
  name: input.name,
  options: input.options,
  required: input.required,
  title: input.title,
});

const draftFromAgent = (input: typeof AgentDraftInput.Type): typeof DraftCapability.Type =>
  Schema.decodeUnknownSync(
    DraftCapability,
    STRICT_DECODING,
  )({
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    description: input.description,
    formId: input.form_id,
    name: input.name,
    parameters: input.parameters.map(parameterFromAgent),
    submitPolicy: input.submit_policy,
    title: input.title,
  });

const changesFromAgent = (
  input: typeof AgentDraftChangesInput.Type,
): typeof DraftCapabilityChanges.Type =>
  Schema.decodeUnknownSync(
    DraftCapabilityChanges,
    STRICT_DECODING,
  )({
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.form_id === undefined ? {} : { formId: input.form_id }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.parameters === undefined
      ? {}
      : { parameters: input.parameters.map(parameterFromAgent) }),
    ...(input.submit_policy === undefined ? {} : { submitPolicy: input.submit_policy }),
    ...(input.title === undefined ? {} : { title: input.title }),
  });

const inventoryOutput = (scan: ScanResult, safetyBoundary: typeof SAFETY_BOUNDARY) => ({
  forms: scan.forms.map((form) => ({
    controls: form.controls.map((control) => ({
      kind: control.kind,
      label: control.label,
      name: control.name,
      options: control.options,
      required: control.required,
    })),
    formId: form.formId,
    title: form.title,
  })),
  page: {
    origin: scan.origin,
    pathname: scan.pathname,
    title: scan.title,
    url: scan.url,
  },
  safety_boundary: safetyBoundary,
});

const inspectTool = (dispatch: Dispatch, registrationSignal: AbortSignal): ModelContextTool => ({
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  description: "Inspect one HTTPS page for supported semantic forms without submitting anything.",
  execute: async (inputObject, options) => {
    const signal = executionSignal(options, registrationSignal);
    signal.throwIfAborted();
    const input = decodeInput(AgentInspectInput, inputObject);
    const request = Schema.decodeUnknownSync(ScanRequest)({
      safetyBoundary: input.safety_boundary,
      task: input.task,
      url: input.url,
    });
    try {
      const scan = await inspectSiteForAgent(request, signal);
      dispatch(Message.CompletedInspection({ scan }));
      return inventoryOutput(scan, input.safety_boundary);
    } catch (cause) {
      signal.throwIfAborted();
      dispatch(Message.FailedInspection({ message: AGENT_INSPECTION_FAILED }));
      throw new Error(AGENT_INSPECTION_FAILED, { cause });
    }
  },
  inputSchema: inputSchema(AgentInspectInput),
  name: "inspect_site",
  title: "Inspect site",
});

const draftTool = (dispatch: Dispatch, registrationSignal: AbortSignal): ModelContextTool => ({
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Draft a complete fill-for-review form tool contract from the visible inventory.",
  execute: async (inputObject, options) => {
    executionSignal(options, registrationSignal).throwIfAborted();
    const draft = draftFromAgent(decodeInput(AgentDraftInput, inputObject));
    dispatch(Message.AgentDraftedCapability({ draft }));
    return { draftReceived: true, publicationCreated: false };
  },
  inputSchema: inputSchema(AgentDraftInput),
  name: "draft_form_tool",
  title: "Draft form tool",
});

const reviseTool = (dispatch: Dispatch, registrationSignal: AbortSignal): ModelContextTool => ({
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Apply supplied changes to the visible form tool draft without publishing it.",
  execute: async (inputObject, options) => {
    executionSignal(options, registrationSignal).throwIfAborted();
    const changes = changesFromAgent(decodeInput(AgentDraftChangesInput, inputObject));
    dispatch(Message.AgentRevisedCapability({ changes }));
    return { publicationCreated: false, revisionReceived: true };
  },
  inputSchema: inputSchema(AgentDraftChangesInput),
  name: "revise_form_tool",
  title: "Revise form tool",
});

const validateTool = (dispatch: Dispatch, registrationSignal: AbortSignal): ModelContextTool => ({
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Validate the visible current draft and stage it for human approval.",
  execute: async (inputObject, options) => {
    executionSignal(options, registrationSignal).throwIfAborted();
    decodeInput(EmptyInput, inputObject);
    dispatch(Message.AgentRequestedValidation());
    return {
      publicationCreated: false,
      safetyBoundary: SAFETY_BOUNDARY,
      validationRequested: true,
    };
  },
  inputSchema: inputSchema(EmptyInput),
  name: "validate_draft",
  title: "Validate draft",
});

const installSkillTool = (
  installSkill: string,
  registrationSignal: AbortSignal,
): ModelContextTool => ({
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  description: "Read the approved repository installation skill exactly as published.",
  execute: async (inputObject, options) => {
    executionSignal(options, registrationSignal).throwIfAborted();
    const input = decodeInput(InstallSkillInput, inputObject);
    return { content: installSkill, filename: "SKILL.md", stackHint: input.stack_hint };
  },
  inputSchema: inputSchema(InstallSkillInput),
  name: "get_install_skill",
  title: "Get install skill",
});

const proofTool = (
  receipt: typeof ReceiptReference.Type,
  dispatch: Dispatch,
  registrationSignal: AbortSignal,
): ModelContextTool => ({
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  description: "Refresh the aggregate proof receipt for this approved capability.",
  execute: async (inputObject, options) => {
    const signal = executionSignal(options, registrationSignal);
    signal.throwIfAborted();
    decodeInput(EmptyInput, inputObject);
    const request = Schema.decodeUnknownSync(ProofSummaryRequest)(receipt);
    try {
      const proof = await getProofSummaryForAgent(request, signal);
      dispatch(Message.CompletedProofSummary({ proof }));
      return proof;
    } catch (cause) {
      signal.throwIfAborted();
      dispatch(Message.FailedProofSummary({ message: AGENT_PROOF_FAILED }));
      throw new Error(AGENT_PROOF_FAILED, { cause });
    }
  },
  inputSchema: inputSchema(EmptyInput),
  name: "get_proof_summary",
  title: "Get proof summary",
});

const toolsFor = (
  context: ToolContext,
  dispatch: Dispatch,
  registrationSignal: AbortSignal,
): ReadonlyArray<ModelContextTool> => {
  switch (context._tag) {
    case "Inspect":
      return [inspectTool(dispatch, registrationSignal)];
    case "Define":
      return [
        draftTool(dispatch, registrationSignal),
        reviseTool(dispatch, registrationSignal),
        validateTool(dispatch, registrationSignal),
      ];
    case "Approve":
      return [reviseTool(dispatch, registrationSignal)];
    case "Install":
      return [installSkillTool(context.installSkill, registrationSignal)];
    case "Prove":
      return [proofTool(context.receipt, dispatch, registrationSignal)];
  }
};

const toolContext = (model: Model): ToolContext => {
  switch (model.state._tag) {
    case "Inspect":
      return { _tag: "Inspect" };
    case "Define":
      return { _tag: "Define" };
    case "Approve":
      return { _tag: "Approve" };
    case "Install":
      return { _tag: "Install", installSkill: model.state.published.installSkill };
    case "Prove":
      return { _tag: "Prove", receipt: model.state.receipt };
  }
};

export interface StateToolRegistration {
  readonly controller: AbortController;
  readonly ready: Promise<void>;
}

export const registerStateTools = (
  context: ToolContext,
  modelContext: ModelContext | undefined,
  dispatch: Dispatch,
): StateToolRegistration => {
  const controller = new AbortController();
  if (modelContext === undefined) {
    return { controller, ready: Promise.resolve() };
  }
  const ready = Promise.all(
    toolsFor(context, dispatch, controller.signal).map((tool) =>
      modelContext.registerTool(tool, { signal: controller.signal }),
    ),
  )
    .then(() => undefined)
    .catch(() => {
      if (controller.signal.aborted) {
        return;
      }
      controller.abort();
      dispatch(
        Message.FailedModelContextRegistration({
          message: MODEL_CONTEXT_REGISTRATION_FAILED,
        }),
      );
    });
  return { controller, ready };
};

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  modelContextTools: entry(
    { context: ToolContext },
    {
      modelToDependencies: (model) => ({ context: toolContext(model) }),
      dependenciesToStream: ({ context }) =>
        Stream.callback<Message>((queue) =>
          Effect.acquireRelease(
            Effect.sync(() =>
              registerStateTools(context, (document as WebMcpDocument).modelContext, (message) => {
                Queue.offerUnsafe(queue, message);
              }),
            ),
            (registration) => Effect.sync(() => registration.controller.abort()),
          ).pipe(
            Effect.tap((registration) => Effect.promise(() => registration.ready)),
            Effect.flatMap(() => Effect.never),
          ),
        ),
    },
  ),
}));
