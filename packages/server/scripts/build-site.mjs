// Builds the public website into packages/web/dist: the game plus the latest card data, with
// card images shrunk to WebP. Cloudflare runs this (`pnpm site`) before every deploy; see
// docs/HOSTING.md. Official card art and text still never enter this repository: they are
// downloaded from strawhat-card-data into git-ignored folders during the build.
//
//   pnpm site                          # downloads the card data
//   CARD_DATA_DIR=../strawhat-card-data pnpm site   # uses a checkout you already have
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const CARD_DATA_REPO = "https://github.com/Whysodeep1994/strawhat-card-data.git";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const web = join(root, "packages", "web");
const run = (command, args, cwd = root) => execFileSync(command, args, { cwd, stdio: "inherit" });

let source = process.env.CARD_DATA_DIR
  ? resolve(process.env.INIT_CWD ?? process.cwd(), process.env.CARD_DATA_DIR)
  : null;
if (!source) {
  source = join(root, "packages", "server", ".card-data");
  rmSync(source, { recursive: true, force: true });
  run("git", ["clone", "--depth", "1", CARD_DATA_REPO, source]);
}

run("node", [join(web, "scripts", "card-data.mjs"), source]);

// PNG card scans are about 300 KB each; WebP at this quality looks the same at a third the size.
const out = join(web, "public", "card-data");
const images = join(out, "images");
const pngs = readdirSync(images).filter((f) => f.endsWith(".png"));
let done = 0;
const queue = [...pngs];
await Promise.all(
  Array.from({ length: 8 }, async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      await sharp(join(images, file))
        .webp({ quality: 82 })
        .toFile(join(images, file.replace(/\.png$/, ".webp")));
      rmSync(join(images, file));
      if (++done % 250 === 0) console.log(`Converted ${done} of ${pngs.length} images`);
    }
  }),
);
const cardsFile = join(out, "cards.json");
const cards = JSON.parse(readFileSync(cardsFile, "utf8"));
for (const card of cards) if (card.image) card.image = card.image.replace(/\.png$/, ".webp");
writeFileSync(cardsFile, JSON.stringify(cards));
console.log(`Converted ${done} images to WebP`);

run("pnpm", ["--filter", "@strawhat/web", "build"]);
if (!existsSync(join(web, "dist", "index.html")))
  throw new Error("The web build made no index.html");
console.log("The website is ready in packages/web/dist");
