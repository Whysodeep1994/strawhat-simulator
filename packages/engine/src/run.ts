import type { Cost, Duration, EffectDefinition, Step, Target } from "./effects.js";
import { eligibleBlockers } from "./legal.js";
import { endGame, processRules } from "./rules.js";
import {
  basePowerOf,
  canPayCosts,
  conditionsMet,
  definitionOf,
  donOnField,
  effectOf,
  effectsOf,
  fieldCards,
  findCard,
  findOnField,
  hasKeywordNow,
  hasRule,
  leaveField,
  hasStatus,
  koImmuneTo,
  matchesFilter,
  namesOf,
  oncePerTurnKey,
  onPlayNegated,
  playBlocked,
  toDeckBottomOptions,
  restableOpponentCharacters,
  powerAmount,
  powerOf,
  zoneCards,
} from "./state.js";
import { shuffleInPlace } from "./rng.js";
import {
  drawCards,
  knockOut,
  moveFieldCardToTrash,
  pushEffect,
  putOnField,
  queueEffects,
  queueFieldEffects,
  removedByEffect,
  startTurn,
} from "./turn.js";
import {
  opponentOf,
  type CardInstance,
  type Frame,
  type GameState,
  type Modifier,
  type PlayerId,
} from "./types.js";

type FrameOf<K extends Frame["kind"]> = Extract<Frame, { kind: K }>;
/** "yield": the frame pushed a new frame on top and resumes once that one is done. */
type Outcome = "done" | "wait" | "continue" | "yield";

/**
 * Runs the game forward until a player has to decide something. Effects
 * queued along the way resolve in rule order (8-6): after the effect that
 * caused them, turn player's first.
 */
export function advance(state: GameState): void {
  for (let guard = 0; guard < 10_000; guard++) {
    // During setup, only "at the start of the game" effects and the opening draw run.
    if (state.winner !== null || (state.phase === "setup" && state.stack.length === 0)) return;
    const top = state.stack.at(-1);
    if (!top || isBetweenSteps(top)) flushPending(state);
    const frame = state.stack.at(-1);
    if (!frame) {
      state.prompt = { kind: "main", player: state.turnPlayer };
      return;
    }
    const outcome = runFrame(state, frame);
    if (outcome === "wait") return;
    if (outcome === "yield") continue;
    const index = state.stack.lastIndexOf(frame);
    if (outcome === "done" && index >= 0) state.stack.splice(index, 1);
    processRules(state);
  }
  throw new Error(
    "Engine stopped: too many steps without a player decision (possible infinite loop, rule 11-1)",
  );
}

/** Queued effects wait for the effect in progress and for damage processing to finish (rules 8-6-2, 8.6.3). */
function isBetweenSteps(frame: Frame): boolean {
  if (frame.kind === "effect") return frame.stage === "check";
  return frame.kind === "battle" || frame.kind === "end-phase";
}

/** Rule 8-6-1: the turn player's effects resolve first. */
function flushPending(state: GameState): void {
  if (state.pendingEffects.length === 0) return;
  const queued = state.pendingEffects.splice(0);
  const ordered = [
    ...queued.filter((q) => q.controller === state.turnPlayer),
    ...queued.filter((q) => q.controller !== state.turnPlayer),
  ];
  for (const q of ordered.reverse()) pushEffect(state, q.controller, q.source, q.effect);
}

function runFrame(state: GameState, frame: Frame): Outcome {
  switch (frame.kind) {
    case "effect":
      return runEffect(state, frame);
    case "battle":
      return runBattle(state, frame);
    case "damage":
      return runDamage(state, frame);
    case "trigger-cleanup":
      // Rule 10-1-5-3: the [Trigger] card is trashed afterwards unless it went somewhere else.
      if (state.limbo) state.players[state.limbo.owner].trash.unshift(state.limbo);
      state.limbo = null;
      return "done";
    case "end-phase":
      return runEndPhase(state, frame);
    case "opening-draw":
      // Rule 5-2-1-6.
      for (const player of ["p1", "p2"] as const) drawCards(state, player, 5);
      state.prompt = { kind: "mulligan", player: state.firstPlayer ?? state.turnPlayer };
      return "done";
  }
}

// --- Effects (rule 8) ---------------------------------------------------------

const ON_FIELD_TIMINGS = new Set([
  "onPlay",
  "whenAttacking",
  "onOpponentsAttack",
  "onBlock",
  "activateMain",
  "endOfYourTurn",
  "endOfOpponentsTurn",
  "characterRestedByYourEffect",
  "replaceRemoval",
  "donReturned",
  "characterRemovedByOpponent",
  "onOpponentsBlock",
  "drawOutsideDrawPhase",
  "lifeAddedToHand",
  "lifeBecomesZero",
  "triggerActivated",
  "opponentActivatesEvent",
  "characterRemovedByYourEffect",
  "yourCharacterRemovedByEffect",
  "opponentLifeRemoved",
  "becomesRested",
  "characterKOd",
  "attackDealsDamage",
  "opponentCharacterReturned",
  "restedByOpponentsCharacter",
]);

const RULE_EFFECT: EffectDefinition = { timing: "main", steps: [] };

function runEffect(state: GameState, frame: FrameOf<"effect">): Outcome {
  const source = findCard(state, frame.source);
  if (!source) return "done";
  // A rule's frame (e.g. "trashes 2 cards whenever they attack") has its own steps.
  const effect = frame.rule ? RULE_EFFECT : effectOf(state, source, frame.effect);
  if (!effect) return "done";
  const key = oncePerTurnKey(frame.source, effect, frame.effect);

  if (frame.stage === "check") {
    // Rule 8-1-3-1-3: an auto effect whose card has left its area doesn't activate.
    if (ON_FIELD_TIMINGS.has(effect.timing) && !findOnField(state, frame.source)) return "done";
    // Rule 8-2-1-1: a negated [On Play] effect does not happen.
    if (effect.timing === "onPlay" && onPlayNegated(state, frame.controller)) return "done";
    // [On K.O.] conditions were checked on the field (rule 10-2-17-1).
    if (
      effect.timing !== "onKO" &&
      effect.timing !== "koByEffect" &&
      effect.timing !== "koByOpponentsEffect" &&
      !conditionsMet(state, frame.controller, source, effect.conditions)
    )
      return "done";
    if (effect.oncePerTurn && state.usedThisTurn.includes(key)) return "done";
    if (!canPayCosts(state, frame.controller, source, effect.costs ?? [])) return "done";
    frame.stage = effect.optional ? "confirm" : "costs";
  }

  if (frame.stage === "confirm") {
    if (frame.answer === null) {
      state.prompt = {
        kind: "confirm",
        player: frame.controller,
        reason: "optional",
        source: frame.source,
      };
      return "wait";
    }
    const accepted = frame.answer === true;
    frame.answer = null;
    if (!accepted) return "done";
    frame.stage = "costs";
  }

  if (frame.stage === "costs") {
    const costs = effect.costs ?? [];
    while (frame.costIndex < costs.length) {
      const outcome = payCost(state, frame, source, costs[frame.costIndex] as Cost);
      if (outcome === "wait") return "wait";
      frame.costIndex += 1;
    }
    if (effect.oncePerTurn) state.usedThisTurn.push(key);
    // Rule 8-1-3-4: paying a replacement effect's costs prevents the removal.
    if (frame.replacing) (state.prevented ??= []).push(frame.replacing);
    frame.stage = "steps";
  }

  while (frame.steps.length > 0) {
    const outcome = runStep(state, frame, source, frame.steps[0] as Step);
    if (outcome === "wait" || outcome === "yield") return outcome;
    frame.steps.shift();
    frame.memo = [];
    if (state.winner !== null) return "done";
  }
  return "done";
}

