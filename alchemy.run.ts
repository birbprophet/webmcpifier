import { Stack, Stage } from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Command from "alchemy/Command";
import * as Output from "alchemy/Output";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { RUNTIME_PATH } from "./packages/domain/src/index.ts";
import { DeploymentEnvironment } from "./packages/domain/src/environment.ts";
import { apiWorkerImpl } from "./apps/api/src/worker-impl.ts";

const PRODUCTION_STAGE = "prod";
const CLOUDFLARE_COMPATIBILITY_DATE = "2026-08-29";

export default Stack(
  "webmcpifier",
  {
    providers: Layer.mergeAll(Cloudflare.providers(), Command.providers()),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const deploy = yield* DeploymentEnvironment;
    const stage = yield* Stage;
    const production = stage === PRODUCTION_STAGE;
    const runtimeBuild = yield* Command.Build("Runtime", {
      command: "vp run build",
      cwd: "./packages/runtime",
      outdir: "../../apps/studio/public/runtime",
    });
    const runtimeFile = RUNTIME_PATH.slice(RUNTIME_PATH.lastIndexOf("/") + 1);
    const runtimePath = Output.map(runtimeBuild.outdir, (outdir) => `${outdir}/${runtimeFile}`);
    const runtimeVerification = yield* Command.Exec("VerifyRuntimeIntegrity", {
      command: "bun run scripts/verify-runtime-integrity.ts",
      env: {
        EXPECTED_RUNTIME_INTEGRITY: deploy.WEBMCPIFIER_RUNTIME_INTEGRITY,
        RUNTIME_FILE: runtimePath,
      },
      memo: false,
    });
    const verifiedRuntimeIntegrity = Output.map(
      runtimeVerification.hash.input,
      () => deploy.WEBMCPIFIER_RUNTIME_INTEGRITY,
    );
    const api = yield* Cloudflare.Worker(
      "Api",
      {
        compatibility: {
          date: CLOUDFLARE_COMPATIBILITY_DATE,
          flags: ["nodejs_compat"],
        },
        env: {
          API_ORIGIN: deploy.WEBMCPIFIER_API_ORIGIN,
          RELEASE_COMMIT: deploy.WEBMCPIFIER_RELEASE_COMMIT,
          RUNTIME_INTEGRITY: verifiedRuntimeIntegrity,
          STUDIO_ORIGIN: deploy.WEBMCPIFIER_STUDIO_ORIGIN,
          WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: deploy.WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN,
        },
        main: "./apps/api/src/worker.ts",
        ...(production
          ? { domain: "api.webmcpifier.com", workersDev: false }
          : { workersDev: true }),
      },
      apiWorkerImpl({
        API_ORIGIN: deploy.WEBMCPIFIER_API_ORIGIN,
        RELEASE_COMMIT: deploy.WEBMCPIFIER_RELEASE_COMMIT,
        RUNTIME_INTEGRITY: deploy.WEBMCPIFIER_RUNTIME_INTEGRITY,
        STUDIO_ORIGIN: deploy.WEBMCPIFIER_STUDIO_ORIGIN,
        WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: deploy.WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN,
      }),
    );

    const demo = yield* Cloudflare.Website.Vite("Demo", {
      assets: { notFoundHandling: "single-page-application" },
      rootDir: "./apps/demo",
      ...(production
        ? { domain: "demo.webmcpifier.com", workersDev: false }
        : { workersDev: true }),
    });

    const studio = yield* Cloudflare.Website.Foldkit("Studio", {
      env: {
        VITE_API_ORIGIN: deploy.WEBMCPIFIER_API_ORIGIN,
        VITE_DEMO_ORIGIN: deploy.WEBMCPIFIER_DEMO_ORIGIN,
        VITE_RUNTIME_INTEGRITY: verifiedRuntimeIntegrity,
        VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: deploy.WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN,
      },
      memo: {
        include: [
          "**/*",
          "../../packages/runtime/package.json",
          "../../packages/runtime/src/**",
          "../../packages/runtime/vite.config.ts",
        ],
        lockfile: true,
      },
      rootDir: "./apps/studio",
      ...(production
        ? {
            domain: {
              name: "www.webmcpifier.com",
              redirects: ["webmcpifier.com"],
            },
            workersDev: false,
          }
        : { workersDev: true }),
    });

    return {
      apiUrl: api.url,
      demoUrl: demo.url,
      releaseCommit: deploy.WEBMCPIFIER_RELEASE_COMMIT,
      studioUrl: studio.url,
    };
  }),
);
