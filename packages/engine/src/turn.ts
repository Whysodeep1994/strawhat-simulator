import type { Timing } from "./effects.js";
import { cardsToDraw, donToPlace } from "./phases.js";
import { processRules } from "./rules.js";
import {
  conditionsMet,
  definitionOf,
  effectOf,
  fieldCards,
  findOnField,
  hasStatus,
  leaveField,
} from "./state.js";
import type { CardInstance, Frame, GameState, PlayerId } from "./types.js";

/** Rules 4-5-1 to 4-5-3. Drawing from an empty deck does nothing; rule 9-2-1-2 already ended the game. */
export function drawCards(state: GameState, player: PlayerId, count: number): void {
  const p = state.players[player];
  p.hand.push(...p.deck.splice(0, count));
}

/** Queues every effect on `card` with this timing (rule 8-1-3-1). */
export function queueEffects(
  state: GameState,
  controller: PlayerId,
  card: CardInstance,
  timing: Timing,
): void {
  (definitionOf(state, card).effects ?? []).forEach((effect, index) => {
    if (effect.timing === timing)
      state.pendingEffects.push({ controller, source: card.uid, effect: index });
  });
}

/** Rules 6-2 to 6-5. */
export function startTurn(state: GameState, player: PlayerId): void {
  state.turn += 1;
  state.turnPlayer = player;
  state.usedThisTurn = [];
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
    if (!hasStatus(state, card, "noRefresh")) card.rested = false;
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

/**
 * Rules 10-2-1-2 and 10-2-17: [On K.O.] conditions are checked while the card
 * is still on the field; the effect then resolves from the trash. `byEffectOf`
 * is the player whose effect K.O.'d it, or undefined for a K.O. in battle.
 */
export function knockOut(state: GameState, uid: string, byEffectOf?: PlayerId): void {
  for (const player of ["p1", "p2"] as const) {
    const p = state.players[player];
    const card = p.characters.find((c) => c.uid === uid);
    if (!card) continue;
    (definitionOf(state, card).effects ?? []).forEach((effect, index) => {
      const timingMet =
        effect.timing === "onKO" ||
        (effect.timing === "koByEffect" && byEffectOf !== undefined) ||
        (effect.timing === "koByOpponentsEffect" &&
          byEffectOf !== undefined &&
          byEffectOf !== player);
      if (timingMet && conditionsMet(state, player, card, effect.conditions)) {
        state.pendingEffects.push({ controller: player, source: card.uid, effect: index });
      }
    });
    p.characters = p.characters.filter((c) => c.uid !== uid);
    leaveField(state, card);
    p.trash.unshift(card);
    // "When a Character is K.O.'d" on either player's field.
    for (const owner of ["p1", "p2"] as const)
      for (const holder of fieldCards(state, owner))
        queueEffects(state, owner, holder, "characterKOd");
  }
}

/** Places a Character or Stage on the field and queues its [On Play] effects (rule 10-2-6). */
export function putOnField(
  state: GameState,
  player: PlayerId,
  card: CardInstance,
  trash?: string,
): void {
  const p = state.players[player];
  card.rested = false;
  card.givenDon = 0;
  card.playedTurn = state.turn;
  if (definitionOf(state, card).category === "stage") {
    if (p.stage) moveFieldCardToTrash(state, p.stage);
    p.stage = card;
  } else {
    const old = trash ? p.characters.find((c) => c.uid === trash) : undefined;
    if (old) moveFieldCardToTrash(state, old);
    p.characters.push(card);
  }
  queueEffects(state, player, card, "onPlay");
}

/** Trashing by rule (3-7-6-1-1, 3-8-5-1) or by a "trash this Character" cost is not a K.O. */
export function moveFieldCardToTrash(state: GameState, card: CardInstance): void {
  const p = state.players[card.owner];
  if (p.stage?.uid === card.uid) p.stage = null;
  p.characters = p.characters.filter((c) => c.uid !== card.uid);
  leaveField(state, card);
  p.trash.unshift(card);
}

export function pushEffect(
  state: GameState,
  controller: PlayerId,
  source: string,
  effect: number,
): void {
  const card =
    findOnField(state, source)?.card ??
    state.players[controller].trash.find((c) => c.uid === source) ??
    (state.limbo?.uid === source ? state.limbo : null);
  if (!card || !effectOf(state, card, effect)) return;
  const frame: Frame = {
    kind: "effect",
    controller,
    source,
    cardId: card.cardId,
    effect,
    stage: "check",
    costIndex: 0,
    steps: structuredClone(effectOf(state, card, effect)?.steps ?? []),
    memo: [],
    answer: null,
  };
  state.stack.push(frame);
}
