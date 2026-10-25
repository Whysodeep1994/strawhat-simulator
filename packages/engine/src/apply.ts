import type { Action } from "./actions.js";
import { isLegal } from "./legal.js";
import { endGame, processRules } from "./rules.js";
import { advance } from "./run.js";
import { shuffleInPlace } from "./rng.js";
import {
  counterOf,
  definitionOf,
  effectsOf,
  fieldCards,
  findOnField,
  matchesFilter,
  hasStatus,
  playCostOf,
} from "./state.js";
import { opponentOf, type GameState, type PlayerId } from "./types.js";
import {
  drawCards,
  eventActivated,
  pushEffect,
  putOnField,
  queueEffects,
  startTurn,
} from "./turn.js";

export class IllegalActionError extends Error {
  constructor(action: Action) {
    super(`Illegal action: ${JSON.stringify(action)}`);
    this.name = "IllegalActionError";
  }
}

/**
 * Returns the game state after `action`. The input state is never changed.
 * Throws `IllegalActionError` unless the action is legal right now.
 */
export function applyAction(state: GameState, action: Action): GameState {
  if (!isLegal(state, action)) throw new IllegalActionError(action);
  const next = structuredClone(state);
  delete next.revealed;
  perform(next, action);
  processRules(next);
  advance(next);
  return next;
}

function perform(state: GameState, action: Action): void {
  switch (action.type) {
    case "concede":
      // Rule 1-2-3.
      endGame(state, opponentOf(action.player));
      return;
    case "chooseTurnOrder":
      chooseTurnOrder(state, action.player, action.goFirst);
      return;
    case "keepHand":
    case "mulligan":
      finishMulligan(state, action.player, action.type === "mulligan");
      return;
    case "playCard":
      playCard(state, action.player, action.card, action.trash);
      return;
    case "activate":
      pushEffect(state, action.player, action.card, action.effect);
      return;
    case "giveDon":
      giveDon(state, action.player, action.target);
      return;
    case "attack":
      declareAttack(state, action.player, action.attacker, action.target);
      return;
    case "block":
      block(state, action.blocker);
      return;
    case "counter":
      counter(state, action.player, action.card, action.target);
      return;
    case "counterEvent":
      counterEvent(state, action.player, action.card);
      return;
    case "pass":
      setBattleStep(state, state.prompt.kind === "block" ? "counter" : "damage");
      return;
    case "choose":
    case "confirm":
    case "chooseOne": {
      const frame = state.stack.at(-1);
      if (frame?.kind === "effect" && action.type === "chooseOne") {
        frame.answer = [String(action.option)];
      } else if (frame && (frame.kind === "effect" || frame.kind === "damage")) {
        if (action.type === "choose" && frame.kind === "effect") frame.answer = action.cards;
        if (action.type === "confirm") frame.answer = action.accept;
      }
      return;
    }
    case "endTurn":
      // Rule 6-6.
      state.phase = "end";
      state.stack.push({ kind: "end-phase", stage: 0 });
      return;
  }
}

// --- Setup (rule 5-2) ---------------------------------------------------------

/**
 * Rule 5-2-1-5, then 5-2-1-6: both players draw 5; the first player decides on a redraw first.
 * "At the start of the game" Leader effects come before the draw, the chooser's first (5-2-1-5-1).
 */
function chooseTurnOrder(state: GameState, chooser: PlayerId, goFirst: boolean): void {
  const first = goFirst ? chooser : opponentOf(chooser);
  state.firstPlayer = first;
  state.turnPlayer = first;
  state.stack.push({ kind: "opening-draw" });
  // The stack runs newest first, so the chooser's effects are pushed last.
  for (const player of [opponentOf(chooser), chooser]) {
    const leader = state.players[player].leader;
    effectsOf(state, leader).forEach((effect, index) => {
      if (effect.timing === "startOfGame") pushEffect(state, player, leader.uid, index);
    });
  }
}

/** Rules 5-2-1-6, 5-2-1-6-1, 5-2-1-7, 5-2-1-8. */
function finishMulligan(state: GameState, player: PlayerId, redraw: boolean): void {
  if (redraw) {
    const p = state.players[player];
    p.deck.push(...p.hand.splice(0));
    state.rng = shuffleInPlace(p.deck, state.rng);
    drawCards(state, player, 5);
  }
  if (player === state.firstPlayer) {
    state.prompt = { kind: "mulligan", player: opponentOf(player) };
    return;
  }
  for (const id of ["p1", "p2"] as const) {
    const p = state.players[id];
    const life = definitionOf(state, p.leader).life ?? 0;
    // Rule 2-9-2-1: the top card of the deck ends up at the bottom of the Life area.
    p.life = p.deck.splice(0, life).reverse();
  }
  startTurn(state, state.firstPlayer ?? player);
}

