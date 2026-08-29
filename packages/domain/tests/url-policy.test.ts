import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
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
