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
  /**
   * Where a permanent effect works. "hand" is for text like "give this card in
   * your hand −3 cost". Defaults to the field.
   */
  zone?: "field" | "hand";
  /** `replaceRemoval` only: what the effect replaces. */
  replaces?: Replacement;
  /** `donReturned` only: how many DON!! must be returned at once ("when 2 or more ..."). */
  returnedAtLeast?: number;
  steps: Step[];
}

/**
 * "If [card] would be K.O.'d / removed from the field by an effect, you may
 * [costs] instead" (rule 8-1-3-4). Paying the effect's costs prevents the removal.
 */
export interface Replacement {
  /** Which of the effect owner's cards are protected. "this" means only the card itself. */
  side: "self" | "this";
  filter?: Filter;
  /** "ko" for "would be K.O.'d"; "remove" for "would be removed from the field" (K.O., return, and so on). */
  removal: "ko" | "remove";
  /** Only effects of the opponent ("by your opponent's effect"). */
  byOpponent?: boolean;
}

export type Timing =
  | "onPlay"
  | "whenAttacking"
  | "onOpponentsAttack"
  | "onBlock"
  | "onKO"
  /** "When this Character is K.O.'d by an effect": checked like [On K.O.], but not in battle. */
  | "koByEffect"
  | "activateMain"
  | "main"
  | "counter"
  | "trigger"
  | "endOfYourTurn"
  | "endOfOpponentsTurn"
  /** "If a Character is rested by your effect" (any Character, either side). */
  | "characterRestedByYourEffect"
  /** "If ... would be K.O.'d ... instead" (rule 8-1-3-4). See `replaces`. */
  | "replaceRemoval"
  /** "When ... DON!! cards on your field are returned to your DON!! deck". See `returnedAtLeast`. */
  | "donReturned"
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
  | { handAtMost: number }
  /** "If you have X or more DON!! cards on your field": active, rested, and given (rule 3-6-1). */
  | { donOnFieldAtLeast: number }
  | { donOnFieldAtMost: number }
  /** "If this Character was played on this turn". */
  | { playedThisTurn: true }
  /** The top card of your deck matches, as in "Reveal 1 card from the top of your deck. If that card is..." */
  | { deckTopMatches: Filter }
  /** "If your Leader is [Buggy]": the Leader's name. */
  | { leaderIs: string }
  /** True if any of the listed conditions holds ("has the {X} type or is [Y]"). */
  | { anyOf: Condition[] }
  /** "If you have 2 or more Characters with a base cost of 5 or more", and so on. */
  | { count: CardCount; atLeast?: number; atMost?: number }
  /** Rested DON!! cards in your cost area. */
  | { donRestedAtLeast: number }
  /** Rested cards you have: DON!! in the cost area plus Leader, Characters, and Stage. */
  | { restedCardsAtLeast: number }
  /** "If your Leader is multicolored". */
  | { leaderMulticolored: true }
  /** "If your opponent has 5 or more DON!! cards on their field". */
  | { opponentDonOnFieldAtLeast: number }
  /** "If your Leader's type includes "Whitebeard Pirates"". */
  | { leaderTypeIncludes: string };

/** Field cards to count for a `count` condition. Sides are relative to the effect's player. */
export interface CardCount {
  side: "self" | "opponent";
  /** Defaults to "characters". */
  zone?: "leader" | "characters" | "leaderOrCharacters" | "stage";
  filter?: Filter;
}

