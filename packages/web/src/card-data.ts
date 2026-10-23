import {
  BASE_RULES,
  setOf,
  validateDeck,
  type DeckFormat,
  type CardCatalog,
  type CardDefinition,
  type DeckList,
} from "@strawhat/engine";

/** A card from strawhat-card-data: engine data plus the official text and art. */
export interface Card extends CardDefinition {
  text?: string;
  trigger?: string;
  /** Path of the card image, relative to the card data folder. */
  image?: string;
  rarity?: string;
  /** Battle attribute printed by the power, e.g. "Slash" or "Strike/Special". */
  attribute?: string | null;
}

/** An official deck list from strawhat-card-data's decks/ folder. */
export interface OfficialDeck {
  id: string;
  name: string;
  leader: string;
  cards: Record<string, number>;
  source?: string;
}

export interface PlayableDeck extends DeckList {
  id: string;
  name: string;
  /** False for a practice deck built while the official list isn't in the card data yet. */
  official: boolean;
  /** A deck the player built and saved. */
  mine?: boolean;
}

export interface CardData {
  catalog: Record<string, Card>;
  decks: PlayableDeck[];
  /** The Standard format: the official banned and restricted lists, when the card data has them. */
  format: DeckFormat;
  /** False until the card data has the official Standard rules; only the base rules apply. */
  formatLoaded: boolean;
  imageUrl: (card: Card | undefined) => string | undefined;
}

/** Where the app finds card data. The single-file build and dev server serve it next to the page. */
export const CARD_DATA_URL = "./card-data/";

export async function loadCardData(base = CARD_DATA_URL): Promise<CardData> {
  const [cards, decks, formats] = await Promise.all([
    fetchJson<Card[]>(`${base}cards.json`),
    fetchJson<OfficialDeck[]>(`${base}decks.json`).catch(() => []),
    fetchJson<DeckFormat[]>(`${base}formats.json`).catch(() => []),
  ]);
  return buildCardData(cards, decks, base, formats);
}

export function buildCardData(
  cards: Card[],
  officialDecks: OfficialDeck[],
  base: string,
  formats: DeckFormat[] = [],
): CardData {
  const standard = formats.find((f) => f.id === "standard");
  const catalog: Record<string, Card> = Object.fromEntries(cards.map((c) => [c.id, c]));
  const decks: PlayableDeck[] = [];
  for (const deck of officialDecks) {
    const list = Object.entries(deck.cards).flatMap(([id, n]) => Array<string>(n).fill(id));
    if (validateDeck(catalog as CardCatalog, deck.leader, list).length === 0) {
      decks.push({ id: deck.id, name: deck.name, leader: deck.leader, deck: list, official: true });
    }
  }
  // Sets with cards but no official list yet get a practice deck, so they can be played already.
  const covered = new Set(decks.map((d) => setOf(d.leader)));
  for (const leader of cards.filter((c) => c.category === "leader")) {
    const set = setOf(leader.id);
    if (covered.has(set)) continue;
    const practice = practiceDeck(cards, leader);
    if (practice) decks.push(practice);
  }
  decks.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
  return {
    catalog,
    decks,
    format: standard ?? { ...BASE_RULES, id: "standard", name: "Standard" },
    formatLoaded: standard !== undefined,
    imageUrl: (card) => (card?.image ? `${base}${card.image}` : undefined),
  };
}

/**
 * 50 cards from the Leader's own set: every card it can use, as evenly as the 4-copy limit
 * allows (rule 5-1-2), cheaper cards first when the copies don't divide evenly.
 */
export function practiceDeck(cards: Card[], leader: Card): PlayableDeck | null {
  const set = setOf(leader.id);
  const pool = cards
    .filter((c) => setOf(c.id) === set && c.category !== "leader")
    .filter((c) => c.colors.every((color) => leader.colors.includes(color)))
    .sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0) || a.id.localeCompare(b.id));
  if (pool.length * 4 < 50) return null;
  const copies = new Map(pool.map((c) => [c.id, 0]));
  for (let i = 0; i < 50; i++) {
    const card = pool[i % pool.length]!;
    copies.set(card.id, copies.get(card.id)! + 1);
  }
  const deck = [...copies].flatMap(([id, n]) => Array<string>(n).fill(id));
  return {
    id: `${set}-practice`,
    name: `${setLabel(set)} practice deck`,
    leader: leader.id,
    deck,
    official: false,
  };
}

/** "ST01" → "ST-01", the way sets are printed on boxes. */
export function setLabel(set: string): string {
  return set.replace(/^([A-Z]+)(\d)/, "$1-$2");
}

/** The official text, line by line, with its [Trigger] last. */
export function officialText(card: Card): string[] {
  const lines = (card.text ?? "").split("\n").filter((line) => line.trim() !== "");
  if (card.trigger) lines.push(card.trigger);
  return lines;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Couldn't load ${url} (${response.status})`);
  return (await response.json()) as T;
}
