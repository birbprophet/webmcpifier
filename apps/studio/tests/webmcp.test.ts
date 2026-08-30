import { expect, it } from "@effect/vitest";
import {
  type ModelContext,
  type ModelContextTool,
  registerStateTools,
  type ToolContext,
} from "../src/webmcp.ts";

const STATE_TOOL_SETS: ReadonlyArray<{
  readonly context: ToolContext;
  readonly names: ReadonlyArray<string>;
}> = [
  { context: { _tag: "Inspect" }, names: ["inspect_site"] },
  {
    context: { _tag: "Define" },
    names: ["draft_form_tool", "revise_form_tool", "validate_draft"],
  },
  { context: { _tag: "Approve" }, names: ["revise_form_tool"] },
  {
    context: { _tag: "Install", installSkill: "Install the approved capability." },
    names: ["get_install_skill"],
  },
  {
    context: {
      _tag: "Prove",
      receipt: { capabilityId: "capability-proof", readToken: "read-token" },
    },
    names: ["get_proof_summary"],
  },
];

const recordingModelContext = (
  registrations: Array<{
    readonly signal: AbortSignal | undefined;
    readonly tool: ModelContextTool;
  }>,
): ModelContext => ({
  registerTool: async (tool, options) => {
    registrations.push({ signal: options?.signal, tool });
    return undefined;
  },
});

it("registers only the browser-agent tools owned by each studio state", async () => {
  for (const testCase of STATE_TOOL_SETS) {
    const registrations: Array<{
      readonly signal: AbortSignal | undefined;
      readonly tool: ModelContextTool;
    }> = [];
    const registration = registerStateTools(
      testCase.context,
      recordingModelContext(registrations),
      () => undefined,
    );

    await registration.ready;

    expect(registrations.map(({ tool }) => tool.name)).toEqual(testCase.names);
    expect(registrations.every(({ tool }) => tool.execute.length === 2)).toBe(true);
    registration.controller.abort();
  }
});

it("owns one AbortSignal for every tool in a state and aborts it on release", async () => {
  const registrations: Array<{
    readonly signal: AbortSignal | undefined;
    readonly tool: ModelContextTool;
  }> = [];
  const registration = registerStateTools(
    { _tag: "Define" },
    recordingModelContext(registrations),
    () => undefined,
  );

  await registration.ready;

  expect(registrations).toHaveLength(3);
  expect(registrations.every(({ signal }) => signal === registration.controller.signal)).toBe(true);
  expect(registration.controller.signal.aborted).toBe(false);

  registration.controller.abort();

  expect(registrations.every(({ signal }) => signal?.aborted === true)).toBe(true);
});

it("uses the registration signal when a browser omits execution options", async () => {
  const registrations: Array<{
    readonly signal: AbortSignal | undefined;
    readonly tool: ModelContextTool;
  }> = [];
  const registration = registerStateTools(
    { _tag: "Install", installSkill: "Install the approved capability." },
    recordingModelContext(registrations),
    () => undefined,
  );

  await registration.ready;
  const tool = registrations[0]?.tool;
  await expect(tool?.execute({})).resolves.toMatchObject({
    content: "Install the approved capability.",
    filename: "SKILL.md",
  });

  registration.controller.abort(new Error("Studio state was released."));
  await expect(tool?.execute({})).rejects.toThrow("Studio state was released.");
});

it("marks inspected inventory as untrusted browser-agent content", async () => {
  const registrations: Array<{
    readonly signal: AbortSignal | undefined;
    readonly tool: ModelContextTool;
  }> = [];
  const registration = registerStateTools(
    { _tag: "Inspect" },
    recordingModelContext(registrations),
    () => undefined,
  );

  await registration.ready;

  expect(registrations[0]?.tool.annotations).toMatchObject({
    readOnlyHint: false,
    untrustedContentHint: true,
  });
  registration.controller.abort();
});