function payCost(
  state: GameState,
  frame: FrameOf<"effect">,
  source: CardInstance,
  cost: Cost,
): Outcome {
  const p = state.players[frame.controller];
  if ("restDon" in cost) {
    p.donActive -= cost.restDon;
    p.donRested += cost.restDon;
  } else if ("giveActiveDon" in cost) {
    // One DON!! at a time, so the player picks which card each goes to.
    while (frame.memo.length < cost.giveActiveDon) {
      const cards = [p.leader, ...p.characters];
      const chosen = choose(state, frame, frame.controller, cards, 1, 1, "giveDon");
      if (chosen === "wait") return "wait";
      const card = cards.find((c) => c.uid === chosen[0]);
      if (!card || p.donActive === 0) return "continue";
      p.donActive -= 1;
      card.givenDon += 1;
      frame.memo.push(card.uid);
    }
    frame.memo = [];
  } else if ("trashOwnCharacter" in cost) {
    const n = cost.trashOwnCharacter;
    const pile = cost.zone === "stage" ? (p.stage ? [p.stage] : []) : p.characters;
    const own = pile.filter((c) => matchesFilter(state, c, cost.filter, source));
    const chosen = choose(state, frame, frame.controller, own, n, n, "trashCharacter");
    if (chosen === "wait") return "wait";
    for (const uid of chosen) {
      const card = findOnField(state, uid)?.card;
      if (card) moveFieldCardToTrash(state, card);
    }
  } else if ("donMinus" in cost) {
    let count = cost.donMinus;
    const most = donOnField(state, frame.controller);
    if (cost.orMore && most > count) {
      // "Return 1 or more DON!! cards": the player picks how many.
      if (!Array.isArray(frame.answer)) {
        const labels = [];
        for (let n = count; n <= most; n++) labels.push(`Return ${n} DON!!`);
        state.prompt = {
          kind: "chooseOne",
          player: frame.controller,
          labels,
          source: frame.source,
        };
        return "wait";
      }
      count += Number(frame.answer[0]);
      frame.answer = null;
    }
    returnDon(state, frame.controller, count);
  } else if ("trashFromHand" in cost) {
    const options = p.hand.filter((c) => matchesFilter(state, c, cost.filter, source, false));
    const n = cost.trashFromHand;
    const chosen = choose(state, frame, frame.controller, options, n, n, "trashFromHand");
    if (chosen === "wait") return "wait";
    moveFromHandToTrash(state, frame.controller, chosen);
    frame.costTrashed = [...(frame.costTrashed ?? []), ...chosen];
  } else if ("handToDeckTop" in cost) {
    const n = cost.handToDeckTop;
    const chosen = choose(state, frame, frame.controller, p.hand, n, n, "handToDeckTop");
    if (chosen === "wait") return "wait";
    moveFromHandToDeckTop(state, frame.controller, chosen);
  } else if ("returnOwnCharacter" in cost) {
    const n = cost.returnOwnCharacter;
    const own = p.characters.filter((c) => matchesFilter(state, c, cost.filter, source));
    const to = cost.to ?? "hand";
    const reason = to === "hand" ? "returnToHand" : "returnToDeckBottom";
    const chosen = choose(state, frame, frame.controller, own, n, n, reason);
    if (chosen === "wait") return "wait";
    for (const uid of chosen) removeFromField(state, uid, to);
  } else if ("handToDeckBottom" in cost) {
    const n = cost.handToDeckBottom;
    const hand = p.hand.filter((c) => c.uid !== source.uid);
    const chosen = choose(state, frame, frame.controller, hand, n, n, "handToDeckBottom");
    if (chosen === "wait") return "wait";
    moveFromHandToDeckBottom(state, frame.controller, chosen);
  } else if ("returnThis" in cost) {
    removeFromField(state, source.uid, "hand");
  } else if ("restOpponentCharacter" in cost) {
    const n = cost.restOpponentCharacter;
    const options = restableOpponentCharacters(state, frame.controller);
    const chosen = choose(state, frame, frame.controller, options, n, n, "rest");
    if (chosen === "wait") return "wait";
    for (const uid of chosen) {
      const card = findOnField(state, uid)?.card;
      if (card) restCard(state, frame.controller, card, false);
    }
  } else if ("thisToDeckBottom" in cost) {
    removeFromField(state, source.uid, "deckBottom");
  } else if ("returnActiveDon" in cost) {
    returnDon(state, frame.controller, cost.returnActiveDon, true);
  } else if ("activeLeaderPower" in cost) {
    state.modifiers.push({ target: p.leader.uid, power: cost.activeLeaderPower, until: "turn" });
  } else if ("revealFromHand" in cost) {
    // The cards stay in hand; the opponent sees them (rule 11-2-1).
    const options = p.hand.filter(
      (c) => c.uid !== source.uid && matchesFilter(state, c, cost.filter, source, false),
    );
    const n = cost.revealFromHand;
    const chosen = choose(state, frame, frame.controller, options, n, n, "revealFromHand");
    if (chosen === "wait") return "wait";
    frame.revealed = chosen;
  } else if ("restOwn" in cost) {
    const options = fieldCards(state, frame.controller).filter(
      (c) =>
        !c.rested &&
        !hasStatus(state, c, "cannotBeRested") &&
        matchesFilter(state, c, cost.restOwn, source),
    );
    const chosen = choose(state, frame, frame.controller, options, 1, 1, "rest");
    if (chosen === "wait") return "wait";
    for (const uid of chosen) {
      const card = findOnField(state, uid)?.card;
      if (card) restCard(state, frame.controller, card, false);
    }
  } else if ("restCards" in cost) {
    // DON!! are all alike, so the player picks the field cards and the rest are DON!!.
    const options = fieldCards(state, frame.controller).filter(
      (c) => !c.rested && !hasStatus(state, c, "cannotBeRested"),
    );
    const n = cost.restCards;
    const min = Math.max(0, n - p.donActive);
    const chosen = choose(state, frame, frame.controller, options, min, n, "rest");
    if (chosen === "wait") return "wait";
    for (const uid of chosen) {
      const card = findOnField(state, uid)?.card;
      if (card) restCard(state, frame.controller, card, false);
    }
    p.donActive -= n - chosen.length;
    p.donRested += n - chosen.length;
  } else if ("restThis" in cost) {
    restCard(state, frame.controller, source, true);
  } else if ("returnGivenDon" in cost) {
    // One DON!! at a time, so the player picks which cards they come from.
    while (frame.memo.length < cost.returnGivenDon) {
      const given = [p.leader, ...p.characters].filter((c) => c.givenDon > 0);
      const chosen = choose(state, frame, frame.controller, given, 1, 1, "returnGivenDon");
      if (chosen === "wait") return "wait";
      const card = given.find((c) => c.uid === chosen[0]);
      if (!card) return "continue";
      card.givenDon -= 1;
      p.donRested += 1;
      frame.memo.push(card.uid);
    }
    frame.memo = [];
  } else if ("lifeToHand" in cost) {
    for (let i = frame.memo.length; i < cost.lifeToHand; i++) {
      let fromBottom = false;
      if (cost.from === "topOrBottom" && p.life.length > 1) {
        if (frame.answer === null) {
          state.prompt = {
            kind: "confirm",
            player: frame.controller,
            reason: "lifeFromBottom",
            source: frame.source,
          };
          return "wait";
        }
        fromBottom = frame.answer === true;
        frame.answer = null;
      }
      const card = lifeCardToHand(state, frame.controller, fromBottom ? p.life.length - 1 : 0);
      frame.memo.push(card?.uid ?? "");
    }
    frame.memo = [];
  } else if ("trashLife" in cost) {
    trashFromLife(state, frame.controller, cost.trashLife);
  } else if ("lifeFaceUp" in cost || "lifeFaceDown" in cost) {
    const faceUp = "lifeFaceUp" in cost;
    const count = faceUp ? cost.lifeFaceUp : cost.lifeFaceDown;
    for (let i = frame.memo.length; i < count; i++) {
      // Only a card that isn't already facing that way can be turned. "Turn 2 cards from the
      // top" turns the top cards one after another.
      const top = cost.from === "topOrBottom" ? p.life[0] : p.life[i];
      const bottom = p.life.at(-1);
      const topOk = !!top && !!top.faceUp !== faceUp;
      const bottomOk = cost.from === "topOrBottom" && !!bottom && !!bottom.faceUp !== faceUp;
      let card = topOk ? top : bottomOk ? bottom : undefined;
      if (topOk && bottomOk && p.life.length > 1) {
        if (frame.answer === null) {
          state.prompt = {
            kind: "confirm",
            player: frame.controller,
            reason: "lifeFromBottom",
            source: frame.source,
          };
          return "wait";
        }
        if (frame.answer === true) card = bottom;
        frame.answer = null;
      }
      if (card) card.faceUp = faceUp;
      frame.memo.push(card?.uid ?? "");
    }
    frame.memo = [];
  } else if ("trashFromDeckTop" in cost) {
    p.trash.unshift(...p.deck.splice(0, cost.trashFromDeckTop).reverse());
  } else if ("oneOf" in cost) {
    if (frame.picked === undefined) {
      const payable = cost.oneOf
        .map((one, index) => ({ one, index }))
        .filter(({ one }) => canPayCosts(state, frame.controller, source, [one]));
      if (payable.length === 1) frame.picked = payable[0]?.index ?? 0;
      else {
        if (!Array.isArray(frame.answer)) {
          state.prompt = {
            kind: "chooseOne",
            player: frame.controller,
            labels: payable.map(({ one }) => costLabel(one)),
            source: frame.source,
          };
          return "wait";
        }
        frame.picked = payable[Number(frame.answer[0])]?.index ?? 0;
        frame.answer = null;
      }
    }
    const outcome = payCost(state, frame, source, cost.oneOf[frame.picked ?? 0] as Cost);
    if (outcome === "wait") return "wait";
    delete frame.picked;
  } else if ("trashToDeckBottom" in cost) {
    const pile = p.trash.filter(
      (c) => c.uid !== source.uid && matchesFilter(state, c, cost.filter, source, false),
    );
    const chosen = choose(
      state,
      frame,
      frame.controller,
      pile,
      cost.trashToDeckBottom,
      cost.trashToDeckBottom,
      "trashToDeckBottom",
    );
    if (chosen === "wait") return "wait";
    for (const uid of chosen) {
      const index = p.trash.findIndex((c) => c.uid === uid);
      const [card] = p.trash.splice(index, 1);
      if (card) p.deck.push(card);
    }
  } else if ("trashThis" in cost) {
    moveFieldCardToTrash(state, source);
  } else if ("toDeckBottom" in cost) {
    const own = toDeckBottomOptions(state, frame.controller, source, cost);
    const n = cost.toDeckBottom;
    const chosen = choose(state, frame, frame.controller, own, n, n, "returnToDeckBottom");
    if (chosen === "wait") return "wait";
    for (const uid of chosen) removeFromField(state, uid, "deckBottom");
  } else if ("trashToDeck" in cost) {
    const pile = p.trash.filter((c) => c.uid !== source.uid);
    const n = cost.trashToDeck;
    const chosen = choose(state, frame, frame.controller, pile, n, n, "trashToDeck");
    if (chosen === "wait") return "wait";
    p.deck.push(...p.trash.filter((c) => chosen.includes(c.uid)));
    p.trash = p.trash.filter((c) => !chosen.includes(c.uid));
    state.rng = shuffleInPlace(p.deck, state.rng);
  } else if ("koOwnCharacter" in cost) {
    const own = p.characters.filter((c) => matchesFilter(state, c, cost.filter, source));
    const n = cost.koOwnCharacter;
    const chosen = choose(state, frame, frame.controller, own, n, n, "ko");
    if (chosen === "wait") return "wait";
    for (const uid of chosen) knockOut(state, uid, true);
  } else if ("playFromHand" in cost) {
    if (frame.memo.length === 0) {
      const options = p.hand.filter(
        (c) => c.uid !== source.uid && matchesFilter(state, c, cost.playFromHand, source, false),
      );
      const chosen = choose(state, frame, frame.controller, options, 1, 1, "playFromHand");
      if (chosen === "wait") return "wait";
      if (chosen.length === 0) return "continue";
      frame.memo = chosen;
    }
    const outcome = playChosen(state, frame, frame.controller, p.hand, frame.memo[0] as string);
    if (outcome === "wait") return "wait";
    frame.memo = [];
  } else if ("characterToLife" in cost) {
    const own = p.characters.filter((c) => matchesFilter(state, c, cost.filter, source));
    const n = cost.characterToLife;
    const chosen = choose(state, frame, frame.controller, own, n, n, "characterToLife");
    if (chosen === "wait") return "wait";
    for (const uid of chosen) {
      const card = p.characters.find((c) => c.uid === uid);
      if (!card) continue;
      p.characters = p.characters.filter((c) => c.uid !== uid);
      leaveField(state, card);
      if (cost.faceUp) card.faceUp = true;
      p.life.unshift(card);
    }
  }
  return "continue";
}

