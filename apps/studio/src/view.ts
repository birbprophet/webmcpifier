import type {
  DraftCapability,
  ProofSummary,
  PublishedCapability,
  ScanResult,
  SemanticForm,
} from "@webmcpifier/domain";
import { alert as untitledAlert } from "@birbprophet/untitled-ui-foldkit/application/alerts.ts";
import { codeSnippet as untitledCodeSnippet } from "@birbprophet/untitled-ui-foldkit/application/code-snippet.ts";
import { metrics as untitledMetric } from "@birbprophet/untitled-ui-foldkit/application/metrics.ts";
import { progressSteps as untitledProgressSteps } from "@birbprophet/untitled-ui-foldkit/application/progress-steps.ts";
import { badge as untitledBadge } from "@birbprophet/untitled-ui-foldkit/base/badges.ts";
import { button as untitledButton } from "@birbprophet/untitled-ui-foldkit/base/button.ts";
import {
  input as untitledInput,
  textarea as untitledTextarea,
} from "@birbprophet/untitled-ui-foldkit/base/fields.ts";
import * as Option from "effect/Option";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { Message, type Model, SAFETY_GUARANTEE, type StudioState } from "./main.ts";

const STUDIO_STEPS = ["Inspect", "Define", "Approve", "Install", "Prove"] as const;

const stateStep = (state: StudioState): number => STUDIO_STEPS.indexOf(state._tag);

const actionButton = (
  label: string,
  message: Message,
  h: HtmlBuilder<Message>,
  options: {
    readonly disabled?: boolean;
    readonly kind?: "primary" | "secondary" | "quiet";
    readonly pending?: boolean;
  } = {},
): Html =>
  untitledButton(
    {
      color:
        options.kind === "secondary"
          ? "secondary"
          : options.kind === "quiet"
            ? "tertiary"
            : "primary",
      isDisabled: options.disabled,
      isLoading: options.pending,
      label: options.pending === true ? `${label}…` : label,
      onPress: message,
      showTextWhileLoading: true,
      size: "md",
      type: "button",
    },
    h,
  );

const field = (
  id: string,
  label: string,
  value: string,
  onInput: (value: string) => Message,
  h: HtmlBuilder<Message>,
  options: {
    readonly hint?: string;
    readonly type?: "text" | "url";
  } = {},
): Html =>
  untitledInput(
    {
      autocomplete: "off",
      hint: options.hint,
      label,
      name: id,
      onInput,
      size: "lg",
      type: options.type ?? "text",
      value,
    },
    h,
  );

const textAreaField = (
  id: string,
  label: string,
  value: string,
  onInput: (value: string) => Message,
  h: HtmlBuilder<Message>,
  hint?: string,
): Html =>
  untitledTextarea(
    {
      hint,
      label,
      name: id,
      onInput,
      rows: 4,
      value,
    },
    h,
  );

const chip = (
  label: string,
  color: "blue" | "brand" | "gray" | "success",
  h: HtmlBuilder<Message>,
): Html => untitledBadge({ color, label, size: "sm", type: "pill-color" }, h);

const introPoint = (title: string, description: string, h: HtmlBuilder<Message>): Html =>
  h.li(
    [],
    [
      untitledBadge(
        {
          adornment: "icon-only",
          color: "brand",
          label: `${title} included`,
          size: "md",
          type: "pill-color",
        },
        h,
      ),
      h.div([h.Class("intro-point-copy")], [h.strong([], [title]), h.span([], [description])]),
    ],
  );

