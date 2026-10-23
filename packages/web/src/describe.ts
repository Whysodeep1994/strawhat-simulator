import type {
  CardDefinition,
  Condition,
  Cost,
  Duration,
  EffectDefinition,
  Filter,
  Keyword,
  Status,
  Step,
  Target,
  Timing,
} from "@strawhat/engine";

/**
 * Card text written from effect data, for cards that don't come with printed text (the demo
 * cards). Real cards show their official text from the card data instead.
 */

export const KEYWORD_NAMES: Record<Keyword, string> = {
  rush: "Rush",
  rushCharacter: "Rush: Character",
  doubleAttack: "Double Attack",
  banish: "Banish",
  blocker: "Blocker",
  unblockable: "Unblockable",
  canAttackActive: "Can attack active Characters",
};

const KEYWORD_HELP: Record<Keyword, string> = {
  rush: "This card can attack on the turn it is played.",
  rushCharacter: "This card can attack Characters on the turn it is played.",
  doubleAttack: "This card deals 2 damage.",
  banish: "When this card deals damage, the Life card is trashed without its [Trigger].",
  blocker:
    "After your opponent declares an attack, you may rest this card to make it the new target.",
  unblockable: "Your opponent cannot activate [Blocker] when this card attacks.",
  canAttackActive: "This card can also attack your opponent's active Characters.",
};

const TIMING_NAMES: Record<Timing, string> = {
  onPlay: "[On Play]",
  whenAttacking: "[When Attacking]",
  onOpponentsAttack: "[On Your Opponent's Attack]",
  onBlock: "[On Block]",
  onKO: "[On K.O.]",
  koByEffect: "When this Character is K.O.'d by an effect,",
  activateMain: "[Activate: Main]",
  main: "[Main]",
  counter: "[Counter]",
  trigger: "[Trigger]",
  endOfYourTurn: "[End of Your Turn]",
  endOfOpponentsTurn: "[End of Your Opponent's Turn]",
  characterRestedByYourEffect: "(If a Character is rested by your effect)",
  replaceRemoval: "",
  donReturned: "When DON!! cards on your field are returned to your DON!! deck,",
  characterKOd: "When a Character is K.O.'d,",
  attackDealsDamage: "When this card's attack deals damage to your opponent's Life,",
  permanent: "",
};

const STATUS_TEXT: Record<Status, string> = {
  cannotAttack: "cannot attack",
  cannotBlock: "cannot activate [Blocker]",
  cannotBeKOdInBattle: "cannot be K.O.'d in battle",
  cannotBeKOdByEffects: "cannot be K.O.'d by effects",
  cannotBeKOdByOpponentsEffects: "cannot be K.O.'d by your opponent's effects",
  noRefresh: "will not become active in the next Refresh Phase",
};

export function cardText(card: CardDefinition): string[] {
  const lines = (card.keywords ?? []).map((k) => `[${KEYWORD_NAMES[k]}] ${KEYWORD_HELP[k]}`);
  for (const effect of card.effects ?? []) lines.push(effectText(effect));
  return lines;
}

