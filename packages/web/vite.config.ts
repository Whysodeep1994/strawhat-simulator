import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The engine is used from source, so the app always matches the engine in this repo.
export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@strawhat/engine": fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)),
    },
  },
  esbuild: { jsx: "automatic" },
  build: { outDir: "dist", assetsInlineLimit: 100_000 },
});
