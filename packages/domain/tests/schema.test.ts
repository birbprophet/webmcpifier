import { expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { DraftCapability, ProofEvent, ScanResult } from "../src/schema.ts";

const fingerprint = "0".repeat(64);

it("keeps installed-tool annotations under product control", () => {
  const candidate = {
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    description: "Fill a form for review.",
    formId: "quote",
    name: "fill_quote",
    parameters: [
      {
        controlName: "details",
        description: "Details to place in the form.",
        kind: "textarea",
        name: "details",
        options: [],
        required: true,
        title: "Details",
      },
    ],
    submitPolicy: "fill_for_review",
    title: "Fill quote",
  };
  expect(Option.isNone(Schema.decodeUnknownOption(DraftCapability)(candidate))).toBe(true);
});

it("rejects duplicate stable form and control identifiers", () => {
  const control = {
    kind: "text",
    label: "Details",
    name: "details",
    options: [],
    required: true,
  };
  const form = {
    controls: [control, control],
    fingerprint,
    formId: "quote",
    title: "Quote",
  };
  const duplicateControls = {
    forms: [form],
    origin: "https://example.com",
    pathname: "/quote",
    screenshotDataUrl: "data:image/jpeg;base64,AA==",
    title: "Example",
    url: "https://example.com/quote",
  };
  const duplicateForms = {
    ...duplicateControls,
    forms: [
      { ...form, controls: [control] },
      { ...form, controls: [control] },
    ],
  };

  expect(Option.isNone(Schema.decodeUnknownOption(ScanResult)(duplicateControls))).toBe(true);
  expect(Option.isNone(Schema.decodeUnknownOption(ScanResult)(duplicateForms))).toBe(true);
});

it("rejects duplicate tool bindings and malformed proof capability identifiers", () => {
  const parameter = {
    controlName: "details",
    description: "Details to place in the form.",
    kind: "textarea" as const,
    name: "details",
    options: [],
    required: true,
    title: "Details",
  };
  const duplicateBindings = {
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    description: "Fill a form for review.",
    formId: "quote",
    name: "fill_quote",
    parameters: [parameter, parameter],
    submitPolicy: "fill_for_review",
    title: "Fill quote",
  };
  const malformedProofEvent = {
    capabilityHash: fingerprint,
    capabilityId: "not/a/token",
    latencyMs: 10,
    origin: "https://example.com",
    outcome: "success",
    runtimeVersion: "1.0.0",
    writeToken: "write-token",
  };

  expect(Option.isNone(Schema.decodeUnknownOption(DraftCapability)(duplicateBindings))).toBe(true);
  expect(Option.isNone(Schema.decodeUnknownOption(ProofEvent)(malformedProofEvent))).toBe(true);
});