export function effectText(effect: EffectDefinition): string {
  const head = [
    TIMING_NAMES[effect.timing],
    ...(effect.conditions ?? []).map(conditionText),
    effect.oncePerTurn ? "[Once Per Turn]" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const costs = (effect.costs ?? []).map(costText).join(", ");
  const body = effect.steps.map(stepText).join(" Then, ");
  const prefix = effect.optional && costs ? "You may " : "";
  const sentence = costs ? `${prefix}${costs}: ${body}` : body;
  return head ? `${head} ${sentence}` : sentence;
}

function conditionText(condition: Condition): string {
  if ("donAtLeast" in condition) return `[DON!! x${condition.donAtLeast}]`;
  if ("yourTurn" in condition) return "[Your Turn]";
  if ("opponentsTurn" in condition) return "[Opponent's Turn]";
  if ("lifeAtMost" in condition) return `(If you have ${condition.lifeAtMost} or less Life)`;
  if ("lifeAtLeast" in condition) return `(If you have ${condition.lifeAtLeast} or more Life)`;
  if ("opponentLifeAtMost" in condition) {
    return `(If your opponent has ${condition.opponentLifeAtMost} or less Life)`;
  }
  if ("opponentLifeAtLeast" in condition) {
    return `(If your opponent has ${condition.opponentLifeAtLeast} or more Life)`;
  }
  if ("leaderHasType" in condition)
    return `(If your Leader has the {${condition.leaderHasType}} type)`;
  if ("charactersAtLeast" in condition) {
    return `(If you have ${condition.charactersAtLeast} or more Characters)`;
  }
  if ("handAtMost" in condition)
    return `(If you have ${condition.handAtMost} or less cards in hand)`;
  if ("donOnFieldAtLeast" in condition) {
    return `(If you have ${condition.donOnFieldAtLeast} or more DON!! cards on your field)`;
  }
  if ("donOnFieldAtMost" in condition) {
    return `(If you have ${condition.donOnFieldAtMost} or less DON!! cards on your field)`;
  }
  if ("playedThisTurn" in condition) return "(If this Character was played on this turn)";
  if ("leaderIs" in condition) return `(If your Leader is [${condition.leaderIs}])`;
  if ("anyOf" in condition) return condition.anyOf.map(conditionText).join(" or ");
  if ("count" in condition) {
    const owner = condition.count.side === "self" ? "you have" : "your opponent has";
    const amount =
      condition.atMost !== undefined
        ? `${condition.atMost} or less`
        : `${condition.atLeast ?? 1} or more`;
    return `(If ${owner} ${amount} Characters${withFilter(condition.count.filter)})`;
  }
  if ("donRestedAtLeast" in condition)
    return `(If you have ${condition.donRestedAtLeast} or more rested DON!! cards)`;
  if ("restedCardsAtLeast" in condition)
    return `(If you have ${condition.restedCardsAtLeast} or more rested cards)`;
  if ("lifeAtMostOpponents" in condition)
    return "(If you have equal or fewer Life cards than your opponent)";
  if ("leaderTypeIncludes" in condition)
    return `(If your Leader's type includes "${condition.leaderTypeIncludes}")`;
  if ("leaderMulticolored" in condition) return "(If your Leader is multicolored)";
  if ("opponentDonOnFieldAtLeast" in condition)
    return `(If your opponent has ${condition.opponentDonOnFieldAtLeast} or more DON!! cards on their field)`;
  return `(If the top card of your deck is a${filterText(condition.deckTopMatches)} card)`;
}

function costText(cost: Cost): string {
  if ("restDon" in cost) return `①`.repeat(cost.restDon);
  if ("donMinus" in cost)
    return cost.orMore
      ? `return ${cost.donMinus} or more DON!! cards from your field to your DON!! deck`
      : `DON!! −${cost.donMinus}`;
  if ("trashFromHand" in cost)
    return `trash ${cost.trashFromHand}${filterText(cost.filter)} card(s) from your hand`;
  if ("handToDeckTop" in cost)
    return `place ${cost.handToDeckTop} card(s) from your hand at the top of your deck`;
  if ("returnOwnCharacter" in cost)
    return `return ${cost.returnOwnCharacter} of your Characters${withFilter(cost.filter)} to the owner's hand`;
  if ("revealFromHand" in cost)
    return `reveal ${cost.revealFromHand}${filterText(cost.filter)} card(s) from your hand`;
  if ("restOwn" in cost) return `rest 1 of your${filterText(cost.restOwn)} cards`;
  if ("trashThis" in cost) return "trash this card";
  if ("returnGivenDon" in cost)
    return `return ${cost.returnGivenDon} of your given DON!! cards to your cost area rested`;
  if ("lifeToHand" in cost) {
    const from = cost.from === "topOrBottom" ? "top or bottom" : "top";
    return `add ${cost.lifeToHand} card(s) from the ${from} of your Life cards to your hand`;
  }
  if ("trashLife" in cost) return `trash ${cost.trashLife} card(s) from the top of your Life cards`;
  if ("lifeFaceUp" in cost)
    return `turn ${cost.lifeFaceUp} card(s) from the top of your Life cards face-up`;
  if ("trashToDeckBottom" in cost) {
    return `place ${cost.trashToDeckBottom} card(s) from your trash at the bottom of your deck`;
  }
  if ("characterToLife" in cost)
    return `add ${cost.characterToLife} of your Characters${withFilter(cost.filter)} to the top of your Life cards${cost.faceUp ? " face-up" : ""}`;
  return "rest this card";
}

function stepText(step: Step): string {
  switch (step.do) {
    case "draw":
      return `Draw ${step.count} card${step.count === 1 ? "" : "s"}.`;
    case "powerUp":
      return `Give ${targetText(step.target)} ${step.amount >= 0 ? "+" : "−"}${Math.abs(step.amount)} power${durationText(step.duration)}${step.perPrevious ? " for every card moved" : ""}.`;
    case "grantKeyword":
      return `${capital(targetText(step.target))} gains [${KEYWORD_NAMES[step.keyword]}]${durationText(step.duration)}.`;
    case "grantStatus":
      return `${capital(targetText(step.target))} ${STATUS_TEXT[step.status]}${durationText(step.duration)}.`;
    case "costChange":
      return `Give ${targetText(step.target)} ${step.amount >= 0 ? "+" : "−"}${Math.abs(step.amount)} cost${durationText(step.duration)}.`;
    case "ko":
      return `K.O. ${targetText(step.target)}.`;
    case "rest":
      return `Rest ${targetText(step.target)}.${step.ifYouDo ? ` If you do, ${step.ifYouDo.map(stepText).join(" ")}` : ""}`;
    case "setActive":
      return `Set ${targetText(step.target)} as active.`;
    case "returnToHand":
      return `Return ${targetText(step.target)} to the owner's hand.`;
    case "returnToDeckBottom":
      return `Place ${targetText(step.target)} at the bottom of the owner's deck.`;
    case "noBlockers":
      return `Your opponent cannot activate [Blocker] when ${targetText(step.target)} attacks${durationText(step.duration)}.`;
    case "giveRestedDon":
      return `Give up to ${step.count} rested DON!! card${step.count === 1 ? "" : "s"} to ${targetText(step.target)}.`;
    case "addDon":
      return `Add up to ${step.count} DON!! card${step.count === 1 ? "" : "s"} from your DON!! deck${step.rested ? " and rest it" : ""}.`;
    case "setDonActive":
      return `Set up to ${step.count} of your DON!! cards as active.`;
    case "trashFromHand":
      return `Trash ${step.upTo ? "up to " : ""}${step.count}${filterText(step.filter)} card(s) from your hand.`;
    case "handToDeckTop":
      return `Place ${step.count} card(s) from your hand at the top of your deck.`;
    case "handToDeckBottom":
      return `Place ${step.count} card(s) from your hand at the bottom of your deck.`;
    case "handToLife":
      return `Add up to ${step.count}${filterText(step.filter)} card(s) from your hand${step.fromTrash ? " or trash" : ""} to the top of your Life cards${step.faceUp ? " face-up" : ""}.`;
    case "trashFaceUpLife":
      return "Trash all your face-up Life cards.";
    case "trashDeckTop":
      return `Trash ${step.count} card(s) from the top of your deck.`;
    case "faceUpLifeToDeckBottom":
      return "Your face-up Life cards are placed at the bottom of your deck instead of being added to your hand, according to the rules.";
    case "winOnDeckOut":
      return "When your deck is reduced to 0, you win the game instead of losing.";
    case "deckOnlyType":
      return `You can only include {${step.type}} type cards in your deck.`;
    case "revealedToDeckTop":
      return "Place the revealed card(s) at the top of your deck.";
    case "trashToHand":
      return `Add up to ${step.count ?? 1}${filterText(step.filter)} card(s) from your trash to your hand.`;
    case "arrangeDeckTop":
      return `Look at ${step.look} cards from the top of your deck and place them at the top${step.bottom ? " or bottom" : ""} of your deck in any order.`;
    case "playFromDeckTop":
      return `You may play the top card of your deck if it is a${filterText(step.filter)} card${step.rested ? ", rested" : ""}.`;
    case "noLifeToHand":
      return "You cannot add Life cards to your hand using your own effects during this turn.";
    case "chooseOne":
      return `${step.chooser === "opponent" ? "Your opponent chooses" : "Choose"} one: ${step.options.map((o) => o.label).join(" / ")}.`;
    case "restOpponentDon":
      return `Rest up to ${step.count} of your opponent's DON!! cards.`;
    case "atEndOfTurn":
      return `At the end of this turn: ${step.steps.map(stepText).join(" ")}`;
    case "opponentTrashesFromHand":
      return `Your opponent trashes ${step.count} card(s) from their hand.`;
    case "searchDeck":
      return `Look at ${step.look} cards from the top of your deck; reveal up to ${step.take}${filterText(step.filter)} card${step.take === 1 ? "" : "s"} and add ${step.take === 1 ? "it" : "them"} to ${step.to === "lifeFaceUp" ? "the top of your Life cards face-up" : "your hand"}. Then, ${step.rest === "trash" ? "trash the rest" : "place the rest at the bottom of your deck in any order"}.`;
    case "playFromHand":
      return `Play up to 1${filterText(step.filter)} card from your hand${step.rested ? " rested" : ""}.`;
    case "playFromTrash":
      return `Play up to 1${filterText(step.filter)} card from your trash${step.rested ? " rested" : ""}.`;
    case "lifeToHand":
      return `Add ${step.count} card(s) from the ${step.fromBottom ? "bottom" : "top"} of your Life cards to your hand.`;
    case "deckToLife":
      return `Add up to ${step.count} card(s) from the top of your deck to the top of your Life cards.`;
    case "trashLife":
      return `Trash ${step.count} card(s) from the top of ${step.side === "self" ? "your" : "your opponent's"} Life cards.`;
    case "arrangeLife":
      return "Look at up to 1 card from the top of your or your opponent's Life cards, and place it at the top or bottom of the Life cards.";
    case "trashCharacter":
      return `Trash ${targetText(step.target)}.`;
    case "characterToLife":
      return `Add ${targetText(step.target)} to the top or bottom of the owner's Life cards${step.faceUp ? " face-up" : ""}.`;
    case "lifeToDeckTop":
      return "Look at all your Life cards; place 1 at the top of your deck and the rest back in your Life area in any order.";
    case "addThisToHand":
      return "Add this card to your hand.";
    case "playThis":
      return "Play this card.";
    case "negateOnPlay":
      return `${step.side === "self" ? "Your" : "Your opponent's"} [On Play] effects are negated${durationText(step.duration)}.`;
    case "setBasePower":
      return `${capital(targetText(step.target))}'s base power becomes ${step.power}${durationText(step.duration)}.`;
    case "if":
      return `If ${step.conditions.map(conditionText).join(" and ")}, ${step.steps.map(stepText).join(" ")}`;
  }
}

function targetText(target: Target): string {
  if (target.side === "this") return "this card";
  const owner = target.side === "self" ? "your" : target.side === "any" ? "the" : "your opponent's";
  const zone = target.zone ?? "characters";
  const count = target.count ?? 1;
  const noun =
    zone === "leader"
      ? "Leader"
      : zone === "stage"
        ? "Stage"
        : zone === "leaderOrCharacters"
          ? "Leader or Character cards"
          : "Characters";
  if (zone === "leader" || zone === "stage") return `${owner} ${noun}`;
  const amount = target.upTo ? `up to ${count}` : `${count}`;
  return `${amount} of ${owner} ${noun}${withFilter(target.filter)}`;
}

function filterText(filter: Filter | undefined): string {
  if (!filter) return "";
  const { type, color, category, ...rest } = filter;
  return `${color ? ` ${color}` : ""}${type ? ` {${type}} type` : ""}${category ? ` ${category}` : ""}${withFilter(rest)}`;
}

function withFilter(filter: Filter | undefined): string {
  if (!filter) return "";
  const parts: string[] = [];
  if (filter.rested) parts.push("rested");
  if (filter.costAtMost !== undefined) parts.push(`a cost of ${filter.costAtMost} or less`);
  if (filter.costAtLeast !== undefined) parts.push(`a cost of ${filter.costAtLeast} or more`);
  if (filter.costAtMostOpponentLife) parts.push("a cost up to your opponent's Life count");
  if (filter.costAtMostTotalLife) parts.push("a cost up to the total of both players' Life cards");
  if (filter.noBaseEffect) parts.push("no base effect");
  if (filter.powerAtMost !== undefined) parts.push(`${filter.powerAtMost} power or less`);
  if (filter.powerAtLeast !== undefined) parts.push(`${filter.powerAtLeast} power or more`);
  if (filter.type) parts.push(`the {${filter.type}} type`);
  if (filter.name) parts.push(`the name "${filter.name}"`);
  if (filter.nameIncludes) parts.push(`"${filter.nameIncludes}" in the name`);
  if (filter.keyword) parts.push(`[${KEYWORD_NAMES[filter.keyword]}]`);
  if (parts.length === 0) return "";
  const rested = filter.rested ? " that are rested" : "";
  const rest = parts.filter((p) => p !== "rested");
  return rest.length ? `${rested} with ${rest.join(" and ")}` : rested;
}

function durationText(duration: Duration | undefined): string {
  if (duration === "battle") return " during this battle";
  if (duration === "opponentsNextTurn") return " until the end of your opponent's next turn";
  if (duration === "turn") return " during this turn";
  return "";
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
