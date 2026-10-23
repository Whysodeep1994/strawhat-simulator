import type { Action } from "./actions.js";
import { hasKeyword } from "./cards.js";
import { eligibleBlockers, legalActions } from "./legal.js";
import { cardsToDraw, donToPlace } from "./phases.js";
import { shuffleInPlace } from "./rng.js";
import { endGame, processRules } from "./rules.js";
import { definitionOf, findOnField, leaveField, powerOf } from "./state.js";
import { opponentOf, type GameState, type PlayerId } from "./types.js";

export class IllegalActionError extends Error {
  constructor(action: Action) {
    super(`Illegal action: ${JSON.stringify(action)}`);
    this.name = "IllegalActionError";
  }
}

/**
 * Returns the game state after `action`. The input state is never changed.
 * Throws `IllegalActionError` unless the action is in `legalActions`.
 */
export function applyAction(state: GameState, action: Action): GameState {
  const key = actionKey(action);
  if (!legalActions(state, action.player).some((a) => actionKey(a) === key)) {
    throw new IllegalActionError(action);
  }
  const next = structuredClone(state);
  perform(next, action);
  return next;
}

function actionKey(action: Action): string {
  const entries = Object.entries(action).filter(([, v]) => v !== undefined);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
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
      break;
    case "giveDon":
      giveDon(state, action.player, action.target);
      break;
    case "attack":
      declareAttack(state, action.player, action.attacker, action.target);
      break;
    case "block":
      block(state, action.player, action.blocker);
      break;
    case "counter":
      counter(state, action.player, action.card, action.target);
      break;
    case "pass":
      if (state.prompt.kind === "block") enterCounterStep(state);
      else damageStep(state);
      break;
    case "endTurn":
      endTurn(state);
      break;
  }
  processRules(state);
}

// --- Setup (rule 5-2) ---------------------------------------------------------

