import { InvalidTarget, NonBlankString } from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const DNS_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const DNS_RECORD_TYPES = ["A", "AAAA"] as const;

const DnsResponse = Schema.Struct({
  Answer: Schema.optional(
    Schema.Array(
      Schema.Struct({
        data: Schema.String,
        type: Schema.Number,
      }),
    ),
  ),
  Status: Schema.Number,
});

const denied = (): InvalidTarget =>
  new InvalidTarget({ message: "The target hostname does not resolve to a public address." });

const ipv4Octets = (address: string): ReadonlyArray<number> | undefined => {
  const parts = address.split(".");
  if (parts.length !== 4) return undefined;
  const octets = parts.map(Number);
  return octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
    ? octets
    : undefined;
};

export const isPublicAddress = (address: string): boolean => {
  const ipv4 = ipv4Octets(address);
  if (ipv4 !== undefined) {
    const [first = 0, second = 0, third = 0] = ipv4;
    return !(
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0 && third === 0) ||
      (first === 192 && second === 0 && third === 2) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      (first === 198 && second === 51 && third === 100) ||
      (first === 203 && second === 0 && third === 113) ||
      first >= 224
    );
  }

  const ipv6 = address.toLowerCase();
  const globallyRouted = ipv6.startsWith("2") || ipv6.startsWith("3");
  return globallyRouted && !ipv6.startsWith("2001:db8:");
};

export interface PublicHostResolver {
  readonly assertPublic: (hostname: string) => Effect.Effect<void, InvalidTarget>;
}

export const cloudflarePublicHostResolver = (
  request: typeof fetch = fetch,
): PublicHostResolver => ({
  assertPublic: (hostname) =>
    Effect.gen(function* () {
      const name = yield* Schema.decodeUnknownEffect(NonBlankString)(hostname).pipe(
        Effect.mapError(denied),
      );
      const responses = yield* Effect.forEach(
        DNS_RECORD_TYPES,
        (recordType) =>
          Effect.tryPromise({
            catch: denied,
            try: (signal) => {
              const url = new URL(DNS_ENDPOINT);
              url.searchParams.set("name", name);
              url.searchParams.set("type", recordType);
              return request(url, {
                headers: { accept: "application/dns-json" },
                redirect: "error",
                signal,
              });
            },
          }).pipe(
            Effect.flatMap((response) => (response.ok ? Effect.succeed(response) : denied())),
            Effect.flatMap((response) =>
              Effect.tryPromise({ catch: denied, try: () => response.json() }),
            ),
            Effect.flatMap((input) =>
              Schema.decodeUnknownEffect(DnsResponse)(input).pipe(Effect.mapError(denied)),
            ),
          ),
        { concurrency: "unbounded" },
      );
      if (responses.some(({ Status }) => Status !== 0)) return yield* denied();
      const addresses = responses.flatMap(({ Answer = [] }) =>
        Answer.filter(({ type }) => type === 1 || type === 28).map(({ data }) => data),
      );
      if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
        return yield* denied();
      }
    }),
});
