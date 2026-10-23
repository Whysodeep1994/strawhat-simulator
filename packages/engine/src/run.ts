import type { Cost, Step, Target } from "./effects.js";
import { eligibleBlockers } from "./legal.js";
import { processRules } from "./rules.js";
import {
  canPayCosts,
  conditionsMet,
  definitionOf,
  effectOf,
  fieldCards,
  findCard,
  findOnField,
  hasKeywordNow,
  matchesFilter,
  powerOf,
} from "./state.js";
import {
  drawCards,
  knockOut,
  moveFieldCardToTrash,
  pushEffect,
  putOnField,
  queueEffects,
  startTurn,
} from "./turn.js";
import {
  opponentOf,
  type CardInstance,
  type Frame,
  type GameState,
  type PlayerId,
} from "./types.js";

type FrameOf<K extends Frame["kind"]> = Extract<Frame, { kind: K }>;
type Outcome = "done" | "wait" | "continue";

/**
 * Runs the game forward until a player has to decide something. Effects
 * queued along the way resolve in rule order (8-6): after the effect that
 * caused them, turn player's first.
 */
export function advance(state: GameState): void {
  for (let guard = 0; guard < 10_000; guard++) {
    if (state.winner !== null || state.phase === "setup") return;
    const top = state.stack.at(-1);
    if (!top || isBetweenSteps(top)) flushPending(state);
    const frame = state.stack.at(-1);
    if (!frame) {
      state.prompt = { kind: "main", player: state.turnPlayer };
      return;
    }
    const outcome = runFrame(state, frame);
    if (outcome === "wait") return;
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
]);

function runEffect(state: GameState, frame: FrameOf<"effect">): Outcome {
  const source = findCard(state, frame.source);
  if (!source) return "done";
  const effect = effectOf(state, source, frame.effect);
  if (!effect) return "done";
  const key = `${frame.source}:${frame.effect}`;

  if (frame.stage === "check") {
    // Rule 8-1-3-1-3: an auto effect whose card has left its area doesn't activate.
    if (ON_FIELD_TIMINGS.has(effect.timing) && !findOnField(state, frame.source)) return "done";
    // [On K.O.] conditions were checked on the field (rule 10-2-17-1).
    if (
      effect.timing !== "onKO" &&
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
    frame.stage = "steps";
  }

  while (frame.steps.length > 0) {
    const outcome = runStep(state, frame, source, frame.steps[0] as Step);
    if (outcome === "wait") return "wait";
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
  } else if ("donMinus" in cost) {
    // Rule 8-3-1-6. The engine returns rested DON!! first, then active, then given ones.
    let left = cost.donMinus;
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
    p.donDeck += cost.donMinus - left;
  } else if ("trashFromHand" in cost) {
    const chosen = choose(
      state,
      frame,
      frame.controller,
      p.hand,
      cost.trashFromHand,
      cost.trashFromHand,
      "trashFromHand",
    );
    if (chosen === "wait") return "wait";
    moveFromHandToTrash(state, frame.controller, chosen);
  } else if ("restThis" in cost) {
    source.rested = true;
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
  } else if ("lifeFaceUp" in cost) {
    for (const card of p.life.slice(0, cost.lifeFaceUp)) card.faceUp = true;
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
  }
  return "continue";
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
  const player = target.side === "self" ? controller : opponentOf(controller);
  const p = state.players[player];
  const zone = target.zone ?? "characters";
  const cards =
    zone === "leader"
      ? [p.leader]
      : zone === "characters"
        ? p.characters
        : zone === "stage"
          ? p.stage
            ? [p.stage]
            : []
          : [p.leader, ...p.characters];
  return cards.filter((c) => matchesFilter(state, c, target.filter, source));
}

function chooseTargets(
  state: GameState,
  frame: FrameOf<"effect">,
  source: CardInstance,
  target: Target,
  reason: string,
): string[] | "wait" {
  const candidates = targetCandidates(state, frame.controller, source, target);
  const count = target.count ?? 1;
  return choose(state, frame, frame.controller, candidates, target.upTo ? 0 : count, count, reason);
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

    case "powerUp":
    case "grantKeyword":
    case "ko":
    case "rest":
    case "setActive":
    case "returnToHand":
    case "returnToDeckBottom":
    case "noBlockers":
    case "giveRestedDon": {
      if (step.do === "giveRestedDon" && p.donRested === 0) return "continue";
      const targets = chooseTargets(state, frame, source, step.target, step.do);
      if (targets === "wait") return "wait";
      for (const uid of targets) applyToTarget(state, controller, step, uid);
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
      const chosen = choose(
        state,
        frame,
        controller,
        p.hand,
        step.upTo ? 0 : step.count,
        step.count,
        "trashFromHand",
      );
      if (chosen === "wait") return "wait";
      moveFromHandToTrash(state, controller, chosen);
      return "continue";
    }

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
      p.deck = p.deck.slice(looked.length);
      p.hand.push(...looked.filter((c) => chosen.includes(c.uid)));
      const rest = looked.filter((c) => !chosen.includes(c.uid));
      if (step.rest === "trash") p.trash.unshift(...rest.reverse());
      else p.deck.push(...rest);
      return "continue";
    }

    case "playFromHand":
    case "playFromTrash": {
      const pile = step.do === "playFromHand" ? p.hand : p.trash;
      if (frame.memo.length === 0) {
        const options = pile.filter((c) => {
          const def = definitionOf(state, c);
          return (
            (def.category === "character" || def.category === "stage") &&
            matchesFilter(state, c, step.filter, source, false)
          );
        });
        const picked =
          options.length === 0 ? [] : choose(state, frame, controller, options, 0, 1, step.do);
        if (picked === "wait") return "wait";
        if (picked.length === 0) return "continue";
        frame.memo = picked;
      }
      return playChosen(state, frame, controller, pile, frame.memo[0] as string);
    }

    case "playThis": {
      const card = state.limbo;
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

    case "lifeToHand":
      for (let i = 0; i < step.count && p.life.length > 0; i++) p.hand.push(takeLife(p.life, 0)!);
      return "continue";

    case "trashLife":
      trashFromLife(state, step.side === "self" ? controller : opponentOf(controller), step.count);
      return "continue";

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
        if (location?.zone === "characters") moveFieldCardToTrash(state, location.card);
      }
      return "continue";
    }

    case "deckToLife":
      p.life.unshift(...p.deck.splice(0, step.count));
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
  return "continue";
}

