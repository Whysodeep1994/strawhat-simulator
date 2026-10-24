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
