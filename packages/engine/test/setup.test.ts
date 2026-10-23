import { describe, expect, it } from "vitest";
import { applyAction, createGame, type GameState } from "../src/index.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

const deck = [
  ...Array<string>(4).fill("TEST-C2-3000"),
  ...Array<string>(4).fill("TEST-C4-5000"),
  ...Array<string>(4).fill("TEST-C5-6000"),
  ...Array<string>(4).fill("TEST-BLOCKER"),
  ...Array<string>(4).fill("TEST-RUSH"),
  ...Array<string>(4).fill("TEST-DOUBLE"),
  ...Array<string>(4).fill("TEST-BANISH"),
  ...Array<string>(4).fill("TEST-UNBLOCKABLE"),
  ...Array<string>(4).fill("TEST-RUSH-CHAR"),
  ...Array<string>(4).fill("TEST-STAGE"),
  ...Array<string>(4).fill("TEST-STAGE-2"),
  ...Array<string>(4).fill("TEST-EVENT"),
  ...Array<string>(2).fill("TEST-FILLER"),
];

function newGame(seed = 42): GameState {
  return createGame({
    catalog: TEST_CATALOG,
    decks: { p1: { leader: "TEST-LEADER", deck }, p2: { leader: "TEST-LEADER", deck } },
    seed,
    chooser: "p1",
  });
}

function startGame(state: GameState): GameState {
  let s = applyAction(state, { type: "chooseTurnOrder", player: "p1", goFirst: true });
  s = applyAction(s, { type: "keepHand", player: "p1" });
  return applyAction(s, { type: "keepHand", player: "p2" });
}

describe("rules 5-1, 5-1-1, 5-2, 5-2-1: pre-game preparations", () => {
  it("5-2-1-1, 5-1-2: rejects decks that break construction rules", () => {
    expect(() =>
      createGame({
        catalog: TEST_CATALOG,
        decks: {
          p1: { leader: "TEST-LEADER", deck: deck.slice(1) },
          p2: { leader: "TEST-LEADER", deck },
        },
        seed: 1,
      }),
    ).toThrow(/exactly 50/);
  });

  it("5-2-1-2, 5-2-1-3: shuffles each deck and places the Leader", () => {
    const state = newGame();
    expect(state.players.p1.deck).toHaveLength(50);
    expect(state.players.p1.leader.cardId).toBe("TEST-LEADER");
    expect(state.players.p1.deck.map((c) => c.cardId)).not.toEqual(deck);
  });

  it("3-2-4: the same seed always shuffles the same way, different seeds differently", () => {
    const order = (s: GameState) => s.players.p1.deck.map((c) => c.cardId);
    expect(order(newGame(7))).toEqual(order(newGame(7)));
    expect(order(newGame(7))).not.toEqual(order(newGame(8)));
  });

  it("5-2-1-4, 5-2-1-5: the Rock-Paper-Scissors winner chooses to go first or second", () => {
    const state = newGame();
    expect(state.prompt).toEqual({ kind: "chooseTurnOrder", player: "p1" });
    const second = applyAction(state, { type: "chooseTurnOrder", player: "p1", goFirst: false });
    expect(second.firstPlayer).toBe("p2");
  });

  it("5-2-1-4-1: the other player can't make that choice", () => {
    expect(() =>
      applyAction(newGame(), { type: "chooseTurnOrder", player: "p2", goFirst: true }),
    ).toThrow(/Illegal action/);
  });

  it("5-2-1-6: both draw 5, then the first player decides on a redraw first", () => {
    const state = applyAction(newGame(), { type: "chooseTurnOrder", player: "p1", goFirst: false });
    expect(state.players.p1.hand).toHaveLength(5);
    expect(state.players.p2.hand).toHaveLength(5);
    expect(state.prompt).toEqual({ kind: "mulligan", player: "p2" });
  });

  it("5-2-1-6-1: a redraw returns the hand, reshuffles, and draws 5 new cards", () => {
    const state = applyAction(newGame(), { type: "chooseTurnOrder", player: "p1", goFirst: true });
    const redrawn = applyAction(state, { type: "mulligan", player: "p1" });
    expect(redrawn.players.p1.hand).toHaveLength(5);
    expect(redrawn.players.p1.deck).toHaveLength(45);
    expect(redrawn.players.p1.hand.map((c) => c.uid)).not.toEqual(
      state.players.p1.hand.map((c) => c.uid),
    );
    expect(redrawn.prompt).toEqual({ kind: "mulligan", player: "p2" });
  });

  it("5-2-1-7, 2-9-2, 2-9-2-1: Life cards come from the top of the deck, top card ending at the bottom", () => {
    const beforeLife = applyAction(
      applyAction(newGame(), { type: "chooseTurnOrder", player: "p1", goFirst: true }),
      { type: "keepHand", player: "p1" },
    );
    const topFive = beforeLife.players.p2.deck.slice(0, 5).map((c) => c.uid);
    const started = applyAction(beforeLife, { type: "keepHand", player: "p2" });
    expect(started.players.p2.life.map((c) => c.uid)).toEqual([...topFive].reverse());
  });

  it("5-2-1-8, 6-3-1, 6-4-1: the first player starts without drawing and with 1 DON!!", () => {
    const state = startGame(newGame());
    expect(state.turn).toBe(1);
    expect(state.turnPlayer).toBe("p1");
    expect(state.phase).toBe("main");
    expect(state.players.p1.hand).toHaveLength(5);
    expect(state.players.p1.donActive).toBe(1);
    expect(state.players.p1.deck).toHaveLength(40);
  });

  it("6-3-1, 6-4-1: the second player draws and gets 2 DON!! on their first turn", () => {
    const state = applyAction(startGame(newGame()), { type: "endTurn", player: "p1" });
    expect(state.turnPlayer).toBe("p2");
    expect(state.players.p2.hand).toHaveLength(6);
    expect(state.players.p2.donActive).toBe(2);
  });
});

describe("applyAction", () => {
  it("never changes the state it was given", () => {
    const state = newGame();
    const snapshot = structuredClone(state);
    applyAction(state, { type: "chooseTurnOrder", player: "p1", goFirst: true });
    expect(state).toEqual(snapshot);
  });
});
