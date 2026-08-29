export const CAPABILITY_CONFIG_VERSION = 1 as const;
export const RUNTIME_VERSION = "1.0.0";
export const RUNTIME_PATH = "/runtime/v1.js";

export const TOOL_LIMITS = {
  description: 500,
  name: 30,
  output: 1_500,
  parameterDescription: 150,
  parameterName: 30,
} as const;

export const SCAN_LIMITS = {
  controls: 48,
  forms: 8,
  pageBytes: 1_000_000,
  redirects: 5,
} as const;

export const PROOF_RETENTION_DAYS = 30;
export const PROOF_RETENTION_MILLISECONDS = PROOF_RETENTION_DAYS * 24 * 60 * 60 * 1_000;

export const LATENCY_BUCKET_UPPER_BOUNDS = [100, 300, 1_000, 3_000] as const;

export const WEBMCP_TOOL_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/u;
export const HTML_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]*$/u;
