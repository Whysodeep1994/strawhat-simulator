import type { Cost, Duration, Step, Target } from "./effects.js";
import { eligibleBlockers } from "./legal.js";
import { endGame, processRules } from "./rules.js";
import {
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
  matchesFilter,
  oncePerTurnKey,
  onPlayNegated,
  playBlocked,
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
  "becomesRested",
]);

function runEffect(state: GameState, frame: FrameOf<"effect">): Outcome {
  const source = findCard(state, frame.source);
  if (!source) return "done";
  const effect = effectOf(state, source, frame.effect);
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
    const own = p.characters.filter((c) => matchesFilter(state, c, cost.filter, source));
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
  } else if ("handToDeckTop" in cost) {
    const n = cost.handToDeckTop;
    const chosen = choose(state, frame, frame.controller, p.hand, n, n, "handToDeckTop");
    if (chosen === "wait") return "wait";
    moveFromHandToDeckTop(state, frame.controller, chosen);
  } else if ("handToDeckBottom" in cost) {
    const n = cost.handToDeckBottom;
    const chosen = choose(state, frame, frame.controller, p.hand, n, n, "handToDeckBottom");
    if (chosen === "wait") return "wait";
    moveFromHandToDeckBottom(state, frame.controller, chosen);
  } else if ("returnOwnCharacter" in cost) {
    const n = cost.returnOwnCharacter;
    const own = p.characters.filter((c) => matchesFilter(state, c, cost.filter, source));
    const chosen = choose(state, frame, frame.controller, own, n, n, "returnToHand");
    if (chosen === "wait") return "wait";
    for (const uid of chosen) removeFromField(state, uid, "hand");
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
      const card = takeLife(p.life, fromBottom ? p.life.length - 1 : 0);
      if (card) p.hand.push(card);
      frame.memo.push(card?.uid ?? "");
    }
    frame.memo = [];
  } else if ("trashLife" in cost) {
    trashFromLife(state, frame.controller, cost.trashLife);
  } else if ("lifeFaceUp" in cost || "lifeFaceDown" in cost) {
    const faceUp = "lifeFaceUp" in cost;
    const count = faceUp ? cost.lifeFaceUp : cost.lifeFaceDown;
    for (let i = frame.memo.length; i < count; i++) {
      // Only a card that isn't already facing that way can be turned.
      const top = p.life[0];
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
    const pile = p.trash.filter((c) => c.uid !== source.uid);
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
  return Object.keys(cost)[0] ?? "Pay";
}

/**
 * DON!! −X (rule 8-3-1-6). The engine returns rested DON!! first, then active, then given
 * ones (Rules Question #3). Returning 2 or more at once can trigger `donReturned` effects.
 */
function returnDon(state: GameState, player: PlayerId, count: number): void {
  const p = state.players[player];
  let left = count;
  const fromRested = Math.min(left, p.donRested);
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
  let candidates =
    target.side === "chosen"
      ? (frame.chosen ?? [])
          .map((uid) => findOnField(state, uid)?.card)
          .filter((c) => !!c && matchesFilter(state, c, target.filter, source))
          .map((c) => c as CardInstance)
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
  const picked = choose(
    state,
    frame,
    frame.controller,
    candidates,
    target.upTo ? 0 : count,
    count,
    reason,
  );
  if (picked !== "wait") frame.chosen = picked;
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
    case "draw":
      drawCards(state, controller, step.count);
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
    case "giveRestedDon": {
      if (step.do === "giveRestedDon" && p.donRested === 0) return "continue";
      const targets = chooseTargets(state, frame, source, step.target, step.do);
      if (targets === "wait") return "wait";
      const applied =
        step.do === "powerUp" && step.perPrevious
          ? { ...step, amount: step.amount * (frame.previous ?? 0) }
          : step;
      for (const uid of targets) applyToTarget(state, controller, applied, uid);
      frame.previous = targets.length;
      // "You may rest ...: If you do, ..."
      if (step.do === "rest" && step.ifYouDo && targets.length > 0)
        frame.steps.splice(1, 0, ...step.ifYouDo);
      return "continue";
    }

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
      return "continue";
    }

    case "handToDeckTop": {
      const chosen = choose(state, frame, controller, p.hand, step.count, step.count, step.do);
      if (chosen === "wait") return "wait";
      moveFromHandToDeckTop(state, controller, chosen);
      return "continue";
    }

    case "handToDeckBottom": {
      const chosen = choose(state, frame, controller, p.hand, step.count, step.count, step.do);
      if (chosen === "wait") return "wait";
      moveFromHandToDeckBottom(state, controller, chosen);
      return "continue";
    }

    case "redirectAttack": {
      if (!state.battle) return "continue";
      const chosen = chooseTargets(state, frame, source, step.target, step.do);
      if (chosen === "wait") return "wait";
      if (chosen[0]) state.battle.target = chosen[0];
      return "continue";
    }

    case "handToLife": {
      const options = [...p.hand, ...(step.fromTrash ? p.trash : [])].filter((c) =>
        matchesFilter(state, c, step.filter, source, false),
      );
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
        const picked = playable ? choose(state, frame, controller, [top], 0, 1, step.do) : [];
        if (picked === "wait") return "wait";
        if (picked.length === 0) return "continue";
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
      const pile = step.do === "playFromHand" ? owner.hand : owner.trash;
      const played = step.do === "playFromTrash" ? (step.played ?? []) : [];
      if (frame.memo.length === 0) {
        const options = pile.filter((c) => {
          const def = definitionOf(state, c);
          return (
            (def.category === "character" || def.category === "stage") &&
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
      const outcome = playChosen(
        state,
        frame,
        controller,
        pile,
        frame.memo[0] as string,
        step.rested ?? false,
      );
      // "If you do, ..."
      if (outcome === "continue" && step.ifYouDo) frame.steps.splice(1, 0, ...step.ifYouDo);
      const uid = frame.memo[0] as string;
      const name = definitionOf(state, findCard(state, uid) as CardInstance).name;
      const outcome = playChosen(state, frame, player, pile, uid, step.rested ?? false);
      // "Play up to 5 ...": the rest are played one at a time.
      if (outcome === "continue" && step.do === "playFromTrash" && (step.count ?? 1) > 1) {
        const next = { ...step, count: (step.count ?? 1) - 1 };
        if (step.differentNames) next.played = [...played, name];
        frame.steps.splice(1, 0, next);
      }
      return outcome;
    }

    case "playThis": {
      const card = state.limbo;
      if (!card && p.trash.some((c) => c.uid === source.uid)) {
        if (definitionOf(state, source).category !== "character") return "continue";
        return playChosen(state, frame, controller, p.trash, source.uid, step.rested);
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
      const blocked = state.modifiers.some((m) => m.target === p.leader.uid && m.noLifeToHand);
      if (blocked) return "continue";
      for (let i = frame.memo.length; i < step.count && p.life.length > 0; i++) {
        let fromBottom = step.fromBottom ?? false;
        if (step.from === "topOrBottom" && p.life.length > 1) {
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
        const card = takeLife(p.life, fromBottom ? p.life.length - 1 : 0)!;
        p.hand.push(card);
        frame.memo.push(card.uid);
      }
      // "You cannot add Life cards ... using your own effects" doesn't stop the opponent's.
      const owner = step.side === "opponent" ? state.players[opponentOf(controller)] : p;
      const blocked =
        owner === p && state.modifiers.some((m) => m.target === p.leader.uid && m.noLifeToHand);
      if (!blocked)
        for (let i = 0; i < step.count && owner.life.length > 0; i++)
          owner.hand.push(takeLife(owner.life, step.fromBottom ? owner.life.length - 1 : 0)!);
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
      // Permanent effects, worked out where they apply.
      return "continue";

    case "if":
      // Rule 8-3-3.
      if (conditionsMet(state, controller, source, step.conditions))
        frame.steps.splice(1, 0, ...step.steps);
      return "continue";
  }
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
  }
  while (frame.memo.length > 1) {
    const next = frame.memo[1] as string;
    if (next.startsWith("?")) {
      const uid = next.slice(1);
      frame.memo.splice(1, 1);
      const saved = state.prevented?.includes(uid) ?? false;
      state.prevented = (state.prevented ?? []).filter((u) => u !== uid);
      if (!saved) applyToTarget(state, frame.controller, step, uid);
      continue;
    }
    const replacement = findReplacement(state, frame.controller, step, next);
    if (replacement) {
      frame.memo[1] = `?${next}`;
      pushEffect(state, replacement.player, replacement.source, replacement.effect);
      const pushed = state.stack.at(-1);
      if (pushed?.kind === "effect") pushed.replacing = next;
      return "yield";
    }
    frame.memo.splice(1, 1);
    applyToTarget(state, frame.controller, step, next);
  }
  // "You may return ...: If you do, ..."
  if (step.ifYouDo && (frame.previous ?? 0) > 0) frame.steps.splice(1, 0, ...step.ifYouDo);
  return "continue";
}

/** Whether a removal step would really remove `uid`, before replacement effects. */
function wouldRemove(state: GameState, controller: PlayerId, step: RemovalStep, uid: string) {
  const location = findOnField(state, uid);
  if (!location || location.zone === "leader") return false;
  if (protectedFrom(state, controller, location.card)) return false;
  if (step.do !== "ko") return true;
  return location.zone === "stage" || !cannotBeKOdBy(state, controller, location.card);
}

function cannotBeKOdBy(state: GameState, controller: PlayerId, card: CardInstance): boolean {
  if (hasStatus(state, card, "cannotBeKOdByEffects")) return true;
  return controller !== card.owner && hasStatus(state, card, "cannotBeKOdByOpponentsEffects");
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
): { player: PlayerId; source: string; effect: number } | null {
  if (!wouldRemove(state, controller, step, uid)) return null;
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
  return null;
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
): void {
  if (card.rested) return;
  card.rested = true;
  const location = findOnField(state, card.uid);
  if (location?.zone !== "characters") return;
  if (byEffect) characterRested(state, controller);
  queueEffects(state, location.player, card, "becomesRested");
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
): Pick<Modifier, "until" | "endsTurn"> {
  if (duration !== "opponentsNextTurn") return { until: duration };
  // The opponent's next turn is the next turn if it's the controller's turn now.
  return { until: "turn", endsTurn: state.turn + (state.turnPlayer === controller ? 1 : 2) };
}

function applyToTarget(state: GameState, controller: PlayerId, step: Step, uid: string): void {
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
    case "setBasePower":
      state.modifiers.push({
        target: uid,
        basePower: step.power,
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
        ...lasting(state, controller, step.duration),
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
      if (location.zone === "characters" && !cannotBeKOdBy(state, controller, card))
        knockOut(state, uid, true, controller);
      // Stages have no [On K.O.]; a K.O.'d Stage goes to the trash.
      if (location.zone === "stage") moveFieldCardToTrash(state, card);
      return;
    case "rest":
      if (hasStatus(state, card, "cannotBeRested")) return;
      restCard(state, controller, card, true);
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
      removedByEffect(state, card, controller);
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
        const safe =
          hasStatus(state, target.card, "cannotBeKOdInBattle") ||
          (attacker.zone === "leader" &&
            hasStatus(state, target.card, "cannotBeKOdInBattleByLeaders"));
        if (!safe) knockOut(state, target.card.uid);
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

    case "end":
      // Rules 7-1-5-1 to 7-1-5-5.
      state.modifiers = state.modifiers.filter((m) => m.until !== "battle");
      state.battle = null;
      return "done";
  }
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
    } else if (top.faceUp && hasRule(state, frame.defender, "faceUpLifeToDeckBottom")) {
      p.deck.push(takeLife(p.life, 0) as CardInstance);
    } else if (!hasTrigger) {
      p.hand.push(takeLife(p.life, 0) as CardInstance);
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
        continue;
      }
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
  startTurn(state, other);
  return "continue";
}
