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
  /**
   * [Once Per Turn] (rule 10-2-13). A string is a key shared by several effects on the card
   * that are one [Once Per Turn] effect, e.g. one written with two timings or two costs.
   */
  oncePerTurn?: boolean | string;
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
  /** `characterRemovedByOpponent` only: which of your Characters it watches. */
  removed?: Filter;
  /**
   * For timings about another card (`yourCharacterKOd`, `yourCharacterRemovedByOpponent`,
   * `youPlayCharacter`): which cards set the effect off.
   */
  cardFilter?: Filter;
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
  /** Also replaces a K.O. in battle ("If ... would be K.O.'d", without "by an effect"). */
  battle?: boolean;
}

export type Timing =
  | "onPlay"
  | "whenAttacking"
  | "onOpponentsAttack"
  | "onBlock"
  | "onKO"
  /** "When this Character is K.O.'d by an effect": checked like [On K.O.], but not in battle. */
  | "koByEffect"
  /** "When this Character is K.O.'d by your opponent's effect". */
  | "koByOpponentsEffect"
  /** "When your Character is removed from the field by your opponent's effect". See `removed`. */
  | "characterRemovedByOpponent"
  /** "When your opponent activates [Blocker]". */
  | "onOpponentsBlock"
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
  /** "When your opponent's Character is returned to the owner's hand by your effect". */
  | "opponentCharacterReturned"
  /**
   * Set up by a `replaceBattleKO` step: "If any of your Characters would be K.O.'d in battle
   * during this turn, you may [costs] instead." Paying the costs saves the Character.
   */
  | "battleKOReplacement"
  /** "When you draw a card outside of your Draw Phase". */
  | "drawOutsideDrawPhase"
  /** "When a card is added to your hand from your Life". */
  | "lifeAddedToHand"
  /** "When your number of Life cards becomes 0". */
  | "lifeBecomesZero"
  /** "When this Character becomes rested" (by attacking, blocking, a cost or an effect). */
  | "becomesRested"
  /** "When a Character is K.O.'d": any Character, either player's, in battle or by an effect. */
  | "characterKOd"
  /** "When your opponent's Character is K.O.'d", in battle or by an effect. */
  | "opponentCharacterKOd"
  /** "When this card's attack deals damage to your opponent's Life". */
  | "attackDealsDamage"
  /** "When you take damage": each time a Life card leaves for damage. */
  | "takeDamage"
  /** "When your Character [cardFilter] is K.O.'d". */
  | "yourCharacterKOd"
  /** "When your Character [cardFilter] is removed from the field by your opponent's effect". */
  | "yourCharacterRemovedByOpponent"
  /** "When you play a Character [cardFilter]". */
  | "youPlayCharacter"
  /** "When a [Trigger] activates" (either player's). */
  | "triggerActivated"
  /** "When your opponent activates an Event" (the card is on your field). */
  | "opponentActivatesEvent"
  /** "When a Character is removed from the field by your effect" (either player's Character). */
  | "characterRemovedByYourEffect"
  /** "When your Character [cardFilter] is removed from the field by an effect" (either player's). */
  | "yourCharacterRemovedByEffect"
  /** "When a card is removed from your opponent's Life cards" (damage or an effect). */
  | "opponentLifeRemoved"
  /** Leader effects that read "at the start of the game" (rule 5-2-1-5-1). */
  | "startOfGame"
  /** "When this Character becomes rested by your opponent's Character's effect". */
  | "restedByOpponentsCharacter"
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
  | { leaderTypeIncludes: string }
  /** "If this Character has 7000 power or more". */
  | { thisPowerAtLeast: number }
  /** "If your opponent has more DON!! cards on their field than you". */
  | { opponentHasMoreDon: true }
  | { handAtLeast: number }
  /** "If you have 10 or more cards in your trash". */
  | { trashAtLeast: number; trashFilter?: Filter }
  /** "If the number of your Life cards is equal to or less than the number of your opponent's Life cards". */
  | { lifeAtMostOpponents: true }
  /** "If you have a total of 3 or more given DON!! cards" (Leader and Characters). */
  | { givenDonAtLeast: number }
  /** "If your Leader has the <Slash> attribute". */
  | { leaderAttribute: string }
  /** "If your opponent has 6 or more cards in their hand". */
  | { opponentHandAtLeast: number }
  /** "If the number of cards in your hand is at least 3 less than the number in your opponent's hand". */
  | { handFewerThanOpponentBy: number }
  /** "If you and your opponent have a total of 5 or less Life cards". */
  | { totalLifeAtMost: number }
  /** "During the turn in which a card in your hand is trashed by an effect". */
  | { handTrashedByEffectThisTurn: true }
  /** "If the number of DON!! cards on your field is equal to or less than the number on your opponent's field". */
  | { donOnFieldAtMostOpponents: true }
  /** "If you have 5 or less active DON!! cards". */
  | { donActiveAtMost: number }
  /** "If the number of DON!! cards on your field is at least 2 less than the number on your opponent's field". */
  | { donFewerThanOpponentBy: number }
  /** "If you have less Life cards than your opponent". */
  | { lifeFewerThanOpponent: true }
  /** "If this Character is rested". */
  | { thisRested: true }
  /** True if the condition doesn't hold. */
  | { not: Condition }
  /** "If your opponent's Leader has the <Slash> attribute". */
  | { opponentLeaderAttribute: string }
  /** "If you have [Kuromarimo] in your trash": a card matching the filter is in your trash. */
  | { trashHas: Filter }
  /** "If your opponent has 7 or more rested cards" (DON!! in the cost area, Leader, Characters, Stage). */
  | { opponentRestedCardsAtLeast: number }
  /** "If this Character is active". */
  | { thisActive: true };

