import { FIRST_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN } from "../../test/origin-trial-token.ts";

export const studioTestEnvironment = {
  VITE_API_ORIGIN: "https://api.webmcpifier.test",
  VITE_DEMO_ORIGIN: "https://demo.webmcpifier.test",
  VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN: FIRST_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN,
} as const;