export type Cost =
  /** ①: rest this many active DON!! (rule 8-3-1-5). */
  | { restDon: number }
  /**
   * DON!! −X: return DON!! from the field to the DON!! deck (rule 8-3-1-6). With `orMore`,
   * "return 1 or more DON!! cards": the player picks how many, at least `donMinus`.
   */
  | { donMinus: number; orMore?: boolean }
  | { trashFromHand: number; filter?: Filter }
  /** Place cards from your hand at the top of your deck. */
  | { handToDeckTop: number }
  /** Return this many of your Characters (matching `filter`, e.g. `notThis`) to your hand. */
  | { returnOwnCharacter: number; filter?: Filter }
  /** "Reveal 2 cards with a type including ... from your hand". They stay in hand. */
  | { revealFromHand: number; filter?: Filter }
  /** Rest 1 of your active Leader, Characters or Stage matching the filter (e.g. "rest 1 of your [Uta] cards"). */
  | { restOwn: Filter }
  | { restThis: true }
  /** Add Life cards to your hand, from the top or (player's choice) the top or bottom. */
  | { lifeToHand: number; from?: "top" | "topOrBottom" }
  /** Trash cards from the top of your Life cards. */
  | { trashLife: number }
  /** Turn the top card of your Life cards face-up. It must be face-down. */
  | { lifeFaceUp: number }
  /** Place cards from your trash at the bottom of your deck. */
  | { trashToDeckBottom: number }
  /** Trash this card from the field. Not a K.O. */
  | { trashThis: true }
  /** "Return N total of your currently given DON!! cards to your cost area rested." */
  | { returnGivenDon: number };

/** Which cards a step can pick from. */
export interface Target {
  /** "this" means the card the effect is on. "any" means either player's cards. */
  side: "self" | "opponent" | "this" | "any";
  zone?: "leader" | "characters" | "leaderOrCharacters" | "stage";
  filter?: Filter;
  /** How many to pick. Defaults to 1. */
  count?: number;
  /** "Up to": the player may pick fewer, even 0 (rule 4-8). */
  upTo?: boolean;
}

export interface Filter {
  category?: CardCategory;
  /** Current cost, after effects such as "+1 cost". */
  costAtMost?: number;
  costAtLeast?: number;
  /** "With a cost equal to or less than the number of your opponent's Life cards." */
  costAtMostOpponentLife?: boolean;
  /** Printed cost ("base cost", rule 2-7-1). */
  baseCostAtMost?: number;
  baseCostAtLeast?: number;
  powerAtMost?: number;
  powerAtLeast?: number;
  /** Printed power ("base power", rule 2-6-1). */
  basePowerAtMost?: number;
  basePowerAtLeast?: number;
  type?: string;
  /** A type containing this text, e.g. "Baroque Works". */
  typeIncludes?: string;
  /** Matches card names containing this text (rule 2-1-2-1). */
  nameIncludes?: string;
  name?: string;
  /** "Other than [X]". */
  notName?: string;
  color?: Color;
  rested?: boolean;
  notThis?: boolean;
  /** Trigger only: the card has a [Trigger]. */
  hasTrigger?: boolean;
  /** The card has this keyword right now, e.g. [Blocker]. */
  keyword?: Keyword;
  /** At least one of these filters matches ("{Cross Guild} type or ..."). */
  anyOf?: Filter[];
}

/**
 * "turn" and "battle" end with the turn or battle. "opponentsNextTurn" lasts
 * until the end of the effect player's opponent's next turn ("until the end of
 * your opponent's next End Phase").
 */
export type Duration = "turn" | "battle" | "opponentsNextTurn";

/** Things a card can or can't do, given by `grantStatus`. */
export type Status =
  | "cannotAttack"
  /** Your opponent cannot activate this [Blocker]. */
  | "cannotBlock"
  | "cannotBeKOdInBattle"
  | "cannotBeKOdByEffects"
  | "cannotBeKOdByOpponentsEffects"
  /** Doesn't become active in its owner's next Refresh Phase. */
  | "noRefresh";

