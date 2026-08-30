import type { Success } from "effect/Layer";
import {
  ControlKind,
  DraftCapability,
  DraftCapabilityChanges,
  formForDraft,
  NonBlankString,
  ParameterName,
  ProofSummary,
  PublishedCapability,
  ScanRequest,
  ScanResult,
  type SemanticForm,
  type ToolParameter,
} from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type * as Scope from "effect/Scope";
import { Command } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import type { Update } from "foldkit";
import {
  getProofSummaryEffect,
  inspectSiteEffect,
  publishCapabilityEffect,
  studioRpcLayer,
} from "./rpc.ts";
import { studioEnvironment } from "./environment.ts";

export const SAFETY_BOUNDARY = "fill_for_review" as const;
export const SAFETY_GUARANTEE = "Fills the form for review. Never submits it.";
export const DEFAULT_TARGET_URL = studioEnvironment.VITE_DEMO_ORIGIN;
export const DEFAULT_TASK =
  "Prepare a Northstar service quote and leave it ready for human review.";

const DEFAULT_TOOL_NAME = "fill_form";
const DEFAULT_TOOL_TITLE = "Fill this form";
const DEFAULT_TOOL_DESCRIPTION =
  "Fill the approved form with supplied values and leave it for human review.";
const DEFAULT_PARAMETER_TITLE = "Form value";
const DEFAULT_PARAMETER_DESCRIPTION = "Value for the approved form control.";
const INSPECTION_FAILED = "The site could not be inspected.";
const PUBLICATION_FAILED = "The approved capability could not be published.";
const PROOF_FAILED = "The proof receipt is not available yet.";
const COPY_FAILED = "The artifact could not be copied. Select the text and copy it manually.";
const DRAFT_INVALID = "Review the contract fields and keep every parameter bound to this form.";
const NO_FORMS_FOUND = "No supported semantic forms were found on this page.";
const SKILL_FILENAME = "SKILL.md";

const DraftParameterEditor = Schema.Struct({
  controlName: ParameterName,
  description: Schema.String,
  kind: ControlKind,
  name: ParameterName,
  options: Schema.Array(Schema.String),
  required: Schema.Boolean,
  title: Schema.String,
});

export const DraftEditor = Schema.Struct({
  annotations: Schema.Struct({
    readOnlyHint: Schema.Boolean,
    untrustedContentHint: Schema.Boolean,
  }),
  description: Schema.String,
  formId: ParameterName,
  name: Schema.String,
  parameters: Schema.Array(DraftParameterEditor),
  submitPolicy: Schema.Literal(SAFETY_BOUNDARY),
  title: Schema.String,
});
export type DraftEditor = typeof DraftEditor.Type;

const InspectState = Schema.Struct({
  _tag: Schema.Literal("Inspect"),
  error: Schema.Option(Schema.String),
  status: Schema.Literals(["idle", "inspecting"]),
  targetUrl: Schema.String,
  task: Schema.String,
});

const DefineState = Schema.Struct({
  _tag: Schema.Literal("Define"),
  draft: DraftEditor,
  error: Schema.Option(Schema.String),
  scan: ScanResult,
});

const ApproveState = Schema.Struct({
  _tag: Schema.Literal("Approve"),
  draft: DraftCapability,
  error: Schema.Option(Schema.String),
  scan: ScanResult,
  status: Schema.Literals(["idle", "publishing"]),
});

const InstallState = Schema.Struct({
  _tag: Schema.Literal("Install"),
  copied: Schema.Literals(["none", "tag", "skill"]),
  error: Schema.Option(Schema.String),
  published: PublishedCapability,
  savedSkill: Schema.Boolean,
});

export const ReceiptReference = Schema.Struct({
  capabilityId: NonBlankString,
  readToken: NonBlankString,
});
export type ReceiptReference = typeof ReceiptReference.Type;

const ProveState = Schema.Struct({
  _tag: Schema.Literal("Prove"),
  error: Schema.Option(Schema.String),
  proof: Schema.Option(ProofSummary),
  published: Schema.Option(PublishedCapability),
  receipt: ReceiptReference,
  status: Schema.Literals(["idle", "loading"]),
});

export const StudioState = Schema.Union([
  InspectState,
  DefineState,
  ApproveState,
  InstallState,
  ProveState,
]);
export type StudioState = typeof StudioState.Type;