/** Rule 5-2-1-5, then 5-2-1-6: both players draw 5; the first player decides on a redraw first. */
function chooseTurnOrder(state: GameState, chooser: PlayerId, goFirst: boolean): void {
  const first = goFirst ? chooser : opponentOf(chooser);
  state.firstPlayer = first;
  state.turnPlayer = first;
  for (const player of ["p1", "p2"] as const) drawCards(state, player, 5);
  state.prompt = { kind: "mulligan", player: first };
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

// --- Turn flow (rule 6) -------------------------------------------------------

function startTurn(state: GameState, player: PlayerId): void {
  state.turn += 1;
  state.turnPlayer = player;
  const p = state.players[player];
  p.turnsTaken += 1;
  const isFirstPlayer = player === state.firstPlayer;

  // Refresh Phase, rules 6-2-3 and 6-2-4.
  state.phase = "refresh";
  for (const card of [p.leader, ...p.characters]) {
    p.donRested += card.givenDon;
    card.givenDon = 0;
  }
  for (const card of [p.leader, ...p.characters, ...(p.stage ? [p.stage] : [])])
    card.rested = false;
  p.donActive += p.donRested;
  p.donRested = 0;

  // Draw Phase, rule 6-3-1.
  state.phase = "draw";
  drawCards(state, player, cardsToDraw(p.turnsTaken, isFirstPlayer));
  processRules(state);
  if (state.winner !== null) return;

  // DON!! Phase, rules 6-4-1 to 6-4-3.
  state.phase = "don";
  const placed = Math.min(donToPlace(p.turnsTaken, isFirstPlayer), p.donDeck);
  p.donDeck -= placed;
  p.donActive += placed;

  // Main Phase, rule 6-5-2.
  state.phase = "main";
  state.prompt = { kind: "main", player };
}

/** Rule 6-6-1-4. End-of-turn effects arrive with the effect library (Phase 4). */
function endTurn(state: GameState): void {
  state.phase = "end";
  startTurn(state, opponentOf(state.turnPlayer));
}

/** Rules 4-5-1 to 4-5-3. Drawing from an empty deck does nothing; rule 9-2-1-2 already ended the game. */
function drawCards(state: GameState, player: PlayerId, count: number): void {
  const p = state.players[player];
  p.hand.push(...p.deck.splice(0, count));
}

// --- Main Phase actions (rule 6-5) --------------------------------------------

function playCard(state: GameState, player: PlayerId, uid: string, trash?: string): void {
  const p = state.players[player];
  const index = p.hand.findIndex((c) => c.uid === uid);
  const [card] = p.hand.splice(index, 1);
  if (!card) return;
  const def = definitionOf(state, card);
  const cost = def.cost ?? 0;
  p.donActive -= cost;
  p.donRested += cost;
  card.rested = false;
  card.playedTurn = state.turn;

  if (def.category === "stage") {
    // Rule 3-8-5-1.
    if (p.stage) {
      leaveField(state, p.stage);
      p.trash.unshift(p.stage);
    }
    p.stage = card;
    return;
  }
  if (trash) {
    // Rule 3-7-6-1.
    const old = p.characters.findIndex((c) => c.uid === trash);
    const [removed] = p.characters.splice(old, 1);
    if (removed) {
      leaveField(state, removed);
      p.trash.unshift(removed);
    }
  }
  p.characters.push(card);
}

function giveDon(state: GameState, player: PlayerId, target: string): void {
  const location = findOnField(state, target);
  if (!location) return;
  state.players[player].donActive -= 1;
  location.card.givenDon += 1;
}

// --- Battle (rule 7) ----------------------------------------------------------

/** Rules 7-1-1-1 and 7-1-1-2, then the Block Step (7-1-2). */
function declareAttack(state: GameState, player: PlayerId, attacker: string, target: string): void {
  const location = findOnField(state, attacker);
  if (!location) return;
  location.card.rested = true;
  state.battle = { attacker, target, bonus: {} };
  const defender = opponentOf(player);
  // Blockers are public, so skipping an empty Block Step reveals nothing.
  if (eligibleBlockers(state, defender).length > 0) {
    state.prompt = { kind: "block", player: defender };
  } else {
    enterCounterStep(state);
  }
}

/** Rules 7-1-2-1 and 10-1-4-1. */
function block(state: GameState, _player: PlayerId, blocker: string): void {
  const location = findOnField(state, blocker);
  if (!location || !state.battle) return;
  location.card.rested = true;
  state.battle.target = blocker;
  enterCounterStep(state);
}

/**
 * Rule 7-1-3. The defender is always asked, even with no counters in hand,
 * so the attacker can't learn anything about their hand.
 */
function enterCounterStep(state: GameState): void {
  state.prompt = { kind: "counter", player: opponentOf(state.turnPlayer) };
}

/** Rule 7-1-3-1-1. */
function counter(state: GameState, player: PlayerId, uid: string, target: string): void {
  const p = state.players[player];
  const index = p.hand.findIndex((c) => c.uid === uid);
  const [card] = p.hand.splice(index, 1);
  if (!card || !state.battle) return;
  p.trash.unshift(card);
  const value = definitionOf(state, card).counter ?? 0;
  state.battle.bonus[target] = (state.battle.bonus[target] ?? 0) + value;
}

/** Rule 7-1-4. */
function damageStep(state: GameState): void {
  const battle = state.battle;
  if (!battle) return;
  const attacker = findOnField(state, battle.attacker);
  const target = findOnField(state, battle.target);
  // Rule 7-1-3-1-3: if either card left the field, skip to the End of the Battle.
  if (attacker && target && powerOf(state, attacker.card) >= powerOf(state, target.card)) {
    if (target.zone === "leader") {
      dealLeaderDamage(state, target.player, definitionOf(state, attacker.card));
    } else {
      // Rule 7-1-4-1-2.
      knockOut(state, target.player, target.card.uid);
    }
  }
  if (state.winner !== null) return;
  // Rule 7-1-5: End of the Battle, then back to the Main Phase (7-1-5-5).
  state.battle = null;
  state.prompt = { kind: "main", player: state.turnPlayer };
}

/** Rules 7-1-4-1-1 to 7-1-4-1-1-3, 10-1-2-1, 10-1-3-1. [Trigger] arrives in Phase 4. */
function dealLeaderDamage(
  state: GameState,
  defender: PlayerId,
  attacker: ReturnType<typeof definitionOf>,
): void {
  const p = state.players[defender];
  // Rule 7-1-4-1-1-1.
  if (p.life.length === 0) {
    processRules(state, [defender]);
    return;
  }
  const damage = hasKeyword(attacker, "doubleAttack") ? 2 : 1;
  for (let i = 0; i < damage; i++) {
    // See docs/RULES_QUESTIONS.md #1: running out of Life mid-damage does not end the game.
    const card = p.life.shift();
    if (!card) break;
    if (hasKeyword(attacker, "banish")) p.trash.unshift(card);
    else p.hand.push(card);
  }
}

/** Rules 10-2-1-1 and 10-2-1-2. */
function knockOut(state: GameState, player: PlayerId, uid: string): void {
  const p = state.players[player];
  const index = p.characters.findIndex((c) => c.uid === uid);
  const [card] = p.characters.splice(index, 1);
  if (!card) return;
  leaveField(state, card);
  p.trash.unshift(card);
}
