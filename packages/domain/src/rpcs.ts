import * as Schema from "effect/Schema";
import { Rpc, RpcGroup } from "effect/unstable/rpc";
import {
  DraftRejected,
  InvalidTarget,
  ProofUnavailable,
  PublicationFailed,
  ScanFailed,
} from "./errors.ts";
import {
  ProofSummary,
  ProofSummaryRequest,
  PublishCapabilityRequest,
  PublishedCapability,
  ScanRequest,
  ScanResult,
} from "./schema.ts";

const inspectSite = Rpc.make("inspectSite", {
  error: Schema.Union([InvalidTarget, ScanFailed]),
  payload: ScanRequest,
  success: ScanResult,
});

const publish = Rpc.make("publishCapability", {
  error: Schema.Union([DraftRejected, PublicationFailed]),
  payload: PublishCapabilityRequest,
  success: PublishedCapability,
});

const getProofSummary = Rpc.make("getProofSummary", {
  error: ProofUnavailable,
  payload: ProofSummaryRequest,
  success: ProofSummary,
});

export class WebMcpifierRpcs extends RpcGroup.make(inspectSite, publish, getProofSummary) {}
