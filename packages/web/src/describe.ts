import type {
  CardCount,
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
  koByOpponentsEffect: "When this Character is K.O.'d by your opponent's effect,",
  characterRemovedByOpponent:
    "When your Character is removed from the field by your opponent's effect,",
  onOpponentsBlock: "When your opponent activates [Blocker],",
  activateMain: "[Activate: Main]",
  main: "[Main]",
  counter: "[Counter]",
  trigger: "[Trigger]",
  endOfYourTurn: "[End of Your Turn]",
  endOfOpponentsTurn: "[End of Your Opponent's Turn]",
  characterRestedByYourEffect: "(If a Character is rested by your effect)",
  replaceRemoval: "",
  donReturned: "When DON!! cards on your field are returned to your DON!! deck,",
  opponentActivatesEvent: "When your opponent activates an Event,",
  youActivateEvent: "When you activate an Event,",
  opponentCharacterKOd: "When your opponent's Character is K.O.'d,",
  donGiven: "When this Leader or any of your Characters is given a DON!! card,",
  opponentPlaysCharacter: "When your opponent plays a Character,",
  koInBattle: "When this Character battles and K.O.'s your opponent's Character,",
  drawOutsideDrawPhase: "When you draw a card outside of your Draw Phase,",
  lifeAddedToHand: "When a card is added to your hand from your Life,",
  lifeBecomesZero: "When your number of Life cards becomes 0,",
  becomesRested: "When this Character becomes rested,",
  characterKOd: "When a Character is K.O.'d,",
  attackDealsDamage: "When this card's attack deals damage to your opponent's Life,",
  opponentCharacterReturned:
    "When your opponent's Character is returned to the owner's hand by your effect,",
  battleKOReplacement: "If any of your Characters would be K.O.'d in battle during this turn,",
  takeDamage: "When you take damage,",
  youDealDamage: "When you deal damage to your opponent's Life,",
  triggerActivated: "When a [Trigger] activates,",
  yourCharacterKOd: "When your Character is K.O.'d,",
  yourCharacterRemovedByOpponent:
    "When your Character is removed from the field by your opponent's effect,",
  youPlayCharacter: "When you play a Character,",
  startOfGame: "At the start of the game,",
  permanent: "",
};

