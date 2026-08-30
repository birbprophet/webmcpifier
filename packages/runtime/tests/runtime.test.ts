import { expect, it } from "@effect/vitest";
import { Window } from "happy-dom";
import type { CapabilityConfig } from "../src/config.ts";
import { fingerprintForm } from "../src/form.ts";
import { installRuntime, type RuntimeDependencies } from "../src/runtime.ts";

interface CapturedTool {
  readonly inputSchema: Record<string, unknown>;
  readonly name: string;
  execute(input: unknown, options?: { readonly signal: AbortSignal }): Promise<unknown>;
}

interface CapturedRegistration {
  readonly signal: AbortSignal;
  readonly tool: CapturedTool;
}

interface Fixture {
  readonly config: CapabilityConfig;
  readonly dependencies: RuntimeDependencies;
  readonly form: HTMLFormElement;
  readonly proofs: readonly string[];
  readonly registration: CapturedRegistration;
  readonly window: Window;
}

const FORM_HTML = `
  <main>
    <form id="quote-form" tabindex="-1">
      <select id="service" name="service" required>
        <option value="">Choose</option>
        <option value="plumbing">Plumbing</option>
        <option value="electrical">Electrical</option>
      </select>
      <select id="urgency" name="urgency" required>
        <option value="">Choose</option>
        <option value="standard">Standard</option>
        <option value="soon">Soon</option>
        <option value="urgent">Urgent</option>
      </select>
      <select id="propertyType" name="propertyType" required>
        <option value="">Choose</option>
        <option value="house">House</option>
        <option value="apartment">Apartment</option>
      </select>
      <input id="postcode" name="postcode" type="text" pattern="[A-Za-z0-9 -]{3,10}" required />
      <textarea id="details" name="details" maxlength="1200" required></textarea>
      <input id="name" name="name" type="text" required />
      <input id="email" name="email" type="email" required />
      <button type="button" data-webmcpifier-review>Review request</button>
      <button type="submit">Send request</button>
    </form>
  </main>
`;

const parameters: CapabilityConfig["tool"]["parameters"] = [
  {
    controlName: "service",
    description: "The service needed.",
    kind: "select",
    name: "service",
    options: ["plumbing", "electrical"],
    required: true,
    title: "Service",
  },
  {
    controlName: "urgency",
    description: "When the service is needed.",
    kind: "select",
    name: "urgency",
    options: ["standard", "soon", "urgent"],
    required: true,
    title: "Timing",
  },
  {
    controlName: "propertyType",
    description: "The type of property.",
    kind: "select",
    name: "propertyType",
    options: ["house", "apartment"],
    required: true,
    title: "Property type",
  },
  {
    controlName: "postcode",
    description: "The service postcode.",
    kind: "text",
    name: "postcode",
    options: [],
    required: true,
    title: "Postcode",
  },
  {
    controlName: "details",
    description: "A short description of the issue.",
    kind: "textarea",
    name: "details",
    options: [],
    required: true,
    title: "Details",
  },
  {
    controlName: "name",
    description: "The contact name.",
    kind: "text",
    name: "name",
    options: [],
    required: true,
    title: "Name",
  },
  {
    controlName: "email",
    description: "The contact email address.",
    kind: "email",
    name: "email",
    options: [],
    required: true,
    title: "Email",
  },
];

const input = {
  details: "The kitchen tap has a slow leak.",
  email: "alex@example.test",
  name: "Alex Morgan",
  postcode: "94107",
  propertyType: "house",
  service: "plumbing",
  urgency: "soon",
};

const createWindow = (): Window =>
  new Window({
    settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
    url: "https://demo.webmcpifier.com/quote",
  });

const encodeConfig = (config: CapabilityConfig): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(config));
  let binary = "";
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const createFixture = async (
  mutateConfig: (config: CapabilityConfig) => CapabilityConfig = (config) => config,
): Promise<Fixture> => {
  const window = createWindow();
  const document = window.document as unknown as Document;
  document.body.innerHTML = FORM_HTML;
  const form = document.querySelector<HTMLFormElement>("#quote-form");
  if (form === null) throw new Error("Fixture form is missing.");
  const fingerprint = await fingerprintForm(form, crypto);
  const config = mutateConfig({
    capabilityId: "cap_northstar",
    proof: {
      endpoint: "https://api.webmcpifier.com/proof/events",
      writeToken: "write-token",
    },
    runtime: {
      originTrialToken: "third-party-origin-trial-token",
      version: "1.0.0",
    },
    target: {
      fingerprint,
      formId: "quote-form",
      origin: "https://demo.webmcpifier.com",
      pathname: "/quote",
    },
    tool: {
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      description: "Fill a service request for the user to review. Never submit it.",
      name: "prepare_service_quote",
      parameters,
      submitPolicy: "fill_for_review",
      title: "Prepare service quote",
    },
    version: 1,
  });
  const script = document.createElement("script");
  script.src = "https://www.webmcpifier.com/runtime/v1.js";
  script.integrity = "sha384-runtime";
  script.crossOrigin = "anonymous";
  script.setAttribute("data-webmcpifier", encodeConfig(config));
  document.body.append(script);

  const proofs: string[] = [];
  const dependencies: RuntimeDependencies = {
    crypto,
    fetch: async (_url, request) => {
      if (typeof request.body !== "string") throw new Error("Proof body must be JSON text.");
      proofs.push(request.body);
      return undefined;
    },
    now: (() => {
      let time = 100;
      return () => time++;
    })(),
  };
  let captured: CapturedRegistration | undefined;
  let metaExistedBeforeModelContext = false;
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    get: () => {
      metaExistedBeforeModelContext =
        document.querySelector('meta[http-equiv="origin-trial"]')?.getAttribute("content") ===
        "third-party-origin-trial-token";
      return {
        registerTool: async (tool: CapturedTool, options: { readonly signal: AbortSignal }) => {
          captured = { signal: options.signal, tool };
        },
      };
    },
  });

  await installRuntime(document, script, dependencies);
  if (!metaExistedBeforeModelContext || captured === undefined) {
    throw new Error("Runtime registration was not captured.");
  }
  return {
    config,
    dependencies,
    form,
    proofs,
    registration: captured,
    window,
  };
};

