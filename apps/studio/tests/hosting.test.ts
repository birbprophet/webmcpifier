// @vitest-environment node

import { expect, it } from "@effect/vitest";
import { readFileSync } from "node:fs";

it("serves the cross-origin SRI runtime with CORS", () => {
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");

  expect(headers).toContain("/runtime/v1.js\n  Access-Control-Allow-Origin: *");
});
