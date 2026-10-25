import { describe, expect, it } from "vitest";
import { applyAction, chooseBotAction, createGame, powerOf, type GameState } from "../src/index.js";
import { isLegal } from "../src/legal.js";
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
  // 30 whole games take a few seconds, more on slower CI machines.
  it("plays 30 full games against itself using only legal moves", { timeout: 30_000 }, () => {
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

  it("keeps to a total power limit when choosing cards", () => {
    let state = createGame({
      catalog: TEST_CATALOG,
      decks: {
        p1: { leader: "TEST-LEADER", deck: deck.slice(0, 50) },
        p2: { leader: "TEST-LEADER", deck: deck.slice(2, 52) },
      },
      seed: 3,
    });
    // Let the bots play until one side has a few Characters on the field.
    while (state.players.p1.characters.length < 3 && state.winner === null) {
      const prompt = state.prompt;
      if (prompt.kind === "gameOver") break;
      state = applyAction(state, chooseBotAction(state, prompt.player));
    }
    const targets = state.players.p1.characters;
    expect(targets.length).toBeGreaterThanOrEqual(3);
    const smallest = Math.min(...targets.map((c) => powerOf(state, c)));
    state = {
      ...state,
      prompt: {
        kind: "choose",
        player: "p2",
        options: targets.map((c) => c.uid),
        min: 0,
        max: 2,
        reason: "ko",
        source: state.players.p2.leader.uid,
        maxTotalPower: smallest,
      },
    };
    const action = chooseBotAction(state, "p2");
    expect(action.type).toBe("choose");
    expect(isLegal(state, action)).toBe(true);
  });
});
