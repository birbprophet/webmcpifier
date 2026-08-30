import {
  DraftCapability,
  type ProofSummary,
  type PublishedCapability,
  type ScanResult,
  type SemanticForm,
  ToolParameter,
} from "@webmcpifier/domain";
import { alert as untitledAlert } from "@birbprophet/untitled-ui-foldkit/application/alerts.ts";
import { codeSnippet as untitledCodeSnippet } from "@birbprophet/untitled-ui-foldkit/application/code-snippet.ts";
import { loadingIndicator as untitledLoadingIndicator } from "@birbprophet/untitled-ui-foldkit/application/loading-indicator.ts";
import {
  type ProgressStep,
  progressSteps as untitledProgressSteps,
} from "@birbprophet/untitled-ui-foldkit/application/progress-steps.ts";
import { badge as untitledBadge } from "@birbprophet/untitled-ui-foldkit/base/badges.ts";
import { button as untitledButton } from "@birbprophet/untitled-ui-foldkit/base/button.ts";
import {
  input as untitledInput,
  textarea as untitledTextarea,
} from "@birbprophet/untitled-ui-foldkit/base/fields.ts";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
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
    readonly invalid?: boolean;
    readonly size?: "md" | "lg";
    readonly type?: "text" | "url";
  } = {},
): Html =>
  untitledInput(
    {
      autocomplete: "off",
      hint: options.hint,
      hideRequiredIndicator: true,
      isInvalid: options.invalid,
      isRequired: true,
      label,
      name: id,
      onInput,
      size: options.size ?? "lg",
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
  invalid = false,
): Html =>
  untitledTextarea(
    {
      hint,
      hideRequiredIndicator: true,
      isInvalid: invalid,
      isRequired: true,
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
  color: "blue" | "brand" | "error" | "gray" | "success",
  h: HtmlBuilder<Message>,
): Html => untitledBadge({ color, label, size: "sm", type: "pill-color" }, h);

const introPoint = (title: string, description: string, h: HtmlBuilder<Message>): Html =>
  h.li(
    [],
    [
      h.span(
        [h.AriaHidden(true)],
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
        ],
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
  const items: readonly ProgressStep[] = STUDIO_STEPS.map((step, index) => ({
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
  }));
  return h.nav(
    [h.Class("progress-shell"), h.AriaLabel("Studio progress")],
    [
      h.div(
        [h.Class("progress-desktop")],
        [
          untitledProgressSteps(
            {
              connector: true,
              items,
              orientation: "horizontal",
              size: "sm",
              type: "icon",
              variant: "icons-with-text",
            },
            h,
          ),
        ],
      ),
      h.div(
        [h.Class("progress-mobile")],
        [
          h.div(
            [h.Class("progress-mobile-copy")],
            [
              h.span([], [`Step ${String(current + 1)} of ${String(STUDIO_STEPS.length)}`]),
              h.strong([], [STUDIO_STEPS[current] ?? STUDIO_STEPS[0]]),
            ],
          ),
          h.div(
            [h.Class("progress-mobile-meter"), h.AriaHidden(true)],
            [
              untitledProgressSteps(
                {
                  connector: false,
                  items,
                  orientation: "horizontal",
                  size: "sm",
                  type: "icon",
                  variant: "minimal-icons",
                },
                h,
              ),
            ],
          ),
          h.ol(
            [h.Class("sr-only"), h.AriaLabel("Studio steps")],
            items.map((item) =>
              h.li(item.status === "current" ? [h.AriaCurrent("step")] : [], [
                `${item.title}: ${item.status}`,
              ]),
            ),
          ),
        ],
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
  options: { readonly level?: "h1" | "h2" } = {},
): Html =>
  h.div(
    [h.Class("panel-heading")],
    [
      h.p([h.Class("eyebrow")], [eyebrow]),
      ...(options.level === "h1" ? [h.h1([], [title])] : [h.h2([], [title])]),
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
      h.div([h.Class("target-path")], [h.span([], ["Path"]), h.code([], [pathname])]),
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
  validationAttempted: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const titleInvalid =
    validationAttempted && !Schema.is(ToolParameter.fields.title)(parameter.title);
  const descriptionInvalid =
    validationAttempted && !Schema.is(ToolParameter.fields.description)(parameter.description);
  return h.keyed("div")(
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
        {
          hint: titleInvalid ? "Enter a non-blank title of 500 characters or fewer." : undefined,
          invalid: titleInvalid,
          size: "md",
        },
      ),
      field(
        `parameter-description-${parameter.controlName}`,
        "Agent-facing description",
        parameter.description,
        (value) =>
          Message.ChangedParameterDescription({ controlName: parameter.controlName, value }),
        h,
        {
          hint: descriptionInvalid
            ? "Enter a non-blank description of 150 characters or fewer."
            : "Keep it short and specific.",
          invalid: descriptionInvalid,
          size: "md",
        },
      ),
    ],
  );
};

const draftEditor = (
  state: Extract<StudioState, { readonly _tag: "Define" }>,
  h: HtmlBuilder<Message>,
): Html => {
  const nameInvalid =
    state.validationAttempted && !Schema.is(DraftCapability.fields.name)(state.draft.name);
  const titleInvalid =
    state.validationAttempted && !Schema.is(DraftCapability.fields.title)(state.draft.title);
  const descriptionInvalid =
    state.validationAttempted &&
    !Schema.is(DraftCapability.fields.description)(state.draft.description);
  return h.section(
    [h.Class("panel")],
    [
      panelHeading(
        "Define",
        "Write the public contract",
        "Only these reviewed names and descriptions become agent context.",
        h,
        { level: "h1" },
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
            {
              hint: nameInvalid
                ? "Enter 1–30 letters, numbers, underscores, dashes, or dots."
                : "Letters, numbers, underscore, dash, or dot. Maximum 30 characters.",
              invalid: nameInvalid,
            },
          ),
          field(
            "tool-title",
            "Display title",
            state.draft.title,
            (value) => Message.ChangedDraftTitle({ value }),
            h,
            {
              hint: titleInvalid
                ? "Enter a non-blank display title of 500 characters or fewer."
                : undefined,
              invalid: titleInvalid,
            },
          ),
          textAreaField(
            "tool-description",
            "Description",
            state.draft.description,
            (value) => Message.ChangedDraftDescription({ value }),
            h,
            descriptionInvalid
              ? "Enter a non-blank description of 500 characters or fewer."
              : undefined,
            descriptionInvalid,
          ),
          h.div(
            [h.Class("parameter-stack")],
            [
              h.div(
                [h.Class("section-label")],
                [h.h3([], ["Parameters"]), h.span([], [String(state.draft.parameters.length)])],
              ),
              ...state.draft.parameters.map((parameter) =>
                parameterEditor(parameter, state.validationAttempted, h),
              ),
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
};

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
        draft.parameters.map((parameter) =>
          h.keyed("div")(
            parameter.name,
            [h.Class("contract-parameter")],
            [
              h.dt([], [h.code([], [parameter.name]), chip(parameter.kind, "blue", h)]),
              h.dd([], [h.strong([], [parameter.title]), h.span([], [parameter.description])]),
            ],
          ),
        ),
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
            { level: "h1" },
          ),
          targetSummary(state.scan.title, state.scan.url, state.scan.pathname, h),
          contractSummary(state.draft, h),
          safetyCard(h),
          h.div(
            [h.Class("approval-boundary")],
            [
              untitledAlert(
                {
                  color: "brand",
                  confirmLabel: "",
                  description:
                    "The button below is the only path that can mint an installation artifact.",
                  title: "Publication boundary",
                },
                h,
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
  expansion?: { readonly expanded: boolean; readonly message: Message },
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
              expanded: expansion?.expanded,
              language: className.includes("tag-block") ? "html" : "markdown",
              maxHeight: className.includes("tag-block") ? 180 : 420,
              onCopy: copy?.message,
              onToggleExpanded: expansion?.message,
              showLineNumbers: false,
              variant: "plain",
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
  const saveControl = state.savedSkill
    ? h.div(
        [h.Class("save-confirmation"), h.Role("status")],
        [chip("Saved", "success", h), h.span([], ["SKILL.md downloaded"])],
      )
    : actionButton("Save as SKILL.md", Message.ClickedSaveSkill(), h, { kind: "secondary" });
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
            { level: "h1" },
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
            [h.Class("install-details")],
            [
              h.div(
                [h.Class("install-detail")],
                [h.dt([], ["Expected tool"]), h.dd([], [h.code([], [published.config.tool.name])])],
              ),
              h.div(
                [h.Class("install-detail")],
                [h.dt([], ["Runtime"]), h.dd([], [h.code([], [published.config.runtime.version])])],
              ),
              h.div(
                [h.Class("install-detail")],
                [h.dt([], ["Private receipt"]), h.dd([], [h.code([], [published.receiptUrl])])],
              ),
            ],
          ),
        ],
      ),
      codeReceipt(
        "Installation tag",
        published.scriptTag,
        "code-block tag-block",
        h,
        {
          copied: state.copied === "tag",
          message: Message.ClickedCopyInstallationTag(),
        },
        {
          expanded: state.expandedArtifact === "tag",
          message: Message.ClickedToggleArtifact({ artifact: "tag" }),
        },
      ),
      codeReceipt(
        "Installation skill",
        published.installSkill,
        "code-block skill-block",
        h,
        {
          copied: state.copied === "skill",
          message: Message.ClickedCopyInstallSkill(),
        },
        {
          expanded: state.expandedArtifact === "skill",
          message: Message.ClickedToggleArtifact({ artifact: "skill" }),
        },
      ),
      h.div(
        [h.Class("actions split-actions")],
        [saveControl, actionButton("View proof receipt", Message.ClickedViewProof(), h)],
      ),
    ],
  );
};

const proofStat = (
  label: string,
  value: number | string,
  h: HtmlBuilder<Message>,
  featured = false,
): Html =>
  h.div(
    [h.Class(featured ? "proof-stat proof-stat-featured" : "proof-stat")],
    [
      h.dt([h.Class("proof-stat-label")], [label]),
      h.dd([], [h.strong([h.Class("proof-stat-value")], [String(value)])]),
    ],
  );

const proofTimestamp = (value: string): string => {
  const normalized = value.replace("T", " ").replace(/\.\d{3}Z$/u, " UTC");
  return normalized === value ? value : normalized;
};

const proofCardHeading = (
  title: string,
  description: string,
  h: HtmlBuilder<Message>,
  adornment?: Html,
): Html =>
  h.div(
    [h.Class("proof-card-heading")],
    [
      h.div([], [h.h3([], [title]), h.p([], [description])]),
      ...(adornment === undefined ? [] : [adornment]),
    ],
  );

const proofDetails = (proof: ProofSummary, h: HtmlBuilder<Message>): Html => {
  const successRate =
    proof.invocations === 0
      ? "0%"
      : `${String(Math.round((proof.successes / proof.invocations) * 100))}%`;
  const latency = [
    { count: proof.latency.atMost100Ms, key: "at-most-100", label: "≤ 100 ms" },
    { count: proof.latency.atMost300Ms, key: "at-most-300", label: "≤ 300 ms" },
    { count: proof.latency.atMost1000Ms, key: "at-most-1000", label: "≤ 1,000 ms" },
    { count: proof.latency.atMost3000Ms, key: "at-most-3000", label: "≤ 3,000 ms" },
    { count: proof.latency.over3000Ms, key: "over-3000", label: "> 3,000 ms" },
  ] as const;
  const latencyWidth = (count: number): string =>
    proof.invocations === 0
      ? "0%"
      : `${String(Math.min(100, Math.round((count / proof.invocations) * 100)))}%`;
  return h.div(
    [h.Class("proof-stack")],
    [
      h.dl(
        [h.Class("proof-stats"), h.AriaLabel("Proof totals")],
        [
          proofStat("Invocations", proof.invocations, h),
          proofStat("Successes", proof.successes, h),
          proofStat("Failures", proof.failures, h),
          proofStat("Aborts", proof.aborts, h),
          proofStat("Success rate", successRate, h, true),
        ],
      ),
      h.div(
        [h.Class("proof-detail-grid")],
        [
          h.section(
            [h.Class("proof-card")],
            [
              proofCardHeading(
                "Latency distribution",
                "Completed invocations by duration",
                h,
                chip(`${String(proof.invocations)} total`, "gray", h),
              ),
              h.ul(
                [h.Class("latency-list")],
                latency.map((bucket) =>
                  h.keyed("li")(
                    bucket.key,
                    [],
                    [
                      h.div(
                        [h.Class("latency-row")],
                        [h.span([], [bucket.label]), h.strong([], [String(bucket.count)])],
                      ),
                      h.div(
                        [h.Class("latency-track"), h.AriaHidden(true)],
                        [h.span([h.Style({ width: latencyWidth(bucket.count) })])],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          h.section(
            [h.Class("proof-card")],
            [
              proofCardHeading("Runtime evidence", "Exact public target and installed build", h),
              h.dl(
                [h.Class("proof-metadata")],
                [
                  h.div(
                    [h.Class("proof-metadata-row")],
                    [h.dt([], ["Origin"]), h.dd([], [h.code([], [proof.origin])])],
                  ),
                  h.div(
                    [h.Class("proof-metadata-row")],
                    [h.dt([], ["Runtime"]), h.dd([], [h.code([], [proof.runtimeVersion])])],
                  ),
                  h.div(
                    [h.Class("proof-metadata-row")],
                    [
                      h.dt([], ["Last seen"]),
                      h.dd(
                        [],
                        [
                          h.time(
                            [h.Attribute("datetime", proof.lastSeenAt), h.Title(proof.lastSeenAt)],
                            [proofTimestamp(proof.lastSeenAt)],
                          ),
                        ],
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class("proof-metadata-row")],
                    [h.dt([], ["Capability hash"]), h.dd([], [h.code([], [proof.capabilityHash])])],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

const priorInstallation = (
  published: Option.Option<PublishedCapability>,
  expandedArtifact: "none" | "tag" | "skill",
  h: HtmlBuilder<Message>,
): readonly Html[] =>
  Option.match(published, {
    onNone: () => [],
    onSome: (artifact) => [
      h.details(
        [h.Class("prior-installation")],
        [
          h.summary([], ["Approved installation details"]),
          codeReceipt(
            "Installation tag",
            artifact.scriptTag,
            "code-block tag-block",
            h,
            undefined,
            {
              expanded: expandedArtifact === "tag",
              message: Message.ClickedToggleArtifact({ artifact: "tag" }),
            },
          ),
          codeReceipt(
            "Installation skill",
            artifact.installSkill,
            "code-block skill-block",
            h,
            undefined,
            {
              expanded: expandedArtifact === "skill",
              message: Message.ClickedToggleArtifact({ artifact: "skill" }),
            },
          ),
        ],
      ),
    ],
  });

const proveView = (
  state: Extract<StudioState, { readonly _tag: "Prove" }>,
  h: HtmlBuilder<Message>,
): Html => {
  const proofStatus: {
    readonly color: "brand" | "error" | "gray" | "success";
    readonly label: string;
  } =
    state.status === "loading"
      ? { color: "brand", label: "Refreshing" }
      : Option.isSome(state.error)
        ? { color: "error", label: "Unavailable" }
        : Option.isSome(state.proof)
          ? { color: "success", label: "Live" }
          : { color: "gray", label: "No events" };
  return h.div(
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
            { level: "h1" },
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
                [h.Class("receipt-live"), h.Role("status")],
                [chip(proofStatus.label, proofStatus.color, h)],
              ),
            ],
          ),
          ...Option.match(state.proof, {
            onNone: () => [
              h.div(
                [h.Class("empty-proof")],
                state.status === "loading"
                  ? [
                      untitledLoadingIndicator(
                        { label: "Loading proof receipt…", size: "sm", type: "line-simple" },
                        h,
                      ),
                    ]
                  : [
                      h.strong([], ["No proof events yet."]),
                      h.span([], ["Run the installed tool, then refresh this private receipt."]),
                    ],
              ),
            ],
            onSome: (proof) => [proofDetails(proof, h)],
          }),
          h.div(
            [h.Class("actions proof-actions")],
            [
              actionButton("Refresh proof", Message.ClickedRefreshProof(), h, {
                kind: "secondary",
                pending: state.status === "loading",
              }),
            ],
          ),
        ],
      ),
      ...priorInstallation(state.published, state.expandedArtifact, h),
    ],
  );
};

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
