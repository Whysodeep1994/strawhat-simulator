import type { CardCatalog } from "./cards.js";
import type { Phase } from "./phases.js";

export type PlayerId = "p1" | "p2";

export const PLAYER_IDS: readonly PlayerId[] = ["p1", "p2"];

export function opponentOf(player: PlayerId): PlayerId {
  return player === "p1" ? "p2" : "p1";
}

/** One physical card in a game. DON!! cards are tracked as counts instead. */
export interface CardInstance {
  uid: string;
  cardId: string;
  owner: PlayerId;
  /** Rule 4-4-1. Only meaningful on the field. */
  rested: boolean;
  /** DON!! cards given to this card (rule 6-5-5-1). */
  givenDon: number;
  /** Turn this card was played, used by rule 3-7-4. `null` when not on the field. */
  playedTurn: number | null;
}

export interface PlayerState {
  leader: CardInstance;
  /** Index 0 is the top of the deck. */
  deck: CardInstance[];
  hand: CardInstance[];
  /** Index 0 is the top of the trash. */
  trash: CardInstance[];
  characters: CardInstance[];
  stage: CardInstance | null;
  /** Index 0 is the top Life card. */
  life: CardInstance[];
  donDeck: number;
  donActive: number;
  donRested: number;
  turnsTaken: number;
}

export interface Battle {
  attacker: string;
  /** Changes when a [Blocker] takes the attacked card's place (rule 10-1-4-1). */
  target: string;
  /** Power added during this battle, by card uid (rule 7-1-3-1-1). */
  bonus: Record<string, number>;
}

/** Who must act next, and what kind of decision it is. */
export type Prompt =
  | { kind: "chooseTurnOrder"; player: PlayerId }
  | { kind: "mulligan"; player: PlayerId }
  | { kind: "main"; player: PlayerId }
  | { kind: "block"; player: PlayerId }
  | { kind: "counter"; player: PlayerId }
  | { kind: "gameOver" };

export interface GameState {
  catalog: CardCatalog;
  players: Record<PlayerId, PlayerState>;
  /** 0 during setup; 1 is the first player's first turn. */
  turn: number;
  turnPlayer: PlayerId;
  firstPlayer: PlayerId | null;
  phase: Phase | "setup" | "gameOver";
  prompt: Prompt;
  battle: Battle | null;
  winner: PlayerId | "draw" | null;
  /** Seeded random state, so a game can be replayed exactly. */
  rng: number;
  nextUid: number;
}
