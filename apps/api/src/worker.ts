import * as Cloudflare from "alchemy/Cloudflare";
import { apiWorkerProgram } from "./worker-program.ts";

export { CapabilityProof } from "./proof-durable-object.ts";
export {
  apiWorkerImpl,
  ApiInitialization,
  createApiHandler,
  NativeBindings,
  type ApiHandler,
  type ApiWorkerFetch,
  type ApiWorkerShape,
} from "./worker-impl.ts";

export default Cloudflare.Worker("Api", { main: import.meta.url }, apiWorkerProgram);