const STATUS_TEXT: Record<Status, string> = {
  cannotAttack: "cannot attack",
  cannotBlock: "cannot activate [Blocker]",
  cannotBeKOdInBattle: "cannot be K.O.'d in battle",
  cannotBeKOdByEffects: "cannot be K.O.'d by effects",
  cannotBeKOdByOpponentsEffects: "cannot be K.O.'d by your opponent's effects",
  noRefresh: "will not become active in the next Refresh Phase",
  onlyAttackTarget: "is the only card your opponent can attack",
  cannotBeKOdInBattleByLeaders: "cannot be K.O.'d in battle by Leaders",
  negated: "has its effects negated",
  cannotBeRested: "cannot be rested",
  cannotBeRemovedByOpponentsEffects: "cannot be removed from the field by your opponent's effects",
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
  if ("handAtLeast" in condition)
    return `(If you have ${condition.handAtLeast} or more cards in hand)`;
  if ("thisRested" in condition) return "(If this Character is rested)";
  if ("allDonRested" in condition) return "(If all of your DON!! cards are rested)";
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
  if ("lifeLessThanOpponents" in condition)
    return "(If you have less Life cards than your opponent)";
  if ("deckAtMost" in condition)
    return `(If you have ${condition.deckAtMost} or less cards in your deck)`;
  if ("thisIsAttackTarget" in condition) return "(If this card is being attacked)";
  if ("leaderTypeIncludes" in condition)
    return `(If your Leader's type includes "${condition.leaderTypeIncludes}")`;
  if ("givenDonAtLeast" in condition)
    return `(If you have a total of ${condition.givenDonAtLeast} or more given DON!! cards)`;
  if ("leaderAttribute" in condition)
    return `(If your Leader has the <${condition.leaderAttribute}> attribute)`;
  if ("handTrashedByEffectThisTurn" in condition)
    return "(During the turn in which a card in your hand is trashed by an effect)";
  if ("leaderMulticolored" in condition) return "(If your Leader is multicolored)";
  if ("donOnFieldAtMostOpponents" in condition)
    return "(If you have the same or fewer DON!! cards on your field than your opponent)";
  if ("donFewerThanOpponentBy" in condition)
    return `(If you have at least ${condition.donFewerThanOpponentBy} fewer DON!! cards on your field than your opponent)`;
  if ("donActiveAtMost" in condition)
    return `(If you have ${condition.donActiveAtMost} or less active DON!! cards)`;
  if ("donGivenAtLeast" in condition)
    return `(If you have ${condition.donGivenAtLeast} or more given DON!! cards)`;
  if ("trashAtLeast" in condition)
    return `(If you have ${condition.trashAtLeast} or more cards in your trash)`;
  if ("leaderAttribute" in condition)
    return `(If your Leader has the <${condition.leaderAttribute}> attribute)`;
  if ("opponentDonOnFieldAtLeast" in condition)
    return `(If your opponent has ${condition.opponentDonOnFieldAtLeast} or more DON!! cards on their field)`;
  if ("thisPowerAtLeast" in condition)
    return `(If this Character has ${condition.thisPowerAtLeast} power or more)`;
  if ("opponentHasMoreDon" in condition)
    return "(If your opponent has more DON!! cards on their field than you)";
  if ("handAtLeast" in condition)
    return `(If you have ${condition.handAtLeast} or more cards in hand)`;
  if ("opponentHandAtLeast" in condition)
    return `(If your opponent has ${condition.opponentHandAtLeast} or more cards in their hand)`;
  if ("handFewerThanOpponentBy" in condition)
    return `(If you have at least ${condition.handFewerThanOpponentBy} fewer cards in hand than your opponent)`;
  if ("totalLifeAtMost" in condition)
    return `(If you and your opponent have a total of ${condition.totalLifeAtMost} or less Life cards)`;
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
  if ("handToDeckBottom" in cost)
    return `place ${cost.handToDeckBottom} card(s) from your hand at the bottom of your deck`;
  if ("returnOwnCharacter" in cost)
    return cost.to === "deckBottom"
      ? `place ${cost.returnOwnCharacter} of your Characters${withFilter(cost.filter)} at the bottom of your deck`
      : `return ${cost.returnOwnCharacter} of your Characters${withFilter(cost.filter)} to the owner's hand`;
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
  if ("trashLife" in cost)
    return `trash ${cost.trashLife} card(s) from the ${cost.from === "topOrBottom" ? "top or bottom" : "top"} of your Life cards`;
  if ("lifeFaceUp" in cost) {
    const from = cost.from === "topOrBottom" ? "top or bottom" : "top";
    return `turn ${cost.lifeFaceUp} card(s) from the ${from} of your Life cards face-up`;
  }
  if ("lifeFaceDown" in cost) {
    const from = cost.from === "topOrBottom" ? "top or bottom" : "top";
    return `turn ${cost.lifeFaceDown} card(s) from the ${from} of your Life cards face-down`;
  }
  if ("trashFromDeckTop" in cost)
    return `trash ${cost.trashFromDeckTop} card(s) from the top of your deck`;
  if ("oneOf" in cost) return cost.oneOf.map(costText).join(" or ");
  if ("trashToDeckBottom" in cost) {
    return `place ${cost.trashToDeckBottom}${filterText(cost.filter)} card(s) from your trash at the bottom of your deck`;
  }
  if ("handToDeckBottom" in cost)
    return `place ${cost.handToDeckBottom} card(s) from your hand at the bottom of your deck`;
  if ("restCharacters" in cost)
    return `rest ${cost.restCharacters} of your Characters${withFilter(cost.filter)}`;
  if ("thisToDeckBottom" in cost) return "place this card at the bottom of your deck";
  if ("returnActiveDon" in cost)
    return `return ${cost.returnActiveDon} of your active DON!! cards to your DON!! deck`;
  if ("activeLeaderPower" in cost)
    return `give your 1 active Leader −${Math.abs(cost.activeLeaderPower)} power during this turn`;
  if ("toDeckBottom" in cost)
    return `place ${cost.toDeckBottom} ${cost.zone === "stage" ? "of your Stages" : `${cost.side === "any" ? "" : "of your "}Characters${withFilter(cost.filter)}`} at the bottom of the owner's deck`;
  if ("trashToDeck" in cost)
    return `return ${cost.trashToDeck} cards from your trash to your deck and shuffle it`;
  if ("koOwnCharacter" in cost)
    return `K.O. ${cost.koOwnCharacter} of your Characters${withFilter(cost.filter)}`;
  if ("playFromHand" in cost) return `play 1${filterText(cost.playFromHand)} card from your hand`;
  if ("characterToLife" in cost)
    return `add ${cost.characterToLife} of your Characters${withFilter(cost.filter)} to the top of your Life cards${cost.faceUp ? " face-up" : ""}`;
  if ("giveActiveDon" in cost)
    return `give ${cost.giveActiveDon} of your active DON!! cards to your Leader or a Character`;
  if ("trashOwnCharacter" in cost)
    return `trash ${cost.trashOwnCharacter} of your ${cost.zone === "stage" ? "Stages" : "Characters"}${withFilter(cost.filter)}`;
  return "rest this card";
}

