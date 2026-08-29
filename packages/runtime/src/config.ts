export const CONFIG_VERSION = 1;
export const RUNTIME_VERSION = "1.0.0";
export const RUNTIME_PATH = "/runtime/v1.js";

const MAX_CONFIG_LENGTH = 65_536;
const MAX_CONTROLS = 48;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_NAME_LENGTH = 30;
const MAX_PARAMETER_DESCRIPTION_LENGTH = 150;
const HTML_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/u;
const TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/u;
const OPAQUE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/u;
const SHA_256_PATTERN = /^[a-f0-9]{64}$/u;

export type ControlKind = "text" | "email" | "tel" | "textarea" | "select" | "radio";

export interface ToolParameter {
  readonly controlName: string;
  readonly description: string;
  readonly kind: ControlKind;
  readonly name: string;
  readonly options: readonly string[];
  readonly required: boolean;
  readonly title: string;
}

export interface CapabilityConfig {
  readonly capabilityId: string;
  readonly proof: {
    readonly endpoint: string;
    readonly writeToken: string;
  };
  readonly runtime: {
    readonly originTrialToken: string;
    readonly version: string;
  };
  readonly target: {
    readonly fingerprint: string;
    readonly formId: string;
    readonly origin: string;
    readonly pathname: string;
  };
  readonly tool: {
    readonly annotations: {
      readonly readOnlyHint: boolean;
      readonly untrustedContentHint: boolean;
    };
    readonly description: string;
    readonly name: string;
    readonly parameters: readonly ToolParameter[];
    readonly submitPolicy: "fill_for_review";
    readonly title: string;
  };
  readonly version: 1;
}

const CONTROL_KINDS = new Set<ControlKind>(["text", "email", "tel", "textarea", "select", "radio"]);

const fail = (): never => {
  throw new Error("Invalid WebMCPifier capability configuration.");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const recordWithKeys = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  if (!isRecord(value)) return fail();
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return fail();
  }
  return value;
};

const nonBlankString = (value: unknown, maximum = Number.POSITIVE_INFINITY): string => {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > maximum) {
    return fail();
  }
  return value;
};

const boolean = (value: unknown): boolean => {
  if (typeof value !== "boolean") return fail();
  return value;
};

const htmlName = (value: unknown): string => {
  const name = nonBlankString(value, MAX_NAME_LENGTH);
  if (!HTML_NAME_PATTERN.test(name)) return fail();
  return name;
};

const toolName = (value: unknown): string => {
  const name = nonBlankString(value, MAX_NAME_LENGTH);
  if (!TOOL_NAME_PATTERN.test(name)) return fail();
  return name;
};

const stringArray = (value: unknown): readonly string[] => {
  if (!Array.isArray(value) || value.length > MAX_CONTROLS) return fail();
  const strings = value.map((item) => nonBlankString(item));
  if (new Set(strings).size !== strings.length) return fail();
  return strings;
};

const opaqueToken = (value: unknown): string => {
  const token = nonBlankString(value, MAX_CONFIG_LENGTH);
  if (!OPAQUE_TOKEN_PATTERN.test(token)) return fail();
  return token;
};

const controlKind = (value: unknown): ControlKind => {
  if (typeof value !== "string" || !CONTROL_KINDS.has(value as ControlKind)) return fail();
  return value as ControlKind;
};

const decodeParameter = (value: unknown): ToolParameter => {
  const parameter = recordWithKeys(value, [
    "controlName",
    "description",
    "kind",
    "name",
    "options",
    "required",
    "title",
  ]);
  return {
    controlName: htmlName(parameter.controlName),
    description: nonBlankString(parameter.description, MAX_PARAMETER_DESCRIPTION_LENGTH),
    kind: controlKind(parameter.kind),
    name: htmlName(parameter.name),
    options: stringArray(parameter.options),
    required: boolean(parameter.required),
    title: nonBlankString(parameter.title),
  };
};

const decodeParameters = (value: unknown): readonly ToolParameter[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CONTROLS) return fail();
  const parameters = value.map(decodeParameter);
  const names = new Set(parameters.map(({ name }) => name));
  const controls = new Set(parameters.map(({ controlName }) => controlName));
  if (names.size !== parameters.length || controls.size !== parameters.length) return fail();
  return parameters;
};

const httpsUrl = (value: unknown): string => {
  const text = nonBlankString(value);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail();
  }
  if (url.protocol !== "https:" || url.username.length > 0 || url.password.length > 0)
    return fail();
  return text;
};

const exactOrigin = (value: unknown): string => {
  const text = httpsUrl(value);
  const url = new URL(text);
  if (url.origin !== text) return fail();
  return text;
};

export const decodeCapabilityConfig = (encoded: string): CapabilityConfig => {
  if (!/^[A-Za-z0-9_-]+$/u.test(encoded) || encoded.length > MAX_CONFIG_LENGTH) return fail();
  const padding = "=".repeat((4 - (encoded.length % 4)) % 4);
  let decoded: unknown;
  try {
    const binary = atob(encoded.replaceAll("-", "+").replaceAll("_", "/") + padding);
    const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0);
    decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return fail();
  }

  const config = recordWithKeys(decoded, [
    "capabilityId",
    "proof",
    "runtime",
    "target",
    "tool",
    "version",
  ]);
  if (config.version !== CONFIG_VERSION) return fail();

  const proof = recordWithKeys(config.proof, ["endpoint", "writeToken"]);
  const runtime = recordWithKeys(config.runtime, ["originTrialToken", "version"]);
  const target = recordWithKeys(config.target, ["fingerprint", "formId", "origin", "pathname"]);
  const tool = recordWithKeys(config.tool, [
    "annotations",
    "description",
    "name",
    "parameters",
    "submitPolicy",
    "title",
  ]);
  const annotations = recordWithKeys(tool.annotations, ["readOnlyHint", "untrustedContentHint"]);
  const fingerprint = nonBlankString(target.fingerprint);
  const pathname = nonBlankString(target.pathname);

  if (
    runtime.version !== RUNTIME_VERSION ||
    tool.submitPolicy !== "fill_for_review" ||
    !SHA_256_PATTERN.test(fingerprint) ||
    !pathname.startsWith("/")
  ) {
    return fail();
  }

  return {
    capabilityId: opaqueToken(config.capabilityId),
    proof: {
      endpoint: httpsUrl(proof.endpoint),
      writeToken: opaqueToken(proof.writeToken),
    },
    runtime: {
      originTrialToken: nonBlankString(runtime.originTrialToken),
      version: runtime.version,
    },
    target: {
      fingerprint,
      formId: htmlName(target.formId),
      origin: exactOrigin(target.origin),
      pathname,
    },
    tool: {
      annotations: {
        readOnlyHint: boolean(annotations.readOnlyHint),
        untrustedContentHint: boolean(annotations.untrustedContentHint),
      },
      description: nonBlankString(tool.description, MAX_DESCRIPTION_LENGTH),
      name: toolName(tool.name),
      parameters: decodeParameters(tool.parameters),
      submitPolicy: tool.submitPolicy,
      title: nonBlankString(tool.title),
    },
    version: config.version,
  };
};
