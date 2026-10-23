// Folds the built JavaScript and CSS into dist/index.html, so the whole game is one file
// that opens anywhere, even without a web server.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
let html = readFileSync(join(dist, "index.html"), "utf8");

html = html.replace(
  /<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/,
  (_, file) =>
    `<script type="module">${readFileSync(join(dist, file), "utf8").replaceAll("</script", "<\\/script")}</script>`,
);
html = html.replace(
  /<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/,
  (_, file) => `<style>${readFileSync(join(dist, file), "utf8")}</style>`,
);

writeFileSync(join(dist, "strawhat-simulator.html"), html);
console.log("Wrote dist/strawhat-simulator.html");