export const Model = Schema.Struct({ state: StudioState });
export type Model = typeof Model.Type;

export const StudioFlags = Schema.Union([
  Schema.Struct({ _tag: Schema.Literal("Studio") }),
  Schema.Struct({ _tag: Schema.Literal("Receipt"), receipt: ReceiptReference }),
]);
export type StudioFlags = typeof StudioFlags.Type;

export const Message = defineMessageUnion({
  AgentDraftedCapability: { draft: DraftCapability },
  AgentRequestedValidation: {},
  AgentRevisedCapability: { changes: DraftCapabilityChanges },
  ChangedDraftDescription: { value: Schema.String },
  ChangedDraftName: { value: Schema.String },
  ChangedDraftTitle: { value: Schema.String },
  ChangedParameterDescription: { controlName: ParameterName, value: Schema.String },
  ChangedParameterTitle: { controlName: ParameterName, value: Schema.String },
  ChangedTargetUrl: { value: Schema.String },
  ChangedTask: { value: Schema.String },
  ClickedApprove: {},
  ClickedCopyInstallSkill: {},
  ClickedCopyInstallationTag: {},
  ClickedEditDraft: {},
  ClickedInspect: {},
  ClickedRefreshProof: {},
  ClickedSaveSkill: {},
  ClickedValidateDraft: {},
  ClickedViewProof: {},
  CompletedInspection: { scan: ScanResult },
  CompletedCopy: { artifact: Schema.Literals(["tag", "skill"]) },
  CompletedProofSummary: { proof: ProofSummary },
  CompletedPublication: { published: PublishedCapability },
  CompletedSkillSave: {},
  FailedInspection: { message: Schema.String },
  FailedCopy: { message: Schema.String },
  FailedModelContextRegistration: { message: Schema.String },
  FailedProofSummary: { message: Schema.String },
  FailedPublication: { message: Schema.String },
  SelectedForm: { formId: ParameterName },
});
export type Message = typeof Message.Type;

type StudioResources = Success<typeof studioRpcLayer> | Scope.Scope;
type StudioUpdate = Update.Return<Model, Message, StudioResources>;

const describeFailure = (failure: unknown, fallback: string): string => {
  const decoded = Schema.decodeUnknownOption(Schema.Struct({ message: Schema.String }))(failure);
  return Option.match(decoded, {
    onNone: () => fallback,
    onSome: ({ message }) => message,
  });
};

export const InspectSite = Command.define("InspectSite", {
  args: { request: ScanRequest },
  execute: ({ request }) =>
    Effect.scoped(
      Effect.match(inspectSiteEffect(request), {
        onFailure: (failure) =>
          Message.FailedInspection({ message: describeFailure(failure, INSPECTION_FAILED) }),
        onSuccess: (scan) => Message.CompletedInspection({ scan }),
      }),
    ),
  messages: [Message.CompletedInspection, Message.FailedInspection],
});

export const PublishCapability = Command.define("PublishCapability", {
  args: { draft: DraftCapability, scan: ScanResult },
  execute: ({ draft, scan }) =>
    Effect.scoped(
      Effect.match(publishCapabilityEffect({ draft, scan }), {
        onFailure: (failure) =>
          Message.FailedPublication({ message: describeFailure(failure, PUBLICATION_FAILED) }),
        onSuccess: (published) => Message.CompletedPublication({ published }),
      }),
    ),
  messages: [Message.CompletedPublication, Message.FailedPublication],
});

export const LoadProofSummary = Command.define("LoadProofSummary", {
  args: { receipt: ReceiptReference },
  execute: ({ receipt }) =>
    Effect.scoped(
      Effect.match(getProofSummaryEffect(receipt), {
        onFailure: (failure) =>
          Message.FailedProofSummary({ message: describeFailure(failure, PROOF_FAILED) }),
        onSuccess: (proof) => Message.CompletedProofSummary({ proof }),
      }),
    ),
  messages: [Message.CompletedProofSummary, Message.FailedProofSummary],
});

