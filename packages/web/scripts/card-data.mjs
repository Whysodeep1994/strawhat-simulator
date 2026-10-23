// Copies card data from a strawhat-card-data checkout into public/card-data, where the app
// loads it. Official card art and text never go into this repository (see docs/CARD_ASSETS.md);
// public/card-data is git-ignored.
//
//   node scripts/card-data.mjs ../../../strawhat-card-data
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(process.argv[2] ?? "../../../strawhat-card-data");
const out = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public", "card-data");
if (!existsSync(join(source, "cards"))) {
  console.error(`No cards/ folder in ${source}. Pass the path to a strawhat-card-data checkout.`);
  process.exit(1);
}

const readJsonFiles = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")))
    : [];

const cards = readJsonFiles(join(source, "cards")).flat();
const decks = readJsonFiles(join(source, "decks"));
const formats = readJsonFiles(join(source, "formats"));

mkdirSync(join(out, "images"), { recursive: true });
let images = 0;
for (const card of cards) {
  if (!card.image) continue;
  const from = join(source, card.image);
  if (existsSync(from)) {
    copyFileSync(from, join(out, card.image));
    images++;
  }
}
writeFileSync(join(out, "cards.json"), JSON.stringify(cards));
writeFileSync(join(out, "decks.json"), JSON.stringify(decks));
writeFileSync(join(out, "formats.json"), JSON.stringify(formats));
console.log(
  `Copied ${cards.length} cards, ${decks.length} decks, ${formats.length} formats, and ${images} images to ${out}`,
);