it("registers only after origin-trial injection and fills the semantic form for human review", async () => {
  const fixture = await createFixture();
  const events: string[] = [];
  for (const name of Object.keys(input)) {
    const control = fixture.window.document.getElementById(name);
    control?.addEventListener("input", () => events.push(`${name}:input`));
    control?.addEventListener("change", () => events.push(`${name}:change`));
  }

  let submissionAttempts = 0;
  Object.defineProperties(fixture.form, {
    requestSubmit: { value: () => submissionAttempts++ },
    submit: { value: () => submissionAttempts++ },
  });
  const submitButton = fixture.form.querySelector("button");
  if (submitButton === null) throw new Error("Fixture submit button is missing.");
  Object.defineProperty(submitButton, "click", { value: () => submissionAttempts++ });

  const result = await fixture.registration.tool.execute(input, {
    signal: new AbortController().signal,
  });

  expect(result).toEqual({
    status: "ready_for_review",
    submissionRequired: true,
    updatedFieldCount: 7,
  });
  expect(fixture.window.document.activeElement?.textContent).toBe("Review request");
  expect(submissionAttempts).toBe(0);
  expect(events).toHaveLength(14);
  expect(
    events.every((event, index) => event.endsWith(index % 2 === 0 ? ":input" : ":change")),
  ).toBe(true);
  for (const [name, value] of Object.entries(input)) {
    const control = fixture.window.document.getElementById(name) as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement
      | null;
    expect(control?.value).toBe(value);
  }

  expect(fixture.registration.tool.name).toBe("prepare_service_quote");
  expect(fixture.registration.tool.inputSchema).toMatchObject({
    additionalProperties: false,
    required: ["service", "urgency", "propertyType", "postcode", "details", "name", "email"],
    type: "object",
  });
  expect(fixture.proofs).toHaveLength(1);
  const telemetry = JSON.parse(fixture.proofs[0] ?? "") as Record<string, unknown>;
  expect(telemetry).toMatchObject({
    capabilityId: "cap_northstar",
    latencyMs: 1,
    origin: "https://demo.webmcpifier.com",
    outcome: "success",
    runtimeVersion: "1.0.0",
    writeToken: "write-token",
  });
  expect(Object.keys(telemetry).sort()).toEqual([
    "capabilityHash",
    "capabilityId",
    "latencyMs",
    "origin",
    "outcome",
    "runtimeVersion",
    "writeToken",
  ]);
  expect(JSON.stringify({ result, telemetry })).not.toContain(input.name);
  expect(JSON.stringify({ result, telemetry })).not.toContain(input.email);
});

it("uses the registration signal when a browser omits execution options", async () => {
  const fixture = await createFixture();

  await expect(fixture.registration.tool.execute(input)).resolves.toMatchObject({
    status: "ready_for_review",
    submissionRequired: true,
  });
  expect((JSON.parse(fixture.proofs[0] ?? "") as { readonly outcome: string }).outcome).toBe(
    "success",
  );

  const aborted = await createFixture();
  aborted.window.dispatchEvent(new aborted.window.Event("pagehide"));
  await expect(aborted.registration.tool.execute(input)).rejects.toThrow();
});

it("validates every execution input before mutating the form", async () => {
  const fixture = await createFixture();
  const invalidInputs = [
    { ...input, email: "not-an-email" },
    { ...input, service: "roofing" },
    { ...input, postcode: "?" },
    { ...input, unexpected: "value" },
    { ...input, name: undefined },
  ];

  for (const invalidInput of invalidInputs) {
    await expect(
      fixture.registration.tool.execute(invalidInput, { signal: new AbortController().signal }),
    ).rejects.toThrow("form contract");
  }
  expect(fixture.form.querySelector<HTMLSelectElement>("#service")?.value).toBe("");
  expect(fixture.proofs).toHaveLength(invalidInputs.length);
  expect(
    fixture.proofs.every(
      (proof) => (JSON.parse(proof) as { readonly outcome: string }).outcome === "failure",
    ),
  ).toBe(true);
});