/** A short label for a cost option in a "pay one of these" prompt. */
function costLabel(cost: Cost): string {
  if ("restDon" in cost) return `Rest ${cost.restDon} DON!!`;
  if ("donMinus" in cost) return `DON!! −${cost.donMinus}`;
  if ("restThis" in cost) return "Rest this card";
  if ("restOwn" in cost)
    return cost.restOwn.category === "leader" ? "Rest your Leader" : "Rest 1 of your cards";
  if ("trashFromHand" in cost) return `Trash ${cost.trashFromHand} from your hand`;
  if ("restCards" in cost) return `Rest ${cost.restCards} of your cards`;
  return Object.keys(cost)[0] ?? "Pay";
}

/**
 * DON!! −X (rule 8-3-1-6). The engine returns rested DON!! first, then active, then given
 * ones (Rules Question #3). Returning 2 or more at once can trigger `donReturned` effects.
 */
function returnDon(state: GameState, player: PlayerId, count: number, activeOnly = false): void {
  const p = state.players[player];
  let left = count;
  const fromRested = activeOnly ? 0 : Math.min(left, p.donRested);
  p.donRested -= fromRested;
  left -= fromRested;
  const fromActive = Math.min(left, p.donActive);
  p.donActive -= fromActive;
  left -= fromActive;
  for (const card of [...p.characters, p.leader]) {
    const taken = Math.min(left, card.givenDon);
    card.givenDon -= taken;
    left -= taken;
  }
  p.donDeck += count - left;
  const returned = count - left;
  if (returned === 0) return;
  for (const card of fieldCards(state, player)) {
    effectsOf(state, card).forEach((effect, index) => {
      if (effect.timing === "donReturned" && returned >= (effect.returnedAtLeast ?? 1))
        state.pendingEffects.push({ controller: player, source: card.uid, effect: index });
    });
  }
}

/**
 * Picks cards for a step. When there's no real choice, it picks automatically
 * so players are only asked about meaningful decisions.
 */
function choose(
  state: GameState,
  frame: FrameOf<"effect">,
  player: PlayerId,
  candidates: CardInstance[],
  min: number,
  max: number,
  reason: string,
): string[] | "wait" {
  const upper = Math.min(max, candidates.length);
  const lower = Math.min(min, upper);
  if (Array.isArray(frame.answer)) {
    const answer = frame.answer;
    frame.answer = null;
    return answer;
  }
  if (lower === upper && upper === candidates.length) return candidates.map((c) => c.uid);
  state.prompt = {
    kind: "choose",
    player,
    options: candidates.map((c) => c.uid),
    min: lower,
    max: upper,
    reason,
    source: frame.source,
  };
  return "wait";
}

function targetCandidates(
  state: GameState,
  controller: PlayerId,
  source: CardInstance,
  target: Target,
): CardInstance[] {
  if (target.side === "this") return findOnField(state, source.uid) ? [source] : [];
  const players =
    target.side === "any"
      ? [controller, opponentOf(controller)]
      : [target.side === "self" ? controller : opponentOf(controller)];
  const zone = target.zone ?? "characters";
  const cards = players.flatMap((player) => zoneCards(state.players[player], zone));
  return cards.filter((c) => matchesFilter(state, c, target.filter, source));
}

function chooseTargets(
  state: GameState,
  frame: FrameOf<"effect">,
  source: CardInstance,
  target: Target,
  reason: string,
): string[] | "wait" {
  // "That Character": the cards picked before, if they're still on the field.
  const earlier = () =>
    (frame.targets ?? [])
      .map((uid) => findOnField(state, uid)?.card)
      .filter((c): c is CardInstance => !!c && matchesFilter(state, c, target.filter, source));
  if (target.side === "that") return earlier().map((c) => c.uid);
  let candidates =
    target.side === "chosen"
      ? earlier()
      : targetCandidates(state, frame.controller, source, target);
  const count = target.count ?? 1;
  const total = target.totalPowerAtMost;
  if (total !== undefined) {
    // Only cards that fit within the total on their own can be part of a pick.
    candidates = candidates.filter((c) => powerOf(state, c) <= total);
    if (!Array.isArray(frame.answer) && candidates.length > 0) {
      state.prompt = {
        kind: "choose",
        player: frame.controller,
        options: candidates.map((c) => c.uid),
        min: target.upTo ? 0 : Math.min(count, candidates.length),
        max: Math.min(count, candidates.length),
        reason,
        source: frame.source,
        maxTotalPower: total,
      };
      return "wait";
    }
  }
  const chooser = target.chooser === "opponent" ? opponentOf(frame.controller) : frame.controller;
  const picked = choose(state, frame, chooser, candidates, target.upTo ? 0 : count, count, reason);
  if (picked !== "wait") frame.targets = picked;
  return picked;
}

