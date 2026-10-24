import type { CardCatalog, Keyword } from "./cards.js";
import type { Filter, Status, Step } from "./effects.js";
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
  /** A face-up Life card, which both players can see (rule 3-10-2-1). */
  faceUp?: boolean;
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
  /** A [Blocker] can be used once per battle (rule 7-1-2-1). */
  blocked: boolean;
}

/** A temporary change from an effect, such as "+2000 power during this turn". */
export interface Modifier {
  target: string;
  power?: number;
  /** "Base power becomes X": replaces the printed power. */
  basePower?: number;
  cost?: number;
  keyword?: Keyword;
  status?: Status;
  /** The opponent can't activate [Blocker] Characters matching this when the target attacks. */
  noBlockers?: Filter;
  /** The target is a Leader: its player's [On Play] effects are negated. */
  negateOnPlay?: boolean;
  /** On a Leader: its player can't add Life cards to their hand with their own effects. */
  noLifeToHand?: boolean;
  /** On a Leader: a `battleKOReplacement` effect, set up by a `replaceBattleKO` step, that may save
   * its player's Characters from a K.O. in battle this turn. */
  battleKOReplace?: { source: string; effect: number };
  /** On a Leader: its player can't play cards matching `filter` (`fromHand`: only from the hand). */
  cannotPlay?: { filter?: Filter; fromHand?: boolean };
  /** On a Leader: its player can't attack Leaders ("you cannot attack a Leader during this turn"). */
  noLeaderAttacks?: boolean;
  until: "turn" | "battle";
  /** For "turn": the last turn it lasts. Defaults to the current turn. */
  endsTurn?: number;
}

/** An auto effect whose timing was met and is waiting to resolve (rule 8-6). */
export interface QueuedEffect {
  controller: PlayerId;
  source: string;
  effect: number;
}

/** Steps of an effect that happen at the end of the turn. */
export interface DelayedEffect {
  controller: PlayerId;
  source: string;
  effect: number;
  steps: Step[];
}

/**
 * Work the engine still has to finish, newest on top. When a frame needs a
 * player's decision, the engine stops and sets `prompt`; the answer resumes it.
 */
export type Frame =
  | {
      kind: "effect";
      controller: PlayerId;
      source: string;
      cardId: string;
      effect: number;
      /** Where the effect is in its procedure (rule 8-4-1). */
      stage: "check" | "confirm" | "costs" | "steps";
      costIndex: number;
      steps: Step[];
      /** Scratch space for a step that needs more than one decision. */
      memo: string[];
      /** Cards revealed from the hand to pay a `revealFromHand` cost. */
      revealed?: string[];
      /** Which option of a `oneOf` cost the player is paying. */
      picked?: number;
      /** How many cards the previous step moved, for "for every card trashed". */
      previous?: number;
      /** The cards the last removal step moved, for "a different color than the returned Character". */
      moved?: string[];
      /** Cards trashed from the hand to pay this effect's costs ("the trashed card"). */
      costTrashed?: string[];
      answer: string[] | boolean | null;
      /** `replaceRemoval` only: the card the replacement would save. */
      replacing?: string;
      /** The cards the last targeting step picked, for "that Character" (`side: "that"`). */
      targets?: string[];
    }
  | {
      kind: "battle";
      step: "attack" | "block" | "counter" | "damage" | "ko" | "end";
      /** The losing Character a replacement effect may save from a K.O. in battle. */
      saving?: string;
    }
  | {
      kind: "damage";
      defender: PlayerId;
      remaining: number;
      banish: boolean;
      answer: boolean | null;
    }
  | { kind: "trigger-cleanup" }
  /** Rule 5-2-1-6: the opening draw, after any "at the start of the game" effects. */
  | { kind: "opening-draw" }
  | { kind: "end-phase"; stage: number };

/** Who must act next, and what kind of decision it is. */
export type Prompt =
  | { kind: "chooseTurnOrder"; player: PlayerId }
  | { kind: "mulligan"; player: PlayerId }
  | { kind: "main"; player: PlayerId }
  | { kind: "block"; player: PlayerId }
  | { kind: "counter"; player: PlayerId }
  | {
      kind: "choose";
      player: PlayerId;
      /** Card uids to pick from. */
      options: string[];
      min: number;
      max: number;
      /** What the choice is for, e.g. "ko" or "trashFromHand". */
      reason: string;
      source: string;
      /** Extra cards only the chooser sees, e.g. every card looked at in a search (rule 11-3-1). */
      revealed?: string[];
      /** "With a total power of 4000 or less": the picked cards' power must add up to at most this. */
      maxTotalPower?: number;
    }
  | {
      kind: "confirm";
      player: PlayerId;
      /**
       * "optional" and "trigger": yes or no. "lifeFromBottom" and "lifeToBottom": yes
       * means the bottom of the Life cards.
       */
      reason: "optional" | "trigger" | "lifeFromBottom" | "lifeToBottom";
      source: string;
    }
  /** "Choose one": answered with the index of one of `labels`. */
  | { kind: "chooseOne"; player: PlayerId; labels: string[]; source: string }
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
  stack: Frame[];
  pendingEffects: QueuedEffect[];
  modifiers: Modifier[];
  /** "uid:effect" keys of [Once Per Turn] effects used this turn (rule 10-2-13). */
  usedThisTurn: string[];
  /** Steps waiting for the End Phase ("at the end of this turn"). */
  delayed: DelayedEffect[];
  /** The last turn in which each player's hand had a card trashed by an effect. */
  handTrashedTurn?: Partial<Record<PlayerId, number>>;
  /** Events activated this turn ("if you have activated an Event ... during this turn"). */
  activatedEvents?: { player: PlayerId; cardId: string; turn: number }[];
  /** Cards whose pending removal a replacement effect prevented (rule 8-1-3-4). */
  prevented?: string[];
  /** A [Trigger] card being activated belongs to no area (rule 10-1-5-3). */
  limbo: CardInstance | null;
  /** A player who takes an extra turn after this one ("take an extra turn"). */
  extraTurn?: PlayerId;
  /** Seeded random state, so a game can be replayed exactly. */
  rng: number;
  nextUid: number;
}