// --- Main Phase actions (rule 6-5) --------------------------------------------

/** Rules 6-5-3-1, 2-7-2 to 2-7-4, 3-7-6-1, 3-8-5-1, 8-4-2. */
function playCard(state: GameState, player: PlayerId, uid: string, trash?: string): void {
  const p = state.players[player];
  const position = p.hand.findIndex((c) => c.uid === uid);
  const inHand = p.hand[position];
  if (!inHand) return;
  // Rule 6-5-3-1: the cost is worked out while the card is still in hand.
  const cost = playCostOf(state, player, inHand);
  useNextPlayDiscount(state, player, inHand.uid);
  const [card] = p.hand.splice(position, 1);
  if (!card) return;
  const def = definitionOf(state, card);
  p.donActive -= cost;
  p.donRested += cost;

  if (def.category === "event") {
    p.trash.unshift(card);
    const index = (def.effects ?? []).findIndex((e) => e.timing === "main");
    eventActivated(state, player, card);
    pushEffect(state, player, card.uid, index);
    return;
  }
  putOnField(state, player, card, trash, true);
}

/** Rule 6-5-5-1. */
function giveDon(state: GameState, player: PlayerId, target: string): void {
  const location = findOnField(state, target);
  if (!location) return;
  state.players[player].donActive -= 1;
  location.card.givenDon += 1;
  if (location.player === player) donGiven(state, player);
}

/** "When this Leader or any of your Characters is given a DON!! card". */
export function donGiven(state: GameState, player: PlayerId): void {
  for (const card of fieldCards(state, player)) queueEffects(state, player, card, "donGiven");
}

// --- Battle (rule 7) ----------------------------------------------------------

/** Rules 7-1-1-1 to 7-1-1-3, 10-2-5, 10-2-16. */
function declareAttack(state: GameState, player: PlayerId, attacker: string, target: string): void {
  const location = findOnField(state, attacker);
  if (!location) return;
  location.card.rested = true;
  state.battle = { attacker, target, blocked: false };
  state.stack.push({ kind: "battle", step: "attack" });
  // "Cannot attack unless your opponent trashes 2 cards from their hand whenever they attack".
  if (hasStatus(state, location.card, "mustTrashToAttack"))
    state.stack.push({
      kind: "effect",
      controller: player,
      source: attacker,
      cardId: location.card.cardId,
      effect: -1,
      stage: "steps",
      costIndex: 0,
      steps: [{ do: "trashFromHand", count: 2 }],
      memo: [],
      answer: null,
      rule: true,
    });
  queueEffects(state, player, location.card, "whenAttacking");
  queueEffects(state, player, location.card, "becomesRested");
  for (const card of fieldCards(state, opponentOf(player))) {
    queueEffects(state, opponentOf(player), card, "onOpponentsAttack");
  }
}

function setBattleStep(state: GameState, step: "counter" | "damage"): void {
  const frame = state.stack.findLast((f) => f.kind === "battle");
  if (frame?.kind === "battle") frame.step = step;
}

/** Rules 7-1-2-1, 7-1-2-2, 10-1-4-1, 10-2-15. */
function block(state: GameState, blocker: string): void {
  const location = findOnField(state, blocker);
  if (!location || !state.battle) return;
  location.card.rested = true;
  state.battle.target = blocker;
  state.battle.blocked = true;
  setBattleStep(state, "counter");
  queueEffects(state, location.player, location.card, "onBlock");
  queueEffects(state, location.player, location.card, "becomesRested");
  const attacker = opponentOf(location.player);
  for (const card of fieldCards(state, attacker))
    queueEffects(state, attacker, card, "onOpponentsBlock");
}

/** Rule 7-1-3-1-1. */
function counter(state: GameState, player: PlayerId, uid: string, target: string): void {
  const p = state.players[player];
  const [card] = p.hand.splice(
    p.hand.findIndex((c) => c.uid === uid),
    1,
  );
  if (!card) return;
  p.trash.unshift(card);
  const value = counterOf(state, player, card);
  state.modifiers.push({ target, power: value, until: "battle" });
}

/** Rules 7-1-3-1-2, 10-2-4. */
function counterEvent(state: GameState, player: PlayerId, uid: string): void {
  const p = state.players[player];
  const position = p.hand.findIndex((c) => c.uid === uid);
  const inHand = p.hand[position];
  if (!inHand) return;
  const cost = playCostOf(state, player, inHand);
  const [card] = p.hand.splice(position, 1);
  if (!card) return;
  const def = definitionOf(state, card);
  p.donActive -= cost;
  p.donRested += cost;
  p.trash.unshift(card);
  const index = (def.effects ?? []).findIndex((e) => e.timing === "counter");
  eventActivated(state, player, card);
  pushEffect(state, player, card.uid, index);
}
