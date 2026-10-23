import { describe, expect, it } from "vitest";
import { applyAction, chooseBotAction, createGame, type GameState } from "../src/index.js";
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

function playBotGame(seed: number): { state: GameState; actions: number } {
  let state = createGame({
    catalog: TEST_CATALOG,
    decks: {
      p1: { leader: "TEST-LEADER", deck: deck.slice(0, 50) },
      p2: { leader: "TEST-LEADER", deck: deck.slice(2, 52) },
    },
    seed,
  });
  let actions = 0;
  while (state.winner === null && actions < 3000) {
    const prompt = state.prompt;
    if (prompt.kind === "gameOver") break;
    state = applyAction(state, chooseBotAction(state, prompt.player));
    actions++;
  }
  return { state, actions };
}

describe("computer opponent", () => {
  it("plays 30 full games against itself using only legal moves", () => {
    let leaderWins = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { state } = playBotGame(seed);
      expect(state.winner, `game with seed ${seed} never finished`).not.toBeNull();
      // Games should end by damage, not by running out of cards, so the bot really attacks.
      const loser = state.winner === "p1" ? "p2" : "p1";
      if (state.winner !== "draw" && state.players[loser].deck.length > 0) leaderWins++;
    }
    expect(leaderWins).toBeGreaterThanOrEqual(25);
  });

  it("never concedes or gives up while it still has moves", () => {
    const { state } = playBotGame(7);
    expect(state.winner).not.toBeNull();
    const loser = state.winner === "p1" ? "p2" : "p1";
    expect(state.players[loser].life.length).toBe(0);
  });
});
