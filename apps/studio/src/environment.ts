import { AbsoluteHttpsOrigin, FirstPartyWebMcpOriginTrialToken } from "@webmcpifier/domain";
import * as Schema from "effect/Schema";

export const StudioEnvironment = Schema.Struct({
  VITE_API_ORIGIN: AbsoluteHttpsOrigin,
  VITE_DEMO_ORIGIN: AbsoluteHttpsOrigin,
  VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: FirstPartyWebMcpOriginTrialToken,
});
export type StudioEnvironment = typeof StudioEnvironment.Type;

export const studioEnvironment = Schema.decodeUnknownSync(StudioEnvironment)({
  VITE_API_ORIGIN: import.meta.env.VITE_API_ORIGIN,
  VITE_DEMO_ORIGIN: import.meta.env.VITE_DEMO_ORIGIN,
  VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: import.meta.env
    .VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN,
});

const ORIGIN_TRIAL_HTTP_EQUIV = "origin-trial";

export const injectFirstPartyOriginTrialToken = (target: Document): HTMLMetaElement => {
  const meta = target.createElement("meta");
  meta.content = studioEnvironment.VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN;
  meta.httpEquiv = ORIGIN_TRIAL_HTTP_EQUIV;
  target.head.prepend(meta);
  return meta;
};
