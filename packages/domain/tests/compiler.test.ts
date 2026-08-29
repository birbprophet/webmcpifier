import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { publishCapability } from "../src/compiler.ts";
import type { DraftCapability, ScanResult } from "../src/schema.ts";

const scan: ScanResult = {
  forms: [
    {
      controls: [
        {
          kind: "select",
          label: "Service",
          name: "service",
          options: ["plumbing"],
          required: true,
        },
      ],
      fingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      formId: "quote-form",
      title: "Request a quote",
    },
  ],
  origin: "https://demo.webmcpifier.com",
  pathname: "/",
  screenshotDataUrl: "data:image/png;base64,AA==",
  title: "Northstar Home Services",
  url: "https://demo.webmcpifier.com/",
};

const draft: DraftCapability = {
  annotations: { readOnlyHint: false, untrustedContentHint: false },
  description: "Fill a service quote draft for the user to review. Never submit it.",
  formId: "quote-form",
  name: "prepare_service_quote",
  parameters: [
    {
      controlName: "service",
      description: "Service needed.",
      kind: "select",
      name: "service",
      options: ["plumbing"],
      required: true,
      title: "Service",
    },
  ],
  submitPolicy: "fill_for_review",
  title: "Prepare service quote",
};

it.effect("publishes only a matching inspected form", () =>
  Effect.gen(function* () {
    const published = yield* publishCapability(scan, draft, {
      apiOrigin: "https://api.webmcpifier.com",
      capabilityId: "cap_test",
      originTrialToken: "trial-token",
      readToken: "read-token",
      runtimeIntegrity: "sha384-dGVzdA==",
      studioOrigin: "https://webmcpifier.com",
      writeToken: "write-token",
    });
    expect(published.config.target.formId).toBe("quote-form");
    expect(published.scriptTag).toContain("data-webmcpifier=");
    expect(published.installSkill).toContain("Stop and ask the user");
    expect(published.installSkill).toContain("nothing was submitted");
    expect(published.installSkill).toContain('"additionalProperties": false');
    expect(published.installSkill).toContain("focus is on Review request");
  }),
);

it.effect("rejects a stale binding", () =>
  Effect.gen(function* () {
    const invalidDraft: DraftCapability = {
      ...draft,
      parameters: [{ ...draft.parameters[0]!, controlName: "missing" }],
    };
    const result = yield* Effect.exit(
      publishCapability(scan, invalidDraft, {
        apiOrigin: "https://api.webmcpifier.com",
        capabilityId: "cap_test",
        originTrialToken: "trial-token",
        readToken: "read-token",
        runtimeIntegrity: "sha384-dGVzdA==",
        studioOrigin: "https://webmcpifier.com",
        writeToken: "write-token",
      }),
    );
    expect(result._tag).toBe("Failure");
  }),
);