function runStep(
  state: GameState,
  frame: FrameOf<"effect">,
  source: CardInstance,
  step: Step,
): Outcome {
  const controller = frame.controller;
  const p = state.players[controller];
  switch (step.do) {
    case "draw": {
      const who = step.side === "opponent" ? opponentOf(controller) : controller;
      if (drawCards(state, who, step.count) > 0)
        queueFieldEffects(state, who, "drawOutsideDrawPhase");
      return "continue";
    }

    case "trashThis":
      if (findOnField(state, source.uid)) moveFieldCardToTrash(state, source);
      return "continue";

    case "handDownTo": {
      const players = step.both ? [controller, opponentOf(controller)] : [controller];
      for (const player of players) {
        if (frame.memo.includes(player)) continue;
        const hand = state.players[player].hand;
        const excess = hand.length - step.count;
        if (excess > 0) {
          const chosen = choose(state, frame, player, hand, excess, excess, "trashFromHand");
          if (chosen === "wait") return "wait";
          moveFromHandToTrash(state, player, chosen);
        }
        frame.memo.push(player);
      }
      return "continue";
    }

    case "trashToDeckBottom": {
      const player = step.side === "self" ? controller : opponentOf(controller);
      const owner = state.players[player];
      const pile = owner.trash.filter((c) => matchesFilter(state, c, step.filter, source, false));
      const chooser = step.youChoose ? controller : player;
      const min = step.upTo ? 0 : step.count;
      const chosen = choose(state, frame, chooser, pile, min, step.count, step.do);
      if (chosen === "wait") return "wait";
      owner.deck.push(...chosen.map((uid) => owner.trash.find((c) => c.uid === uid)!));
      owner.trash = owner.trash.filter((c) => !chosen.includes(c.uid));
      frame.previous = chosen.length;
      return "continue";
    }

    case "handCostChange":
      // Only works as a permanent effect (see playCostOf).
      return "continue";

    case "extraTurn":
      state.extraTurn = controller;
      return "continue";

    case "ko":
    case "returnToHand":
    case "returnToDeckBottom":
      return runRemoval(state, frame, source, step);

    case "powerUp":
    case "grantKeyword":
    case "grantStatus":
    case "costChange":
    case "rest":
    case "setActive":
    case "noBlockers":
    case "setBasePower":
    case "setPower":
    case "giveRestedDon": {
      if (step.do === "giveRestedDon" && p.donRested === 0) return "continue";
      const targets = chooseTargets(state, frame, source, step.target, step.do);
      if (targets === "wait") return "wait";
      const applied =
        step.do === "powerUp" && step.perPrevious
          ? {
              ...step,
              amount:
                step.amount * Math.floor((frame.previous ?? 0) / (step.perPreviousEvery ?? 1)),
            }
          : step;
      for (const uid of targets) applyToTarget(state, controller, applied, uid, source);
      frame.previous = targets.length;
      // "You may rest ...: If you do, ..."
      if (step.do === "rest" && step.ifYouDo && targets.length > 0)
        frame.steps.splice(1, 0, ...step.ifYouDo);
      return "continue";
    }

    case "swapBasePower": {
      if (frame.memo.length === 0) {
        const first = chooseTargets(state, frame, source, step.target, step.do);
        if (first === "wait") return "wait";
        frame.memo = ["picked", ...first];
      }
      let picked = frame.memo.slice(1);
      if (step.with && picked.length === 1) {
        const second = chooseTargets(state, frame, source, step.with, step.do);
        if (second === "wait") return "wait";
        picked = [...picked, ...second.filter((uid) => uid !== picked[0])];
      }
      const cards = picked.map((uid) => findOnField(state, uid)?.card);
      const [a, b] = cards;
      if (cards.length !== 2 || !a || !b) return "continue";
      const [powerA, powerB] = [basePowerOf(state, a), basePowerOf(state, b)];
      state.modifiers.push(
        { target: a.uid, basePower: powerB, ...lasting(state, controller, step.duration) },
        { target: b.uid, basePower: powerA, ...lasting(state, controller, step.duration) },
      );
      return "continue";
    }

    case "opponentDonMinus":
      returnDon(state, opponentOf(controller), step.count);
      return "continue";

    case "negateOnPlay": {
      const player = step.side === "self" ? controller : opponentOf(controller);
      state.modifiers.push({
        target: state.players[player].leader.uid,
        negateOnPlay: true,
        ...lasting(state, controller, step.duration),
      });
      return "continue";
    }

    case "addDon": {
      const count = Math.min(step.count, p.donDeck);
      p.donDeck -= count;
      if (step.rested) p.donRested += count;
      else p.donActive += count;
      return "continue";
    }

    case "setDonActive": {
      const count = Math.min(step.count, p.donRested);
      p.donRested -= count;
      p.donActive += count;
      return "continue";
    }

    case "trashFromHand": {
      const options = p.hand.filter((c) => matchesFilter(state, c, step.filter, source, false));
      const min = step.upTo ? 0 : step.count;
      const chosen = choose(state, frame, controller, options, min, step.count, "trashFromHand");
      if (chosen === "wait") return "wait";
      moveFromHandToTrash(state, controller, chosen);
      frame.previous = chosen.length;
      // "You may trash ...: If you do, ..."
      if (step.ifYouDo && chosen.length > 0) frame.steps.splice(1, 0, ...step.ifYouDo);
      return "continue";
    }

    case "handToDeckTop": {
      const chosen = choose(state, frame, controller, p.hand, step.count, step.count, step.do);
      if (chosen === "wait") return "wait";
      moveFromHandToDeckTop(state, controller, chosen);
      // "At the top or bottom of your deck in any order": the player arranges them.
      if (step.orBottom && chosen.length > 0)
        frame.steps.splice(1, 0, { do: "arrangeDeckTop", look: chosen.length, bottom: true });
      return "continue";
    }

    case "donDownToOpponent": {
      const excess = donOnField(state, controller) - donOnField(state, opponentOf(controller));
      if (excess > 0) returnDon(state, controller, excess);
      return "continue";
    }

    case "opponentDonNoRefresh": {
      const opponent = state.players[opponentOf(controller)];
      opponent.donNoRefresh = Math.min(
        opponent.donRested,
        (opponent.donNoRefresh ?? 0) + step.count,
      );
      return "continue";
    }

    case "handToDeckBottom": {
      // "Your opponent must place 1 card from their hand ...": they pick.
      const who = step.side === "opponent" ? opponentOf(controller) : controller;
      const hand = state.players[who].hand;
      const n = Math.min(step.count, hand.length);
      const chosen = choose(state, frame, who, hand, n, n, step.do);
      if (chosen === "wait") return "wait";
      moveFromHandToDeckBottom(state, who, chosen);
      return "continue";
    }

    case "handToDeckShuffle": {
      const who = step.side === "opponent" ? opponentOf(controller) : controller;
      const player = state.players[who];
      player.deck.push(...player.hand);
      player.hand = [];
      state.rng = shuffleInPlace(player.deck, state.rng);
      drawCards(state, who, step.draw);
      return "continue";
    }

    case "cannotAttackLeader":
      state.modifiers.push({ target: p.leader.uid, noLeaderAttacks: true, until: "turn" });
      return "continue";

    case "dealDamage": {
      // The damage frame runs on top; the step is done once it has been pushed.
      if (frame.memo.includes("dealt")) return "continue";
      frame.memo.push("dealt");
      // `side: "self"`: "you take 1 damage".
      const defender = step.side === "self" ? controller : opponentOf(controller);
      // Rule 1-2-1-1-1: damage while you have 0 Life cards loses the game.
      if (state.players[defender].life.length === 0) {
        processRules(state, [defender]);
        return "continue";
      }
      state.stack.push({
        kind: "damage",
        defender,
        remaining: step.count,
        banish: false,
        answer: null,
      });
      return "yield";
    }

    case "redirectAttack": {
      if (!state.battle) return "continue";
      const chosen = chooseTargets(state, frame, source, step.target, step.do);
      if (chosen === "wait") return "wait";
      if (chosen[0]) state.battle.target = chosen[0];
      return "continue";
    }

    case "handToLife": {
      const pool = step.onlyTrash ? p.trash : [...p.hand, ...(step.fromTrash ? p.trash : [])];
      const options = pool.filter((c) => matchesFilter(state, c, step.filter, source, false));
      const chosen =
        options.length === 0
          ? []
          : choose(state, frame, controller, options, 0, step.count, step.do);
      if (chosen === "wait") return "wait";
      const cards = chosen.map((uid) => options.find((c) => c.uid === uid)).filter((c) => !!c);
      p.hand = p.hand.filter((c) => !chosen.includes(c.uid));
      p.trash = p.trash.filter((c) => !chosen.includes(c.uid));
      if (step.faceUp) for (const card of cards) card.faceUp = true;
      p.life.unshift(...cards);
      return "continue";
    }

    case "trashFaceUpLife": {
      const faceUp = p.life.filter((c) => c.faceUp);
      p.life = p.life.filter((c) => !c.faceUp);
      for (const card of faceUp) {
        delete card.faceUp;
        p.trash.unshift(card);
      }
      return "continue";
    }

    case "trashDeckTop":
      p.trash.unshift(...p.deck.splice(0, step.count).reverse());
      return "continue";

    // Rules for the game, not steps that happen: read by damage, rule processing, and checkDeck.
    case "faceUpLifeToDeckBottom":
    case "winOnDeckOut":
    case "deckOnlyType":
      return "continue";

    case "revealedToDeckTop":
      moveFromHandToDeckTop(
        state,
        controller,
        (frame.revealed ?? []).filter((uid) => p.hand.some((c) => c.uid === uid)),
      );
      return "continue";

    case "trashToHand": {
      const options = p.trash.filter((c) => matchesFilter(state, c, step.filter, source, false));
      const chosen =
        options.length === 0
          ? []
          : choose(state, frame, controller, options, 0, step.count ?? 1, step.do);
      if (chosen === "wait") return "wait";
      p.hand.push(...p.trash.filter((c) => chosen.includes(c.uid)));
      p.trash = p.trash.filter((c) => !chosen.includes(c.uid));
      return "continue";
    }

    case "arrangeDeckTop":
      return arrangeDeckTop(state, frame, controller, step.look, step.bottom ?? false);

    case "opponentTrashesFromHand": {
      const opponent = opponentOf(controller);
      const hand = state.players[opponent].hand;
      const chosen = choose(state, frame, opponent, hand, step.count, step.count, "trashFromHand");
      if (chosen === "wait") return "wait";
      moveFromHandToTrash(state, opponent, chosen);
      return "continue";
    }

    case "searchDeck": {
      if (step.play) return searchAndPlay(state, frame, source, step);
      const looked = p.deck.slice(0, step.look);
      const matching = looked.filter((c) => matchesFilter(state, c, step.filter, source, false));
      const chosen =
        matching.length === 0
          ? []
          : choose(state, frame, controller, matching, 0, step.take, "searchDeck");
      if (chosen === "wait") return "wait";
      // Rule 11-2-1: cards moved from the deck to the hand are revealed.
      const rest = looked.filter((c) => !chosen.includes(c.uid));
      p.deck = p.deck.slice(looked.length);
      const taken = looked.filter((c) => chosen.includes(c.uid));
      if (step.to === "lifeFaceUp") {
        for (const card of taken) card.faceUp = true;
        p.life.unshift(...taken);
      } else if (step.to === "play") {
        // The chosen card waits on top of the deck and is played right after.
        p.deck.unshift(...taken);
        if (taken.length > 0) frame.steps.splice(1, 0, { do: "playFromDeckTop", must: true });
      } else p.hand.push(...taken);
      if (step.rest === "trash") p.trash.unshift(...rest.reverse());
      else if (step.rest === "topOrBottom") {
        // The rest go back on top, then the player arranges them.
        p.deck.unshift(...rest);
        if (rest.length > 0)
          frame.steps.splice(1, 0, { do: "arrangeDeckTop", look: rest.length, bottom: true });
      } else p.deck.push(...rest);
      return "continue";
    }

    case "playFromDeckTop": {
      if (frame.memo.length === 0) {
        const top = p.deck[0];
        const def = top && definitionOf(state, top);
        const playable =
          !!def &&
          (def.category === "character" || def.category === "stage") &&
          !playBlocked(state, controller, top, false) &&
          matchesFilter(state, top, step.filter, source, false);
        const picked = playable
          ? choose(state, frame, controller, [top], step.must ? 1 : 0, 1, step.do)
          : [];
        if (picked === "wait") return "wait";
        if (picked.length === 0) {
          // "Then, place the rest at the bottom of your deck."
          if (step.restToBottom && top) p.deck.push(...p.deck.splice(0, 1));
          if (step.restTopOrBottom && top)
            frame.steps.splice(1, 0, { do: "arrangeDeckTop", look: 1, bottom: true });
          return "continue";
        }
        frame.memo = picked;
      }
      return playChosen(state, frame, controller, p.deck, frame.memo[0] as string, step.rested);
    }

    case "playFromHand":
    case "playFromTrash": {
      // "Your opponent plays ... from their hand": they choose and the card is theirs.
      const player =
        step.do === "playFromHand" && step.side === "opponent"
          ? opponentOf(controller)
          : controller;
      const owner = state.players[player];
      const both = step.do === "playFromHand" && step.orTrash;
      const piles = both
        ? [owner.hand, owner.trash]
        : [step.do === "playFromHand" ? owner.hand : owner.trash];
      const played = step.do === "playFromTrash" ? (step.played ?? []) : [];
      // "A different color than the returned Character."
      const avoid =
        step.do === "playFromHand" && step.differentColor
          ? (frame.moved ?? []).flatMap((uid) => {
              const card = findCard(state, uid);
              return card ? definitionOf(state, card).colors : [];
            })
          : [];
      // "The same card name as the trashed card."
      const sameName =
        step.do === "playFromTrash" && step.sameNameAsTrashed
          ? (frame.costTrashed ?? []).flatMap((uid) => {
              const card = findCard(state, uid);
              return card ? namesOf(definitionOf(state, card)) : [];
            })
          : null;
      if (frame.memo.length === 0) {
        const options = piles.flat().filter((c) => {
          const def = definitionOf(state, c);
          return (
            (def.category === "character" || def.category === "stage") &&
            !def.colors.some((color) => avoid.includes(color)) &&
            (!sameName || namesOf(def).some((n) => sameName.includes(n))) &&
            !played.includes(def.name) &&
            !playBlocked(state, player, c, step.do === "playFromHand") &&
            matchesFilter(state, c, step.filter, source, false)
          );
        });
        const picked =
          options.length === 0 ? [] : choose(state, frame, player, options, 0, 1, step.do);
        if (picked === "wait") return "wait";
        if (picked.length === 0) return "continue";
        frame.memo = picked;
      }
      const uid = frame.memo[0] as string;
      const name = definitionOf(state, findCard(state, uid) as CardInstance).name;
      const pile = piles.find((cards) => cards.some((c) => c.uid === uid)) ?? [];
      const outcome = playChosen(state, frame, player, pile, uid, step.rested ?? false);
      // "Play up to 5 ...": the rest are played one at a time.
      if (outcome === "continue" && step.do === "playFromTrash" && (step.count ?? 1) > 1) {
        const next = { ...step, count: (step.count ?? 1) - 1 };
        if (step.differentNames) next.played = [...played, name];
        frame.steps.splice(1, 0, next);
      }
      // "If you do, ..."
      if (outcome === "continue" && step.ifYouDo) frame.steps.splice(1, 0, ...step.ifYouDo);
      return outcome;
    }

    case "playThis": {
      const card = state.limbo;
      if (!card && p.trash.some((c) => c.uid === source.uid)) {
        if (definitionOf(state, source).category !== "character") return "continue";
        return playChosen(state, frame, controller, p.trash, source.uid, step.rested);
      }
      if (card && definitionOf(state, card).category === "stage") {
        state.limbo = null;
        putOnField(state, controller, card);
        return "continue";
      }
      if (!card || definitionOf(state, card).category !== "character") return "continue";
      if (p.characters.length >= 5) {
        const trash = choose(state, frame, controller, p.characters, 1, 1, "trashCharacter");
        if (trash === "wait") return "wait";
        state.limbo = null;
        putOnField(state, controller, card, trash[0]);
      } else {
        state.limbo = null;
        putOnField(state, controller, card);
      }
      return "continue";
    }

    case "lifeToHand": {
      // "You cannot add Life cards ... using your own effects" doesn't stop the opponent's.
      const owner = step.side === "opponent" ? state.players[opponentOf(controller)] : p;
      const blocked =
        owner === p && state.modifiers.some((m) => m.target === p.leader.uid && m.noLifeToHand);
      if (blocked) return "continue";
      for (let i = frame.memo.length; i < step.count && owner.life.length > 0; i++) {
        let fromBottom = step.fromBottom ?? false;
        if (step.from === "topOrBottom" && owner.life.length > 1) {
          if (frame.answer === null) {
            state.prompt = {
              kind: "confirm",
              player: controller,
              reason: "lifeFromBottom",
              source: frame.source,
            };
            return "wait";
          }
          fromBottom = frame.answer === true;
          frame.answer = null;
        }
        const card = takeLife(owner.life, fromBottom ? owner.life.length - 1 : 0)!;
        owner.hand.push(card);
        frame.memo.push(card.uid);
        lifeLost(state, owner === p ? controller : opponentOf(controller));
      }
      return "continue";
    }

    case "noLifeToHand":
      state.modifiers.push({ target: p.leader.uid, noLifeToHand: true, until: "turn" });
      return "continue";

    case "chooseOne": {
      const chooser = step.chooser === "opponent" ? opponentOf(controller) : controller;
      if (!Array.isArray(frame.answer)) {
        state.prompt = {
          kind: "chooseOne",
          player: chooser,
          labels: step.options.map((o) => o.label),
          source: frame.source,
        };
        return "wait";
      }
      const option = step.options[Number(frame.answer[0])];
      frame.answer = null;
      if (option) frame.steps.splice(1, 0, ...structuredClone(option.steps));
      return "continue";
    }

    case "restOpponentDon": {
      const opponent = state.players[opponentOf(controller)];
      const count = Math.min(step.count, opponent.donActive);
      opponent.donActive -= count;
      opponent.donRested += count;
      return "continue";
    }

    case "atEndOfTurn":
      state.delayed.push({
        controller,
        source: frame.source,
        effect: frame.effect,
        steps: structuredClone(step.steps),
      });
      return "continue";

    case "trashLife":
      trashFromLife(state, step.side === "self" ? controller : opponentOf(controller), step.count);
      return "continue";

    case "characterToLife":
      return characterToLife(state, frame, source, step);

    case "lifeToDeckTop": {
      if (frame.memo.length === 0) {
        const chosen = choose(state, frame, controller, p.life, 1, 1, "lifeToDeckTop");
        if (chosen === "wait") return "wait";
        const index = p.life.findIndex((c) => c.uid === chosen[0]);
        const card = index >= 0 ? takeLife(p.life, index) : undefined;
        if (!card) return "continue";
        p.deck.unshift(card);
        frame.memo = [card.uid];
      }
      // "Place the rest back in your Life area in any order": first picked is the new top.
      if (p.life.length > 1) {
        if (!Array.isArray(frame.answer)) {
          state.prompt = {
            kind: "choose",
            player: controller,
            options: p.life.map((c) => c.uid),
            min: p.life.length,
            max: p.life.length,
            reason: "lifeOrder",
            source: frame.source,
          };
          return "wait";
        }
        const order = frame.answer;
        frame.answer = null;
        p.life = order.map((uid) => p.life.find((c) => c.uid === uid) as CardInstance);
      }
      return "continue";
    }

    case "arrangeLife":
      return arrangeLife(state, frame);

    case "addThisToHand": {
      const card = state.limbo;
      if (!card) return "continue";
      state.limbo = null;
      p.hand.push(card);
      return "continue";
    }

    case "trashCharacter": {
      const targets = chooseTargets(state, frame, source, step.target, step.do);
      if (targets === "wait") return "wait";
      for (const uid of targets) {
        const location = findOnField(state, uid);
        if (location?.zone !== "characters") continue;
        if (protectedFrom(state, controller, location.card)) continue;
        noteRemoval(state, controller, location.card);
        removedByEffect(state, location.card, controller);
        moveFieldCardToTrash(state, location.card);
      }
      return "continue";
    }

    case "trashFromDeck": {
      const count = step.perPrevious ? (frame.previous ?? 0) : step.count;
      p.trash.unshift(...p.deck.splice(0, count).reverse());
      return "continue";
    }

    case "winGame":
      endGame(state, controller);
      return "continue";

    case "playRested":
      // Read by putOnField while the permanent effect is on the field.
      return "continue";

    case "deckToLife":
      p.life.unshift(...p.deck.splice(0, step.count));
      return "continue";

    case "moveGivenDon": {
      // First the card to take a given DON!! from, then the card to give it to.
      if (frame.memo.length === 0) {
        const given = [p.leader, ...p.characters].filter((c) => c.givenDon > 0);
        const from =
          given.length === 0 ? [] : choose(state, frame, controller, given, 0, 1, "returnGivenDon");
        if (from === "wait") return "wait";
        if (from.length === 0) return "continue";
        frame.memo = from;
      }
      const to = chooseTargets(state, frame, source, step.target, step.do);
      if (to === "wait") return "wait";
      const fromCard = findOnField(state, frame.memo[0] as string)?.card;
      const toCard = to[0] ? findOnField(state, to[0])?.card : undefined;
      if (fromCard && toCard && fromCard.givenDon > 0) {
        fromCard.givenDon -= 1;
        toCard.givenDon += 1;
      }
      return "continue";
    }

    case "replaceBattleKO":
      state.modifiers.push({
        target: p.leader.uid,
        battleKOReplace: { source: frame.source, effect: step.effect },
        until: "turn",
      });
      return "continue";

    case "restOwnDon": {
      // "Rest any number of your DON!! cards": the player picks how many.
      const most = Math.min(step.count ?? p.donActive, p.donActive);
      let count = 0;
      if (most > 0) {
        if (!Array.isArray(frame.answer)) {
          const labels = [];
          for (let n = 0; n <= most; n++) labels.push(`Rest ${n} DON!!`);
          state.prompt = { kind: "chooseOne", player: controller, labels, source: frame.source };
          return "wait";
        }
        count = Math.min(most, Number(frame.answer[0]));
        frame.answer = null;
      }
      p.donActive -= count;
      p.donRested += count;
      frame.previous = count;
      return "continue";
    }

    case "cannotPlay":
      state.modifiers.push({
        target: p.leader.uid,
        cannotPlay: {
          ...(step.filter ? { filter: step.filter } : {}),
          ...(step.fromHand ? { fromHand: true } : {}),
        },
        until: "turn",
      });
      return "continue";

    case "grantCounter":
      // Only works as a permanent effect; see counterOf.
      return "continue";

    case "deckTopToBottom":
      p.deck.push(...p.deck.splice(0, step.count));
      return "continue";

    case "copyPower": {
      const picked = chooseTargets(state, frame, source, step.target, step.do);
      if (picked === "wait") return "wait";
      const chosen = picked[0] && findOnField(state, picked[0]);
      if (chosen && findOnField(state, source.uid))
        state.modifiers.push({
          target: source.uid,
          basePower: powerOf(state, chosen.card),
          until: "turn",
        });
      return "continue";
    }

    case "reorderLife": {
      const owner = step.side === "self" ? p : state.players[opponentOf(controller)];
      if (owner.life.length < 2) return "continue";
      // Every card is picked: the order is the choice, first picked is the new top.
      if (!Array.isArray(frame.answer)) {
        state.prompt = {
          kind: "choose",
          player: controller,
          options: owner.life.map((c) => c.uid),
          min: owner.life.length,
          max: owner.life.length,
          reason: "lifeOrder",
          source: frame.source,
          revealed: owner.life.map((c) => c.uid),
        };
        return "wait";
      }
      const order = frame.answer;
      frame.answer = null;
      owner.life = order.map((uid) => owner.life.find((c) => c.uid === uid) as CardInstance);
      return "continue";
    }

    case "allLifeFaceDown":
      for (const card of p.life) card.faceUp = false;
      return "continue";

    case "trashLifeDownTo":
      trashFromLife(state, controller, p.life.length - step.count);
      return "continue";

    case "arrangeOwnLife":
      if (p.life.length > 1) {
        if (!Array.isArray(frame.answer)) {
          state.prompt = {
            kind: "choose",
            player: controller,
            options: p.life.map((c) => c.uid),
            min: p.life.length,
            max: p.life.length,
            reason: "lifeOrder",
            source: frame.source,
          };
          return "wait";
        }
        const order = frame.answer;
        frame.answer = null;
        p.life = order.map((uid) => p.life.find((c) => c.uid === uid) as CardInstance);
      }
      return "continue";

    case "playFromDeck": {
      if (frame.memo.length === 0) {
        const options = p.deck.filter((c) => {
          const def = definitionOf(state, c);
          return (
            (def.category === "character" || def.category === "stage") &&
            !playBlocked(state, controller, c, false) &&
            matchesFilter(state, c, step.filter, source, false)
          );
        });
        const picked =
          options.length === 0 ? [] : choose(state, frame, controller, options, 0, 1, step.do);
        if (picked === "wait") return "wait";
        if (picked.length === 0) {
          state.rng = shuffleInPlace(p.deck, state.rng);
          return "continue";
        }
        frame.memo = picked;
      }
      const outcome = playChosen(state, frame, controller, p.deck, frame.memo[0] as string);
      // Rule 5-2-1-5-2: a deck changed by an effect is shuffled.
      if (outcome === "continue") state.rng = shuffleInPlace(p.deck, state.rng);
      return outcome;
    }

    case "negateEffects":
    case "donPhaseToLeader":
    case "deckExcludes":
    case "koImmunity":
      // Permanent effects, worked out where they apply.
      return "continue";

    case "if":
      // Rule 8-3-3.
      if (conditionsMet(state, controller, source, step.conditions))
        frame.steps.splice(1, 0, ...step.steps);
      return "continue";
  }
}

