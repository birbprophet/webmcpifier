import {
  type ProofSummaryRequest,
  type PublishCapabilityRequest,
  type ScanRequest,
  WebMcpifierRpcs,
} from "@webmcpifier/domain";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import { studioEnvironment } from "./environment.ts";

const RPC_PATH = "/rpc";
export const RPC_URL = `${studioEnvironment.VITE_API_ORIGIN}${RPC_PATH}`;

export const studioRpcLayer = RpcClient.layerProtocolHttp({ url: RPC_URL }).pipe(
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(RpcSerialization.layerNdjson),
);

export const inspectSiteEffect = Effect.fn("WebMCPifierStudio.inspectSite")(function* (
  request: ScanRequest,
) {
  const client = yield* RpcClient.make(WebMcpifierRpcs);
  return yield* client.inspectSite(request);
});

export const publishCapabilityEffect = Effect.fn("WebMCPifierStudio.publishCapability")(function* (
  request: PublishCapabilityRequest,
) {
  const client = yield* RpcClient.make(WebMcpifierRpcs);
  return yield* client.publishCapability(request);
});

export const getProofSummaryEffect = Effect.fn("WebMCPifierStudio.getProofSummary")(function* (
  request: ProofSummaryRequest,
) {
  const client = yield* RpcClient.make(WebMcpifierRpcs);
  return yield* client.getProofSummary(request);
});

export const inspectSiteForAgent = (request: ScanRequest, signal: AbortSignal) =>
  Effect.runPromise(
    Effect.scoped(inspectSiteEffect(request).pipe(Effect.provide(studioRpcLayer))),
    { signal },
  );

export const getProofSummaryForAgent = (request: ProofSummaryRequest, signal: AbortSignal) =>
  Effect.runPromise(
    Effect.scoped(getProofSummaryEffect(request).pipe(Effect.provide(studioRpcLayer))),
    { signal },
  );
