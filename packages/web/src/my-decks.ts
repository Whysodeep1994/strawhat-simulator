import { checkDeck, type CardCatalog, type DeckFormat } from "@strawhat/engine";
import type { CardData, PlayableDeck } from "./card-data.js";

/**
 * Decks the player builds in the deck builder. They stay in this browser (localStorage), like
 * uploaded playmats; accounts and syncing come with online play.
 */
export interface SavedDeck {
  id: string;
  name: string;
  leader?: string;
  /** Card number → copies. */
  cards: Record<string, number>;
  /** ISO time of the last change. */
  updated: string;
  /** The format the Deck Builder checks the deck against. Left out means Standard. */
  format?: FormatId;
}

/**
 * Standard (blocks 2 to 5 and X) is for every game. Grand Battle allows every block, Block 1
 * included, and is for games against a friend.
 */
export type FormatId = "standard" | "grand-battle";

export const FORMAT_NAMES: Record<FormatId, string> = {
  standard: "Standard",
  "grand-battle": "Grand Battle",
};

export function formatFor(id: FormatId, data: CardData): DeckFormat {
  return id === "grand-battle" ? data.grandBattle : data.format;
}

/** The format the deck is built for. */
export function deckFormat(deck: SavedDeck, data: CardData): DeckFormat {
  return formatFor(deck.format ?? "standard", data);
}

const KEY = "strawhat.decks";

export function loadDecks(): SavedDeck[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isSavedDeck) : [];
  } catch {
    return [];
  }
}

/** Returns false when the browser refused to store them (private mode or out of space). */
export function saveDecks(decks: SavedDeck[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(decks));
    return true;
  } catch {
    return false;
  }
}

export function newDeck(): SavedDeck {
  return {
    id: `deck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: "New deck",
    cards: {},
    updated: new Date().toISOString(),
  };
}

/** The deck as a list of 50 card numbers, the way the engine takes it. */
export function cardList(deck: SavedDeck): string[] {
  return Object.entries(deck.cards)
    .sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }))
    .flatMap(([id, n]) => Array<string>(n).fill(id));
}

export function fromList(deck: SavedDeck, leader: string | undefined, list: string[]): SavedDeck {
  const cards: Record<string, number> = {};
  for (const id of list) cards[id] = (cards[id] ?? 0) + 1;
  const next: SavedDeck = { ...deck, cards, updated: new Date().toISOString() };
  if (leader) next.leader = leader;
  else delete next.leader;
  return next;
}

/** What keeps the deck out of its own format (or of `format`, when given). */
export function problemsOf(deck: SavedDeck, data: CardData, format?: FormatId) {
  const rules = format ? formatFor(format, data) : deckFormat(deck, data);
  return checkDeck(data.catalog as CardCatalog, rules, deck.leader, cardList(deck));
}

/**
 * A saved deck that can be played right now in `format` (Standard unless given). A Standard deck
 * is also a Grand Battle deck, since Grand Battle only allows more cards.
 */
export function playable(
  deck: SavedDeck,
  data: CardData,
  format: FormatId = "standard",
): PlayableDeck | null {
  if (!deck.leader || problemsOf(deck, data, format).length > 0) return null;
  return {
    id: deck.id,
    name: deck.name,
    leader: deck.leader,
    deck: cardList(deck),
    official: false,
    mine: true,
  };
}

function isSavedDeck(value: unknown): value is SavedDeck {
  if (typeof value !== "object" || value === null) return false;
  const deck = value as Partial<SavedDeck>;
  return (
    typeof deck.id === "string" &&
    typeof deck.name === "string" &&
    typeof deck.cards === "object" &&
    deck.cards !== null
  );
}

/** A new saved deck that starts as a copy of a Quick deck, for the player to tweak. */
export function copyOf(deck: PlayableDeck, name: string): SavedDeck {
  return { ...fromList(newDeck(), deck.leader, deck.deck), name };
}

const LAST_KEY = "strawhat.lastDeck";

/** The id of the deck the player last started a game with, so menus can start on it. */
export function loadLastDeck(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function saveLastDeck(id: string): void {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    // Private windows can refuse storage; the menus then start on the first deck instead.
  }
}

/** The deck a menu starts on: the last one played if it can still be played, else `fallback`. */
export function startingDeck(
  available: { id: string }[],
  last: string | null,
  fallback: string | null,
): string | null {
  return last && available.some((d) => d.id === last) ? last : fallback;
}
