import { InvalidTarget, NonBlankString } from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { promises as dns } from "node:dns";

const DnsRecord = Schema.Struct({
  address: Schema.optional(Schema.String),
  type: Schema.String,
});

type ResolveHost = (hostname: string) => Promise<unknown>;

const resolutionFailed = (): InvalidTarget =>
  new InvalidTarget({ message: "The target hostname could not be resolved safely." });

const invalidResolution = (): InvalidTarget =>
  new InvalidTarget({ message: "The target hostname returned invalid resolution data." });

const deniedAddress = (): InvalidTarget =>
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
  resolve: ResolveHost = (hostname) => dns.resolveAny(hostname),
): PublicHostResolver => ({
  assertPublic: (hostname) =>
    Effect.gen(function* () {
      const name = yield* Schema.decodeUnknownEffect(NonBlankString)(hostname).pipe(
        Effect.mapError(invalidResolution),
      );
      const records = yield* Effect.tryPromise({
        catch: resolutionFailed,
        try: () => resolve(name),
      }).pipe(
        Effect.flatMap((input) =>
          Schema.decodeUnknownEffect(Schema.Array(DnsRecord))(input).pipe(
            Effect.mapError(invalidResolution),
          ),
        ),
      );
      const addresses = records.flatMap(({ address, type }) =>
        address !== undefined && (type === "A" || type === "AAAA") ? [address] : [],
      );
      if (addresses.length === 0 || addresses.some((address) => !isPublicAddress(address))) {
        return yield* deniedAddress();
      }
    }),
});
