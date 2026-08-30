import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { ApiInitialization } from "./environment.ts";
import { apiWorkerImpl } from "./worker-impl.ts";

export { CapabilityProof } from "./proof-durable-object.ts";
export {
  apiWorkerImpl,
  ApiInitialization,
  createApiHandler,
  makeApiWorker,
  type ApiHandler,
  type ApiWorkerFetch,
  type ApiWorkerShape,
} from "./worker-impl.ts";

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

export const apiWorkerProgram = Effect.gen(function* () {
  return yield* apiWorkerImpl(yield* ApiRuntimeConfig);
});

export default Cloudflare.Worker("Api", { main: import.meta.url }, apiWorkerProgram);