function stepText(step: Step): string {
  switch (step.do) {
    case "draw":
      return `Draw ${step.count} card${step.count === 1 ? "" : "s"}.`;
    case "powerUp":
      return `Give ${targetText(step.target)} ${step.amount >= 0 ? "+" : "−"}${Math.abs(step.amount)} power${durationText(step.duration)}${step.perPrevious ? " for every card moved" : ""}${perCountText(step.perCount)}.`;
    case "grantKeyword":
      return `${capital(targetText(step.target))} gains [${KEYWORD_NAMES[step.keyword]}]${durationText(step.duration)}.`;
    case "grantStatus":
      return `${capital(targetText(step.target))} ${STATUS_TEXT[step.status]}${durationText(step.duration)}.`;
    case "costChange":
      return `Give ${targetText(step.target)} ${step.amount >= 0 ? "+" : "−"}${Math.abs(step.amount)} cost${durationText(step.duration)}${perCountText(step.perCount)}.`;
    case "ko":
      return `K.O. ${targetText(step.target)}.`;
    case "rest":
      return `Rest ${targetText(step.target)}.${step.ifYouDo ? ` If you do, ${step.ifYouDo.map(stepText).join(" ")}` : ""}`;
    case "setActive":
      return `Set ${targetText(step.target)} as active.`;
    case "returnToHand":
      return `Return ${targetText(step.target)} to the owner's hand.${step.ifYouDo ? ` If you do, ${step.ifYouDo.map(stepText).join(" ")}` : ""}`;
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
      return step.side === "opponent"
        ? `Your opponent places ${step.count} card(s) from their hand at the bottom of their deck.`
        : `Place ${step.count} card(s) from your hand at the bottom of your deck.`;
    case "handToDeckShuffle":
      return `${step.side === "opponent" ? "Your opponent returns" : "Return"} all cards in hand to the deck and shuffles it, then draws ${step.draw} cards.`;
    case "cannotAttackLeader":
      return "You cannot attack a Leader during this turn.";
    case "dealDamage":
      return `Deal ${step.count} damage to your opponent.`;
    case "redirectAttack":
      return `Change the target of the attack to ${targetText(step.target)}.`;
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
      if (step.play)
        return `Look at ${step.look} cards from the top of your deck and play up to 1${filterText(step.filter)} card${step.rested ? " rested" : ""}. Then, place the rest at the bottom of your deck in any order.`;
      if (step.to === "trash")
        return `Look at ${step.look} cards from the top of your deck and trash up to ${step.take}${filterText(step.filter)} card${step.take === 1 ? "" : "s"}. Then, place the rest at the bottom of your deck in any order.`;
      return `Look at ${step.look} cards from the top of your deck; reveal up to ${step.take}${filterText(step.filter)} card${step.take === 1 ? "" : "s"} and add ${step.take === 1 ? "it" : "them"} to ${step.to === "lifeFaceUp" ? "the top of your Life cards face-up" : "your hand"}. Then, ${step.rest === "trash" ? "trash the rest" : "place the rest at the bottom of your deck in any order"}.`;
    case "playFromHand":
      return step.side === "opponent"
        ? `Your opponent plays up to 1${filterText(step.filter)} card from their hand.`
        : `Play up to 1${filterText(step.filter)} card from your hand${step.orTrash ? " or trash" : ""}${step.differentColor ? " that is a different color than the returned card" : ""}${step.rested ? " rested" : ""}.${ifYouDoText(step.ifYouDo)}`;
    case "playFromTrash":
      return `Play up to ${step.count ?? 1}${filterText(step.filter)} card(s)${step.differentNames ? " with different names" : ""}${step.sameNameAsTrashed ? " with the same card name as the trashed card" : ""} from your trash${step.rested ? " rested" : ""}.${ifYouDoText(step.ifYouDo)}`;
    case "playRested":
      return "Your Character cards are played rested.";
    case "trashFromDeck":
      return step.perPrevious
        ? "Trash the same number of cards from the top of your deck."
        : `Trash ${step.count} card(s) from the top of your deck.`;
    case "winGame":
      return "You win the game.";
    case "lifeToHand":
      return step.side === "opponent"
        ? `Your opponent adds ${step.count} card(s) from the top of their Life cards to their hand.`
        : `Add ${step.count} card(s) from the ${step.from === "topOrBottom" ? "top or bottom" : step.fromBottom ? "bottom" : "top"} of your Life cards to your hand.`;
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
    case "setCost":
      return `Set the cost of ${targetText(step.target)} to ${step.cost}${durationText(step.duration)}.`;
    case "revealOpponentHand":
      return `Choose ${step.count} card(s) from your opponent's hand; your opponent reveals them.${step.steps ? ` If a revealed card is a${filterText(step.ifRevealed)} card, ${step.steps.map(stepText).join(" ")}` : ""}`;
    case "lifeToDeckBottom":
      return `Place ${step.count} card(s) from the top of ${step.side === "self" ? "your" : "your opponent's"} Life cards at the bottom of the owner's deck.`;
    case "searchWholeDeck":
      return `${step.play ? "Play" : "Reveal"} up to 1${filterText(step.filter)} card from your deck${step.play ? "" : " and add it to your hand"}. Then, shuffle your deck.`;
    case "drawTo":
      return `Draw cards so that you have ${step.count} cards in your hand.`;
    case "opponentReturnsDon":
      return `Your opponent returns ${step.count} DON!! card(s) from their field to their DON!! deck.`;
    case "atEndOfBattle":
      return `At the end of this battle: ${step.steps.map(stepText).join(" ")}`;
    case "nextPlayCostChange":
      return `The next time you play a${filterText(step.filter)} card from your hand during this turn, give it ${step.amount >= 0 ? "+" : "−"}${Math.abs(step.amount)} cost.`;
    case "moveGivenDon":
      return `Give up to 1 of your currently given DON!! cards to ${targetText(step.target)}.`;
    case "replaceBattleKO":
      return "If any of your Characters would be K.O.'d in battle during this turn, you may pay this card's other cost instead.";
    case "grantCounter":
      return `All of ${targetText(step.target)} in your hand have a +${step.amount} Counter.`;
    case "deckTopToBottom":
      return `Place ${step.count} card(s) from the top of your deck at the bottom.`;
    case "copyPower":
      return `This card's base power becomes the same as the power of ${targetText(step.target)} during this turn.`;
    case "reorderLife":
      return `Look at all of ${step.side === "self" ? "your" : "your opponent's"} Life cards and place them back in any order.`;
    case "allLifeFaceDown":
      return "Turn all of your Life cards face-down.";
    case "trashLifeDownTo":
      return `Trash cards from the top of your Life cards until you have ${step.count} Life card${step.count === 1 ? "" : "s"}.`;
    case "trashThis":
      return "Trash this card.";
    case "handDownTo":
      return `${step.both ? "You and your opponent trash" : "Trash"} cards from your hand until you have ${step.count} cards.`;
    case "trashToDeckBottom":
      return `${step.side === "self" ? "Place" : "Your opponent places"} ${step.count} card(s) from the trash at the bottom of the deck.`;
    case "handCostChange":
      return `The cost of playing${filterText(step.filter)} cards from your hand changes by ${step.amount}.`;
    case "extraTurn":
      return "Take an extra turn after this one.";
    case "restOwnDon":
      return "Rest any number of your DON!! cards.";
    case "cannotPlay":
      return `You cannot play${filterText(step.filter)} cards${step.fromHand ? " from your hand" : ""} during this turn.`;
    case "arrangeOwnLife":
      return "Look at all of your Life cards and place them back in your Life area in any order.";
    case "playFromDeck":
      return `Play up to 1${filterText(step.filter)} card from your deck.`;
    case "negateEffects":
      return `${capital(targetText(step.target))} have their effects negated.`;
    case "deckExcludes":
      return `You cannot include${step.category ? ` ${step.category}s` : " cards"}${step.costAtLeast !== undefined ? ` with a cost of ${step.costAtLeast} or more` : ""} in your deck.`;
    case "donPhaseToLeader":
      return "1 DON!! card placed during your DON!! Phase is given to your Leader.";
    case "if":
      return `If ${step.conditions.map(conditionText).join(" and ")}, ${step.steps.map(stepText).join(" ")}`;
  }
}