/** Field cards to count for a `count` condition. Sides are relative to the effect's player. */
export interface CardCount {
  /** "any" counts both players' cards ("if there are 2 or more Characters with a cost of 8 or more"). */
  side: "self" | "opponent" | "any";
  /** Defaults to "characters". "field" is the Leader, Characters, and Stage. */
  zone?: "leader" | "characters" | "leaderOrCharacters" | "stage" | "field";
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
  /**
   * Return this many of your Characters (matching `filter`, e.g. `notThis`) to your hand, or
   * with `to: "deckBottom"` place them at the bottom of your deck.
   */
  | { returnOwnCharacter: number; filter?: Filter; to?: "deckBottom" }
  /** "Reveal 2 cards with a type including ... from your hand". They stay in hand. */
  | { revealFromHand: number; filter?: Filter }
  /** Rest 1 of your active Leader, Characters or Stage matching the filter (e.g. "rest 1 of your [Uta] cards"). */
  | { restOwn: Filter }
  | { restThis: true }
  /** Add Life cards to your hand, from the top or (player's choice) the top or bottom. */
  | { lifeToHand: number; from?: "top" | "topOrBottom" }
  /** Trash cards from the top of your Life cards. */
  | { trashLife: number }
  /** Turn the top (or, with `from: "topOrBottom"`, top or bottom) Life card face-up. It must be face-down. */
  | { lifeFaceUp: number; from?: "top" | "topOrBottom" }
  /** Turn a face-up Life card at the top (or bottom) face-down. */
  | { lifeFaceDown: number; from?: "top" | "topOrBottom" }
  /** Trash cards from the top of your deck. */
  | { trashFromDeckTop: number }
  /** "Rest your Leader or 1 of your DON!! cards": the player pays one of these. */
  | { oneOf: Cost[] }
  /** Place cards from your trash (matching `filter`) at the bottom of your deck. */
  | { trashToDeckBottom: number; filter?: Filter }
  /** Place cards from your hand at the bottom of your deck. */
  | { handToDeckBottom: number }
  /** Place this card (a Character or Stage) at the bottom of your deck. */
  | { thisToDeckBottom: true }
  /** "Return this Character to the owner's hand". */
  | { thisToHand: true }
  /** "Give this Character −2000 power during this turn". */
  | { thisPower: number }
  /** "Give your 1 active Leader −5000 power during this turn": the Leader must be active. */
  | { activeLeaderPower: number }
  /** "Return 2 of your active DON!! cards to your DON!! deck". */
  | { returnActiveDon: number }
  /** Trash this card from the field. Not a K.O. */
  | { trashThis: true }
  /** "Return N total of your currently given DON!! cards to your cost area rested." */
  | { returnGivenDon: number }
  /** "Place 1 of your Characters (or Stages) at the bottom of your deck". */
  | { toDeckBottom: number; zone?: "characters" | "stage"; filter?: Filter; side?: "any" }
  /** "Return 20 cards from your trash to your deck and shuffle it". */
  | { trashToDeck: number }
  /** "K.O. 1 of your Characters other than this Character". */
  | { koOwnCharacter: number; filter?: Filter }
  /** "Play 1 [Kotori] from your hand". */
  | { playFromHand: Filter }
  /** "Add 1 of your Characters ... to the top of your Life cards (face-up)". */
  | { characterToLife: number; filter?: Filter; faceUp?: boolean }