const pageHeader = (h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class("site-header")],
    [
      h.div(
        [h.Class("brand-lockup")],
        [
          h.span(
            [h.Class("brand-mark"), h.AriaHidden(true)],
            [
              h.svg(
                [h.Fill("none"), h.ViewBox("0 0 24 24")],
                [
                  h.path([
                    h.D("m5 8 3.2 8L12 9l3.8 7L19 8"),
                    h.Stroke("currentColor"),
                    h.StrokeLinecap("round"),
                    h.StrokeLinejoin("round"),
                    h.StrokeWidth("2.4"),
                  ]),
                ],
              ),
            ],
          ),
          h.div([], [h.strong([], ["WebMCPifier"]), h.span([], ["Capability Studio"])]),
        ],
      ),
      h.div(
        [h.Class("header-status")],
        [chip("WebMCP native", "success", h), chip("v1 · one form", "gray", h)],
      ),
    ],
  );

const progress = (state: StudioState, h: HtmlBuilder<Message>): Html => {
  const current = stateStep(state);
  return h.nav(
    [h.Class("progress-shell"), h.AriaLabel("Studio progress")],
    [
      untitledProgressSteps(
        {
          connector: true,
          items: STUDIO_STEPS.map((step, index) => ({
            description:
              index === 0
                ? "See the page"
                : index === 1
                  ? "Shape the tool"
                  : index === 2
                    ? "Human gate"
                    : index === 3
                      ? "Add one tag"
                      : "Check usage",
            status: index < current ? "complete" : index === current ? "current" : "incomplete",
            title: step,
          })),
          orientation: "horizontal",
          size: "sm",
          type: "icon",
          variant: "icons-with-text",
        },
        h,
      ),
    ],
  );
};

const safetyCard = (h: HtmlBuilder<Message>): Html =>
  h.aside(
    [h.Class("safety-boundary")],
    [
      untitledAlert(
        {
          color: "success",
          confirmLabel: "",
          description: `${SAFETY_GUARANTEE} No click macros, form submission, or arbitrary JavaScript.`,
          title: "Fill for review. Never submit.",
        },
        h,
      ),
    ],
  );

const errorBanner = (state: StudioState, h: HtmlBuilder<Message>): readonly Html[] =>
  Option.match(state.error, {
    onNone: () => [],
    onSome: (error) => [
      h.div(
        [h.Class("error-banner"), h.Role("alert")],
        [
          untitledAlert(
            {
              color: "error",
              confirmLabel: "",
              description: error,
              title: "Needs attention",
            },
            h,
          ),
        ],
      ),
    ],
  });

const panelHeading = (
  eyebrow: string,
  title: string,
  description: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("panel-heading")],
    [
      h.p([h.Class("eyebrow")], [eyebrow]),
      h.h2([], [title]),
      h.p([h.Class("muted")], [description]),
    ],
  );

const targetSummary = (
  title: string,
  url: string,
  pathname: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("target-summary")],
    [
      h.div([], [h.p([h.Class("eyebrow")], ["Target"]), h.h3([], [title]), h.code([], [url])]),
      chip(`Path ${pathname}`, "gray", h),
    ],
  );

const controlInventory = (form: SemanticForm, h: HtmlBuilder<Message>): readonly Html[] =>
  form.controls.map((control) =>
    h.keyed("li")(
      control.name,
      [h.Class("control-row")],
      [
        h.div([], [h.strong([], [control.label]), h.code([], [control.name])]),
        chip(control.kind, "blue", h),
        h.span([h.Class("muted")], [control.required ? "Required" : "Optional"]),
      ],
    ),
  );

const formInventory = (scan: ScanResult, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("inventory")],
    scan.forms.map((form) =>
      h.keyed("section")(
        form.formId,
        [h.Class("form-card")],
        [
          h.div(
            [h.Class("form-card-heading")],
            [
              h.div([], [h.h3([], [form.title]), h.code([], [form.formId])]),
              chip(`${String(form.controls.length)} fields`, "gray", h),
            ],
          ),
          h.ul([h.Class("control-list")], controlInventory(form, h)),
        ],
      ),
    ),
  );

