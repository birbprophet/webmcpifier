import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { createApiHandler } from "../src/worker-impl.ts";

const STUDIO_ORIGIN = "https://www.webmcpifier.com";
const CUSTOMER_ORIGIN = "https://customer.example";
const event = {
  capabilityHash: "0".repeat(64),
  capabilityId: "cap_test",
  latencyMs: 42,
  origin: CUSTOMER_ORIGIN,
  outcome: "success",
  runtimeVersion: "1.0.0",
  writeToken: "write-token",
} as const;

const makeHandler = (recorded: Array<unknown>) =>
  createApiHandler({
    API_ORIGIN: "https://api.webmcpifier.com",
    BROWSER: { quickAction: () => Promise.resolve(new Response()) },
    PROOF: {
      getByName: () => ({
        record: (input: unknown) => {
          recorded.push(input);
          return Promise.resolve(true);
        },
      }),
    },
    RELEASE_COMMIT: "0123456789abcdef0123456789abcdef01234567",
    RUNTIME_INTEGRITY: "sha384-dGVzdA==",
    STUDIO_ORIGIN,
    WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: "third-party-token",
  });

const telemetryRequest = (body: unknown, origin = CUSTOMER_ORIGIN, suffix = "") =>
  new Request(`https://api.webmcpifier.com/proof/events${suffix}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });

it.effect("accepts only strict metadata from the authorized customer origin", () =>
  Effect.gen(function* () {
    const recorded: Array<unknown> = [];
    const handler = yield* makeHandler(recorded);

    const accepted = yield* Effect.promise(() => handler(telemetryRequest(event)));
    const wrongOrigin = yield* Effect.promise(() =>
      handler(telemetryRequest(event, "https://attacker.example")),
    );
    const excess = yield* Effect.promise(() =>
      handler(telemetryRequest({ ...event, contactEmail: "alex@example.test" })),
    );
    const query = yield* Effect.promise(() =>
      handler(telemetryRequest(event, CUSTOMER_ORIGIN, "?x=1")),
    );

    expect(accepted.status).toBe(204);
    expect(accepted.headers.get("access-control-allow-origin")).toBe(CUSTOMER_ORIGIN);
    expect(wrongOrigin.status).toBe(403);
    expect(excess.status).toBe(400);
    expect(query.status).toBe(400);
    expect(recorded).toEqual([event]);
  }),
);

it.effect("limits RPC CORS to the configured Studio origin", () =>
  Effect.gen(function* () {
    const handler = yield* makeHandler([]);
    const allowed = yield* Effect.promise(() =>
      handler(
        new Request("https://api.webmcpifier.com/rpc", {
          headers: { origin: STUDIO_ORIGIN },
          method: "OPTIONS",
        }),
      ),
    );
    const denied = yield* Effect.promise(() =>
      handler(
        new Request("https://api.webmcpifier.com/rpc", {
          headers: { origin: "https://attacker.example" },
          method: "OPTIONS",
        }),
      ),
    );

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(STUDIO_ORIGIN);
    expect(denied.status).toBe(403);
  }),
);
