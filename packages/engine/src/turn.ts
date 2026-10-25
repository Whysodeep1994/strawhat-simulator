import type { Timing } from "./effects.js";
import { cardsToDraw, donToPlace } from "./phases.js";
import { processRules } from "./rules.js";
import {
  conditionsMet,
  definitionOf,
  effectOf,
  effectsOf,
  fieldCards,
  findOnField,
  hasStatus,
  leaveField,
  matchesFilter,
} from "./state.js";
import {
  opponentOf,
  type CardInstance,
  type Frame,
  type GameState,
  type PlayerId,
} from "./types.js";

/** Rules 4-5-1 to 4-5-3. Drawing from an empty deck does nothing; rule 9-2-1-2 already ended the game. */
export function drawCards(state: GameState, player: PlayerId, count: number): number {
  const p = state.players[player];
  const drawn = p.deck.splice(0, count);
  p.hand.push(...drawn);
  return drawn.length;
}

/** Queues effects on `player`'s field with this timing, e.g. "when you draw a card ...". */
export function queueFieldEffects(state: GameState, player: PlayerId, timing: Timing): void {
  const p = state.players[player];
  for (const card of [p.leader, ...p.characters, ...(p.stage ? [p.stage] : [])])
    queueEffects(state, player, card, timing);
}

/**
 * Queues every effect on `card` with this timing (rule 8-1-3-1). `about` is the card the
 * timing is about (the K.O.'d or played Character), checked against `cardFilter`.
 */
export function queueEffects(
  state: GameState,
  controller: PlayerId,
  card: CardInstance,
  timing: Timing,
  about?: CardInstance,
): void {
  effectsOf(state, card).forEach((effect, index) => {
    if (effect.timing !== timing) return;
    if (about && !matchesFilter(state, about, effect.cardFilter, card)) return;
    state.pendingEffects.push({ controller, source: card.uid, effect: index });
  });
}

/** Queues `timing` effects on the owner's other field cards about `card`. */
function queueAbout(state: GameState, card: CardInstance, timing: Timing): void {
  for (const holder of fieldCards(state, card.owner))
    if (holder.uid !== card.uid) queueEffects(state, card.owner, holder, timing, card);
}

/**
 * "When your Character is removed from the field by your opponent's effect". Call before
 * the card leaves, so its type and power can still be checked.
 */
export function removedByEffect(state: GameState, card: CardInstance, by: PlayerId): void {
  if (findOnField(state, card.uid)?.zone !== "characters") return;
  if (by !== card.owner) queueAbout(state, card, "yourCharacterRemovedByOpponent");
  queueAbout(state, card, "yourCharacterRemovedByEffect");
  // "When a Character is removed from the field by your effect".
  queueFieldEffects(state, by, "characterRemovedByYourEffect");
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
  // "Will not become active in your opponent's next Refresh Phase" for DON!! cards.
  const stay = Math.min(p.donNoRefresh ?? 0, p.donRested);
  p.donActive += p.donRested - stay;
  p.donRested = stay;
  delete p.donNoRefresh;

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
  // "1 DON!! card placed during your DON!! Phase is given to your Leader."
  const toLeader = effectsOf(state, p.leader).some(
    (e) =>
      e.timing === "permanent" &&
      e.steps.some((s) => s.do === "donPhaseToLeader") &&
      conditionsMet(state, player, p.leader, e.conditions),
  );
  if (placed > 0 && toLeader) {
    p.donActive -= 1;
    p.leader.givenDon += 1;
  }

  // Main Phase, rule 6-5-2.
  state.phase = "main";
  state.prompt = { kind: "main", player };
}

/**
 * Rules 10-2-1-2 and 10-2-17: [On K.O.] conditions are checked while the card
 * is still on the field; the effect then resolves from the trash. `by` is the
 * player whose effect K.O.s the card, and is left out for a K.O. in battle.
 */
export function knockOut(state: GameState, uid: string, byEffect = false, by?: PlayerId): void {
  for (const player of ["p1", "p2"] as const) {
    const p = state.players[player];
    const card = p.characters.find((c) => c.uid === uid);
    if (!card) continue;
    queueAbout(state, card, "yourCharacterKOd");
    // "When your opponent's Character is K.O.'d".
    for (const holder of fieldCards(state, opponentOf(player)))
      queueEffects(state, opponentOf(player), holder, "opponentCharacterKOd", card);
    if (by) removedByEffect(state, card, by);
    effectsOf(state, card).forEach((effect, index) => {
      const timingMet =
        effect.timing === "onKO" ||
        (effect.timing === "koByEffect" && byEffect) ||
        (effect.timing === "koByOpponentsEffect" && byEffect && by !== undefined && by !== player);
      if (timingMet && conditionsMet(state, player, card, effect.conditions)) {
        state.pendingEffects.push({ controller: player, source: card.uid, effect: index });
      }
    });
    p.characters = p.characters.filter((c) => c.uid !== uid);
    leaveField(state, card);
    p.trash.unshift(card);
    // "When a Character is K.O.'d" effects on either player's field.
    for (const watcher of ["p1", "p2"] as const)
      for (const source of fieldCards(state, watcher))
        queueEffects(state, watcher, source, "characterKOd");
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
    // "Your Character cards are played rested."
    if (playsRested(state, player)) card.rested = true;
    queueAbout(state, card, "youPlayCharacter");
  }
  queueEffects(state, player, card, "onPlay");
}

function playsRested(state: GameState, player: PlayerId): boolean {
  return fieldCards(state, player).some((source) =>
    effectsOf(state, source).some(
      (effect) =>
        effect.timing === "permanent" &&
        effect.steps.some((s) => s.do === "playRested") &&
        conditionsMet(state, player, source, effect.conditions),
    ),
  );
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