  /** "Give 1 of your active DON!! cards to 1 of your Leader or Character cards". */
  | { giveActiveDon: number }
  /** "Trash 1 of your Characters with a type including ...". Not a K.O. `zone: "stage"` trashes your Stage. */
  | { trashOwnCharacter: number; filter?: Filter; zone?: "stage" }
  /** "Return this Character to the owner's hand". */
  | { returnThis: true }
  /** "Rest 1 of your opponent's Characters" (e.g. as a replacement cost). */
  | { restOpponentCharacter: number }
  /** "Rest 2 of your cards": active DON!! in the cost area, Leader, Characters, or Stage. */
  | { restCards: number };

/** Which cards a step can pick from. */
export interface Target {
  /**
   * "this" means the card the effect is on. "any" means either player's cards. "that" means
   * the cards the previous step picked, or the card a replacement effect saves ("that Character").
   * "chosen" picks among the cards the previous step picked ("1 of those Characters").
   */
  side: "self" | "opponent" | "this" | "any" | "chosen" | "that";
  zone?: "leader" | "characters" | "leaderOrCharacters" | "stage" | "field";
  filter?: Filter;
  /** How many to pick. Defaults to 1. */
  count?: number;
  /** "Your opponent returns 1 of their Characters": the opponent picks. */
  chooser?: "opponent";
  /** "Up to": the player may pick fewer, even 0 (rule 4-8). */
  upTo?: boolean;
  /** "Up to 2 ... with a total power of 4000 or less". */
  totalPowerAtMost?: number;
}

export interface Filter {
  category?: CardCategory;
  /** Current cost, after effects such as "+1 cost". */
  costAtMost?: number;
  costAtLeast?: number;
  /** "With a cost equal to or less than the number of your opponent's Life cards." */
  costAtMostOpponentLife?: boolean;
  /** "With a cost equal to or less than the total of your and your opponent's Life cards." */
  costAtMostTotalLife?: boolean;
  /** Printed cost ("base cost", rule 2-7-1). */
  baseCostAtMost?: number;
  baseCostAtLeast?: number;
  powerAtMost?: number;
  powerAtLeast?: number;
  /** Printed power ("base power", rule 2-6-1). */
  basePowerAtMost?: number;
  basePowerAtLeast?: number;
  type?: string;
  /** Doesn't have this type ("If you only have {Celestial Dragons} type Characters"). */
  notType?: string;
  /** "With a cost equal to or less than the number of DON!! cards on your field". */
  costAtMostDonOnField?: boolean;
  /** "With a cost equal to or less than the number of DON!! cards on your opponent's field". */
  costAtMostOpponentDonOnField?: boolean;
  /** "With a cost equal to or less than your number of Life cards". */
  costAtMostLife?: boolean;
  /** A type containing this text, e.g. "Baroque Works". */
  typeIncludes?: string;
  /** No type containing this text. */
  notTypeIncludes?: string;
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
  /** The card doesn't have this keyword right now ("without [Blocker]"). */
  lacksKeyword?: Keyword;
  /** The printed attribute includes this, e.g. "Slash". */
  attribute?: string;
  /** At least one of these filters matches ("{Cross Guild} type or ..."). */
  anyOf?: Filter[];
  /** "Character cards without a Counter". */
  noCounter?: boolean;
  /** "With no base effect": a card without card text (rule 2-8-5), so no effects or keywords. */
  noBaseEffect?: boolean;
  /** "Without a [When Attacking] effect": the card has no effect with this timing. */
  lacksTiming?: Timing;
}

/**
 * "turn" and "battle" end with the turn or battle. "opponentsNextTurn" lasts
 * until the end of the effect player's opponent's next turn ("until the end of
 * your opponent's next End Phase"). "yourNextTurn" lasts until the end of the effect
 * player's own next turn ("until the end of your next turn").
 */
export type Duration = "turn" | "battle" | "opponentsNextTurn" | "yourNextTurn";

/** Things a card can or can't do, given by `grantStatus`. */
export type Status =
  | "cannotAttack"
  /** Your opponent cannot activate this [Blocker]. */
  | "cannotBlock"
  | "cannotBeKOdInBattle"
  | "cannotBeKOdByEffects"
  | "cannotBeKOdByOpponentsEffects"
  /** Doesn't become active in its owner's next Refresh Phase. */
  | "noRefresh"
  /** "Cannot be K.O.'d in battle by Leaders". */
  | "cannotBeKOdInBattleByLeaders"
  /** "Cannot be K.O.'d in battle by <Slash> attribute cards". */
  | "cannotBeKOdInBattleBySlash"
  /** "Cannot attack unless your opponent trashes 2 cards from their hand whenever they attack". */
  | "mustTrashToAttack"
  /** "Negate the effect of ...": the card's effects and keywords don't work (rule 8-2). */
  | "negated"
  /** "Cannot be rested": it can't attack, block, or be rested by effects or costs. */
  | "cannotBeRested"
  /** Can't be K.O.'d, returned, or trashed by the opponent's effects. */
  | "cannotBeRemovedByOpponentsEffects";

export type Step =
  /** `side: "opponent"`: "your opponent draws 1 card". */
  | { do: "draw"; count: number; side?: "opponent" }
  /**
   * With `perPrevious`, `amount` is multiplied by how many cards the previous step moved.
   * `perTrash`: "+amount for every N cards in your trash" (only cards matching `trashFilter`,
   * e.g. "every 2 Events"). `perRestedDon`: "for every 3 of your rested DON!! cards".
   */
  | {
      do: "powerUp";
      target: Target;
      amount: number;
      duration?: Duration;
      perPrevious?: boolean;
      /** With `perPrevious`: "for every 3 cards placed", so the count is divided by this. */
      perPreviousEvery?: number;
      perTrash?: number;
      trashFilter?: Filter;
      perRestedDon?: number;
      /** "For every {Straw Hat Crew} type card on your field": amount × the count. */
      perCount?: CardCount;
    }
  /**
   * Permanent effects only: matching Character cards in your hand have +amount Counter
   * ("All of your {Land of Wano} type Character cards without a Counter have a +1000 Counter").
   */
  | { do: "grantCounter"; target: Target; amount: number }
  | { do: "grantKeyword"; target: Target; keyword: Keyword; duration?: Duration }
  | { do: "grantStatus"; target: Target; status: Status; duration?: Duration }
  /**
   * Change cost (negative for "−"). As a permanent effect with `zone: "hand"`
   * it changes the cost to play the card.
   */
  | {
      do: "costChange";
      target: Target;
      amount: number;
      duration?: Duration;
      perTrash?: number;
      trashFilter?: Filter;
      perRestedDon?: number;
      perCount?: CardCount;
    }
  /** K.O. Characters or Stages. */
  | { do: "ko"; target: Target; ifYouDo?: Step[] }
  /**
   * `stayRested`: "and that Character will not become active in your
   * opponent's next Refresh Phase". `ifYouDo`: steps that happen only if at
   * least one card was rested ("you may rest ...: If you do, ...").
   */
  | { do: "rest"; target: Target; stayRested?: boolean; ifYouDo?: Step[] }
  | { do: "setActive"; target: Target }
  /** `ifYouDo`: "you may return ...: If you do, ..." (use `upTo` on the target). */
  | { do: "returnToHand"; target: Target; ifYouDo?: Step[] }
  | { do: "returnToDeckBottom"; target: Target; ifYouDo?: Step[] }
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
  /** `ifYouDo`: "you may trash ...: If you do, ..." (with `upTo`). */
  /** `perCount` multiplies `count` like `draw` ("Then, trash the same number of cards from your hand"). */
  | {
      do: "trashFromHand";
      count: number;
      upTo?: boolean;
      filter?: Filter;
      ifYouDo?: Step[];
      perCount?: CardCount;
    }
  /** "Trash this Stage" (or Character) as part of the effect. Not a K.O. */
  | { do: "trashThis" }
  /** "Trash cards from your hand until you have 5 cards"; `both` for "you and your opponent". */
  | { do: "handDownTo"; count: number; both?: boolean }
  /**
   * "Your opponent places 3 cards from their trash at the bottom of their deck". With
   * `youChoose`, the effect's player picks the cards ("place up to 1 card from your
   * opponent's trash at the bottom of their deck"). `upTo` allows fewer, even 0
   * ("any number of"), and `filter` limits which cards.
   */
  | {
      do: "trashToDeckBottom";
      side: "self" | "opponent";
      count: number;
      upTo?: boolean;
      filter?: Filter;
      youChoose?: boolean;
    }
  /**
   * On a permanent field effect: "The cost of playing ... from your hand will be reduced by 1".
   */
  | { do: "handCostChange"; filter?: Filter; amount: number }
  /** "Take an extra turn after this one". */
  | { do: "extraTurn" }
  /**
   * Place cards from your hand at the top of your deck. `orBottom`: "at the top or bottom of
   * your deck in any order".
   */
  | { do: "handToDeckTop"; count: number; orBottom?: boolean }
  /**
   * Place cards from your hand at the bottom of your deck. `side: "opponent"`: "your opponent
   * must place 1 card from their hand at the bottom of their deck" (they pick).
   */
  | { do: "handToDeckBottom"; count: number; side?: "opponent" }
  /** "[Side] returns all cards in their hand to their deck and shuffles it. Then, draws 5 cards." */
  | { do: "handToDeckShuffle"; side: "self" | "opponent"; draw: number }
  /** "You cannot attack a Leader during this turn." */
  | { do: "cannotAttackLeader" }
  /**
   * "Deal 1 damage to your opponent" (rule 4-6-2: damage from an effect, [Trigger] included).
   * `side: "self"`: "you take 1 damage".
   */
  | { do: "dealDamage"; count: number; side?: "self" }
  /** "Change the target of the attack to ...": the chosen card becomes the attack's target. */
  | { do: "redirectAttack"; target: Target }
  /**
   * "Add up to 1 card from your hand to the top of your Life cards." `fromTrash` also offers
   * matching cards in your trash ("from your hand or trash"); `faceUp` adds them face-up.
   */
  | {
      do: "handToLife";
      count: number;
      filter?: Filter;
      fromTrash?: boolean;
      faceUp?: boolean;
      /** Only from the trash ("from your trash ... add it to the top of your Life cards"). */
      onlyTrash?: boolean;
    }
  /** Trash all of your face-up Life cards. */
  | { do: "trashFaceUpLife" }
  /** Trash cards from the top of your deck. */
  | { do: "trashDeckTop"; count: number }
  /**
   * Permanent only: "Your face-up Life cards are placed at the bottom of your deck instead of
   * being added to your hand, according to the rules" (damage, rule 7-1-4-1-1-2).
   */
  | { do: "faceUpLifeToDeckBottom" }
  /** Permanent, on a Leader: "when your deck is reduced to 0, you win the game instead of losing". */
  | { do: "winOnDeckOut" }
  /** Permanent, on a Leader: "you can only include {type} type cards in your deck". Checked by `checkDeck`. */
  | { do: "deckOnlyType"; type: string }
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
   * With `play`, up to 1 matching Character or Stage is played instead ("look at 5 cards
   * from the top of your deck and play up to 1 ..."), `rested` if it says so.
   */
  | {
      do: "searchDeck";
      look: number;
      take: number;
      filter?: Filter;
      rest?: "bottom" | "trash" | "topOrBottom";
      play?: boolean;
      rested?: boolean;
      /** "Add ... to the top of your Life cards face-up" instead of to your hand. */
      to?: "lifeFaceUp" | "play";
    }
  /** Place cards from the top of your deck at the bottom ("place the revealed card at the bottom"). */
  | { do: "deckTopToBottom"; count: number }
  /**
   * Look at the top cards and put them back on top in any order. With `bottom`,
   * any of them can go to the bottom instead ("at the top or bottom of the deck in any order").
   */
  | { do: "arrangeDeckTop"; look: number; bottom?: boolean }
  /**
   * "You may play" the top card of your deck if it matches. `restToBottom`: "Then, place the
   * rest at the bottom of your deck" (the revealed card, if it wasn't played). `must`: the card
   * is played without asking (used after `searchDeck` with `to: "play"`).
   */
  | {
      do: "playFromDeckTop";
      filter?: Filter;
      rested?: boolean;
      restToBottom?: boolean;
      must?: boolean;
      /** "Then, place the rest at the top or bottom of your deck." */
      restTopOrBottom?: boolean;
    }
  /**
   * Play a card from hand for free. `rested`: "play ... rested". `orTrash`: "from your hand
   * or trash". `differentColor`: it must share no color with the cards the previous step moved
   * ("a different color than the returned Character"). `side: "opponent"`:
   * "your opponent plays up to 1 Character card ... from their hand".
   * `ifYouDo`: steps that happen only if a card was played ("If you do, draw 1 card").
   */
  | {
      do: "playFromHand";
      filter?: Filter;
      rested?: boolean;
      orTrash?: boolean;
      differentColor?: boolean;
      side?: "opponent";
      ifYouDo?: Step[];
    }
  /**
   * `count`: "play up to 5 ...", one at a time. `differentNames`: "with different card names".
   * `played` is filled in by the engine with the names played so far.
   */
  | {
      do: "playFromTrash";
      filter?: Filter;
      rested?: boolean;
      count?: number;
      differentNames?: boolean;
      played?: string[];
      /** "the same card name as the trashed card" (trashed to pay this effect's cost). */
      sameNameAsTrashed?: boolean;
      ifYouDo?: Step[];
    }
  /** "Give up to 1 of your currently given DON!! cards to [target]": moves 1 given DON!!. */
  | { do: "moveGivenDon"; target: Target }
  /**
   * "If any of your Characters would be K.O.'d in battle during this turn, you may [costs]
   * instead": sets up this card's `battleKOReplacement` effect (its index) for the rest of the turn.
   */
  | { do: "replaceBattleKO"; effect: number }
  /** Permanent only: "Your Character cards are played rested." */
  | { do: "playRested" }
  /** Trash cards from the top of your deck. `perPrevious`: as many as the previous step moved. */
  | { do: "trashFromDeck"; count: number; perPrevious?: boolean }
  /** "You win the game." */
  | { do: "winGame" }
  /** "Play up to 1 ... from your deck", then shuffle it (start of the game effects). */
  | { do: "playFromDeck"; filter?: Filter }
  /** "Rest any number of your DON!! cards" (up to `count`); later steps can use `perPrevious`. */
  | { do: "restOwnDon"; count?: number }
  /**
   * "You cannot play Character cards with a base cost of 5 or more during this turn".
   * `fromHand`: only plays from the hand ("you cannot play cards from your hand").
   */
  | { do: "cannotPlay"; filter?: Filter; fromHand?: boolean }
  /** "Look at all of your Life cards and place them back in your Life area in any order." */
  | { do: "arrangeOwnLife" }
  /**
   * Permanent only: "[target] have their effects negated". Their printed keywords and effects
   * stop working while this effect is on the field.
   */
  | { do: "negateEffects"; target: Target }
  /** Permanent, Leader only: "1 DON!! card placed during your DON!! Phase is given to your Leader". */
  | { do: "donPhaseToLeader" }
  /** Permanent, Leader only: "you cannot include Events with a cost of 2 or more in your deck". */
  | { do: "deckExcludes"; category?: CardCategory; costAtLeast?: number }
  /** "You cannot add Life cards to your hand using your own effects during this turn." */
  | { do: "noLifeToHand" }
  /**
   * Add Life cards to your hand, from the top or (`fromBottom`) the bottom.
   * `from: "topOrBottom"` lets the player pick. `side: "opponent"`:
   * "your opponent adds 1 card from the top of their Life cards to their hand".
   */
  | {
      do: "lifeToHand";
      count: number;
      fromBottom?: boolean;
      from?: "topOrBottom";
      side?: "opponent";
    }
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
  /** `leaderBase`: "becomes the same as your Leader's base power" (`power` is then ignored). */
  | {
      do: "setBasePower";
      target: Target;
      power: number;
      leaderBase?: boolean;
      duration?: Duration;
    }
  /**
   * "Set the power of ... to 0 during this turn": the card's power becomes `power` now, and
   * later changes still apply on top.
   */
  | { do: "setPower"; target: Target; power: number; duration?: Duration }
  /**
   * "Up to 1 of your opponent's rested DON!! cards will not become active in your opponent's
   * next Refresh Phase".
   */
  | { do: "opponentDonNoRefresh"; count: number }
  /**
   * "Return DON!! cards from your field to your DON!! deck until you have the same number of
   * DON!! cards on your field as your opponent" (rested first, as for DON!! −X).
   */
  | { do: "donDownToOpponent" }
  /** "This Character's base power becomes the same as the selected Character's power during this turn." */
  | { do: "copyPower"; target: Target }
  /** "Look at all of your (opponent's) Life cards and place them back in any order." */
  | { do: "reorderLife"; side: "self" | "opponent" }
  /** "Turn all of your Life cards face-down." */
  | { do: "allLifeFaceDown" }
  /** "Trash cards from the top of your Life cards until you have 1 Life card." */
  | { do: "trashLifeDownTo"; count: number }
  /**
   * "Select 2 ... Swap the base power of the selected cards with each other". Picks 2 from
   * `target`, or 1 from `target` and 1 from `with` ("your Leader and 1 Character").
   */
  | { do: "swapBasePower"; target: Target; with?: Target; duration?: Duration }
  /** "Your opponent returns 1 DON!! card from their field to their DON!! deck". */
  | { do: "opponentDonMinus"; count: number }
  /**
   * Permanent: "This Character cannot be K.O.'d by effects of your opponent's
   * Characters with 5000 base power or less" (`from` describes those cards).
   */
  | { do: "koImmunity"; from: Filter };
