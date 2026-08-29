import { ProofSummaryRequest } from "@webmcpifier/domain";
import { DurableObject } from "cloudflare:workers";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ProofConflict, ProofDenied } from "./errors.ts";
import {
  applyProofEvent,
  consumeProofRate,
  initializeProofState,
  ProofInitialization,
  ProofState,
  ProofTelemetryEvent,
  proofSummary,
  tokenMatches,
} from "./proof.ts";

const STATE_KEY = "proof";
const strict = { onExcessProperty: "error" } as const;

export class CapabilityProof extends DurableObject {
  async initialize(input: unknown): Promise<void> {
    const initialization = await Schema.decodeUnknownPromise(ProofInitialization, strict)(input);
    const existing = await this.ctx.storage.get(STATE_KEY);
    if (existing !== undefined) {
      const state = await Schema.decodeUnknownPromise(ProofState, strict)(existing);
      const same =
        state.capabilityHash === initialization.capabilityHash &&
        state.origin === initialization.origin &&
        state.runtimeVersion === initialization.runtimeVersion &&
        state.readTokenHash === initialization.readTokenHash &&
        state.writeTokenHash === initialization.writeTokenHash;
      if (!same) throw new ProofConflict({ message: "The capability proof already exists." });
      return;
    }
    const state = initializeProofState(initialization, Date.now());
    await this.ctx.storage.put(STATE_KEY, state);
    await this.ctx.storage.setAlarm(state.expiresAt);
  }

  async record(input: unknown): Promise<boolean> {
    const event = await Schema.decodeUnknownPromise(ProofTelemetryEvent, strict)(input);
    const stored = await this.ctx.storage.get(STATE_KEY);
    if (stored === undefined)
      throw new ProofDenied({ message: "The capability proof is unavailable." });
    const initial = await Schema.decodeUnknownPromise(ProofState, strict)(stored);
    if (!(await tokenMatches(initial.writeTokenHash, event.writeToken))) {
      throw new ProofDenied({ message: "The capability proof is unavailable." });
    }

    return this.ctx.storage.transaction(async (transaction) => {
      const currentValue = await transaction.get(STATE_KEY);
      if (currentValue === undefined) {
        throw new ProofDenied({ message: "The capability proof is unavailable." });
      }
      const current = await Schema.decodeUnknownPromise(ProofState, strict)(currentValue);
      const now = Date.now();
      const rate = consumeProofRate(current, now);
      if (!rate.allowed) return false;
      const updated = await Effect.runPromise(applyProofEvent(rate.state, event, now));
      await transaction.put(STATE_KEY, updated);
      await transaction.setAlarm(updated.expiresAt);
      return true;
    });
  }

  async summary(input: unknown): Promise<ReturnType<typeof proofSummary>> {
    const request = await Schema.decodeUnknownPromise(ProofSummaryRequest, strict)(input);
    const stored = await this.ctx.storage.get(STATE_KEY);
    if (stored === undefined)
      throw new ProofDenied({ message: "The capability proof is unavailable." });
    const state = await Schema.decodeUnknownPromise(ProofState, strict)(stored);
    if (!(await tokenMatches(state.readTokenHash, request.readToken))) {
      throw new ProofDenied({ message: "The capability proof is unavailable." });
    }
    return proofSummary(state);
  }

  override async alarm(): Promise<void> {
    const stored = await this.ctx.storage.get(STATE_KEY);
    if (stored === undefined) return;
    const state = await Schema.decodeUnknownPromise(ProofState, strict)(stored);
    if (state.expiresAt > Date.now()) {
      await this.ctx.storage.setAlarm(state.expiresAt);
      return;
    }
    await this.ctx.storage.deleteAll();
  }
}