const scanEvidence = (
  scan: ScanResult,
  h: HtmlBuilder<Message>,
  options: { readonly includeTarget?: boolean } = {},
): Html =>
  h.div(
    [h.Class("evidence-stack")],
    [
      ...(options.includeTarget === false
        ? []
        : [targetSummary(scan.title, scan.url, scan.pathname, h)]),
      h.figure(
        [h.Class("screenshot-card")],
        [
          h.img([
            h.Alt("Rendered target page from the current inspection"),
            h.Src(scan.screenshotDataUrl),
          ]),
          h.figcaption([], ["Rendered inspection · page content is untrusted inventory"]),
        ],
      ),
      formInventory(scan, h),
    ],
  );

const inspectView = (
  state: Extract<StudioState, { readonly _tag: "Inspect" }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("inspect-layout")],
    [
      h.section(
        [h.Class("studio-intro")],
        [
          chip("Safe WebMCP compiler", "brand", h),
          h.h1([], ["Turn one website form into a browser tool."]),
          h.p(
            [h.Class("intro-lede")],
            [
              "Describe the task to your browser agent. Review the exact contract. Add one generated tag. Prove the tool works.",
            ],
          ),
          h.ul(
            [h.Class("intro-points")],
            [
              introPoint("Semantic only", "Stable forms and labeled controls", h),
              introPoint("Human approved", "Nothing is published before your click", h),
              introPoint("Privacy light", "Proof without captured form values", h),
            ],
          ),
          h.p([h.Class("intro-thesis")], ["Describe it. Approve it. Paste it. Prove it."]),
        ],
      ),
      h.section(
        [h.Class("panel hero-panel")],
        [
          panelHeading(
            "Inspect",
            "Start with one public form",
            "Describe the job. WebMCPifier inventories the rendered page and keeps every action inside the review boundary.",
            h,
          ),
          h.div(
            [h.Class("form-stack")],
            [
              field(
                "target-url",
                "Target URL",
                state.targetUrl,
                (value) => Message.ChangedTargetUrl({ value }),
                h,
                { hint: "HTTPS only. One page per capability.", type: "url" },
              ),
              textAreaField(
                "target-task",
                "What should the browser agent prepare?",
                state.task,
                (value) => Message.ChangedTask({ value }),
                h,
                "State the outcome, not a click sequence.",
              ),
              h.div(
                [h.Class("actions")],
                [
                  actionButton("Inspect site", Message.ClickedInspect(), h, {
                    pending: state.status === "inspecting",
                  }),
                ],
              ),
            ],
          ),
        ],
      ),
      h.div([h.Class("inspect-safety")], [safetyCard(h)]),
    ],
  );

const formPicker = (
  state: Extract<StudioState, { readonly _tag: "Define" }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("field")],
    [
      h.label([h.For("selected-form")], ["Form"]),
      h.select(
        [
          h.Id("selected-form"),
          h.OnChange((formId) => Message.SelectedForm({ formId })),
          h.Value(state.draft.formId),
        ],
        state.scan.forms.map((form) =>
          h.keyed("option")(
            form.formId,
            [h.Selected(form.formId === state.draft.formId), h.Value(form.formId)],
            [form.title],
          ),
        ),
      ),
    ],
  );

