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

const dnsResolve = (addresses: ReadonlyArray<string>) => () =>
  Promise.resolve({
    ipv4: addresses.filter((address) => !address.includes(":")),
    ipv6: addresses.filter((address) => address.includes(":")),
  });

it.effect("rejects a hostname when any public DNS answer targets a private network", () =>
  Effect.gen(function* () {
    const publicResult = yield* Effect.exit(
      cloudflarePublicHostResolver(dnsResolve(["104.16.1.1", "2606:4700:4700::1111"])).assertPublic(
        "example.com",
      ),
    );
    const privateResult = yield* Effect.exit(
      cloudflarePublicHostResolver(
        dnsResolve(["169.254.169.254", "2606:4700:4700::1111"]),
      ).assertPublic("rebound.example"),
    );
    expect(publicResult._tag).toBe("Success");
    expect(privateResult._tag).toBe("Failure");
  }),
);
