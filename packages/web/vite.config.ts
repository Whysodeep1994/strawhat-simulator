import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * The game's version: this commit plus the card data it ships with. Online, two pages only play
 * each other when their versions match (see BUILD in src/online.ts).
 */
function build(): string {
  let commit = process.env.WORKERS_CI_COMMIT_SHA ?? "";
  if (!commit) {
    try {
      commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
      commit = "dev";
    }
  }
  const cards = fileURLToPath(new URL("public/card-data/cards.json", import.meta.url));
  const data = existsSync(cards)
    ? createHash("sha256").update(readFileSync(cards)).digest("hex").slice(0, 8)
    : "none";
  return `${commit.slice(0, 12)}-${data}`;
}

// The engine is used from source, so the app always matches the engine in this repo.
export default defineConfig({
  base: "./",
  define: { __BUILD__: JSON.stringify(build()) },
  resolve: {
    alias: {
      "@strawhat/engine": fileURLToPath(new URL("../engine/src/index.ts", import.meta.url)),
    },
  },
  esbuild: { jsx: "automatic" },
  build: { outDir: "dist", assetsInlineLimit: 100_000 },
});
