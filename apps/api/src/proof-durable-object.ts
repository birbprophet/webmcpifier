import { ProofSummaryRequest } from "@webmcpifier/domain";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Clock from "effect/Clock";
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

const unavailable = (): ProofDenied =>
  new ProofDenied({ message: "The capability proof is unavailable." });

const decodeStoredState = (input: unknown) =>
  Schema.decodeUnknownEffect(ProofState)(input, strict).pipe(Effect.orDie);

/**
 * One Effect-native Durable Object instance owns one published capability.
 * Inputs are decoded again at the storage boundary; persisted state is decoded
 * on every read so a stale or malformed object cannot be treated as trusted.
 */
export class CapabilityProof extends Cloudflare.DurableObject<CapabilityProof>()(
  "CapabilityProof",
  Effect.gen(function* () {
    const state = yield* Cloudflare.DurableObjectState;

    return Effect.succeed({
      initialize: (input: unknown) =>
        Effect.gen(function* () {
          const initialization = yield* Schema.decodeUnknownEffect(ProofInitialization)(
            input,
            strict,
          ).pipe(
            Effect.mapError(
              () => new ProofConflict({ message: "The capability proof is invalid." }),
            ),
          );
          const existing = yield* state.storage.get(STATE_KEY);
          if (existing !== undefined) {
            const stored = yield* decodeStoredState(existing);
            const unchanged =
              stored.capabilityHash === initialization.capabilityHash &&
              stored.origin === initialization.origin &&
              stored.runtimeVersion === initialization.runtimeVersion &&
              stored.readTokenHash === initialization.readTokenHash &&
              stored.writeTokenHash === initialization.writeTokenHash;
            if (!unchanged) {
              return yield* new ProofConflict({
                message: "The capability proof already exists.",
              });
            }
            return;
          }
          const now = yield* Clock.currentTimeMillis;
          const stored = initializeProofState(initialization, now);
          yield* state.storage.put(STATE_KEY, stored);
          yield* state.storage.setAlarm(stored.expiresAt);
        }),

      record: (input: unknown) =>
        Effect.gen(function* () {
          const event = yield* Schema.decodeUnknownEffect(ProofTelemetryEvent)(input, strict).pipe(
            Effect.mapError(unavailable),
          );
          const existing = yield* state.storage.get(STATE_KEY);
          if (existing === undefined) return yield* unavailable();
          const initial = yield* decodeStoredState(existing);
          if (!(yield* tokenMatches(initial.writeTokenHash, event.writeToken))) {
            return yield* unavailable();
          }

          const now = yield* Clock.currentTimeMillis;
          yield* applyProofEvent(initial, event, now);
          const accepted = yield* state.storage.transaction((transaction) =>
            Effect.gen(function* () {
              const currentValue = yield* transaction.get(STATE_KEY);
              if (currentValue === undefined) return undefined;
              const current = yield* decodeStoredState(currentValue);
              const rate = consumeProofRate(current, now);
              if (!rate.allowed) return false;
              const updated = yield* applyProofEvent(rate.state, event, now).pipe(Effect.orDie);
              yield* transaction.put(STATE_KEY, updated);
              yield* transaction.setAlarm(updated.expiresAt);
              return true;
            }),
          );
          if (accepted === undefined) return yield* unavailable();
          return accepted;
        }),

      summary: (input: unknown) =>
        Effect.gen(function* () {
          const request = yield* Schema.decodeUnknownEffect(ProofSummaryRequest)(
            input,
            strict,
          ).pipe(Effect.mapError(unavailable));
          const existing = yield* state.storage.get(STATE_KEY);
          if (existing === undefined) return yield* unavailable();
          const stored = yield* decodeStoredState(existing);
          if (!(yield* tokenMatches(stored.readTokenHash, request.readToken))) {
            return yield* unavailable();
          }
          return proofSummary(stored);
        }),

      alarm: () =>
        Effect.gen(function* () {
          const existing = yield* state.storage.get(STATE_KEY);
          if (existing === undefined) return;
          const stored = yield* decodeStoredState(existing);
          const now = yield* Clock.currentTimeMillis;
          if (stored.expiresAt > now) {
            yield* state.storage.setAlarm(stored.expiresAt);
            return;
          }
          yield* state.storage.deleteAll();
        }),
    });
  }),
) {}

export type CapabilityProofNamespace = Cloudflare.DurableObject<CapabilityProof>;