const parameterEditor = (
  parameter: Extract<StudioState, { readonly _tag: "Define" }>["draft"]["parameters"][number],
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed("div")(
    parameter.controlName,
    [h.Class("parameter-editor")],
    [
      h.div(
        [h.Class("parameter-heading")],
        [
          h.div([], [h.code([], [parameter.name]), h.span([], [` → ${parameter.controlName}`])]),
          chip(parameter.kind, "blue", h),
        ],
      ),
      field(
        `parameter-title-${parameter.controlName}`,
        "Agent-facing title",
        parameter.title,
        (value) => Message.ChangedParameterTitle({ controlName: parameter.controlName, value }),
        h,
      ),
      field(
        `parameter-description-${parameter.controlName}`,
        "Agent-facing description",
        parameter.description,
        (value) =>
          Message.ChangedParameterDescription({ controlName: parameter.controlName, value }),
        h,
        { hint: "Keep it short and specific." },
      ),
    ],
  );

const draftEditor = (
  state: Extract<StudioState, { readonly _tag: "Define" }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.Class("panel")],
    [
      panelHeading(
        "Define",
        "Write the public contract",
        "Only these reviewed names and descriptions become agent context.",
        h,
      ),
      h.div(
        [h.Class("form-stack")],
        [
          formPicker(state, h),
          field(
            "tool-name",
            "Tool name",
            state.draft.name,
            (value) => Message.ChangedDraftName({ value }),
            h,
            { hint: "Letters, numbers, underscore, dash, or dot. Maximum 30 characters." },
          ),
          field(
            "tool-title",
            "Display title",
            state.draft.title,
            (value) => Message.ChangedDraftTitle({ value }),
            h,
          ),
          textAreaField(
            "tool-description",
            "Description",
            state.draft.description,
            (value) => Message.ChangedDraftDescription({ value }),
            h,
          ),
          h.div(
            [h.Class("parameter-stack")],
            [
              h.div(
                [h.Class("section-label")],
                [h.h3([], ["Parameters"]), h.span([], [String(state.draft.parameters.length)])],
              ),
              ...state.draft.parameters.map((parameter) => parameterEditor(parameter, h)),
            ],
          ),
          safetyCard(h),
          h.div(
            [h.Class("actions")],
            [actionButton("Validate draft", Message.ClickedValidateDraft(), h)],
          ),
        ],
      ),
    ],
  );

const defineView = (
  state: Extract<StudioState, { readonly _tag: "Define" }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("workspace")],
    [draftEditor(state, h), h.aside([h.Class("evidence-panel")], [scanEvidence(state.scan, h)])],
  );

const contractSummary = (draft: DraftCapability, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("contract-card")],
    [
      h.div(
        [h.Class("contract-heading")],
        [
          h.div([], [h.p([h.Class("eyebrow")], ["Contract"]), h.h3([], [draft.title])]),
          h.code([], [draft.name]),
        ],
      ),
      h.p([], [draft.description]),
      h.dl(
        [h.Class("contract-parameters")],
        draft.parameters.flatMap((parameter) => [
          h.keyed("dt")(
            `${parameter.name}-term`,
            [],
            [h.code([], [parameter.name]), chip(parameter.kind, "blue", h)],
          ),
          h.keyed("dd")(
            `${parameter.name}-description`,
            [],
            [h.strong([], [parameter.title]), h.span([], [parameter.description])],
          ),
        ]),
      ),
    ],
  );

const approveView = (
  state: Extract<StudioState, { readonly _tag: "Approve" }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("workspace")],
    [
      h.section(
        [h.Class("panel approval-panel")],
        [
          panelHeading(
            "Approve",
            "One human decision creates publication",
            "Check the target, contract, bindings, and safety guarantee. No tag or installation skill exists yet.",
            h,
          ),
          targetSummary(state.scan.title, state.scan.url, state.scan.pathname, h),
          contractSummary(state.draft, h),
          safetyCard(h),
          h.div(
            [h.Class("approval-notice")],
            [
              h.strong([], ["Publication boundary"]),
              h.p(
                [],
                ["The button below is the only path that can mint an installation artifact."],
              ),
            ],
          ),
          h.div(
            [h.Class("actions split-actions")],
            [
              actionButton("Edit contract", Message.ClickedEditDraft(), h, {
                disabled: state.status === "publishing",
                kind: "secondary",
              }),
              actionButton("Approve capability", Message.ClickedApprove(), h, {
                pending: state.status === "publishing",
              }),
            ],
          ),
        ],
      ),
      h.aside([h.Class("evidence-panel")], [scanEvidence(state.scan, h, { includeTarget: false })]),
    ],
  );

