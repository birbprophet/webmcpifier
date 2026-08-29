import {
  AbsoluteHttpsOrigin,
  LATENCY_BUCKET_UPPER_BOUNDS,
  LatencyBuckets,
  PROOF_RETENTION_MILLISECONDS,
  ProofEvent,
  RUNTIME_VERSION,
  Sha256Hex,
  type ProofSummary,
} from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ProofDenied } from "./errors.ts";

const Count = Schema.Natural;
export const TokenHash = Sha256Hex;

export const ProofTelemetryEvent = Schema.Struct({
  ...ProofEvent.fields,
  runtimeVersion: Schema.Literal(RUNTIME_VERSION),
});
export type ProofTelemetryEvent = typeof ProofTelemetryEvent.Type;

export const ProofInitialization = Schema.Struct({
  capabilityHash: Sha256Hex,
  origin: AbsoluteHttpsOrigin,
  readTokenHash: TokenHash,
  runtimeVersion: Schema.Literal(RUNTIME_VERSION),
  writeTokenHash: TokenHash,
});
export type ProofInitialization = typeof ProofInitialization.Type;

export const ProofState = Schema.Struct({
  aborts: Count,
  capabilityHash: Sha256Hex,
  expiresAt: Schema.Natural,
  failures: Count,
  invocations: Count,
  lastSeenAt: Schema.String,
  latency: LatencyBuckets,
  origin: AbsoluteHttpsOrigin,
  rateWindowCount: Count,
  rateWindowStartedAt: Schema.Natural,
  readTokenHash: TokenHash,
  runtimeVersion: Schema.Literal(RUNTIME_VERSION),
  successes: Count,
  writeTokenHash: TokenHash,
});
export type ProofState = typeof ProofState.Type;

const PROOF_RATE_LIMIT = 120;
const PROOF_RATE_WINDOW_MILLISECONDS = 60_000;

const encoder = new TextEncoder();

export const digestToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hexBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

export const tokenMatches = async (expectedHash: string, token: string): Promise<boolean> => {
  const actualHash = await digestToken(token);
  const expected = hexBytes(expectedHash);
  const actual = hexBytes(actualHash);
  const platformComparison = Reflect.get(crypto.subtle, "timingSafeEqual");
  if (typeof platformComparison === "function") {
    return Reflect.apply(platformComparison, crypto.subtle, [expected, actual]) === true;
  }
  let difference = expected.length ^ actual.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected[index]! ^ actual[index % actual.length]!;
  }
  return difference === 0;
};

const emptyLatency = (): typeof LatencyBuckets.Type => ({
  atMost100Ms: 0,
  atMost300Ms: 0,
  atMost1000Ms: 0,
  atMost3000Ms: 0,
  over3000Ms: 0,
});

export const initializeProofState = (input: ProofInitialization, now: number): ProofState => ({
  aborts: 0,
  capabilityHash: input.capabilityHash,
  expiresAt: now + PROOF_RETENTION_MILLISECONDS,
  failures: 0,
  invocations: 0,
  lastSeenAt: new Date(now).toISOString(),
  latency: emptyLatency(),
  origin: input.origin,
  rateWindowCount: 0,
  rateWindowStartedAt: now,
  readTokenHash: input.readTokenHash,
  runtimeVersion: input.runtimeVersion,
  successes: 0,
  writeTokenHash: input.writeTokenHash,
});

export const consumeProofRate = (
  state: ProofState,
  now: number,
): { readonly allowed: boolean; readonly state: ProofState } => {
  const inCurrentWindow = now - state.rateWindowStartedAt < PROOF_RATE_WINDOW_MILLISECONDS;
  if (inCurrentWindow && state.rateWindowCount >= PROOF_RATE_LIMIT) {
    return { allowed: false, state };
  }
  return {
    allowed: true,
    state: {
      ...state,
      rateWindowCount: inCurrentWindow ? state.rateWindowCount + 1 : 1,
      rateWindowStartedAt: inCurrentWindow ? state.rateWindowStartedAt : now,
    },
  };
};

const incrementLatency = (
  latency: typeof LatencyBuckets.Type,
  milliseconds: number,
): typeof LatencyBuckets.Type => {
  if (milliseconds <= LATENCY_BUCKET_UPPER_BOUNDS[0]) {
    return { ...latency, atMost100Ms: latency.atMost100Ms + 1 };
  }
  if (milliseconds <= LATENCY_BUCKET_UPPER_BOUNDS[1]) {
    return { ...latency, atMost300Ms: latency.atMost300Ms + 1 };
  }
  if (milliseconds <= LATENCY_BUCKET_UPPER_BOUNDS[2]) {
    return { ...latency, atMost1000Ms: latency.atMost1000Ms + 1 };
  }
  if (milliseconds <= LATENCY_BUCKET_UPPER_BOUNDS[3]) {
    return { ...latency, atMost3000Ms: latency.atMost3000Ms + 1 };
  }
  return { ...latency, over3000Ms: latency.over3000Ms + 1 };
};

export const applyProofEvent = (
  state: ProofState,
  event: ProofTelemetryEvent,
  now: number,
): Effect.Effect<ProofState, ProofDenied> => {
  if (
    event.capabilityHash !== state.capabilityHash ||
    event.origin !== state.origin ||
    event.runtimeVersion !== state.runtimeVersion
  ) {
    return Effect.fail(
      new ProofDenied({ message: "The proof event does not match this capability." }),
    );
  }
  return Effect.succeed({
    ...state,
    aborts: state.aborts + (event.outcome === "abort" ? 1 : 0),
    expiresAt: now + PROOF_RETENTION_MILLISECONDS,
    failures: state.failures + (event.outcome === "failure" ? 1 : 0),
    invocations: state.invocations + 1,
    lastSeenAt: new Date(now).toISOString(),
    latency: incrementLatency(state.latency, event.latencyMs),
    successes: state.successes + (event.outcome === "success" ? 1 : 0),
  });
};

export const proofSummary = (state: ProofState): ProofSummary => ({
  aborts: state.aborts,
  capabilityHash: state.capabilityHash,
  failures: state.failures,
  invocations: state.invocations,
  lastSeenAt: state.lastSeenAt,
  latency: state.latency,
  origin: state.origin,
  runtimeVersion: state.runtimeVersion,
  successes: state.successes,
});
