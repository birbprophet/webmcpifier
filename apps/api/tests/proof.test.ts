import { expect, it } from "@effect/vitest";
import { PROOF_RETENTION_MILLISECONDS } from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import {
  applyProofEvent,
  consumeProofRate,
  digestToken,
  initializeProofState,
  PROOF_RATE_POLICY,
  proofSummary,
  tokenMatches,
  type ProofTelemetryEvent,
} from "../src/proof.ts";

it.effect("keeps only hashed credentials and aggregate proof metadata", () =>
  Effect.gen(function* () {
    const readTokenHash = yield* digestToken("read-secret");
    const writeTokenHash = yield* digestToken("write-secret");
    const capabilityHash = yield* digestToken("capability-config");
    const startedAt = Date.UTC(2026, 7, 29, 12);
    let state = initializeProofState(
      {
        capabilityHash,
        origin: "https://demo.webmcpifier.com",
        readTokenHash,
        runtimeVersion: "1.0.0",
        writeTokenHash,
      },
      startedAt,
    );
    const event = (
      outcome: ProofTelemetryEvent["outcome"],
      latencyMs: number,
    ): ProofTelemetryEvent => ({
      capabilityHash,
      capabilityId: "cap_test",
      latencyMs,
      origin: "https://demo.webmcpifier.com",
      outcome,
      runtimeVersion: "1.0.0",
      writeToken: "write-secret",
    });
    state = yield* applyProofEvent(state, event("success", 80), startedAt + 1);
    state = yield* applyProofEvent(state, event("failure", 250), startedAt + 2);
    state = yield* applyProofEvent(state, event("abort", 4_000), startedAt + 3);

    expect(proofSummary(state)).toMatchObject({
      aborts: 1,
      failures: 1,
      invocations: 3,
      latency: {
        atMost100Ms: 1,
        atMost300Ms: 1,
        atMost1000Ms: 0,
        atMost3000Ms: 0,
        over3000Ms: 1,
      },
      successes: 1,
    });
    expect(state.expiresAt).toBe(startedAt + 3 + PROOF_RETENTION_MILLISECONDS);
    expect(JSON.stringify(state)).not.toContain("read-secret");
    expect(JSON.stringify(state)).not.toContain("write-secret");
    expect(Object.keys(state).sort()).toEqual([
      "aborts",
      "capabilityHash",
      "expiresAt",
      "failures",
      "invocations",
      "lastSeenAt",
      "latency",
      "origin",
      "rateWindowCount",
      "rateWindowStartedAt",
      "readTokenHash",
      "runtimeVersion",
      "successes",
      "writeTokenHash",
    ]);
    expect(yield* tokenMatches(writeTokenHash, "write-secret")).toBe(true);
    expect(yield* tokenMatches(writeTokenHash, "wrong-secret")).toBe(false);
  }),
);

it.effect("rejects proof metadata drift", () =>
  Effect.gen(function* () {
    const readTokenHash = yield* digestToken("read-secret");
    const writeTokenHash = yield* digestToken("write-secret");
    const capabilityHash = yield* digestToken("capability-config");
    const state = initializeProofState(
      {
        capabilityHash,
        origin: "https://demo.webmcpifier.com",
        readTokenHash,
        runtimeVersion: "1.0.0",
        writeTokenHash,
      },
      0,
    );
    const result = yield* Effect.exit(
      applyProofEvent(
        state,
        {
          capabilityHash: yield* digestToken("different-capability-config"),
          capabilityId: "cap_test",
          latencyMs: 10,
          origin: "https://demo.webmcpifier.com",
          outcome: "success",
          runtimeVersion: "1.0.0",
          writeToken: "write-secret",
        },
        1,
      ),
    );
    expect(result._tag).toBe("Failure");
  }),
);

it.effect("rate limits proof writes per capability without storing caller identity", () =>
  Effect.gen(function* () {
    const readTokenHash = yield* digestToken("read-secret");
    const writeTokenHash = yield* digestToken("write-secret");
    const capabilityHash = yield* digestToken("capability-config");
    let state = initializeProofState(
      {
        capabilityHash,
        origin: "https://demo.webmcpifier.com",
        readTokenHash,
        runtimeVersion: "1.0.0",
        writeTokenHash,
      },
      0,
    );
    for (let index = 0; index < PROOF_RATE_POLICY.limit; index += 1) {
      const result = consumeProofRate(state, index);
      expect(result.allowed).toBe(true);
      state = result.state;
    }
    expect(consumeProofRate(state, PROOF_RATE_POLICY.limit + 1).allowed).toBe(false);
    expect(consumeProofRate(state, PROOF_RATE_POLICY.windowMilliseconds).allowed).toBe(true);
    expect(JSON.stringify(state)).not.toContain("identity");
  }),
);