const codeReceipt = (
  label: string,
  content: string,
  className: string,
  h: HtmlBuilder<Message>,
  copy?: { readonly copied: boolean; readonly message: Message },
): Html =>
  h.section(
    [h.Class("receipt-card code-receipt")],
    [
      h.div(
        [h.Class("receipt-heading")],
        [
          h.h3([], [label]),
          chip(
            copy?.copied === true ? "Copied" : "Ready",
            copy?.copied === true ? "success" : "gray",
            h,
          ),
        ],
      ),
      h.div(
        [h.Class(`code-surface ${className}`)],
        [
          untitledCodeSnippet(
            {
              code: content,
              copied: copy?.copied,
              language: className.includes("tag-block") ? "html" : "markdown",
              maxHeight: className.includes("tag-block") ? 180 : 420,
              onCopy: copy?.message,
              showLineNumbers: false,
              variant: "modern",
            },
            h,
          ),
        ],
      ),
    ],
  );

const installView = (
  state: Extract<StudioState, { readonly _tag: "Install" }>,
  h: HtmlBuilder<Message>,
): Html => {
  const published = state.published;
  return h.div(
    [h.Class("single-column receipt-column")],
    [
      h.section(
        [h.Class("panel")],
        [
          panelHeading(
            "Install",
            "Approved artifacts are ready",
            "Use the tag directly or hand the concise SKILL.md to a repository agent.",
            h,
          ),
          targetSummary(
            published.config.tool.title,
            `${published.config.target.origin}${published.config.target.pathname}`,
            published.config.target.pathname,
            h,
          ),
          h.div(
            [h.Class("hash-row")],
            [h.span([], ["Capability hash"]), h.code([], [published.capabilityHash])],
          ),
          h.dl(
            [h.Class("proof-details")],
            [
              h.dt([], ["Expected tool"]),
              h.dd([], [h.code([], [published.config.tool.name])]),
              h.dt([], ["Runtime"]),
              h.dd([], [h.code([], [published.config.runtime.version])]),
              h.dt([], ["Private receipt"]),
              h.dd([], [h.code([], [published.receiptUrl])]),
            ],
          ),
        ],
      ),
      codeReceipt("Installation tag", published.scriptTag, "code-block tag-block", h, {
        copied: state.copied === "tag",
        message: Message.ClickedCopyInstallationTag(),
      }),
      codeReceipt("Installation skill", published.installSkill, "code-block skill-block", h, {
        copied: state.copied === "skill",
        message: Message.ClickedCopyInstallSkill(),
      }),
      h.div(
        [h.Class("actions split-actions")],
        [
          actionButton(
            state.savedSkill ? "Saved SKILL.md" : "Save as SKILL.md",
            Message.ClickedSaveSkill(),
            h,
            { kind: "secondary" },
          ),
          actionButton("View proof receipt", Message.ClickedViewProof(), h),
        ],
      ),
    ],
  );
};

const metric = (label: string, value: number | string, h: HtmlBuilder<Message>): Html =>
  untitledMetric(
    {
      showActions: false,
      subtitle: label,
      title: String(value),
      variant: "simple",
    },
    h,
  );

