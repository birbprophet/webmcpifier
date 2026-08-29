import {
  DraftCapability,
  NonBlankString,
  ProofSummaryRequest,
  ScanRequest,
  type ScanResult,
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
  readonly execute: (inputObject: object, options: ToolExecuteOptions) => Promise<unknown>;
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
  task: ScanRequest.fields.task,
  url: ScanRequest.fields.url,
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

const MODEL_CONTEXT_REGISTRATION_FAILED = "Browser-agent actions could not be registered.";
const AGENT_INSPECTION_FAILED = "The browser-agent inspection failed.";
const AGENT_PROOF_FAILED = "The browser-agent proof refresh failed.";

const inputSchema = (schema: Schema.Top): Record<string, unknown> => {
  const generated = Schema.toJsonSchemaDocument(schema, { additionalProperties: false });
  return Object.keys(generated.definitions).length === 0
    ? generated.schema
    : { ...generated.schema, $defs: generated.definitions };
};

const decodeInput = <S extends Schema.ConstraintDecoder<unknown>>(
  schema: S,
  input: object,
): S["Type"] => Schema.decodeUnknownSync(schema)(input);

const inventoryOutput = (scan: ScanResult) => ({
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
});

const inspectTool = (dispatch: Dispatch): ModelContextTool => ({
  annotations: { readOnlyHint: false, untrustedContentHint: true },
  description: "Inspect one HTTPS page for supported semantic forms without submitting anything.",
  execute: async (inputObject, options) => {
    const input = decodeInput(AgentInspectInput, inputObject);
    const request = Schema.decodeUnknownSync(ScanRequest)({
      safetyBoundary: SAFETY_BOUNDARY,
      task: input.task,
      url: input.url,
    });
    try {
      const scan = await inspectSiteForAgent(request, options.signal);
      dispatch(Message.CompletedInspection({ scan }));
      return inventoryOutput(scan);
    } catch (cause) {
      options.signal.throwIfAborted();
      dispatch(Message.FailedInspection({ message: AGENT_INSPECTION_FAILED }));
      throw new Error(AGENT_INSPECTION_FAILED, { cause });
    }
  },
  inputSchema: inputSchema(AgentInspectInput),
  name: "inspect_site",
  title: "Inspect site",
});

const draftTool = (dispatch: Dispatch): ModelContextTool => ({
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Draft a complete fill-for-review form tool contract from the visible inventory.",
  execute: async (inputObject, options) => {
    options.signal.throwIfAborted();
    const draft = decodeInput(DraftCapability, inputObject);
    dispatch(Message.AgentDraftedCapability({ draft }));
    return { draftAccepted: true, publicationCreated: false };
  },
  inputSchema: inputSchema(DraftCapability),
  name: "draft_form_tool",
  title: "Draft form tool",
});

const reviseTool = (dispatch: Dispatch): ModelContextTool => ({
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Replace the current form tool draft with a complete revised contract.",
  execute: async (inputObject, options) => {
    options.signal.throwIfAborted();
    const draft = decodeInput(DraftCapability, inputObject);
    dispatch(Message.AgentRevisedCapability({ draft }));
    return { publicationCreated: false, revisionAccepted: true };
  },
  inputSchema: inputSchema(DraftCapability),
  name: "revise_form_tool",
  title: "Revise form tool",
});

const validateTool = (dispatch: Dispatch): ModelContextTool => ({
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Validate a complete form tool draft and stage it for human approval.",
  execute: async (inputObject, options) => {
    options.signal.throwIfAborted();
    const draft = decodeInput(DraftCapability, inputObject);
    dispatch(Message.AgentValidatedCapability({ draft }));
    return {
      publicationCreated: false,
      safetyBoundary: SAFETY_BOUNDARY,
      reviewRequested: true,
    };
  },
  inputSchema: inputSchema(DraftCapability),
  name: "validate_draft",
  title: "Validate draft",
});

const installSkillTool = (installSkill: string): ModelContextTool => ({
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  description: "Read the approved repository installation skill exactly as published.",
  execute: async (inputObject, options) => {
    options.signal.throwIfAborted();
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
): ModelContextTool => ({
  annotations: { readOnlyHint: true, untrustedContentHint: false },
  description: "Refresh the aggregate proof receipt for this approved capability.",
  execute: async (inputObject, options) => {
    decodeInput(EmptyInput, inputObject);
    const request = Schema.decodeUnknownSync(ProofSummaryRequest)(receipt);
    try {
      const proof = await getProofSummaryForAgent(request, options.signal);
      dispatch(Message.CompletedProofSummary({ proof }));
      return proof;
    } catch (cause) {
      options.signal.throwIfAborted();
      dispatch(Message.FailedProofSummary({ message: AGENT_PROOF_FAILED }));
      throw new Error(AGENT_PROOF_FAILED, { cause });
    }
  },
  inputSchema: inputSchema(EmptyInput),
  name: "get_proof_summary",
  title: "Get proof summary",
});

const toolsFor = (context: ToolContext, dispatch: Dispatch): ReadonlyArray<ModelContextTool> => {
  switch (context._tag) {
    case "Inspect":
      return [inspectTool(dispatch)];
    case "Define":
      return [draftTool(dispatch), reviseTool(dispatch), validateTool(dispatch)];
    case "Approve":
      return [reviseTool(dispatch)];
    case "Install":
      return [installSkillTool(context.installSkill)];
    case "Prove":
      return [proofTool(context.receipt, dispatch)];
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
    toolsFor(context, dispatch).map((tool) =>
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
