import { expect, it } from "@effect/vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const stylesPath = [
  resolve(process.cwd(), "src/styles.css"),
  resolve(process.cwd(), "apps/studio/src/styles.css"),
].find(existsSync);

if (stylesPath === undefined) {
  throw new Error("Could not locate apps/studio/src/styles.css");
}

const styles = readFileSync(stylesPath, "utf8");

it("keeps receipt structures independent and generated artifacts expandable", () => {
  expect(styles).toContain(".proof-detail-grid");
  expect(styles).toContain(".proof-metadata-row");
  expect(styles).not.toContain(".proof-details");
  expect(styles).not.toMatch(/\.(?:tag|skill)-block\s*\{[^}]*max-height/gu);
});

it("contains untrusted target metadata without widening the studio", () => {
  expect(styles).toMatch(/\.target-summary > div\s*\{\s*min-width:\s*0/gu);
  expect(styles).toMatch(/\.target-summary h3\s*\{[^}]*overflow-wrap:\s*anywhere/gu);
  expect(styles).toMatch(/\.target-summary code\s*\{[^}]*overflow-wrap:\s*anywhere/gu);
});

it("preserves mobile DOM order and swaps to the compact FoldKit progress variant", () => {
  expect(styles).not.toContain("flex-direction: column-reverse");
  expect(styles).not.toContain("min-width: 20rem");
  expect(styles).toMatch(/\.progress-desktop\s*\{\s*display:\s*none/gu);
  expect(styles).toMatch(/\.progress-mobile\s*\{[^}]*display:\s*grid/gu);
  expect(styles).toMatch(/prefers-reduced-motion:\s*reduce/gu);
  expect(styles).toMatch(/\.app-shell \.animate-spin\s*\{\s*animation:\s*none/gu);
});
