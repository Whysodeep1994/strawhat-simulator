import { checkDeck, type CardCatalog } from "@strawhat/engine";
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

export function problemsOf(deck: SavedDeck, data: CardData) {
  return checkDeck(data.catalog as CardCatalog, data.format, deck.leader, cardList(deck));
}

/** A saved deck that can be played right now: legal in Standard. */
export function playable(deck: SavedDeck, data: CardData): PlayableDeck | null {
  if (!deck.leader || problemsOf(deck, data).length > 0) return null;
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