it("uses a closed object schema for tools with no arguments", async () => {
  const registrations: Array<{
    readonly signal: AbortSignal | undefined;
    readonly tool: ModelContextTool;
  }> = [];
  const registration = registerStateTools(
    {
      _tag: "Prove",
      receipt: { capabilityId: "capability-proof", readToken: "read-token" },
    },
    recordingModelContext(registrations),
    () => undefined,
  );
  await registration.ready;
  const tool = registrations[0]?.tool;
  expect(tool?.inputSchema).toEqual({ additionalProperties: false, type: "object" });
  await expect(
    tool?.execute({ unexpected: true }, { signal: new AbortController().signal }),
  ).rejects.toThrow();
  registration.controller.abort();
});

it("exposes the exact snake-case authoring contract and validates the current draft", async () => {
  const inspectRegistrations: Array<{
    readonly signal: AbortSignal | undefined;
    readonly tool: ModelContextTool;
  }> = [];
  const inspectRegistration = registerStateTools(
    { _tag: "Inspect" },
    recordingModelContext(inspectRegistrations),
    () => undefined,
  );
  await inspectRegistration.ready;
  const inspect = inspectRegistrations[0]?.tool;
  expect(inspect?.inputSchema).toHaveProperty("properties.safety_boundary");
  expect(inspect?.inputSchema).toHaveProperty("required", ["safety_boundary", "task", "url"]);
  inspectRegistration.controller.abort();

  const messages: Array<unknown> = [];
  const defineRegistrations: Array<{
    readonly signal: AbortSignal | undefined;
    readonly tool: ModelContextTool;
  }> = [];
  const defineRegistration = registerStateTools(
    { _tag: "Define" },
    recordingModelContext(defineRegistrations),
    (message) => messages.push(message),
  );
  await defineRegistration.ready;
  const draft = defineRegistrations.find(({ tool }) => tool.name === "draft_form_tool")?.tool;
  const revise = defineRegistrations.find(({ tool }) => tool.name === "revise_form_tool")?.tool;
  const validate = defineRegistrations.find(({ tool }) => tool.name === "validate_draft")?.tool;

  expect(draft?.inputSchema).toHaveProperty("properties.form_id");
  expect(draft?.inputSchema).toHaveProperty("properties.submit_policy");
  expect(draft?.inputSchema).toHaveProperty("properties.parameters.items.properties.control_name");
  expect(draft?.inputSchema).not.toHaveProperty("properties.annotations");
  expect(validate?.inputSchema).toEqual({ additionalProperties: false, type: "object" });

  await expect(
    draft?.execute({
      description: "Fill the contact form and leave it ready for review.",
      form_id: "contact",
      name: "fill_contact",
      parameters: [
        {
          control_name: "email",
          description: "The email to place in the approved control.",
          kind: "email",
          name: "email",
          options: [],
          required: true,
          title: "Work email",
        },
      ],
      submit_policy: "fill_for_review",
      title: "Fill contact form",
    }),
  ).resolves.toMatchObject({ draftReceived: true, publicationCreated: false });
  expect(messages[0]).toMatchObject({
    _tag: "AgentDraftedCapability",
    draft: {
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      formId: "contact",
      submitPolicy: "fill_for_review",
    },
  });

  await expect(revise?.execute({ title: "Revised contact form" })).resolves.toMatchObject({
    publicationCreated: false,
    revisionReceived: true,
  });
  expect(messages[1]).toMatchObject({
    _tag: "AgentRevisedCapability",
    changes: { title: "Revised contact form" },
  });

  await expect(validate?.execute({})).resolves.toMatchObject({
    publicationCreated: false,
    validationRequested: true,
  });
  expect(messages[2]).toMatchObject({ _tag: "AgentRequestedValidation" });
  await expect(validate?.execute({ unexpected: true })).rejects.toThrow();
  defineRegistration.controller.abort();
});
