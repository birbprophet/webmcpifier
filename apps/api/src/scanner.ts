import {
  InvalidTarget,
  NonBlankString,
  parsePublicTarget,
  SCAN_LIMITS,
  ScanFailed,
  ScanResult,
  type ScanRequest,
} from "@webmcpifier/domain";
import type { RuntimeContext } from "alchemy/RuntimeContext";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { BrowserSnapshotBinding } from "./environment.ts";
import { cloudflarePublicHostResolver, type PublicHostResolver } from "./network-policy.ts";
import { extractSemanticForms } from "./semantic-forms.ts";

// Browser Run can wait far longer by default. A scan is an interactive,
// untrusted fetch, so WebMCPifier gives it a short, explicit execution budget
// and disables cached snapshots before compiling a structural fingerprint.
const SCAN_ACTION_TIMEOUT_MILLISECONDS = 15_000;
const SCAN_CACHE_TTL_SECONDS = 0;

const BrowserSnapshot = Schema.Struct({
  meta: Schema.Struct({
    finalUrl: Schema.optional(Schema.String),
    headers: Schema.optional(Schema.Record(Schema.String, Schema.String)),
    redirectChain: Schema.optional(
      Schema.Array(
        Schema.Struct({
          headers: Schema.Record(Schema.String, Schema.String),
          status: Schema.Number,
          url: Schema.String,
        }),
      ),
    ),
    status: Schema.Number,
    title: Schema.String,
  }),
  result: Schema.Struct({
    content: NonBlankString,
    screenshot: NonBlankString,
  }),
  success: Schema.Literal(true),
});

export interface SiteScanner {
  readonly inspect: (
    request: ScanRequest,
  ) => Effect.Effect<ScanResult, ScanFailed | InvalidTarget, RuntimeContext>;
}

const scanFailure = (): ScanFailed =>
  new ScanFailed({ message: "The rendered page could not be inspected safely." });

const supportedContentType = (headers: Readonly<Record<string, string>> | undefined): boolean => {
  const mediaType = headers?.["content-type"]?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "text/html" || mediaType === "application/xhtml+xml";
};

export const browserSiteScanner = (
  browser: BrowserSnapshotBinding,
  resolver: PublicHostResolver = cloudflarePublicHostResolver(),
): SiteScanner => ({
  inspect: (request) =>
    Effect.gen(function* () {
      const requested = yield* parsePublicTarget(request.url);
      const requestedUrl = `${requested.origin}${requested.pathname}`;
      yield* resolver.assertPublic(new URL(requested.origin).hostname);
      const payload = yield* browser
        .snapshot({
          actionTimeout: SCAN_ACTION_TIMEOUT_MILLISECONDS,
          cacheTTL: SCAN_CACHE_TTL_SECONDS,
          formats: ["content", "screenshot"],
          screenshotOptions: {
            fullPage: false,
            type: "jpeg",
          },
          url: requestedUrl,
        })
        .pipe(
          Effect.mapError(scanFailure),
          Effect.flatMap((input) =>
            Schema.decodeUnknownEffect(BrowserSnapshot)(input).pipe(Effect.mapError(scanFailure)),
          ),
        );
      if (
        payload.meta.status < 200 ||
        payload.meta.status >= 400 ||
        !supportedContentType(payload.meta.headers) ||
        (payload.meta.redirectChain?.length ?? 0) > SCAN_LIMITS.redirects ||
        new TextEncoder().encode(payload.result.content).byteLength > SCAN_LIMITS.pageBytes ||
        payload.result.screenshot.length > Math.ceil((SCAN_LIMITS.pageBytes * 4) / 3)
      ) {
        return yield* scanFailure();
      }
      const redirectTargets = yield* Effect.forEach(payload.meta.redirectChain ?? [], ({ url }) =>
        parsePublicTarget(url),
      );
      const finalTarget = yield* parsePublicTarget(payload.meta.finalUrl ?? requestedUrl);
      const hostnames = new Set(
        [...redirectTargets, finalTarget].map((target) => new URL(target.origin).hostname),
      );
      yield* Effect.forEach(hostnames, (hostname) => resolver.assertPublic(hostname));
      const forms = yield* extractSemanticForms(payload.result.content).pipe(
        Effect.mapError(scanFailure),
      );
      const title = payload.meta.title.trim();
      if (title.length === 0) return yield* scanFailure();
      return yield* Schema.decodeUnknownEffect(ScanResult)({
        forms,
        origin: finalTarget.origin,
        pathname: finalTarget.pathname,
        screenshotDataUrl: `data:image/jpeg;base64,${payload.result.screenshot}`,
        title,
        url: `${finalTarget.origin}${finalTarget.pathname}`,
      }).pipe(Effect.mapError(scanFailure));
    }),
});