/**
 * "Look at 5 cards from the top of your deck; play up to 1 ...". The chosen card waits on top of
 * the deck while the rest go to the bottom, so a full Character area can still ask what to trash.
 */
function searchAndPlay(
  state: GameState,
  frame: FrameOf<"effect">,
  source: CardInstance,
  step: Extract<Step, { do: "searchDeck" }>,
): Outcome {
  const p = state.players[frame.controller];
  if (frame.memo.length === 0) {
    const looked = p.deck.slice(0, step.look);
    const matching = looked.filter((c) => {
      const category = definitionOf(state, c).category;
      return (
        (category === "character" || category === "stage") &&
        matchesFilter(state, c, step.filter, source, false)
      );
    });
    const chosen =
      matching.length === 0
        ? []
        : choose(state, frame, frame.controller, matching, 0, 1, "searchDeck");
    if (chosen === "wait") return "wait";
    const picked = looked.filter((c) => chosen.includes(c.uid));
    const rest = looked.filter((c) => !chosen.includes(c.uid));
    p.deck = [...picked, ...p.deck.slice(looked.length), ...rest];
    if (picked.length === 0) return "continue";
    frame.memo = chosen;
  }
  return playChosen(state, frame, frame.controller, p.deck, frame.memo[0] as string, step.rested);
}

