import {
  type CapabilityConfig,
  decodeCapabilityConfig,
  RUNTIME_PATH,
  RUNTIME_VERSION,
} from "./config.ts";
import { fillFormForReview, fingerprintForm, inputSchemaFor } from "./form.ts";

type ProofOutcome = "success" | "failure" | "abort";

interface ExecutionOptions {
  readonly signal: AbortSignal;
}

interface ModelContextTool {
  readonly annotations: {
    readonly readOnlyHint: boolean;
    readonly untrustedContentHint: boolean;
  };
  readonly description: string;
  readonly execute: (input: unknown, options: ExecutionOptions) => Promise<unknown>;
  readonly inputSchema: Record<string, unknown>;
  readonly name: string;
  readonly title: string;
}

interface ModelContext {
  registerTool(tool: ModelContextTool, options: { readonly signal: AbortSignal }): Promise<void>;
}

interface WebMcpDocument extends Document {
  readonly modelContext: ModelContext | undefined;
}

export interface RuntimeDependencies {
  readonly crypto: Crypto;
  readonly fetch: (input: string, init: RequestInit) => Promise<unknown>;
  readonly now: () => number;
}

const fail = (): never => {
  throw new Error("WebMCPifier refused to install this capability.");
};

const scriptConfig = (script: HTMLScriptElement | null): string => {
  if (script === null) return fail();
  const source = new URL(script.src);
  if (
    source.protocol !== "https:" ||
    source.username.length > 0 ||
    source.password.length > 0 ||
    source.pathname !== RUNTIME_PATH ||
    source.search.length > 0 ||
    source.hash.length > 0 ||
    script.integrity.trim().length === 0 ||
    script.crossOrigin !== "anonymous"
  ) {
    return fail();
  }
  const encoded = script.getAttribute("data-webmcpifier");
  if (encoded === null) return fail();
  return encoded;
};

const assertTarget = (document: Document, config: CapabilityConfig): HTMLFormElement => {
  if (
    document.location?.origin !== config.target.origin ||
    document.location.pathname !== config.target.pathname
  ) {
    return fail();
  }
  const form =
    document.getElementById(config.target.formId) ?? document.forms.namedItem(config.target.formId);
  if (form?.tagName !== "FORM") return fail();
  return form as HTMLFormElement;
};

const injectOriginTrial = (document: Document, token: string): void => {
  const meta = document.createElement("meta");
  meta.httpEquiv = "origin-trial";
  meta.content = token;
  document.head.prepend(meta);
};

const sha256Hex = async (value: string, crypto: Crypto): Promise<string> => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const sendProof = (
  config: CapabilityConfig,
  capabilityHash: string,
  outcome: ProofOutcome,
  latencyMs: number,
  fetch: RuntimeDependencies["fetch"],
): void => {
  const body = JSON.stringify({
    capabilityHash,
    capabilityId: config.capabilityId,
    latencyMs,
    origin: config.target.origin,
    outcome,
    runtimeVersion: RUNTIME_VERSION,
    writeToken: config.proof.writeToken,
  });
  void fetch(config.proof.endpoint, {
    body,
    credentials: "omit",
    headers: { "content-type": "application/json" },
    keepalive: true,
    method: "POST",
    mode: "cors",
    referrerPolicy: "no-referrer",
  }).catch(() => undefined);
};

const executionFor =
  (
    config: CapabilityConfig,
    form: HTMLFormElement,
    capabilityHash: string,
    dependencies: RuntimeDependencies,
  ): ModelContextTool["execute"] =>
  async (input, options) => {
    const startedAt = dependencies.now();
    let outcome: ProofOutcome = "failure";
    try {
      if (options.signal.aborted) throw options.signal.reason;
      const updatedFieldCount = fillFormForReview(
        form,
        config.tool.parameters,
        input,
        options.signal,
      );
      outcome = "success";
      return {
        status: "ready_for_review",
        submissionRequired: true,
        updatedFieldCount,
      };
    } catch (error) {
      outcome = options.signal.aborted ? "abort" : "failure";
      throw error;
    } finally {
      const elapsed = dependencies.now() - startedAt;
      const latencyMs = Number.isFinite(elapsed) ? Math.max(0, Math.round(elapsed)) : 0;
      sendProof(config, capabilityHash, outcome, latencyMs, dependencies.fetch);
    }
  };

export const installRuntime = async (
  document: Document,
  script: HTMLScriptElement | null,
  dependencies: RuntimeDependencies,
): Promise<void> => {
  const config = decodeCapabilityConfig(scriptConfig(script));
  const form = assertTarget(document, config);

  injectOriginTrial(document, config.runtime.originTrialToken);

  const modelContext = (document as WebMcpDocument).modelContext;
  if (modelContext === undefined) return;

  const [actualFingerprint, capabilityHash] = await Promise.all([
    fingerprintForm(form, dependencies.crypto),
    sha256Hex(JSON.stringify(config), dependencies.crypto),
  ]);
  if (actualFingerprint !== config.target.fingerprint) return fail();

  const registration = new AbortController();
  document.defaultView?.addEventListener("pagehide", () => registration.abort(), { once: true });
  await modelContext.registerTool(
    {
      annotations: config.tool.annotations,
      description: config.tool.description,
      execute: executionFor(config, form, capabilityHash, dependencies),
      inputSchema: inputSchemaFor(config.tool.parameters),
      name: config.tool.name,
      title: config.tool.title,
    },
    { signal: registration.signal },
  );
};
