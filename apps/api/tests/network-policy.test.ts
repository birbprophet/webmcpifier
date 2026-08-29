import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { cloudflarePublicHostResolver, isPublicAddress } from "../src/network-policy.ts";

it("classifies public addresses without admitting private or reserved ranges", () => {
  expect(["104.16.1.1", "8.8.8.8", "2606:4700:4700::1111"].every(isPublicAddress)).toBe(true);
  expect(
    [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "192.168.0.1",
      "198.51.100.1",
      "203.0.113.1",
      "224.0.0.1",
      "::1",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
    ].some(isPublicAddress),
  ).toBe(false);
});

const dnsFetch = (addresses: Readonly<Record<string, string>>) => (input: URL | RequestInfo) => {
  const url = new URL(
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
  );
  const type = url.searchParams.get("type") ?? "";
  const data = addresses[type];
  return Promise.resolve(
    Response.json({
      Answer: data === undefined ? [] : [{ data, type: type === "A" ? 1 : 28 }],
      Status: 0,
    }),
  );
};

it.effect("rejects a hostname when any public DNS answer targets a private network", () =>
  Effect.gen(function* () {
    const publicResult = yield* Effect.exit(
      cloudflarePublicHostResolver(
        dnsFetch({ A: "104.16.1.1", AAAA: "2606:4700:4700::1111" }) as typeof fetch,
      ).assertPublic("example.com"),
    );
    const privateResult = yield* Effect.exit(
      cloudflarePublicHostResolver(
        dnsFetch({ A: "169.254.169.254", AAAA: "2606:4700:4700::1111" }) as typeof fetch,
      ).assertPublic("rebound.example"),
    );
    expect(publicResult._tag).toBe("Success");
    expect(privateResult._tag).toBe("Failure");
  }),
);
