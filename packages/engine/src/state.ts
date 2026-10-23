import type { CardDefinition } from "./cards.js";
import type { CardInstance, GameState, PlayerId } from "./types.js";

export type FieldZone = "leader" | "characters" | "stage";

export interface FieldLocation {
  player: PlayerId;
  zone: FieldZone;
  card: CardInstance;
}

export function definitionOf(state: GameState, card: CardInstance): CardDefinition {
  const def = state.catalog[card.cardId];
  if (!def) throw new Error(`Unknown card id "${card.cardId}"`);
  return def;
}

/** Finds a card on the field (Leader, Character, or Stage area) by uid. */
export function findOnField(state: GameState, uid: string): FieldLocation | null {
  for (const player of ["p1", "p2"] as const) {
    const p = state.players[player];
    if (p.leader.uid === uid) return { player, zone: "leader", card: p.leader };
    const character = p.characters.find((c) => c.uid === uid);
    if (character) return { player, zone: "characters", card: character };
    if (p.stage?.uid === uid) return { player, zone: "stage", card: p.stage };
  }
  return null;
}

/**
 * Current power of a Leader or Character: printed power, +1000 per given DON!!
 * during its owner's turn (rule 6-5-5-2), plus any battle bonus (rule 7-1-3-1-1).
 */
export function powerOf(state: GameState, card: CardInstance): number {
  const base = definitionOf(state, card).power ?? 0;
  const don = card.owner === state.turnPlayer ? card.givenDon * 1000 : 0;
  const bonus = state.battle?.bonus[card.uid] ?? 0;
  return base + don + bonus;
}

/**
 * A card leaving the field becomes a new card (rule 3-1-6). Its given DON!!
 * go to the cost area rested (rule 6-5-5-4).
 */
export function leaveField(state: GameState, card: CardInstance): void {
  state.players[card.owner].donRested += card.givenDon;
  card.givenDon = 0;
  card.rested = false;
  card.playedTurn = null;
}
