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
  return `(If the top card of your deck is a${filterText(condition.deckTopMatches)} card)`;
}

function costText(cost: Cost): string {
  if ("restDon" in cost) return `①`.repeat(cost.restDon);
  if ("donMinus" in cost) return `DON!! −${cost.donMinus}`;
  if ("trashFromHand" in cost)
    return `trash ${cost.trashFromHand}${filterText(cost.filter)} card(s) from your hand`;
  if ("handToDeckTop" in cost)
    return `place ${cost.handToDeckTop} card(s) from your hand at the top of your deck`;
  if ("returnOwnCharacter" in cost)
    return `return ${cost.returnOwnCharacter} of your Characters to the owner's hand`;
  if ("restOwn" in cost) return `rest 1 of your${filterText(cost.restOwn)} cards`;
  if ("trashThis" in cost) return "trash this card";
  if ("returnGivenDon" in cost)
    return `return ${cost.returnGivenDon} of your given DON!! cards to your cost area rested`;
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
      return `Look at ${step.look} cards from the top of your deck; reveal up to ${step.take}${filterText(step.filter)} card${step.take === 1 ? "" : "s"} and add ${step.take === 1 ? "it" : "them"} to your hand. Then, place the rest at the bottom of your deck in any order.`;
    case "playFromHand":
      return `Play up to 1${filterText(step.filter)} card from your hand${step.rested ? " rested" : ""}.`;
    case "playFromTrash":
      return `Play up to 1${filterText(step.filter)} card from your trash${step.rested ? " rested" : ""}.`;
    case "lifeToHand":
      return `Add ${step.count} card(s) from the top of your Life cards to your hand.`;
    case "deckToLife":
      return `Add up to ${step.count} card(s) from the top of your deck to the top of your Life cards.`;
    case "playThis":
      return "Play this card.";
    case "negateOnPlay":
      return `${step.side === "self" ? "Your" : "Your opponent's"} [On Play] effects are negated${durationText(step.duration)}.`;
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
