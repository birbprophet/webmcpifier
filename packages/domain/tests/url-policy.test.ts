import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FastCheck from "effect/testing/FastCheck";
import { parsePublicTarget } from "../src/url-policy.ts";

it.effect("accepts a public HTTPS page", () =>
  Effect.gen(function* () {
    const target = yield* parsePublicTarget("https://example.com/quote?ref=demo#form");
    expect(target).toEqual({
      origin: "https://example.com",
      pathname: "/quote",
      url: "https://example.com/quote?ref=demo",
    });
  }),
);

it.effect("rejects credentials, local hosts, private addresses, and non-HTTPS URLs", () =>
  Effect.gen(function* () {
    const inputs = [
      "http://example.com",
      "https://user:secret@example.com",
      "https://localhost/quote",
      "https://127.0.0.1/quote",
      "https://8.8.8.8/quote",
      "https://10.0.0.4/quote",
      "https://service.internal/quote",
    ];
    const results = yield* Effect.forEach(inputs, (input) => Effect.exit(parsePublicTarget(input)));
    expect(results.every((result) => result._tag === "Failure")).toBe(true);
  }),
);

it.effect.prop(
  "normalizes generated public HTTPS targets without admitting fragments",
  {
    hostLabel: FastCheck.stringMatching(/^[a-z][a-z0-9]{0,15}$/u),
    pathSegment: FastCheck.stringMatching(/^[a-z][a-z0-9-]{0,15}$/u),
  },
  ({ hostLabel, pathSegment }) =>
    Effect.gen(function* () {
      const target = yield* parsePublicTarget(
        `https://${hostLabel}.example.com/${pathSegment}?source=property#form`,
      );
      expect(target).toEqual({
        origin: `https://${hostLabel}.example.com`,
        pathname: `/${pathSegment}`,
        url: `https://${hostLabel}.example.com/${pathSegment}?source=property`,
      });
    }),
);

it.effect.prop(
  "returns a tagged InvalidTarget for generated private IPv4 literals",
  {
    host: FastCheck.tuple(
      FastCheck.integer({ min: 0, max: 255 }),
      FastCheck.integer({ min: 0, max: 255 }),
      FastCheck.integer({ min: 0, max: 255 }),
    ),
  },
  ({ host }) =>
    Effect.gen(function* () {
      const failure = yield* Effect.flip(parsePublicTarget(`https://10.${host.join(".")}/quote`));
      expect(failure._tag).toBe("InvalidTarget");
    }),
);
