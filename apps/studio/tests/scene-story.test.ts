import { expect, it } from "@effect/vitest";
import type {
  DraftCapability,
  ProofSummary,
  PublishedCapability,
  ScanResult,
} from "@webmcpifier/domain";
import { Scene, Story } from "foldkit/test";
import { THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN } from "../../../test/origin-trial-token.ts";
import {
  init,
  LoadProofSummary,
  Message,
  type Model,
  PublishCapability,
  update,
} from "../src/main.ts";
import { view } from "../src/view.ts";

const fingerprint = "0".repeat(64);
const capabilityHash = "1".repeat(64);
const scan: ScanResult = {
  forms: [
    {
      controls: [
        {
          kind: "text",
          label: "Postcode",
          name: "postcode",
          options: [],
          required: true,
        },
      ],
      fingerprint,
      formId: "quote-form",
      title: "Service quote",
    },
  ],
  origin: "https://demo.webmcpifier.test",
  pathname: "/quote",
  screenshotDataUrl: "data:image/jpeg;base64,AA==",
  title: "Northstar Home Services",
  url: "https://demo.webmcpifier.test/quote",
};
const draft: DraftCapability = {
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Fill a quote for the user to review. Never submit it.",
  formId: "quote-form",
  name: "prepare_service_quote",
  parameters: [
    {
      controlName: "postcode",
      description: "The service postcode.",
      kind: "text",
      name: "postcode",
      options: [],
      required: true,
      title: "Postcode",
    },
  ],
  submitPolicy: "fill_for_review",
  title: "Prepare service quote",
};
const published: PublishedCapability = {
  capabilityHash,
  config: {
    capabilityId: "cap_scene",
    proof: { endpoint: "https://api.webmcpifier.test/proof/events", writeToken: "write-token" },
    runtime: { originTrialToken: THIRD_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN, version: "1.0.0" },
    target: {
      fingerprint,
      formId: "quote-form",
      origin: scan.origin,
      pathname: scan.pathname,
    },
    tool: draft,
    version: 1,
  },
  installSkill: "---\nname: install-webmcpifier-capability\n---\n\nInstall the tag.",
  receiptUrl: "https://www.webmcpifier.test/receipt/cap_scene#read-token",
  scriptTag: '<script src="https://www.webmcpifier.test/runtime/v1.js" defer></script>',
};
const proof: ProofSummary = {
  aborts: 0,
  capabilityHash,
  failures: 0,
  invocations: 1,
  lastSeenAt: "2026-08-29T20:00:00.000Z",
  latency: {
    atMost1000Ms: 0,
    atMost100Ms: 1,
    atMost3000Ms: 0,
    atMost300Ms: 0,
    over3000Ms: 0,
  },
  origin: scan.origin,
  runtimeVersion: "1.0.0",
  successes: 1,
};

const inspect = init({ _tag: "Studio" }).model;
const define = update(inspect, Message.CompletedInspection({ scan })).model;
const invalidDefine = update(
  update(define, Message.ChangedDraftName({ value: "" })).model,
  Message.ClickedValidateDraft(),
).model;
const drafted = update(define, Message.AgentDraftedCapability({ draft })).model;
const approve = update(drafted, Message.AgentRequestedValidation()).model;
const install = update(approve, Message.CompletedPublication({ published })).model;
const loadingProof = update(install, Message.ClickedViewProof()).model;
const prove = update(loadingProof, Message.CompletedProofSummary({ proof })).model;
const emptyProof = update(
  loadingProof,
  Message.FailedProofSummary({ message: "Proof is not available yet." }),
).model;

it("renders every Studio state as a FoldKit Scene", () => {
  const states: ReadonlyArray<readonly [Model, string]> = [
    [inspect, "Start with one public form"],
    [define, "Write the public contract"],
    [approve, "One human decision creates publication"],
    [install, "Approved artifacts are ready"],
    [prove, "Aggregate proof, without captured form data"],
  ];
  for (const [model, expected] of states) {
    Scene.scene(
      { update, view },
      Scene.given(model),
      Scene.tap((simulation) => expect(Scene.textContent(simulation.html)).toContain(expected)),
    );
  }
});

it("gives every Studio state one page-level heading", () => {
  const states = [inspect, define, approve, install, prove] as const;

  for (const model of states) {
    Scene.scene(
      { update, view },
      Scene.given(model),
      Scene.tap((simulation) => {
        const rendered = JSON.stringify(simulation.html);
        expect(rendered.match(/"sel":"h1"/gu)).toHaveLength(1);
      }),
    );
  }
});