function ifYouDoText(steps: Step[] | undefined): string {
  return steps ? ` If you do, ${steps.map(stepText).join(" ")}` : "";
}

function targetText(target: Target): string {
  if (target.side === "this") return "this card";
  if (target.side === "that") return "that card";
  if (target.side === "chosen") return `that card${withFilter(target.filter)}`;
  const owner = target.side === "self" ? "your" : target.side === "any" ? "the" : "your opponent's";
  const zone = target.zone ?? "characters";
  const count = target.count ?? 1;
  const noun =
    zone === "leader"
      ? "Leader"
      : zone === "stage"
        ? "Stage"
        : zone === "field"
          ? "cards"
          : zone === "leaderOrCharacters"
            ? "Leader or Character cards"
            : "Characters";
  if (zone === "leader" || zone === "stage") return `${owner} ${noun}`;
  const amount = target.upTo ? `up to ${count}` : `${count}`;
  const total =
    target.totalPowerAtMost !== undefined
      ? ` with a total power of ${target.totalPowerAtMost} or less`
      : "";
  return `${amount} of ${owner} ${noun}${withFilter(target.filter)}${total}`;
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
  if (filter.notType) parts.push(`no {${filter.notType}} type`);
  if (filter.typeIncludes) parts.push(`a type including "${filter.typeIncludes}"`);
  if (filter.notTypeIncludes) parts.push(`no type including "${filter.notTypeIncludes}"`);
  if (filter.name) parts.push(`the name "${filter.name}"`);
  if (filter.nameIncludes) parts.push(`"${filter.nameIncludes}" in the name`);
  if (filter.keyword) parts.push(`[${KEYWORD_NAMES[filter.keyword]}]`);
  if (filter.attribute) parts.push(`the <${filter.attribute}> attribute`);
  if (parts.length === 0) return "";
  const rested = filter.rested ? " that are rested" : "";
  const rest = parts.filter((p) => p !== "rested");
  return rest.length ? `${rested} with ${rest.join(" and ")}` : rested;
}

function perCountText(count: CardCount | undefined): string {
  if (!count) return "";
  const owner = count.side === "self" ? "your" : "your opponent's";
  return ` for every${filterText(count.filter)} card on ${owner} field`;
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
