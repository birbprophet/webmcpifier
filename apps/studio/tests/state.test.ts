import { expect, it } from "@effect/vitest";
import {
  DraftCapability,
  ProofSummary,
  PublishedCapability,
  ScanResult,
} from "@webmcpifier/domain";
import * as Schema from "effect/Schema";
import { THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN } from "../../../test/origin-trial-token.ts";
import { init, Message, SAFETY_BOUNDARY, update } from "../src/main.ts";

const FORM_FINGERPRINT = "0".repeat(64);
const CAPABILITY_HASH = "1".repeat(64);

const scan = Schema.decodeUnknownSync(ScanResult)({
  forms: [
    {
      controls: [
        {
          kind: "email",
          label: "Work email",
          name: "email",
          options: [],
          required: true,
        },
      ],
      fingerprint: FORM_FINGERPRINT,
      formId: "contact",
      title: "Contact sales",
    },
  ],
  origin: "https://example.com",
  pathname: "/contact",
  screenshotDataUrl: "data:image/png;base64,AA==",
  title: "Example contact",
  url: "https://example.com/contact",
});

const draft = Schema.decodeUnknownSync(DraftCapability)({
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Fill the contact form and leave it ready for human review.",
  formId: "contact",
  name: "fill_contact",
  parameters: [
    {
      controlName: "email",
      description: "The work email to place in the approved email field.",
      kind: "email",
      name: "email",
      options: [],
      required: true,
      title: "Work email",
    },
  ],
  submitPolicy: SAFETY_BOUNDARY,
  title: "Fill contact form",
});

const published = Schema.decodeUnknownSync(PublishedCapability)({
  capabilityHash: CAPABILITY_HASH,
  config: {
    capabilityId: "capability-proof",
    proof: {
      endpoint: "https://api.example.com/proof/events",
      writeToken: "write-token",
    },
    runtime: {
      originTrialToken: THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN,
      version: "1.0.0",
    },
    target: {
      fingerprint: FORM_FINGERPRINT,
      formId: "contact",
      origin: "https://example.com",
      pathname: "/contact",
    },
    tool: draft,
    version: 1,
  },
  installSkill: "---\nname: install-webmcpifier-capability\n---\n\nInstall the approved tag.",
  receiptUrl: "https://studio.example.com/receipt/capability-proof#read-token",
  scriptTag: '<script src="https://studio.example.com/runtime/v1.js" defer></script>',
});

const proof = Schema.decodeUnknownSync(ProofSummary)({
  aborts: 0,
  capabilityHash: CAPABILITY_HASH,
  failures: 0,
  invocations: 2,
  lastSeenAt: "2026-08-29T18:00:00.000Z",
  latency: {
    atMost1000Ms: 0,
    atMost100Ms: 2,
    atMost3000Ms: 0,
    atMost300Ms: 0,
    over3000Ms: 0,
  },
  origin: "https://example.com",
  runtimeVersion: "1.0.0",
  successes: 2,
});

const initialModel = init({ _tag: "Studio" }).model;

const defineModel = update(initialModel, Message.CompletedInspection({ scan })).model;
const approveModel = update(defineModel, Message.AgentValidatedCapability({ draft })).model;

it("moves from Inspect to Define after a completed inspection", () => {
  expect(initialModel.state._tag).toBe("Inspect");
  expect(initialModel.state).toMatchObject({
    targetUrl: "https://demo.webmcpifier.test",
    task: "Prepare a Northstar service quote and leave it ready for human review.",
  });

  const requested = update(initialModel, Message.ClickedInspect());
  expect(requested.commands?.map((command) => command.name)).toEqual(["InspectSite"]);
  expect(requested.model.state).toMatchObject({ _tag: "Inspect", status: "inspecting" });

  expect(defineModel.state._tag).toBe("Define");
  if (defineModel.state._tag === "Define") {
    expect(defineModel.state.scan).toEqual(scan);
    expect(defineModel.state.draft.formId).toBe("contact");
  }
});

it("validates a matching draft into Approve without publishing it", () => {
  const validated = update(defineModel, Message.AgentValidatedCapability({ draft }));
  expect(validated.commands).toBeUndefined();
  expect(validated.model.state._tag).toBe("Approve");
  expect("published" in validated.model.state).toBe(false);
});

it("allows only the human approval message to issue publication", () => {
  const premature = update(defineModel, Message.ClickedApprove());
  expect(premature.commands).toBeUndefined();
  expect(premature.model.state._tag).toBe("Define");

  const agentValidation = update(defineModel, Message.AgentValidatedCapability({ draft }));
  expect(agentValidation.commands).toBeUndefined();
  expect(agentValidation.model.state._tag).toBe("Approve");

  const approved = update(agentValidation.model, Message.ClickedApprove());
  expect(approved.commands?.map((command) => command.name)).toEqual(["PublishCapability"]);
  expect(approved.commands?.[0]?.args).toEqual({ draft, scan });
  expect("published" in approved.model.state).toBe(false);
});

it("keeps revision agent-owned but publication human-owned", () => {
  const revised = update(approveModel, Message.AgentRevisedCapability({ draft }));
  expect(revised.commands).toBeUndefined();
  expect(revised.model.state._tag).toBe("Define");
  expect("published" in revised.model.state).toBe(false);
});

it("creates installation artifacts only after publication completes", () => {
  expect("published" in initialModel.state).toBe(false);
  expect("published" in defineModel.state).toBe(false);
  expect("published" in approveModel.state).toBe(false);

  const installing = update(approveModel, Message.CompletedPublication({ published }));
  expect(installing.model.state._tag).toBe("Install");
  if (installing.model.state._tag === "Install") {
    expect(installing.model.state.published.scriptTag).toContain("runtime/v1.js");
    expect(installing.model.state.published.installSkill).toContain(
      "install-webmcpifier-capability",
    );
  }
});

it("moves from Install to a refreshable Prove receipt", () => {
  const installModel = update(approveModel, Message.CompletedPublication({ published })).model;
  const proving = update(installModel, Message.ClickedViewProof());
  expect(proving.commands?.map((command) => command.name)).toEqual(["LoadProofSummary"]);
  expect(proving.model.state._tag).toBe("Prove");

  const completed = update(proving.model, Message.CompletedProofSummary({ proof }));
  expect(completed.model.state).toMatchObject({ _tag: "Prove", status: "idle" });
  if (completed.model.state._tag === "Prove") {
    expect(completed.model.state.proof).toMatchObject({ value: proof });
  }
});

it("tracks copied installation artifacts without changing publication", () => {
  const installModel = update(approveModel, Message.CompletedPublication({ published })).model;
  const copied = update(installModel, Message.CompletedCopy({ artifact: "tag" }));
  expect(copied.model.state._tag).toBe("Install");
  if (copied.model.state._tag === "Install") {
    expect(copied.model.state.copied).toBe("tag");
    expect(copied.model.state.published).toEqual(published);
  }
});
