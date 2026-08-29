import {
  InvalidTarget,
  NonBlankString,
  parsePublicTarget,
  SCAN_LIMITS,
  ScanFailed,
  ScanResult,
  type ScanRequest,
} from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { BrowserSnapshotBinding } from "./environment.ts";
import { cloudflarePublicHostResolver, type PublicHostResolver } from "./network-policy.ts";
import { extractSemanticForms } from "./semantic-forms.ts";

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
  readonly inspect: (request: ScanRequest) => Effect.Effect<ScanResult, ScanFailed | InvalidTarget>;
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
      const response = yield* Effect.tryPromise({
        try: () =>
          browser.quickAction("snapshot", {
            actionTimeout: 15_000,
            cacheTTL: 0,
            formats: ["content", "screenshot"],
            screenshotOptions: {
              fullPage: false,
              quality: 70,
              type: "jpeg",
            },
            url: requestedUrl,
            viewport: { height: 720, width: 1280 },
          }),
        catch: scanFailure,
      });
      if (!response.ok) return yield* scanFailure();
      const payload = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: scanFailure,
      }).pipe(
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
