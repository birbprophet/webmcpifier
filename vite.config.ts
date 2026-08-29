import { defineConfig } from "vite-plus";
import { studioTestEnvironment } from "./apps/studio/test-environment.ts";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "vitest",
              message: "Import test APIs from @effect/vitest.",
            },
            {
              name: "vite-plus/test",
              message: "Import test APIs from @effect/vitest.",
            },
            {
              name: "bun:test",
              message: "Import test APIs from @effect/vitest.",
            },
          ],
        },
      ],
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
  test: {
    env: studioTestEnvironment,
    experimental: {
      fsModuleCache: true,
    },
  },
});
