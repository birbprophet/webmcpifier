import { foldkit } from "@foldkit/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite-plus";
import { studioTestEnvironment } from "./test-environment.ts";

export default defineConfig({
  fmt: {},
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  optimizeDeps: {
    entries: ["src/entry.ts"],
  },
  plugins: [tailwindcss(), foldkit()],
  run: {
    tasks: {
      build: {
        command: "vp build",
        dependsOn: ["@webmcpifier/runtime#build"],
        output: ["dist/**"],
      },
    },
  },
  test: {
    env: studioTestEnvironment,
    environment: "happy-dom",
    experimental: {
      fsModuleCache: true,
    },
  },
});
