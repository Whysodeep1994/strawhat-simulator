import type { CardCategory, Color, Keyword } from "./cards.js";

/**
 * Card effects are data built from these blocks, so most new cards need no
 * new code. See docs/CARD_EFFECTS.md for the full list with examples.
 */
export interface EffectDefinition {
  /** When the effect can happen (rules 8-1-3, 10-2). */
  timing: Timing;
  /** All must hold (rule 8-3-2-1). */
  conditions?: Condition[];
  /** Paid before the colon, top to bottom (rule 8-3-1). */
  costs?: Cost[];
  /** [Once Per Turn] (rule 10-2-13). */
  oncePerTurn?: boolean;
  /** "You may": the player can decline (rule 8-1-2). */
  optional?: boolean;
  steps: Step[];
}

export type Timing =
  | "onPlay"
  | "whenAttacking"
  | "onOpponentsAttack"
  | "onBlock"
  | "onKO"
  | "activateMain"
  | "main"
  | "counter"
  | "trigger"
  | "endOfYourTurn"
  | "endOfOpponentsTurn"
  /** Always on while its conditions hold (rule 8-1-3-3). */
  | "permanent";

export type Condition =
  /** [DON!! xX]: at least X DON!! given to this card (rule 8-3-2-3). */
  | { donAtLeast: number }
  /** [Your Turn] (rule 8-3-2-4). */
  | { yourTurn: true }
  /** [Opponent's Turn] (rule 8-3-2-5). */
  | { opponentsTurn: true }
  | { lifeAtMost: number }
  | { lifeAtLeast: number }
  | { opponentLifeAtMost: number }
  | { opponentLifeAtLeast: number }
  | { leaderHasType: string }
  | { charactersAtLeast: number }
  | { handAtMost: number };

export type Cost =
  /** ①: rest this many active DON!! (rule 8-3-1-5). */
  | { restDon: number }
  /** DON!! −X: return DON!! from the field to the DON!! deck (rule 8-3-1-6). */
  | { donMinus: number }
  | { trashFromHand: number }
  | { restThis: true }
  /** "Return N total of your currently given DON!! cards to your cost area rested." */
  | { returnGivenDon: number };

/** Which cards a step can pick from. */
export interface Target {
  /** "this" means the card the effect is on. */
  side: "self" | "opponent" | "this";
  zone?: "leader" | "characters" | "leaderOrCharacters" | "stage";
  filter?: Filter;
  /** How many to pick. Defaults to 1. */
  count?: number;
  /** "Up to": the player may pick fewer, even 0 (rule 4-8). */
  upTo?: boolean;
}

export interface Filter {
  category?: CardCategory;
  costAtMost?: number;
  costAtLeast?: number;
  /** "With a cost equal to or less than the number of your opponent's Life cards." */
  costAtMostOpponentLife?: boolean;
  powerAtMost?: number;
  powerAtLeast?: number;
  type?: string;
  /** Matches card names containing this text (rule 2-1-2-1). */
  nameIncludes?: string;
  name?: string;
  color?: Color;
  rested?: boolean;
  notThis?: boolean;
  /** Trigger only: the card has a [Trigger]. */
  hasTrigger?: boolean;
  /** The card has this keyword right now, e.g. [Blocker]. */
  keyword?: Keyword;
}

export type Duration = "turn" | "battle";

export type Step =
  | { do: "draw"; count: number }
  /** `perTrash`: "+amount for every N cards in your trash". */
  | { do: "powerUp"; target: Target; amount: number; duration?: Duration; perTrash?: number }
  | { do: "grantKeyword"; target: Target; keyword: Keyword; duration?: Duration }
  | { do: "ko"; target: Target }
  | { do: "rest"; target: Target }
  | { do: "setActive"; target: Target }
  | { do: "returnToHand"; target: Target }
  | { do: "returnToDeckBottom"; target: Target }
  /**
   * "Your opponent cannot activate [Blocker]" when the target attacks. `blockers`
   * limits which [Blocker] Characters are stopped (e.g. 5000 power or more).
   */
  | { do: "noBlockers"; target: Target; blockers?: Filter; duration?: Duration }
  /** Give rested DON!! from the cost area (e.g. "Give up to 1 rested DON!! card to your Leader"). */
  | { do: "giveRestedDon"; target: Target; count: number }
  /** Put DON!! from the DON!! deck into the cost area. */
  | { do: "addDon"; count: number; rested?: boolean }
  | { do: "setDonActive"; count: number }
  /** The effect's player trashes cards from their hand. */
  | { do: "trashFromHand"; count: number; upTo?: boolean }
  /** The opponent trashes cards from their hand. */
  | { do: "opponentTrashesFromHand"; count: number }
  /** Look at the top cards, reveal and add matching ones to hand, rest to the bottom. */
  | { do: "searchDeck"; look: number; take: number; filter?: Filter }
  /** Play a card from hand for free. */
  | { do: "playFromHand"; filter?: Filter }
  | { do: "playFromTrash"; filter?: Filter }
  | { do: "lifeToHand"; count: number }
  | { do: "deckToLife"; count: number }
  /** "[On Play] effects are negated" for you (`self`) or your opponent. */
  | { do: "negateOnPlay"; side: "self" | "opponent"; duration?: Duration }
  /** Trigger only: play this card instead of trashing it. */
  | { do: "playThis" }
  /** A whole sub-sequence that only happens "if" a condition holds (rule 8-3-3). */
  | { do: "if"; conditions: Condition[]; steps: Step[] };
