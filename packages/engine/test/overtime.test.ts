import { describe, expect, it } from "vitest";
import {
  applyAction,
  chooseBotAction,
  createGame,
  overtimeResult,
  overtimeTurn,
  startOvertime,
  type GameState,
} from "../src/index.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

const deck = [
  "TEST-C2-3000",
  "TEST-C4-5000",
  "TEST-C5-6000",
  "TEST-BLOCKER",
  "TEST-RUSH",
  "TEST-DOUBLE",
  "TEST-ONPLAY-KO",
  "TEST-ATTACK-POWER",
  "TEST-ACTIVATE",
  "TEST-EVENT-KO",
  "TEST-EVENT-COUNTER",
  "TEST-TRIGGER-DRAW",
  "TEST-SEARCH",
].flatMap((id) => [id, id, id, id]);

function newGame(seed = 1): GameState {
  return createGame({
    catalog: TEST_CATALOG,
    decks: {
      p1: { leader: "TEST-LEADER", deck: deck.slice(0, 50) },
      p2: { leader: "TEST-LEADER", deck: deck.slice(2, 52) },
    },
    seed,
  });
}

/** Plays bot moves until `stop` says so or the game ends. */
function playUntil(state: GameState, stop: (s: GameState) => boolean): GameState {
  for (let i = 0; i < 3000 && state.winner === null && !stop(state); i++) {
    const prompt = state.prompt;
    if (prompt.kind === "gameOver") break;
    state = applyAction(state, chooseBotAction(state, prompt.player));
  }
  return state;
}

/** Ends the current turn without doing anything else, answering any prompt along the way. */
function endTurn(state: GameState): GameState {
  const turn = state.turn;
  return playUntil(
    state.prompt.kind !== "gameOver" && state.prompt.kind === "main"
      ? applyAction(state, { type: "endTurn", player: state.turnPlayer })
      : state,
    (s) => s.turn !== turn,
  );
}

describe("overtime", () => {
  it("counts turn 0 to 3 and decides the game when turn 3 ends", () => {
    let state = playUntil(newGame(), (s) => s.turn === 3 && s.prompt.kind === "main");
    expect(state.turn).toBe(3);
    state = startOvertime(state);
    expect(overtimeTurn(state)).toBe(0);
    for (let n = 1; n <= 3; n++) {
      state = endTurn(state);
      if (state.winner !== null) break;
      expect(overtimeTurn(state)).toBe(n);
    }
    // Turn 3 ends: no turn 4, and the Floor Rules pick the winner.
    state = playUntil(
      state.prompt.kind === "main"
        ? applyAction(state, { type: "endTurn", player: state.turnPlayer })
        : state,
      () => false,
    );
    expect(state.winner).not.toBeNull();
    expect(state.turn).toBe(6);
    expect(state.winner).toBe(overtimeResult(state).winner);
    expect(state.overtimeOver).toBe(true);
  });

  it("gives the win to the player with more Life, then more deck, then more Characters", () => {
    const base = newGame();
    const withCounts = (life: [number, number], deckSize: [number, number], chars = [0, 0]) => {
      const s = structuredClone(base);
      (["p1", "p2"] as const).forEach((p, i) => {
        s.players[p].life = s.players[p].deck.slice(0, life[i]);
        s.players[p].deck = s.players[p].deck.slice(0, deckSize[i]);
        s.players[p].characters = s.players[p].deck.slice(0, chars[i]);
      });
      return s;
    };
    expect(overtimeResult(withCounts([2, 3], [40, 10]))).toEqual({ winner: "p2", by: "life" });
    expect(overtimeResult(withCounts([3, 3], [30, 29]))).toEqual({ winner: "p1", by: "deck" });
    expect(overtimeResult(withCounts([3, 3], [30, 30], [1, 2]))).toEqual({
      winner: "p2",
      by: "characters",
    });
    const tied = withCounts([3, 3], [30, 30], [2, 2]);
    expect(overtimeResult(tied)).toEqual({ winner: "draw", by: "tie" });
    expect(overtimeResult({ ...tied, lastLifeLost: "p1" })).toEqual({
      winner: "p1",
      by: "lastLifeLost",
    });
  });

  it("still lets a game end normally during overtime", () => {
    let state = startOvertime(newGame(2), 1);
    state = playUntil(state, () => false);
    expect(state.winner).not.toBeNull();
  });
});