/** Plays a card picked by an effect, trashing a Character first if the area is full (rule 3-7-6-1). */
function playChosen(
  state: GameState,
  frame: FrameOf<"effect">,
  controller: PlayerId,
  pile: CardInstance[],
  uid: string,
  rested = false,
): Outcome {
  const p = state.players[controller];
  const index = pile.findIndex((c) => c.uid === uid);
  const card = pile[index];
  if (!card) return "continue";
  let trash: string | undefined;
  if (definitionOf(state, card).category === "character" && p.characters.length >= 5) {
    const chosen = choose(state, frame, controller, p.characters, 1, 1, "trashCharacter");
    if (chosen === "wait") return "wait";
    trash = chosen[0];
  }
  pile.splice(index, 1);
  putOnField(state, controller, card, trash);
  if (rested) card.rested = true;
  return "continue";
}

/**
 * Looks at the top `look` cards and puts them back in the order the player
 * picks (first picked is the new top). With `bottom`, the player first picks
 * which go to the bottom, in order.
 */
function arrangeDeckTop(
  state: GameState,
  frame: FrameOf<"effect">,
  controller: PlayerId,
  look: number,
  bottom: boolean,
): Outcome {
  const p = state.players[controller];
  const looked = p.deck.slice(0, look);
  // The memo ends with "|" once the bottom cards are picked.
  if (bottom && !frame.memo.includes("|")) {
    const picked = choose(state, frame, controller, looked, 0, looked.length, "deckBottom");
    if (picked === "wait") return "wait";
    frame.memo = [...picked, "|"];
  }
  const toBottom = frame.memo.filter((uid) => uid !== "|");
  const toTop = looked.filter((c) => !toBottom.includes(c.uid)).map((c) => c.uid);
  let order = toTop;
  if (toTop.length > 1) {
    // Always ask, even though every card is picked: the order is the choice.
    if (!Array.isArray(frame.answer)) {
      state.prompt = {
        kind: "choose",
        player: controller,
        options: toTop,
        min: toTop.length,
        max: toTop.length,
        reason: "deckTopOrder",
        source: frame.source,
        revealed: looked.map((c) => c.uid),
      };
      return "wait";
    }
    order = frame.answer;
    frame.answer = null;
  }
  const byUid = (uid: string) => looked.find((c) => c.uid === uid) as CardInstance;
  p.deck = [...order.map(byUid), ...p.deck.slice(looked.length), ...toBottom.map(byUid)];
  return "continue";
}

type RemovalStep = Extract<Step, { do: "ko" | "returnToHand" | "returnToDeckBottom" }>;

/**
 * K.O. or return the chosen cards one at a time, so a replacement effect
 * ("would be K.O.'d ... instead", rule 8-1-3-4) can be offered for each.
 * `frame.memo` holds the cards still to go; "?uid" marks one whose
 * replacement effect is resolving.
 */
function runRemoval(
  state: GameState,
  frame: FrameOf<"effect">,
  source: CardInstance,
  step: RemovalStep,
): Outcome {
  if (frame.memo[0] !== "removal") {
    const targets = chooseTargets(state, frame, source, step.target, step.do);
    if (targets === "wait") return "wait";
    frame.memo = ["removal", ...targets];
    frame.previous = targets.length;
    frame.moved = targets;
  }
  while (frame.memo.length > 1) {
    const next = frame.memo[1] as string;
    if (next.startsWith("?")) {
      const uid = next.slice(1);
      frame.memo.splice(1, 1);
      const saved = state.prevented?.includes(uid) ?? false;
      state.prevented = (state.prevented ?? []).filter((u) => u !== uid);
      if (!saved) applyToTarget(state, frame.controller, step, uid, source);
      continue;
    }
    const replacement = findReplacement(state, frame.controller, step, next, false, source);
    if (replacement) {
      frame.memo[1] = `?${next}`;
      pushEffect(state, replacement.player, replacement.source, replacement.effect);
      const pushed = state.stack.at(-1);
      if (pushed?.kind === "effect") {
        pushed.replacing = next;
        pushed.targets = [next];
      }
      return "yield";
    }
    frame.memo.splice(1, 1);
    applyToTarget(state, frame.controller, step, next, source);
  }
  // "You may return ...: If you do, ..."
  if (step.ifYouDo && (frame.previous ?? 0) > 0) frame.steps.splice(1, 0, ...step.ifYouDo);
  return "continue";
}

/** Whether a removal step would really remove `uid`, before replacement effects. */
function wouldRemove(
  state: GameState,
  controller: PlayerId,
  step: RemovalStep,
  uid: string,
  source?: CardInstance,
) {
  const location = findOnField(state, uid);
  if (!location || location.zone === "leader") return false;
  if (protectedFrom(state, controller, location.card)) return false;
  if (step.do !== "ko") return true;
  return location.zone === "stage" || !cannotBeKOdBy(state, controller, location.card, source);
}

function cannotBeKOdBy(
  state: GameState,
  controller: PlayerId,
  card: CardInstance,
  source?: CardInstance,
): boolean {
  if (hasStatus(state, card, "cannotBeKOdByEffects")) return true;
  if (controller === card.owner) return false;
  if (hasStatus(state, card, "cannotBeKOdByOpponentsEffects")) return true;
  return !!source && koImmuneTo(state, card, source);
}

/** "Cannot be removed from the field by your opponent's effects". */
function protectedFrom(state: GameState, controller: PlayerId, card: CardInstance): boolean {
  return controller !== card.owner && hasStatus(state, card, "cannotBeRemovedByOpponentsEffects");
}

/** The first usable replacement effect on the owner's field that would save `uid`. */
function findReplacement(
  state: GameState,
  controller: PlayerId,
  step: RemovalStep,
  uid: string,
  inBattle = false,
  remover?: CardInstance,
): { player: PlayerId; source: string; effect: number } | null {
  if (!inBattle && !wouldRemove(state, controller, step, uid, remover)) return null;
  const card = findOnField(state, uid)?.card;
  if (!card) return null;
  const owner = card.owner;
  for (const holder of fieldCards(state, owner)) {
    const effects = effectsOf(state, holder);
    for (const [index, effect] of effects.entries()) {
      const r = effect.replaces;
      if (effect.timing !== "replaceRemoval" || !r) continue;
      if (r.removal === "ko" && step.do !== "ko") continue;
      if (r.byOpponent && controller === owner) continue;
      if (inBattle && !r.battle) continue;
      if (r.side === "this" ? holder.uid !== uid : !matchesFilter(state, card, r.filter, holder))
        continue;
      if (
        effect.oncePerTurn &&
        state.usedThisTurn.includes(oncePerTurnKey(holder.uid, effect, index))
      )
        continue;
      if (!conditionsMet(state, owner, holder, effect.conditions)) continue;
      if (!canPayCosts(state, owner, holder, effect.costs ?? [])) continue;
      return { player: owner, source: holder.uid, effect: index };
    }
  }
  return inBattle ? battleKOReplacement(state, card) : null;
}

/**
 * "When your {Straw Hat Crew} type Character is removed from the field by your
 * opponent's effect" (OP09-080). Call before the card leaves the field.
 */
