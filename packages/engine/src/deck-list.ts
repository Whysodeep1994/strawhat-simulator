import type { CardCatalog } from "./cards.js";
import type { DeckList } from "./setup.js";

/** What reading a pasted deck list produced. Check `deck` with validateDeck before playing. */
export interface ParsedDeckList {
  leader?: string;
  deck: string[];
  /** Lines that couldn't be read, unknown cards, or a missing or extra Leader. */
  errors: string[];
}

// "4xOP01-016", "4 x OP01-016", "4 OP01-016 Nami", "OP01-016 x4". Alternate-art suffixes such as
// "_p1" are kept so they can be looked up, then dropped if the catalog only has the base card.
const COUNT_FIRST = /^(\d+)\s*[x×]?\s*([A-Z]+\d*-\d+[A-Z0-9_]*)\b/i;
const CARD_NUMBER = /[A-Z]+\d*-\d+/i;
const COUNT_LAST = /^([A-Z]+\d*-\d+[A-Z0-9_]*)\s*[x×]\s*(\d+)\b/i;

/**
 * Reads the plain-text deck lists most One Piece deck sites copy out (one "4xOP01-016" per
 * line, the Leader as "1x"). Lines without a card number, such as "Leader" or "Characters (36)",
 * are skipped, as are comments starting with "//" or "#".
 */
export function parseDeckList(catalog: CardCatalog, text: string): ParsedDeckList {
  const errors: string[] = [];
  const leaders: string[] = [];
  const deck: string[] = [];

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line.startsWith("//") || line.startsWith("#") || !CARD_NUMBER.test(line)) return;
    const first = COUNT_FIRST.exec(line);
    const last = first ? null : COUNT_LAST.exec(line);
    const count = Number(first?.[1] ?? last?.[2]);
    const written = first?.[2] ?? last?.[1];
    if (!written || !Number.isInteger(count) || count < 1) {
      errors.push(`Line ${index + 1}: couldn't read "${line}"`);
      return;
    }
    const id = lookUp(catalog, written);
    if (!id) {
      errors.push(`Line ${index + 1}: unknown card "${written}"`);
      return;
    }
    const target = catalog[id]?.category === "leader" ? leaders : deck;
    for (let i = 0; i < count; i++) target.push(id);
  });

  if (leaders.length === 0) errors.push("No Leader card found");
  if (leaders.length > 1) errors.push(`Found ${leaders.length} Leader cards; a deck has exactly 1`);
  return leaders[0] === undefined ? { deck, errors } : { leader: leaders[0], deck, errors };
}

/** Writes a deck as "1xLEADER" then "NxCARD" lines, in card number order. */
export function formatDeckList(list: DeckList): string {
  const counts = new Map<string, number>();
  for (const id of list.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  const ids = [...counts.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  return [`1x${list.leader}`, ...ids.map((id) => `${counts.get(id)}x${id}`)].join("\n");
}

function lookUp(catalog: CardCatalog, written: string): string | undefined {
  const id = written.toUpperCase();
  if (catalog[id]) return id;
  const base = id.replace(/_.*$/, "");
  return catalog[base] ? base : undefined;
}