const proofDetails = (proof: ProofSummary, h: HtmlBuilder<Message>): Html => {
  const successRate =
    proof.invocations === 0
      ? "0%"
      : `${String(Math.round((proof.successes / proof.invocations) * 100))}%`;
  return h.div(
    [h.Class("proof-stack")],
    [
      h.div(
        [h.Class("metrics")],
        [
          metric("Invocations", proof.invocations, h),
          metric("Successes", proof.successes, h),
          metric("Failures", proof.failures, h),
          metric("Aborts", proof.aborts, h),
          metric("Success rate", successRate, h),
        ],
      ),
      h.section(
        [h.Class("receipt-card")],
        [
          h.h3([], ["Latency buckets"]),
          h.dl(
            [h.Class("proof-details")],
            [
              h.dt([], ["≤ 100 ms"]),
              h.dd([], [String(proof.latency.atMost100Ms)]),
              h.dt([], ["≤ 300 ms"]),
              h.dd([], [String(proof.latency.atMost300Ms)]),
              h.dt([], ["≤ 1,000 ms"]),
              h.dd([], [String(proof.latency.atMost1000Ms)]),
              h.dt([], ["≤ 3,000 ms"]),
              h.dd([], [String(proof.latency.atMost3000Ms)]),
              h.dt([], ["> 3,000 ms"]),
              h.dd([], [String(proof.latency.over3000Ms)]),
            ],
          ),
        ],
      ),
      h.dl(
        [h.Class("proof-details")],
        [
          h.dt([], ["Origin"]),
          h.dd([], [h.code([], [proof.origin])]),
          h.dt([], ["Runtime"]),
          h.dd([], [h.code([], [proof.runtimeVersion])]),
          h.dt([], ["Last seen"]),
          h.dd([], [proof.lastSeenAt]),
          h.dt([], ["Capability hash"]),
          h.dd([], [h.code([], [proof.capabilityHash])]),
        ],
      ),
    ],
  );
};

const priorInstallation = (
  published: Option.Option<PublishedCapability>,
  h: HtmlBuilder<Message>,
): readonly Html[] =>
  Option.match(published, {
    onNone: () => [],
    onSome: (artifact) => [
      h.details(
        [h.Class("prior-installation")],
        [
          h.summary([], ["Approved installation details"]),
          codeReceipt("Installation tag", artifact.scriptTag, "code-block tag-block", h),
          codeReceipt("Installation skill", artifact.installSkill, "code-block skill-block", h),
        ],
      ),
    ],
  });

const proveView = (
  state: Extract<StudioState, { readonly _tag: "Prove" }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("single-column receipt-column")],
    [
      h.section(
        [h.Class("panel")],
        [
          panelHeading(
            "Prove",
            "Aggregate proof, without captured form data",
            "The receipt keeps outcomes and latency buckets only. No field values are retained.",
            h,
          ),
          h.div(
            [h.Class("receipt-identity")],
            [
              h.div(
                [],
                [
                  h.span([h.Class("muted")], ["Capability"]),
                  h.code([], [state.receipt.capabilityId]),
                ],
              ),
              h.span(
                [h.Class("receipt-live")],
                [chip(state.status === "loading" ? "Refreshing" : "Live", "success", h)],
              ),
            ],
          ),
          ...Option.match(state.proof, {
            onNone: () => [
              h.div(
                [h.Class("empty-proof")],
                [state.status === "loading" ? "Loading proof receipt…" : "No proof events yet."],
              ),
            ],
            onSome: (proof) => [proofDetails(proof, h)],
          }),
          h.div(
            [h.Class("actions")],
            [
              actionButton("Refresh proof", Message.ClickedRefreshProof(), h, {
                kind: "secondary",
                pending: state.status === "loading",
              }),
            ],
          ),
        ],
      ),
      ...priorInstallation(state.published, h),
    ],
  );

const stateView = (state: StudioState, h: HtmlBuilder<Message>): Html => {
  switch (state._tag) {
    case "Inspect":
      return inspectView(state, h);
    case "Define":
      return defineView(state, h);
    case "Approve":
      return approveView(state, h);
    case "Install":
      return installView(state, h);
    case "Prove":
      return proveView(state, h);
  }
};

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  body: h.div(
    [h.Class("app-shell")],
    [
      pageHeader(h),
      h.main(
        [h.Class("main")],
        [progress(model.state, h), ...errorBanner(model.state, h), stateView(model.state, h)],
      ),
      h.footer(
        [h.Class("footer")],
        ["WebMCPifier · public form capabilities with explicit human approval"],
      ),
    ],
  ),
  title: `${model.state._tag} · WebMCPifier`,
});