const downloadSkill = (skill: string): void => {
  const url = URL.createObjectURL(new Blob([skill], { type: "text/markdown;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.download = SKILL_FILENAME;
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const SaveInstallSkill = Command.define("SaveInstallSkill", {
  args: { skill: NonBlankString },
  execute: ({ skill }) =>
    Effect.sync(() => downloadSkill(skill)).pipe(Effect.as(Message.CompletedSkillSave())),
  messages: [Message.CompletedSkillSave],
});

export const CopyInstallArtifact = Command.define("CopyInstallArtifact", {
  args: {
    artifact: Schema.Literals(["tag", "skill"]),
    content: NonBlankString,
  },
  execute: ({ artifact, content }) =>
    Effect.tryPromise({
      catch: () => new Error(COPY_FAILED),
      try: () => navigator.clipboard.writeText(content),
    }).pipe(
      Effect.match({
        onFailure: () => Message.FailedCopy({ message: COPY_FAILED }),
        onSuccess: () => Message.CompletedCopy({ artifact }),
      }),
    ),
  messages: [Message.CompletedCopy, Message.FailedCopy],
});

const inspectState = (): StudioState => ({
  _tag: "Inspect",
  error: Option.none(),
  status: "idle",
  targetUrl: DEFAULT_TARGET_URL,
  task: DEFAULT_TASK,
});

const proveState = (
  receipt: ReceiptReference,
  published: Option.Option<typeof PublishedCapability.Type>,
): StudioState => ({
  _tag: "Prove",
  error: Option.none(),
  proof: Option.none(),
  published,
  receipt,
  status: "loading",
});

export const init = (flags: StudioFlags): StudioUpdate =>
  flags._tag === "Receipt"
    ? {
        commands: [LoadProofSummary({ receipt: flags.receipt })],
        model: { state: proveState(flags.receipt, Option.none()) },
      }
    : { model: { state: inspectState() } };

const editorParameter = (control: SemanticForm["controls"][number]): ToolParameter => ({
  controlName: control.name,
  description: DEFAULT_PARAMETER_DESCRIPTION,
  kind: control.kind,
  name: control.name,
  options: control.options,
  required: control.required,
  title: DEFAULT_PARAMETER_TITLE,
});

export const draftForForm = (form: SemanticForm): DraftEditor => ({
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: DEFAULT_TOOL_DESCRIPTION,
  formId: form.formId,
  name: DEFAULT_TOOL_NAME,
  parameters: form.controls.map(editorParameter),
  submitPolicy: SAFETY_BOUNDARY,
  title: DEFAULT_TOOL_TITLE,
});

const defineState = (
  scan: typeof ScanResult.Type,
  draft: DraftEditor,
): typeof DefineState.Type => ({
  _tag: "Define",
  draft,
  error: Option.none(),
  scan,
});

const approvedState = (scan: typeof ScanResult.Type, candidate: unknown): StudioState | undefined =>
  Option.getOrUndefined(
    Option.filter(
      Schema.decodeUnknownOption(DraftCapability)(candidate),
      (draft) => formForDraft(scan, draft) !== undefined,
    ).pipe(
      Option.map((draft): StudioState => ({
        _tag: "Approve",
        draft,
        error: Option.none(),
        scan,
        status: "idle",
      })),
    ),
  );

const invalidDraftState = (state: typeof DefineState.Type): StudioState => ({
  ...state,
  error: Option.some(DRAFT_INVALID),
});

const replaceDraft = (
  state: typeof DefineState.Type,
  draft: typeof DraftCapability.Type,
): StudioState =>
  formForDraft(state.scan, draft) !== undefined
    ? { ...state, draft, error: Option.none() }
    : invalidDraftState(state);

const reviseDraft = (
  scan: typeof ScanResult.Type,
  current: DraftEditor,
  changes: typeof DraftCapabilityChanges.Type,
): StudioState => {
  const candidate = { ...current, ...changes };
  const draft = Option.getOrUndefined(Schema.decodeUnknownOption(DraftCapability)(candidate));
  return draft === undefined || formForDraft(scan, draft) === undefined
    ? invalidDraftState(defineState(scan, candidate))
    : defineState(scan, draft);
};

const changeEditor = (
  state: typeof DefineState.Type,
  change: (draft: DraftEditor) => DraftEditor,
): StudioState => ({ ...state, draft: change(state.draft), error: Option.none() });

const changeParameter = (
  state: typeof DefineState.Type,
  controlName: string,
  change: (parameter: DraftEditor["parameters"][number]) => DraftEditor["parameters"][number],
): StudioState =>
  changeEditor(state, (draft) => ({
    ...draft,
    parameters: draft.parameters.map((parameter) =>
      parameter.controlName === controlName ? change(parameter) : parameter,
    ),
  }));

const receiptFromPublished = (
  published: typeof PublishedCapability.Type,
): ReceiptReference | undefined => {
  try {
    const receiptUrl = new URL(published.receiptUrl);
    return Option.getOrUndefined(
      Schema.decodeUnknownOption(ReceiptReference)({
        capabilityId: published.config.capabilityId,
        readToken: receiptUrl.hash.slice(1),
      }),
    );
  } catch {
    return undefined;
  }
};

const withError = (state: StudioState, message: string): StudioState => ({
  ...state,
  error: Option.some(message),
});

const completedInspection = (state: StudioState, scan: typeof ScanResult.Type): StudioState => {
  if (state._tag !== "Inspect") {
    return state;
  }
  const form = scan.forms[0];
  return form === undefined
    ? { ...state, error: Option.some(NO_FORMS_FOUND), status: "idle" }
    : defineState(scan, draftForForm(form));
};

const validateCurrentDraft = (state: typeof DefineState.Type): StudioState =>
  approvedState(state.scan, state.draft) ?? invalidDraftState(state);

const requestInspection = (state: typeof InspectState.Type): StudioUpdate =>
  Option.match(
    Schema.decodeUnknownOption(ScanRequest)({
      safetyBoundary: SAFETY_BOUNDARY,
      task: state.task,
      url: state.targetUrl,
    }),
    {
      onNone: () => ({ model: { state: withError(state, INSPECTION_FAILED) } }),
      onSome: (request) => ({
        commands: [InspectSite({ request })],
        model: {
          state: { ...state, error: Option.none(), status: "inspecting" },
        },
      }),
    },
  );

const requestPublication = (state: typeof ApproveState.Type): StudioUpdate => ({
  commands: [PublishCapability({ draft: state.draft, scan: state.scan })],
  model: {
    state: { ...state, error: Option.none(), status: "publishing" },
  },
});

const requestProof = (state: typeof ProveState.Type): StudioUpdate => ({
  commands: [LoadProofSummary({ receipt: state.receipt })],
  model: {
    state: { ...state, error: Option.none(), status: "loading" },
  },
});

export const update = (model: Model, message: Message): StudioUpdate =>
  Message.match(message, {
    AgentDraftedCapability: ({ draft }) => ({
      model: {
        state: model.state._tag === "Define" ? replaceDraft(model.state, draft) : model.state,
      },
    }),
    AgentRequestedValidation: () => ({
      model: {
        state: model.state._tag === "Define" ? validateCurrentDraft(model.state) : model.state,
      },
    }),
    AgentRevisedCapability: ({ changes }) => ({
      model: {
        state:
          model.state._tag === "Define"
            ? reviseDraft(model.state.scan, model.state.draft, changes)
            : model.state._tag === "Approve"
              ? reviseDraft(model.state.scan, model.state.draft, changes)
              : model.state,
      },
    }),
    ChangedDraftDescription: ({ value }) => ({
      model: {
        state:
          model.state._tag === "Define"
            ? changeEditor(model.state, (draft) => ({ ...draft, description: value }))
            : model.state,
      },
    }),
    ChangedDraftName: ({ value }) => ({
      model: {
        state:
          model.state._tag === "Define"
            ? changeEditor(model.state, (draft) => ({ ...draft, name: value }))
            : model.state,
      },
    }),
    ChangedDraftTitle: ({ value }) => ({
      model: {
        state:
          model.state._tag === "Define"
            ? changeEditor(model.state, (draft) => ({ ...draft, title: value }))
            : model.state,
      },
    }),
    ChangedParameterDescription: ({ controlName, value }) => ({
      model: {
        state:
          model.state._tag === "Define"
            ? changeParameter(model.state, controlName, (parameter) => ({
                ...parameter,
                description: value,
              }))
            : model.state,
      },
    }),
    ChangedParameterTitle: ({ controlName, value }) => ({
      model: {
        state:
          model.state._tag === "Define"
            ? changeParameter(model.state, controlName, (parameter) => ({
                ...parameter,
                title: value,
              }))
            : model.state,
      },
    }),
    ChangedTargetUrl: ({ value }) => ({
      model: {
        state:
          model.state._tag === "Inspect"
            ? { ...model.state, error: Option.none(), targetUrl: value }
            : model.state,
      },
    }),
    ChangedTask: ({ value }) => ({
      model: {
        state:
          model.state._tag === "Inspect"
            ? { ...model.state, error: Option.none(), task: value }
            : model.state,
      },
    }),
    ClickedApprove: () =>
      model.state._tag === "Approve" && model.state.status === "idle"
        ? requestPublication(model.state)
        : { model },
    ClickedCopyInstallSkill: () =>
      model.state._tag === "Install"
        ? {
            commands: [
              CopyInstallArtifact({
                artifact: "skill",
                content: model.state.published.installSkill,
              }),
            ],
            model,
          }
        : { model },
    ClickedCopyInstallationTag: () =>
      model.state._tag === "Install"
        ? {
            commands: [
              CopyInstallArtifact({
                artifact: "tag",
                content: model.state.published.scriptTag,
              }),
            ],
            model,
          }
        : { model },
    ClickedEditDraft: () => ({
      model: {
        state:
          model.state._tag === "Approve" && model.state.status === "idle"
            ? defineState(model.state.scan, model.state.draft)
            : model.state,
      },
    }),
    ClickedInspect: () =>
      model.state._tag === "Inspect" && model.state.status === "idle"
        ? requestInspection(model.state)
        : { model },
    ClickedRefreshProof: () =>
      model.state._tag === "Prove" && model.state.status === "idle"
        ? requestProof(model.state)
        : { model },
    ClickedSaveSkill: () =>
      model.state._tag === "Install"
        ? {
            commands: [SaveInstallSkill({ skill: model.state.published.installSkill })],
            model,
          }
        : { model },
    ClickedValidateDraft: () => ({
      model: {
        state: model.state._tag === "Define" ? validateCurrentDraft(model.state) : model.state,
      },
    }),
    ClickedViewProof: () => {
      if (model.state._tag !== "Install") {
        return { model };
      }
      const receipt = receiptFromPublished(model.state.published);
      if (receipt === undefined) {
        return { model: { state: withError(model.state, PROOF_FAILED) } };
      }
      const state = proveState(receipt, Option.some(model.state.published));
      return {
        commands: [LoadProofSummary({ receipt })],
        model: { state },
      };
    },
    CompletedInspection: ({ scan }) => ({
      model: { state: completedInspection(model.state, scan) },
    }),
    CompletedCopy: ({ artifact }) => ({
      model: {
        state:
          model.state._tag === "Install"
            ? { ...model.state, copied: artifact, error: Option.none() }
            : model.state,
      },
    }),
    CompletedProofSummary: ({ proof }) => ({
      model: {
        state:
          model.state._tag === "Prove"
            ? {
                ...model.state,
                error: Option.none(),
                proof: Option.some(proof),
                status: "idle",
              }
            : model.state,
      },
    }),
    CompletedPublication: ({ published }) => ({
      model: {
        state:
          model.state._tag === "Approve"
            ? {
                _tag: "Install",
                copied: "none",
                error: Option.none(),
                published,
                savedSkill: false,
              }
            : model.state,
      },
    }),
    CompletedSkillSave: () => ({
      model: {
        state: model.state._tag === "Install" ? { ...model.state, savedSkill: true } : model.state,
      },
    }),
    FailedInspection: ({ message: failure }) => ({
      model: {
        state:
          model.state._tag === "Inspect"
            ? { ...model.state, error: Option.some(failure), status: "idle" }
            : model.state,
      },
    }),
    FailedCopy: ({ message: failure }) => ({
      model: {
        state:
          model.state._tag === "Install"
            ? { ...model.state, error: Option.some(failure) }
            : model.state,
      },
    }),
    FailedModelContextRegistration: ({ message: failure }) => ({
      model: { state: withError(model.state, failure) },
    }),
    FailedProofSummary: ({ message: failure }) => ({
      model: {
        state:
          model.state._tag === "Prove"
            ? { ...model.state, error: Option.some(failure), status: "idle" }
            : model.state,
      },
    }),
    FailedPublication: ({ message: failure }) => ({
      model: {
        state:
          model.state._tag === "Approve"
            ? { ...model.state, error: Option.some(failure), status: "idle" }
            : model.state,
      },
    }),
    SelectedForm: ({ formId }) => {
      if (model.state._tag !== "Define") {
        return { model };
      }
      const form = model.state.scan.forms.find((candidate) => candidate.formId === formId);
      return {
        model: {
          state:
            form === undefined
              ? invalidDraftState(model.state)
              : defineState(model.state.scan, draftForForm(form)),
        },
      };
    },
  });
