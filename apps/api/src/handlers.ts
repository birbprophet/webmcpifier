import {
  canonicalFormSignature,
  DraftRejected,
  parsePublicTarget,
  ProofUnavailable,
  PublicationFailed,
  publishCapability,
  sha256Hex,
  WebMcpifierRpcs,
  type ScanResult,
} from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import { browserSiteScanner } from "./scanner.ts";
import type { ApiEnvironment } from "./environment.ts";
import { digestToken } from "./proof.ts";

const randomToken = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCodePoint(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const validateScan = (scan: ScanResult): Effect.Effect<void, DraftRejected> =>
  Effect.gen(function* () {
    const target = yield* parsePublicTarget(scan.url).pipe(
      Effect.mapError(
        () => new DraftRejected({ message: "Inspect the target again before publishing." }),
      ),
    );
    if (
      new URL(scan.url).search.length > 0 ||
      target.origin !== scan.origin ||
      target.pathname !== scan.pathname
    ) {
      return yield* new DraftRejected({ message: "Inspect the target again before publishing." });
    }
    const fingerprints = yield* Effect.forEach(scan.forms, (form) =>
      sha256Hex(
        canonicalFormSignature({
          controls: form.controls,
          formId: form.formId,
          title: form.title,
        }),
      ),
    );
    if (scan.forms.some((form, index) => form.fingerprint !== fingerprints[index])) {
      return yield* new DraftRejected({ message: "Inspect the target again before publishing." });
    }
  });

export const rpcHandlers = (environment: ApiEnvironment) => {
  const scanner = browserSiteScanner(environment.BROWSER);
  return WebMcpifierRpcs.toLayer({
    getProofSummary: (request) =>
      Effect.tryPromise({
        try: () => environment.PROOF.getByName(request.capabilityId).summary(request),
        catch: () => new ProofUnavailable({ message: "The capability proof is unavailable." }),
      }),
    inspectSite: (request) => scanner.inspect(request),
    publishCapability: ({ draft, scan }) =>
      Effect.gen(function* () {
        yield* validateScan(scan);
        const capabilityId = `cap_${crypto.randomUUID().replaceAll("-", "")}`;
        const readToken = randomToken();
        const writeToken = randomToken();
        const published = yield* publishCapability(scan, draft, {
          apiOrigin: environment.API_ORIGIN,
          capabilityId,
          originTrialToken: environment.WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN,
          readToken,
          runtimeIntegrity: environment.RUNTIME_INTEGRITY,
          studioOrigin: environment.STUDIO_ORIGIN,
          writeToken,
        });
        const [readTokenHash, writeTokenHash] = yield* Effect.promise(() =>
          Promise.all([digestToken(readToken), digestToken(writeToken)]),
        );
        yield* Effect.tryPromise({
          try: () =>
            environment.PROOF.getByName(capabilityId).initialize({
              capabilityHash: published.capabilityHash,
              origin: published.config.target.origin,
              readTokenHash,
              runtimeVersion: published.config.runtime.version,
              writeTokenHash,
            }),
          catch: () =>
            new PublicationFailed({ message: "The capability proof could not be initialized." }),
        });
        return published;
      }),
  });
};
