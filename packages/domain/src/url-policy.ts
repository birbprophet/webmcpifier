import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { InvalidTarget } from "./errors.ts";
import { NonBlankString, PublicTarget } from "./schema.ts";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain"]);
const BLOCKED_HOST_SUFFIXES = [".local", ".internal", ".localhost"] as const;
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/u;

const isBlockedHost = (hostname: string): boolean =>
  BLOCKED_HOSTS.has(hostname) ||
  BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix)) ||
  hostname.includes(":") ||
  IPV4_PATTERN.test(hostname);

export const parsePublicTarget = (input: unknown): Effect.Effect<PublicTarget, InvalidTarget> =>
  Effect.gen(function* () {
    const value = yield* Schema.decodeUnknownEffect(NonBlankString)(input).pipe(
      Effect.mapError(() => new InvalidTarget({ message: "Enter a public HTTPS URL." })),
    );
    const url = yield* Effect.try({
      try: () => new URL(value),
      catch: () => new InvalidTarget({ message: "Enter a valid public HTTPS URL." }),
    });
    if (url.protocol !== "https:") {
      return yield* new InvalidTarget({ message: "Only HTTPS websites can be inspected." });
    }
    if (url.username.length > 0 || url.password.length > 0) {
      return yield* new InvalidTarget({ message: "URLs containing credentials are not allowed." });
    }
    const hostname = url.hostname.toLowerCase();
    if (isBlockedHost(hostname)) {
      return yield* new InvalidTarget({
        message: "Private and local destinations are not allowed.",
      });
    }
    url.hash = "";
    return yield* Schema.decodeUnknownEffect(PublicTarget)({
      origin: url.origin,
      pathname: url.pathname,
      url: url.toString(),
    }).pipe(
      Effect.mapError(() => new InvalidTarget({ message: "The normalized target is invalid." })),
    );
  });