function noteRemoval(state: GameState, controller: PlayerId, card: CardInstance): void {
  const owner = card.owner;
  if (controller === owner || findOnField(state, card.uid)?.zone !== "characters") return;
  for (const holder of fieldCards(state, owner)) {
    effectsOf(state, holder).forEach((effect, index) => {
      if (
        effect.timing === "characterRemovedByOpponent" &&
        matchesFilter(state, card, effect.removed, holder)
      )
        state.pendingEffects.push({ controller: owner, source: holder.uid, effect: index });
    });
  }
}

/**
 * Rests a field card by a cost or effect. `byEffect` also fires "If a Character is
 * rested by your effect"; "When this Character becomes rested" fires either way.
 */
function restCard(
  state: GameState,
  controller: PlayerId,
  card: CardInstance,
  byEffect: boolean,
  source?: CardInstance,
): void {
  if (card.rested) return;
  card.rested = true;
  const location = findOnField(state, card.uid);
  if (location?.zone !== "characters") return;
  if (byEffect) characterRested(state, controller);
  queueEffects(state, location.player, card, "becomesRested");
  // "When this Character becomes rested by your opponent's Character's effect".
  if (
    byEffect &&
    source &&
    controller !== location.player &&
    definitionOf(state, source).category === "character"
  )
    queueEffects(state, location.player, card, "restedByOpponentsCharacter");
}

/** "If a Character is rested by your effect" (OP07-031). */
function characterRested(state: GameState, controller: PlayerId): void {
  for (const card of fieldCards(state, controller))
    queueEffects(state, controller, card, "characterRestedByYourEffect");
}

/** Converts a step's duration into when its modifier ends. */
function lasting(
  state: GameState,
  controller: PlayerId,
  duration: Duration = "turn",
  ownNextTurn = false,
): Pick<Modifier, "until" | "endsTurn"> {
  if (duration !== "opponentsNextTurn" && duration !== "yourNextTurn") return { until: duration };
  // The opponent's next turn is the next turn if it's the controller's turn now. With
  // `ownNextTurn`, it lasts into `controller`'s own next turn instead.
  const now = state.turnPlayer === controller;
  if (ownNextTurn || duration === "yourNextTurn")
    return { until: "turn", endsTurn: state.turn + (now ? 2 : 1) };
  return { until: "turn", endsTurn: state.turn + (now ? 1 : 2) };
}

function applyToTarget(
  state: GameState,
  controller: PlayerId,
  step: Step,
  uid: string,
  source?: CardInstance,
): void {
  const location = findOnField(state, uid);
  if (!location) return;
  const card = location.card;
  switch (step.do) {
    case "powerUp":
      state.modifiers.push({
        target: uid,
        power: powerAmount(state, controller, step),
        ...lasting(state, controller, step.duration),
      });
      return;
    case "costChange":
      state.modifiers.push({
        target: uid,
        cost: powerAmount(state, controller, step),
        ...lasting(state, controller, step.duration),
      });
      return;
    case "setPower":
      state.modifiers.push({
        target: uid,
        power: step.power - powerOf(state, card),
        ...lasting(state, controller, step.duration),
      });
      return;
    case "setBasePower":
      state.modifiers.push({
        target: uid,
        basePower: step.leaderBase
          ? basePowerOf(state, state.players[controller].leader)
          : step.power,
        ...lasting(state, controller, step.duration),
      });
      return;
    case "grantKeyword":
      state.modifiers.push({
        target: uid,
        keyword: step.keyword,
        ...lasting(state, controller, step.duration),
      });
      return;
    case "grantStatus":
      state.modifiers.push({
        target: uid,
        status: step.status,
        // "Will not become active in your next Refresh Phase": it lasts until the card's
        // owner's next turn, whoever's turn it is now.
        ...(step.status === "noRefresh"
          ? lasting(state, card.owner, "opponentsNextTurn", true)
          : lasting(state, controller, step.duration)),
      });
      return;
    case "noBlockers":
      state.modifiers.push({
        target: uid,
        noBlockers: step.blockers ?? {},
        ...lasting(state, controller, step.duration),
      });
      return;
    case "ko":
      if (protectedFrom(state, controller, card)) return;
      if (location.zone === "characters" && !cannotBeKOdBy(state, controller, card, source)) {
        noteRemoval(state, controller, card);
        knockOut(state, uid, true, controller);
      }
      // Stages have no [On K.O.]; a K.O.'d Stage goes to the trash.
      if (location.zone === "stage") moveFieldCardToTrash(state, card);
      return;
    case "rest":
      if (hasStatus(state, card, "cannotBeRested")) return;
      restCard(state, controller, card, true, source);
      if (step.stayRested)
        state.modifiers.push({
          target: uid,
          status: "noRefresh",
          ...lasting(state, controller, "opponentsNextTurn"),
        });
      return;
    case "setActive":
      card.rested = false;
      return;
    case "returnToHand":
    case "returnToDeckBottom":
      if (protectedFrom(state, controller, card)) return;
      noteRemoval(state, controller, card);
      removedByEffect(state, card, controller);
      // "When your opponent's Character is returned to the owner's hand by your effect".
      if (step.do === "returnToHand" && location.zone === "characters" && card.owner !== controller)
        for (const holder of fieldCards(state, controller))
          queueEffects(state, controller, holder, "opponentCharacterReturned");
      removeFromField(state, uid, step.do === "returnToHand" ? "hand" : "deckBottom");
      return;
    case "giveRestedDon": {
      const p = state.players[controller];
      const count = Math.min(step.count, p.donRested);
      p.donRested -= count;
      card.givenDon += count;
      return;
    }
  }
}

/** Removes a card from a Life area. It is no longer face-up once it leaves (rule 3-10-2-1). */
function takeLife(life: CardInstance[], index: number): CardInstance | undefined {
  const [card] = life.splice(index, 1);
  if (card) delete card.faceUp;
  return card;
}

function trashFromLife(state: GameState, player: PlayerId, count: number): void {
  const p = state.players[player];
  for (let i = 0; i < count && p.life.length > 0; i++) p.trash.unshift(takeLife(p.life, 0)!);
  lifeLost(state, player);
}

/** Adds a Life card to its owner's hand: "when a card is added to your hand from your Life". */
function lifeCardToHand(
  state: GameState,
  player: PlayerId,
  index: number,
): CardInstance | undefined {
  const p = state.players[player];
  const card = takeLife(p.life, index);
  if (!card) return undefined;
  p.hand.push(card);
  queueFieldEffects(state, player, "lifeAddedToHand");
  lifeLost(state, player);
  return card;
}

/** "When your number of Life cards becomes 0". */
function lifeLost(state: GameState, player: PlayerId): void {
  queueFieldEffects(state, opponentOf(player), "opponentLifeRemoved");
  if (state.players[player].life.length === 0) queueFieldEffects(state, player, "lifeBecomesZero");
}

/** Moves a Character to the top or bottom of its owner's Life cards (rule 3-10-2-1 for face-up). */
function characterToLife(
  state: GameState,
  frame: FrameOf<"effect">,
  source: CardInstance,
  step: Extract<Step, { do: "characterToLife" }>,
): Outcome {
  if (frame.memo.length === 0) {
    const picked = chooseTargets(state, frame, source, step.target, step.do);
    if (picked === "wait") return "wait";
    if (picked.length === 0) return "continue";
    frame.memo = picked;
  }
  const location = findOnField(state, frame.memo[0] as string);
  if (location?.zone !== "characters") return "continue";
  const card = location.card;
  if (protectedFrom(state, frame.controller, card)) return "continue";
  const owner = state.players[card.owner];
  let toBottom = false;
  if (owner.life.length > 0) {
    if (frame.answer === null) {
      state.prompt = {
        kind: "confirm",
        player: frame.controller,
        reason: "lifeToBottom",
        source: card.uid,
      };
      return "wait";
    }
    toBottom = frame.answer === true;
    frame.answer = null;
  }
  noteRemoval(state, frame.controller, card);
  removedByEffect(state, card, frame.controller);
  owner.characters = owner.characters.filter((c) => c.uid !== card.uid);
  leaveField(state, card);
  if (step.faceUp) card.faceUp = true;
  if (toBottom) owner.life.push(card);
  else owner.life.unshift(card);
  return "continue";
}

/**
 * "Look at up to 1 card from the top of your or your opponent's Life cards, and
 * place it at the top or bottom of the Life cards." The player first picks whose
 * Life by choosing that player's Leader, then sees the card and picks top or bottom.
 */
function arrangeLife(state: GameState, frame: FrameOf<"effect">): Outcome {
  if (frame.memo.length === 0) {
    const leaders = (["p1", "p2"] as const)
      .filter((id) => state.players[id].life.length > 0)
      .map((id) => state.players[id].leader);
    const picked =
      leaders.length === 0
        ? []
        : choose(state, frame, frame.controller, leaders, 0, 1, "arrangeLife");
    if (picked === "wait") return "wait";
    if (picked.length === 0) return "continue";
    frame.memo = picked;
  }
  const owner = findOnField(state, frame.memo[0] as string)?.player;
  const life = owner ? state.players[owner].life : [];
  const top = life[0];
  if (!top) return "continue";
  if (frame.answer === null) {
    state.prompt = {
      kind: "confirm",
      player: frame.controller,
      reason: "lifeToBottom",
      source: top.uid,
    };
    return "wait";
  }
  const toBottom = frame.answer === true;
  frame.answer = null;
  if (toBottom) life.push(life.shift() as CardInstance);
  return "continue";
}

/** Returns a Character or Stage to its owner's hand or the bottom of their deck. */
function removeFromField(state: GameState, uid: string, to: "hand" | "deckBottom"): void {
  const location = findOnField(state, uid);
  if (!location || location.zone === "leader") return;
  const card = location.card;
  const owner = state.players[card.owner];
  if (location.zone === "stage") owner.stage = null;
  owner.characters = owner.characters.filter((c) => c.uid !== uid);
  owner.donRested += card.givenDon;
  card.givenDon = 0;
  card.rested = false;
  card.playedTurn = null;
  state.modifiers = state.modifiers.filter((m) => m.target !== uid);
  state.usedThisTurn = state.usedThisTurn.filter((k) => !k.startsWith(`${uid}:`));
  if (to === "hand") owner.hand.push(card);
  else owner.deck.push(card);
}

