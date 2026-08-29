import { defineConfig } from "vite-plus";

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: "src/v1.ts",
      fileName: () => "v1.js",
      formats: ["iife"],
      name: "WebMcpifierRuntime",
    },
    outDir: "../../apps/studio/public/runtime",
  },
  run: {
    tasks: {
      build: {
        command: "vp build",
        input: [{ auto: true }, "!../../apps/studio/public/runtime/**"],
        output: ["../../apps/studio/public/runtime/v1.js"],
      },
    },
  },
  test: {
    experimental: {
      fsModuleCache: true,
    },
  },
});
