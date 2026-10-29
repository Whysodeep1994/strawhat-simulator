import { hasRule } from "./state.js";
import type { GameState, PlayerId } from "./types.js";

/**
 * Rule processing (rule 9). Called after every step. Players who meet a defeat
 * condition lose; if both do at once, the game is a draw (rule 9-2-1).
 */
export function processRules(state: GameState, leaderDamagedAtZeroLife: PlayerId[] = []): void {
  if (state.winner !== null || state.turn === 0) return;
  // Brook (OP15-022): "you do not lose when your deck has 0 cards" (checked in the End Phase).
  const losers = (["p1", "p2"] as const).filter(
    (p) =>
      leaderDamagedAtZeroLife.includes(p) ||
      (state.players[p].deck.length === 0 && !hasRule(state, p, "deckOutAtEndOfTurn")),
  );
  if (losers.length === 0) return;
  // "When your deck is reduced to 0, you win the game instead of losing" (P-117).
  const deckOutWinner = losers.find(
    (p) => state.players[p].deck.length === 0 && hasRule(state, p, "winOnDeckOut"),
  );
  if (deckOutWinner) return endGame(state, deckOutWinner);
  endGame(state, losers.length === 2 ? "draw" : losers[0] === "p1" ? "p2" : "p1");
}

export function endGame(state: GameState, winner: PlayerId | "draw"): void {
  state.winner = winner;
  state.phase = "gameOver";
  state.prompt = { kind: "gameOver" };
  state.battle = null;
  state.stack = [];
  state.pendingEffects = [];
}

/** The extra turns played once a game clock runs out: turn 0 (the current turn), then 1, 2, 3. */
export const OVERTIME_TURNS = 3;

/**
 * Starts overtime (tournament Floor Rules, "time limit"): the turn being played becomes turn 0,
 * and the game ends after three more turns. `from` is that turn 0; it defaults to now.
 */
export function startOvertime(state: GameState, from: number = state.turn): GameState {
  return { ...state, lastTurn: from + OVERTIME_TURNS };
}

/** Which overtime turn is being played (0 to 3), or null outside overtime. */
export function overtimeTurn(state: GameState): number | null {
  if (state.lastTurn === undefined) return null;
  return Math.max(0, state.turn - (state.lastTurn - OVERTIME_TURNS));
}

/** What decided a game at the end of overtime, in the Floor Rules' order. */
export type OvertimeDecider = "life" | "deck" | "characters" | "lastLifeLost" | "tie";

/**
 * Who wins when overtime ends with no winner. Floor Rules: the player with more Life cards;
 * if tied, more cards left in the deck; then more Characters; then the player who last took a
 * card from their Life area. If even that can't tell them apart, the game is a draw.
 */
export function overtimeResult(state: GameState): {
  winner: PlayerId | "draw";
  by: OvertimeDecider;
} {
  const [p1, p2] = [state.players.p1, state.players.p2];
  const counts: [Exclude<OvertimeDecider, "lastLifeLost" | "tie">, number, number][] = [
    ["life", p1.life.length, p2.life.length],
    ["deck", p1.deck.length, p2.deck.length],
    ["characters", p1.characters.length, p2.characters.length],
  ];
  for (const [by, a, b] of counts) if (a !== b) return { winner: a > b ? "p1" : "p2", by };
  if (state.lastLifeLost) return { winner: state.lastLifeLost, by: "lastLifeLost" };
  return { winner: "draw", by: "tie" };
}
