// @vitest-environment node

import { expect, it } from "@effect/vitest";
import { readFileSync } from "node:fs";
import { FIRST_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN } from "../../../test/origin-trial-token.ts";

it("serves the cross-origin SRI runtime with CORS", () => {
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");

  expect(headers).toContain("/runtime/v1.js\n  Access-Control-Allow-Origin: *");
});

it("keeps the local Vite test mode on a structurally valid origin-trial fixture", () => {
  const environment = readFileSync(new URL("../.env.test", import.meta.url), "utf8");

  expect(environment).toContain(
    `VITE_WEBMCP_FIRST_PARTY_ORIGIN_TRIAL_TOKEN=${FIRST_PARTY_WEBMCP_ORIGIN_TRIAL_TOKEN}`,
  );
});
