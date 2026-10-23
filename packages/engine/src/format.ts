import type { CardCatalog, Color } from "./cards.js";
import type { Step } from "./effects.js";

/**
 * A tournament format's deck rules on top of the base rules (rule 5-1-2): which blocks are
 * legal, and the official banned and restricted lists. Real formats come from strawhat-card-data's
 * formats/ folder, copied from Bandai's official pages.
 */
export interface DeckFormat {
  id: string;
  name: string;
  /** The date this version of the rules took effect. */
  effective?: string;
  season?: { from: string; to: string };
  source?: string[];
  /** Cards in a deck, Leader not counted. Defaults to 50 (rule 5-1-2-1). */
  deckSize?: number;
  /** Copies allowed of one card number. Defaults to 4 (rule 5-1-2-3). */
  maxCopies?: number;
  /** Block icons allowed in decks, e.g. [2, 3, 4, 5, "X"]. Left out means every block. */
  legalBlocks?: (number | string)[];
  /** Card numbers legal whatever their block icon (reprints, Super Parallel Rares). */
  alwaysLegal?: string[];
  /** Card numbers the format treats as another block, e.g. { "ST01-011": 4 }. */
  treatedAsBlock?: Record<string, number | string>;
  /** Cards no deck may contain (as the Leader or in the deck). */
  banned?: string[];
  /** Cards limited to fewer copies than the maximum. */
  restricted?: Record<string, number>;
  /** Pairs of cards that can't be in the same deck (Leader included). */
  bannedPairs?: [string, string][];
  notes?: string;
}

export interface DeckProblem {
  message: string;
  /** The card the problem is about, when there is one. */
  card?: string;
}

/** The base rules only: 50 cards, 4 copies, colors (rule 5-1-2). */
export const BASE_RULES: DeckFormat = { id: "base", name: "Base rules" };

/** How many copies of a card a deck may have in this format: 0 if it can't be used at all. */
export function copyLimit(format: DeckFormat, catalog: CardCatalog, cardId: string): number {
  const id = baseId(cardId);
  if (format.banned?.includes(id) || !inLegalBlock(format, catalog, cardId)) return 0;
  const max = format.maxCopies ?? 4;
  return Math.min(max, format.restricted?.[id] ?? max);
}

/** Whether the card's block is allowed, counting the format's exceptions. Unknown blocks are allowed. */
function inLegalBlock(format: DeckFormat, catalog: CardCatalog, cardId: string): boolean {
  const legal = format.legalBlocks;
  if (!legal) return true;
  const id = baseId(cardId);
  if (format.alwaysLegal?.includes(id)) return true;
  const treated = format.treatedAsBlock?.[id];
  if (treated !== undefined && legal.includes(treated)) return true;
  const block = catalog[cardId]?.blockIcon ?? catalog[id]?.blockIcon;
  return block === undefined || legal.includes(block);
}

/** Every reason a deck isn't legal in the format. An empty list means it can be played. */
export function checkDeck(
  catalog: CardCatalog,
  format: DeckFormat,
  leaderId: string | undefined,
  deck: string[],
): DeckProblem[] {
  const size = format.deckSize ?? 50;
  if (!leaderId) {
    const problems: DeckProblem[] = [{ message: "Choose a Leader" }];
    if (deck.length !== size) problems.push(sizeProblem(deck.length, size));
    return problems;
  }
  const leader = catalog[leaderId];
  if (leader?.category !== "leader") return [{ message: `${leaderId} isn't a Leader card` }];
  const problems: DeckProblem[] = [];
  if (deck.length !== size) problems.push(sizeProblem(deck.length, size));

  // "You can only include {East Blue} type cards in your deck" (P-117).
  const onlyType = (leader.effects ?? [])
    .flatMap((e) => (e.timing === "permanent" ? e.steps : []))
    .find((s): s is Extract<Step, { do: "deckOnlyType" }> => s.do === "deckOnlyType")?.type;
  const copies = new Map<string, number>();
  for (const id of deck) copies.set(id, (copies.get(id) ?? 0) + 1);
  for (const id of copies.keys()) {
    const card = catalog[id];
    const name = card?.name ?? id;
    if (!card) problems.push({ card: id, message: `Unknown card ${id}` });
    else if (card.category === "leader") {
      problems.push({ card: id, message: `${name} (${id}) is a Leader; it can't go in the deck` });
    } else if (!card.colors.every((c) => leader.colors.includes(c))) {
      problems.push({ card: id, message: `${name} (${id}) isn't ${colorList(leader.colors)}` });
    } else if (onlyType && !(card.types ?? []).includes(onlyType)) {
      problems.push({
        card: id,
        message: `${name} (${id}) isn't {${onlyType}} type; ${leader.name} only allows {${onlyType}} cards`,
      });
    }
  }
  for (const id of [leaderId, ...copies.keys()]) {
    const name = catalog[id]?.name ?? id;
    const limit = copyLimit(format, catalog, id);
    const count = id === leaderId ? 1 : (copies.get(id) ?? 0);
    if (limit === 0) {
      const banned = format.banned?.includes(baseId(id));
      problems.push({
        card: id,
        message: banned
          ? `${name} (${id}) is banned in ${format.name}`
          : `${name} (${id}) has rotated out of ${format.name}`,
      });
    } else if (count > limit) {
      problems.push({
        card: id,
        message:
          limit < (format.maxCopies ?? 4)
            ? `${name} (${id}) is limited to ${limit} in ${format.name}; you have ${count}`
            : `${count} copies of ${name} (${id}); the limit is ${limit}`,
      });
    }
  }
  const inDeck = new Set([leaderId, ...deck].map(baseId));
  for (const [a, b] of format.bannedPairs ?? []) {
    if (inDeck.has(a) && inDeck.has(b)) {
      problems.push({
        card: b,
        message: `${a} and ${b} can't be in the same deck in ${format.name}`,
      });
    }
  }
  return problems;
}

function sizeProblem(have: number, size: number): DeckProblem {
  return {
    message:
      have < size
        ? `The deck has ${have} cards; add ${size - have} more to reach ${size}`
        : `The deck has ${have} cards; remove ${have - size} to get down to ${size}`,
  };
}

/** "red", "red or green": the colors a deck with this Leader may use (rule 5-1-2-2). */
function colorList(colors: Color[]): string {
  return colors.join(" or ");
}

/** Parallel (alternate art) prints such as "OP01-016_p1" follow their card number's rules. */
function baseId(cardId: string): string {
  return cardId.replace(/_.*$/, "");
}