it("stops an execution when its distinct cancellation signal aborts", async () => {
  const fixture = await createFixture();
  const execution = new AbortController();
  fixture.window.document.getElementById("service")?.addEventListener("input", () => {
    execution.abort(new Error("cancelled"));
  });

  await expect(
    fixture.registration.tool.execute(input, { signal: execution.signal }),
  ).rejects.toThrow("cancelled");
  expect(fixture.window.document.activeElement).not.toBe(fixture.form);
  expect(fixture.form.querySelector<HTMLSelectElement>("#urgency")?.value).toBe("");
  expect((JSON.parse(fixture.proofs[0] ?? "") as { readonly outcome: string }).outcome).toBe(
    "abort",
  );
});

it("aborts the registration signal on page unload", async () => {
  const fixture = await createFixture();
  expect(fixture.registration.signal.aborted).toBe(false);
  fixture.window.dispatchEvent(new fixture.window.Event("pagehide"));
  expect(fixture.registration.signal.aborted).toBe(true);
});

it("refuses exact target and fingerprint drift without registering a tool", async () => {
  for (const mutateConfig of [
    (config: CapabilityConfig): CapabilityConfig => ({
      ...config,
      target: { ...config.target, origin: "https://different.example" },
    }),
    (config: CapabilityConfig): CapabilityConfig => ({
      ...config,
      target: { ...config.target, pathname: "/different" },
    }),
    (config: CapabilityConfig): CapabilityConfig => ({
      ...config,
      target: { ...config.target, fingerprint: "0".repeat(64) },
    }),
  ]) {
    const window = createWindow();
    const document = window.document as unknown as Document;
    document.body.innerHTML = FORM_HTML;
    const form = document.querySelector<HTMLFormElement>("#quote-form");
    if (form === null) throw new Error("Fixture form is missing.");
    const fingerprint = await fingerprintForm(form, crypto);
    const base = (await createFixture()).config;
    const config = mutateConfig({ ...base, target: { ...base.target, fingerprint } });
    const script = document.createElement("script");
    script.src = "https://www.webmcpifier.com/runtime/v1.js";
    script.integrity = "sha384-runtime";
    script.crossOrigin = "anonymous";
    script.setAttribute("data-webmcpifier", encodeConfig(config));
    let registrations = 0;
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async () => {
          registrations++;
        },
      },
    });
    await expect(
      installRuntime(document, script, {
        crypto,
        fetch: async () => undefined,
        now: () => 0,
      }),
    ).rejects.toThrow("refused");
    expect(registrations).toBe(0);
  }
});

it("silently no-ops when this browser has no WebMCP surface", async () => {
  const window = createWindow();
  const document = window.document as unknown as Document;
  document.body.innerHTML = FORM_HTML;
  const form = document.querySelector<HTMLFormElement>("#quote-form");
  if (form === null) throw new Error("Fixture form is missing.");
  const base = (await createFixture()).config;
  const config = {
    ...base,
    target: { ...base.target, fingerprint: await fingerprintForm(form, crypto) },
  };
  const script = document.createElement("script");
  script.src = "https://www.webmcpifier.com/runtime/v1.js";
  script.integrity = "sha384-runtime";
  script.crossOrigin = "anonymous";
  script.setAttribute("data-webmcpifier", encodeConfig(config));

  await expect(
    installRuntime(document, script, {
      crypto,
      fetch: async () => undefined,
      now: () => 0,
    }),
  ).resolves.toBeUndefined();
  expect(document.querySelector('meta[http-equiv="origin-trial"]')?.getAttribute("content")).toBe(
    "third-party-origin-trial-token",
  );
});

it("keeps disabled controls out of the structural contract and rejects implicit options", async () => {
  const window = createWindow();
  const document = window.document as unknown as Document;
  document.body.innerHTML = FORM_HTML;
  const form = document.querySelector<HTMLFormElement>("#quote-form");
  const service = document.querySelector<HTMLSelectElement>("#service");
  if (form === null || service === null) throw new Error("Fixture form is missing.");
  const baseline = await fingerprintForm(form, crypto);

  const disabled = document.createElement("input");
  disabled.disabled = true;
  disabled.name = "internal_note";
  disabled.type = "text";
  form.append(disabled);
  const disabledOption = document.createElement("option");
  disabledOption.disabled = true;
  disabledOption.value = "retired";
  service.append(disabledOption);

  expect(await fingerprintForm(form, crypto)).toBe(baseline);

  const implicitOption = document.createElement("option");
  implicitOption.textContent = "Implicit value";
  service.append(implicitOption);
  expect(() => fingerprintForm(form, crypto)).toThrow("contract");
});