export type Step =
  | { do: "draw"; count: number }
  /**
   * With `perPrevious`, `amount` is multiplied by how many cards the previous step moved.
   * `perTrash`: "+amount for every N cards in your trash".
   */
  | {
      do: "powerUp";
      target: Target;
      amount: number;
      duration?: Duration;
      perPrevious?: boolean;
      perTrash?: number;
    }
  | { do: "grantKeyword"; target: Target; keyword: Keyword; duration?: Duration }
  | { do: "grantStatus"; target: Target; status: Status; duration?: Duration }
  /**
   * Change cost (negative for "−"). As a permanent effect with `zone: "hand"`
   * it changes the cost to play the card.
   */
  | { do: "costChange"; target: Target; amount: number; duration?: Duration; perTrash?: number }
  | { do: "ko"; target: Target }
  /**
   * `stayRested`: "and that Character will not become active in your
   * opponent's next Refresh Phase". `ifYouDo`: steps that happen only if at
   * least one card was rested ("you may rest ...: If you do, ...").
   */
  | { do: "rest"; target: Target; stayRested?: boolean; ifYouDo?: Step[] }
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
  | { do: "trashFromHand"; count: number; upTo?: boolean; filter?: Filter }
  /** Place cards from your hand at the top of your deck. */
  | { do: "handToDeckTop"; count: number }
  /** Place cards from your hand at the bottom of your deck. */
  | { do: "handToDeckBottom"; count: number }
  /** Place the cards revealed by a `revealFromHand` cost at the top of your deck. */
  | { do: "revealedToDeckTop" }
  /** Add up to `count` (default 1) matching cards from your trash to your hand. */
  | { do: "trashToHand"; filter?: Filter; count?: number }
  /** The opponent trashes cards from their hand. */
  | { do: "opponentTrashesFromHand"; count: number }
  /** Look at the top cards, reveal and add matching ones to hand, rest to the bottom. */
  /**
   * The rest go to the bottom; with `rest: "trash"` they are trashed, and with
   * `rest: "topOrBottom"` they go to the top or bottom of the deck in any order.
   */
  | {
      do: "searchDeck";
      look: number;
      take: number;
      filter?: Filter;
      rest?: "bottom" | "trash" | "topOrBottom";
    }
  /**
   * Look at the top cards and put them back on top in any order. With `bottom`,
   * any of them can go to the bottom instead ("at the top or bottom of the deck in any order").
   */
  | { do: "arrangeDeckTop"; look: number; bottom?: boolean }
  /** "You may play" the top card of your deck if it matches. */
  | { do: "playFromDeckTop"; filter?: Filter; rested?: boolean }
  /** Play a card from hand for free. `rested`: "play ... rested". */
  | { do: "playFromHand"; filter?: Filter; rested?: boolean }
  | { do: "playFromTrash"; filter?: Filter; rested?: boolean }
  /** "You cannot add Life cards to your hand using your own effects during this turn." */
  | { do: "noLifeToHand" }
  /** Add Life cards to your hand, from the top or (`fromBottom`) the bottom. */
  | { do: "lifeToHand"; count: number; fromBottom?: boolean }
  | { do: "deckToLife"; count: number }
  /** "[On Play] effects are negated" for you (`self`) or your opponent. */
  | { do: "negateOnPlay"; side: "self" | "opponent"; duration?: Duration }
  /** Trash cards from the top of your (or your opponent's) Life cards. */
  | { do: "trashLife"; side: "self" | "opponent"; count: number }
  /**
   * "Look at up to 1 card from the top of your or your opponent's Life cards,
   * and place it at the top or bottom of the Life cards."
   */
  | { do: "arrangeLife" }
  /**
   * "Add up to 1 of your Characters ... to the top or bottom of the owner's Life cards face-up."
   * The player picks the Character, then top or bottom.
   */
  | { do: "characterToLife"; target: Target; faceUp?: boolean }
  /** "Look at all your Life cards; place 1 at the top of your deck and the rest back in any order." */
  | { do: "lifeToDeckTop" }
  /** Trigger only: add this card to your hand. */
  | { do: "addThisToHand" }
  /** Trash Characters from the field. This is not a K.O. (rule 10-2-14). */
  | { do: "trashCharacter"; target: Target }
  /** Play this card: a [Trigger] card instead of trashing it, or this card from the trash (e.g. [On K.O.]). */
  | { do: "playThis"; rested?: boolean }
  /** "Choose one": the chooser picks one option, whose steps then happen. */
  | {
      do: "chooseOne";
      chooser?: "opponent";
      options: { label: string; steps: Step[] }[];
    }
  /** Rest up to this many of your opponent's active DON!! cards. */
  | { do: "restOpponentDon"; count: number }
  /** "At the end of this turn": the steps happen in this turn's End Phase. */
  | { do: "atEndOfTurn"; steps: Step[] }
  /** A whole sub-sequence that only happens "if" a condition holds (rule 8-3-3). */
  | { do: "if"; conditions: Condition[]; steps: Step[] }
  /** "[Leader]'s base power becomes 7000": replaces the printed power (rule 2-6-1). */
  | { do: "setBasePower"; target: Target; power: number; duration?: Duration };