function applyToTarget(state: GameState, controller: PlayerId, step: Step, uid: string): void {
  const location = findOnField(state, uid);
  if (!location) return;
  const card = location.card;
  switch (step.do) {
    case "powerUp":
      state.modifiers.push({ target: uid, power: step.amount, until: step.duration ?? "turn" });
      return;
    case "grantKeyword":
      state.modifiers.push({ target: uid, keyword: step.keyword, until: step.duration ?? "turn" });
      return;
    case "noBlockers":
      state.modifiers.push({
        target: uid,
        noBlockers: step.blockers ?? {},
        until: step.duration ?? "turn",
      });
      return;
    case "ko":
      if (location.zone === "characters") knockOut(state, uid);
      return;
    case "rest":
      card.rested = true;
      return;
    case "setActive":
      card.rested = false;
      return;
    case "returnToHand":
    case "returnToDeckBottom": {
      if (location.zone === "leader") return;
      const owner = state.players[card.owner];
      if (location.zone === "stage") owner.stage = null;
      owner.characters = owner.characters.filter((c) => c.uid !== uid);
      state.players[card.owner].donRested += card.givenDon;
      card.givenDon = 0;
      card.rested = false;
      card.playedTurn = null;
      state.modifiers = state.modifiers.filter((m) => m.target !== uid);
      state.usedThisTurn = state.usedThisTurn.filter((k) => !k.startsWith(`${uid}:`));
      if (step.do === "returnToHand") owner.hand.push(card);
      else owner.deck.push(card);
      return;
    }
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

function moveFromHandToTrash(state: GameState, player: PlayerId, uids: string[]): void {
  const p = state.players[player];
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
        knockOut(state, target.card.uid);
        return "continue";
      }
      // Rule 7-1-4-1-1-1.
      if (state.players[target.player].life.length === 0) {
        processRules(state, [target.player]);
        return "continue";
      }
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
    if (frame.banish) {
      p.trash.unshift(takeLife(p.life, 0) as CardInstance);
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
  state.modifiers = state.modifiers.filter((m) => m.until !== "turn");
  state.stack.splice(state.stack.lastIndexOf(frame), 1);
  startTurn(state, other);
  return "continue";
}
