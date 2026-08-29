// @vitest-environment happy-dom

import { expect, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { injectFirstPartyOriginTrialToken, studioEnvironment } from "../src/environment.ts";
import { StudioEnvironment } from "../src/environment.ts";
import { RPC_URL } from "../src/rpc.ts";

it("rejects missing Studio environment values", () => {
  expect(Option.isNone(Schema.decodeUnknownOption(StudioEnvironment)({}))).toBe(true);
});

it("builds the RPC endpoint from the required API origin", () => {
  expect(RPC_URL).toBe("https://api.webmcpifier.test/rpc");
});

it("injects the required first-party origin-trial token into the document head", () => {
  const target = document.implementation.createHTMLDocument("Studio origin trial");

  const meta = injectFirstPartyOriginTrialToken(target);

  expect(meta.httpEquiv).toBe("origin-trial");
  expect(meta.content).toBe(studioEnvironment.VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN);
  expect(target.head.firstElementChild).toBe(meta);
});