/** Puts cards from the hand on top of the deck; the first one ends up on top. */
function moveFromHandToDeckTop(state: GameState, player: PlayerId, uids: string[]): void {
  const p = state.players[player];
  const cards = uids.map((uid) => p.hand.find((c) => c.uid === uid)).filter((c) => !!c);
  p.hand = p.hand.filter((c) => !uids.includes(c.uid));
  p.deck.unshift(...cards);
}

/** Puts cards from the hand at the bottom of the deck, in the order picked. */
function moveFromHandToDeckBottom(state: GameState, player: PlayerId, uids: string[]): void {
  const p = state.players[player];
  const cards = uids.map((uid) => p.hand.find((c) => c.uid === uid)).filter((c) => !!c);
  p.hand = p.hand.filter((c) => !uids.includes(c.uid));
  p.deck.push(...cards);
}

/** Only effects trash from the hand this way, which `handTrashedByEffectThisTurn` tracks. */
function moveFromHandToTrash(state: GameState, player: PlayerId, uids: string[]): void {
  const p = state.players[player];
  if (uids.length > 0) (state.handTrashedTurn ??= {})[player] = state.turn;
  for (const uid of uids) {
    const index = p.hand.findIndex((c) => c.uid === uid);
    const [card] = p.hand.splice(index, 1);
    if (card) p.trash.unshift(card);
  }
}

// --- Battle (rule 7) ----------------------------------------------------------

function attackersStillThere(state: GameState): boolean {
  const battle = state.battle;
  return !!battle && !!findOnField(state, battle.attacker) && !!findOnField(state, battle.target);
}

function runBattle(state: GameState, frame: FrameOf<"battle">): Outcome {
  const battle = state.battle;
  if (!battle) return "done";
  const defender = opponentOf(state.turnPlayer);

  switch (frame.step) {
    case "attack":
      // Rule 7-1-1-4.
      frame.step = attackersStillThere(state) ? "block" : "end";
      return "continue";

    case "block":
      // Blockers are public, so skipping an empty Block Step reveals nothing.
      if (!battle.blocked && eligibleBlockers(state, defender).length > 0) {
        state.prompt = { kind: "block", player: defender };
        return "wait";
      }
      frame.step = "counter";
      return "continue";

    case "counter":
      // Rule 7-1-2-3. The defender is always asked, even with no counters in
      // hand, so the attacker can't learn anything about their hand.
      if (!attackersStillThere(state)) {
        frame.step = "end";
        return "continue";
      }
      state.prompt = { kind: "counter", player: defender };
      return "wait";

    case "damage": {
      frame.step = "end";
      // Rule 7-1-3-1-3.
      if (!attackersStillThere(state)) return "continue";
      const attacker = findOnField(state, battle.attacker);
      const target = findOnField(state, battle.target);
      if (!attacker || !target) return "continue";
      // Rules 7-1-4-1 and 7-1-4-2.
      if (powerOf(state, attacker.card) < powerOf(state, target.card)) return "continue";
      if (target.zone === "characters") {
        if (hasStatus(state, target.card, "cannotBeKOdInBattle")) return "continue";
        if (
          attacker.zone === "leader" &&
          hasStatus(state, target.card, "cannotBeKOdInBattleByLeaders")
        )
          return "continue";
        if (
          (definitionOf(state, attacker.card).attribute ?? "").includes("Slash") &&
          hasStatus(state, target.card, "cannotBeKOdInBattleBySlash")
        )
          return "continue";
        const uid = target.card.uid;
        const ko: RemovalStep = { do: "ko", target: { side: "opponent" } };
        const replacement = findReplacement(state, state.turnPlayer, ko, uid, true);
        if (replacement) {
          // Rule 8-1-3-4: a replacement effect may save the Character.
          frame.step = "ko";
          frame.saving = uid;
          pushEffect(state, replacement.player, replacement.source, replacement.effect);
          const pushed = state.stack.at(-1);
          if (pushed?.kind === "effect") {
            pushed.replacing = uid;
            pushed.targets = [uid];
          }
          return "continue";
        }
        knockOut(state, uid);
        return "continue";
      }
      // Rule 7-1-4-1-1-1.
      if (state.players[target.player].life.length === 0) {
        processRules(state, [target.player]);
        return "continue";
      }
      queueEffects(state, attacker.player, attacker.card, "attackDealsDamage");
      state.stack.push({
        kind: "damage",
        defender: target.player,
        remaining: hasKeywordNow(state, attacker.card, "doubleAttack") ? 2 : 1,
        banish: hasKeywordNow(state, attacker.card, "banish"),
        answer: null,
      });
      return "continue";
    }

    case "ko": {
      frame.step = "end";
      const uid = frame.saving ?? "";
      const saved = state.prevented?.includes(uid) ?? false;
      state.prevented = (state.prevented ?? []).filter((u) => u !== uid);
      if (!saved && findOnField(state, uid)) knockOut(state, uid);
      return "continue";
    }

    case "end":
      // Rules 7-1-5-1 to 7-1-5-5.
      state.modifiers = state.modifiers.filter((m) => m.until !== "battle");
      state.battle = null;
      return "done";
  }
}

/**
 * A `battleKOReplacement` effect a `replaceBattleKO` step set up for the Character's owner
 * this turn ("If any of your Characters would be K.O.'d in battle during this turn, you may
 * [costs] instead"), if it can be paid. Its card is usually in the trash by now.
 */
function battleKOReplacement(
  state: GameState,
  card: CardInstance,
): { player: PlayerId; source: string; effect: number } | null {
  const leader = state.players[card.owner].leader.uid;
  for (const m of state.modifiers) {
    if (m.target !== leader || !m.battleKOReplace) continue;
    const source = findCard(state, m.battleKOReplace.source);
    const effect = source && effectOf(state, source, m.battleKOReplace.effect);
    if (!source || !effect) continue;
    if (!canPayCosts(state, card.owner, source, effect.costs ?? [])) continue;
    return { player: card.owner, ...m.battleKOReplace };
  }
  return null;
}

/** Rules 7-1-4-1-1-2, 7-1-4-1-1-3, 10-1-2-1, 10-1-3-1, 10-1-5. */
function runDamage(state: GameState, frame: FrameOf<"damage">): Outcome {
  const p = state.players[frame.defender];
  while (frame.remaining > 0) {
    // See docs/RULES_QUESTIONS.md #1: running out of Life mid-damage does not end the game.
    const top = p.life[0];
    if (!top) return "done";
    const hasTrigger = (definitionOf(state, top).effects ?? []).some((e) => e.timing === "trigger");
    // "When you take damage", once for each Life card (rule 7-1-4-1-1-2).
    if (frame.answer === null)
      for (const card of fieldCards(state, frame.defender))
        queueEffects(state, frame.defender, card, "takeDamage");
    if (frame.banish) {
      p.trash.unshift(takeLife(p.life, 0) as CardInstance);
      lifeLost(state, frame.defender);
    } else if (top.faceUp && hasRule(state, frame.defender, "faceUpLifeToDeckBottom")) {
      p.deck.push(takeLife(p.life, 0) as CardInstance);
      lifeLost(state, frame.defender);
    } else if (!hasTrigger) {
      lifeCardToHand(state, frame.defender, 0);
    } else if (frame.answer === null) {
      state.prompt = {
        kind: "confirm",
        player: frame.defender,
        reason: "trigger",
        source: top.uid,
      };
      return "wait";
    } else {
      const card = takeLife(p.life, 0) as CardInstance;
      const activate = frame.answer;
      frame.answer = null;
      frame.remaining -= 1;
      if (!activate) {
        p.hand.push(card);
        queueFieldEffects(state, frame.defender, "lifeAddedToHand");
        lifeLost(state, frame.defender);
        continue;
      }
      lifeLost(state, frame.defender);
      // Rule 10-1-5-3.
      for (const player of ["p1", "p2"] as const)
        for (const holder of fieldCards(state, player))
          queueEffects(state, player, holder, "triggerActivated");
      state.limbo = card;
      state.stack.push({ kind: "trigger-cleanup" });
      const index = (definitionOf(state, card).effects ?? []).findIndex(
        (e) => e.timing === "trigger",
      );
      pushEffect(state, frame.defender, card.uid, index);
      return "continue";
    }
    frame.remaining -= 1;
  }
  return "done";
}

// --- End Phase (rule 6-6) -----------------------------------------------------

function runEndPhase(state: GameState, frame: FrameOf<"end-phase">): Outcome {
  const turnPlayer = state.turnPlayer;
  const other = opponentOf(turnPlayer);
  if (frame.stage === 0) {
    // Rules 6-6-1-1 and 6-6-1-1-2.
    for (const card of fieldCards(state, turnPlayer))
      queueEffects(state, turnPlayer, card, "endOfYourTurn");
    // "At the end of this turn" effects.
    for (const delayed of state.delayed.splice(0).reverse()) {
      state.stack.push({
        kind: "effect",
        controller: delayed.controller,
        source: delayed.source,
        cardId: findCard(state, delayed.source)?.cardId ?? "",
        effect: delayed.effect,
        stage: "steps",
        costIndex: 0,
        steps: delayed.steps,
        memo: [],
        answer: null,
      });
    }
    frame.stage = 1;
    return "continue";
  }
  if (frame.stage === 1) {
    for (const card of fieldCards(state, other))
      queueEffects(state, other, card, "endOfOpponentsTurn");
    frame.stage = 2;
    return "continue";
  }
  // Rules 6-6-1-2, 6-6-1-3, 6-6-1-4.
  state.modifiers = state.modifiers.filter(
    (m) => m.until !== "turn" || (m.endsTurn ?? 0) > state.turn,
  );
  state.stack.splice(state.stack.lastIndexOf(frame), 1);
  // "Take an extra turn after this one."
  const next = state.extraTurn === turnPlayer ? turnPlayer : other;
  delete state.extraTurn;
  startTurn(state, next);
  return "continue";
}
