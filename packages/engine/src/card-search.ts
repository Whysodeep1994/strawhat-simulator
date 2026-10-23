import type { CardCatalog, CardCategory, CardDefinition, Color } from "./cards.js";

/** Deck builder search. Every field is optional; a card must match all the fields that are set. */
export interface CardSearch {
  /** Free text: matches the card name, card number, or a type (e.g. "Straw Hat Crew"). */
  text?: string;
  /** Card number, full or partial. "op13-1", "OP13 001", "OP13001", and "OP13-001" all find OP13-001. */
  id?: string;
  /** Set codes such as "OP13" or "ST01". */
  sets?: string[];
  /** Cards with at least one of these colors. */
  colors?: Color[];
  /** Leader, Character, Event, or Stage. */
  categories?: CardCategory[];
  /** Cards with at least one of these types, e.g. "Straw Hat Crew" (rule 2-5). */
  types?: string[];
  /** Inclusive cost range, e.g. { min: 4, max: 6 }. Cards without a cost (Leaders) are left out. */
  cost?: { min?: number; max?: number };
  /** Only cards that can go in a deck with this Leader (rules 5-1-2-1 and 5-1-2-2). */
  leader?: string;
}

/** The values a deck builder needs to fill its filter menus and cost slider. */
export interface SearchOptions {
  sets: string[];
  colors: Color[];
  categories: CardCategory[];
  types: string[];
  cost: { min: number; max: number };
}

const COLOR_ORDER: Color[] = ["red", "green", "blue", "purple", "black", "yellow"];
const CATEGORY_ORDER: CardCategory[] = ["leader", "character", "event", "stage"];

/** The set code of a card number: "OP13-001" -> "OP13", "P-001" -> "P". */
export function setOf(cardId: string): string {
  const dash = cardId.indexOf("-");
  return dash === -1 ? cardId : cardId.slice(0, dash);
}

/** Tidies a typed card number: upper case, and spaces become a dash ("op13 001" -> "OP13-001"). */
export function normalizeCardId(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "-");
}

export function searchCards(catalog: CardCatalog, search: CardSearch): CardDefinition[] {
  const leader = search.leader === undefined ? undefined : catalog[search.leader];
  if (search.leader !== undefined && leader?.category !== "leader") return [];

  const text = search.text?.trim().toLowerCase();
  const id = search.id === undefined ? undefined : normalizeCardId(search.id);
  const sets = search.sets?.map((s) => s.toUpperCase());
  const types = search.types?.map((t) => t.toLowerCase());

  return Object.values(catalog)
    .filter((card) => {
      if (text && !matchesText(card, text)) return false;
      if (id && !matchesId(card.id, id)) return false;
      if (sets?.length && !sets.includes(setOf(card.id))) return false;
      if (search.colors?.length && !card.colors.some((c) => search.colors?.includes(c))) {
        return false;
      }
      if (search.categories?.length && !search.categories.includes(card.category)) return false;
      if (types?.length && !(card.types ?? []).some((t) => types.includes(t.toLowerCase()))) {
        return false;
      }
      if (search.cost) {
        if (card.cost === undefined) return false;
        if (search.cost.min !== undefined && card.cost < search.cost.min) return false;
        if (search.cost.max !== undefined && card.cost > search.cost.max) return false;
      }
      if (leader) {
        if (card.category === "leader") return false;
        if (!card.colors.every((c) => leader.colors.includes(c))) return false;
      }
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

export function searchOptions(catalog: CardCatalog): SearchOptions {
  const cards = Object.values(catalog);
  const costs = cards.flatMap((c) => (c.cost === undefined ? [] : [c.cost]));
  const colors = new Set(cards.flatMap((c) => c.colors));
  const categories = new Set(cards.map((c) => c.category));
  return {
    sets: [...new Set(cards.map((c) => setOf(c.id)))].sort((a, b) =>
      a.localeCompare(b, "en", { numeric: true }),
    ),
    colors: COLOR_ORDER.filter((c) => colors.has(c)),
    categories: CATEGORY_ORDER.filter((c) => categories.has(c)),
    types: [...new Set(cards.flatMap((c) => c.types ?? []))].sort((a, b) => a.localeCompare(b)),
    cost: {
      min: costs.length ? Math.min(...costs) : 0,
      max: costs.length ? Math.max(...costs) : 0,
    },
  };
}

function matchesText(card: CardDefinition, text: string): boolean {
  return (
    card.name.toLowerCase().includes(text) ||
    card.id.toLowerCase().includes(text) ||
    (card.types ?? []).some((t) => t.toLowerCase().includes(text))
  );
}

/** Prefix match, plus a short number for a whole card ("OP13-1" -> OP13-001) or no dash ("OP13001"). */
function matchesId(cardId: string, query: string): boolean {
  const id = cardId.toUpperCase();
  if (id.startsWith(query)) return true;
  const short = /^([A-Z]+\d*)-(\d{1,3})$/.exec(query);
  if (short?.[1] && short[2]) return id === `${short[1]}-${short[2].padStart(3, "0")}`;
  return id.replace("-", "").startsWith(query);
}