it("renders the Studio shell through authenticated Untitled UI component anatomy", () => {
  Scene.scene(
    { update, view },
    Scene.given(inspect),
    Scene.tap((simulation) => {
      const rendered = JSON.stringify(simulation.html);
      expect(Scene.textContent(simulation.html)).toContain(
        "Turn one website form into a browser tool.",
      );
      expect(Scene.textContent(simulation.html)).toContain(
        "Describe it. Approve it. Paste it. Prove it.",
      );
      expect(Scene.textContent(simulation.html)).toContain("Fill for review. Never submit.");
      expect(rendered).toContain("Semantic only included");
      expect(rendered).toContain("bg-bg-brand-solid");
      expect(rendered).toContain("ring-focus-ring");
      expect(rendered).toContain("ring-border-primary");
      expect(rendered).toContain('"rounded-xl":true');
      expect(rendered).toContain('"border-border-primary":true');
    }),
  );
});

it("links invalid contract fields to specific recovery text", () => {
  Scene.scene(
    { update, view },
    Scene.given(invalidDefine),
    Scene.tap((simulation) => {
      const content = Scene.textContent(simulation.html);
      const rendered = JSON.stringify(simulation.html);
      expect(content).toContain("Tool name is missing or outside the allowed contract format.");
      expect(content).toContain("Enter 1–30 letters, numbers, underscores, dashes, or dots.");
      expect(rendered).toContain("aria-invalid");
      expect(rendered).toContain("aria-describedby");
      expect(rendered).toContain("ring-border-error-subtle");
    }),
  );
});

it("renders truthful static proof totals without injected trend claims", () => {
  Scene.scene(
    { update, view },
    Scene.given(prove),
    Scene.tap((simulation) => {
      const content = Scene.textContent(simulation.html);
      const rendered = JSON.stringify(simulation.html);

      expect(content).toContain("Latency distribution");
      expect(content).toContain("Runtime evidence");
      expect(content).toContain("Live");
      expect(content.match(/100%/gu)).toHaveLength(1);
      expect(content).not.toContain("↑");
      expect(rendered).toContain("proof-stat-featured");
      expect(rendered).toContain("latency-track");
      expect(rendered).toContain("proof-metadata-row");
    }),
  );
});

it("renders receipt loading and recoverable empty states without inventing proof", () => {
  const states: ReadonlyArray<readonly [Model, string, string]> = [
    [loadingProof, "Loading proof receipt…", "Refreshing"],
    [emptyProof, "No proof events yet.", "Unavailable"],
  ];

  for (const [model, expected, status] of states) {
    Scene.scene(
      { update, view },
      Scene.given(model),
      Scene.tap((simulation) => {
        const content = Scene.textContent(simulation.html);
        expect(content).toContain(expected);
        expect(content).toContain(status);
        expect(content).not.toContain("Live");
      }),
    );
  }
});

it("keeps both generated artifacts fully reachable through FoldKit expansion controls", () => {
  Scene.scene(
    { update, view },
    Scene.given(install),
    Scene.tap((simulation) => {
      const content = Scene.textContent(simulation.html);
      expect(content.match(/Show more/gu)).toHaveLength(2);
      expect(content).toContain(published.scriptTag);
      expect(content).toContain("install-webmcpifier-capability");
      expect(content).toContain("Install the tag.");
    }),
  );
});

it("places the exact approval target before the contract and human action", () => {
  Scene.scene(
    { update, view },
    Scene.given(approve),
    Scene.tap((simulation) => {
      const content = Scene.textContent(simulation.html);
      const target = content.indexOf("Northstar Home Services");
      const contract = content.indexOf("Prepare service quote");
      const approval = content.indexOf("Approve capability");

      expect(target).toBeGreaterThanOrEqual(0);
      expect(contract).toBeGreaterThan(target);
      expect(approval).toBeGreaterThan(contract);
      expect(content.match(/Northstar Home Services/g)).toHaveLength(1);
      expect(content).toContain("Path/quote");
    }),
  );
});

it("keeps publication behind the human-click Story command", () => {
  Story.story(
    update,
    Story.given(approve),
    Story.message(Message.ClickedApprove()),
    Story.Command.expectExact(PublishCapability),
    Story.Command.resolve(PublishCapability, Message.CompletedPublication({ published })),
    Story.model((model) => expect(model.state._tag).toBe("Install")),
    Story.message(Message.ClickedViewProof()),
    Story.Command.expectExact(LoadProofSummary),
    Story.Command.resolve(LoadProofSummary, Message.CompletedProofSummary({ proof })),
    Story.model((model) => {
      expect(model.state._tag).toBe("Prove");
      if (model.state._tag === "Prove") expect(model.state.proof._tag).toBe("Some");
    }),
  );
});
