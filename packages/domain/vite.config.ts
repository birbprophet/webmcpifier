import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    experimental: {
      fsModuleCache: true,
    },
  },
});
