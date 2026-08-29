import { ApiInitialization } from "./environment.ts";
import { apiWorkerImpl } from "./worker-impl.ts";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const ApiRuntimeConfig = Config.all({
  API_ORIGIN: Config.schema(ApiInitialization.fields.API_ORIGIN, "API_ORIGIN"),
  RELEASE_COMMIT: Config.schema(ApiInitialization.fields.RELEASE_COMMIT, "RELEASE_COMMIT"),
  RUNTIME_INTEGRITY: Config.schema(ApiInitialization.fields.RUNTIME_INTEGRITY, "RUNTIME_INTEGRITY"),
  STUDIO_ORIGIN: Config.schema(ApiInitialization.fields.STUDIO_ORIGIN, "STUDIO_ORIGIN"),
  WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN: Config.schema(
    ApiInitialization.fields.WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN,
    "WEBMCP_THIRD_PARTY_ORIGIN_TRIAL_TOKEN",
  ),
});

/** Rebuild the Worker initializer only from required, deployed bindings. */
export const apiWorkerProgram = Effect.fn("ApiWorker.runtime")(function* () {
  return yield* apiWorkerImpl(yield* ApiRuntimeConfig);
})();
