import { describe, expect, it } from "vitest";
import {
  applyAction,
  buildScenarioState,
  legalActions,
  type Action,
  type CardCatalog,
  type GameState,
} from "../src/index.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

// The house rule that lets a player take back a DON!! given by mistake.

const catalog: CardCatalog = {
  ...TEST_CATALOG,
  "TEST-DON-DRAW": {
    id: "TEST-DON-DRAW",
    name: "Test DON!! Draw",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [{ timing: "donGiven", steps: [{ do: "draw", count: 1 }] }],
  },
};

function start(characters: string[] = ["TEST-C2-3000"], hand: string[] = []): GameState {
  return buildScenarioState(
    { p1: { characters, hand, don: { active: 3, rested: 0 } }, turn: 3 },
    catalog,
  );
}

const character = (state: GameState, index = 0) => state.players.p1.characters[index]!.uid;
const leader = (state: GameState) => state.players.p1.leader.uid;
const takeBacks = (state: GameState) =>
  legalActions(state, "p1").filter((a) => a.type === "takeBackDon");
const give = (target: string): Action => ({ type: "giveDon", player: "p1", target });
const takeBack = (target: string): Action => ({ type: "takeBackDon", player: "p1", target });

describe("taking back a DON!! given by mistake", () => {
  it("returns the DON!! to the cost area as active", () => {
    let state = start();
    const uid = character(state);
    expect(takeBacks(state)).toEqual([]);
    state = applyAction(state, give(uid));
    state = applyAction(state, give(uid));
    expect(state.players.p1.donActive).toBe(1);
    expect(takeBacks(state)).toEqual([takeBack(uid)]);

    state = applyAction(state, takeBack(uid));
    expect(state.players.p1.characters[0]!.givenDon).toBe(1);
    expect(state.players.p1.donActive).toBe(2);
    state = applyAction(state, takeBack(uid));
    expect(state.players.p1.characters[0]!.givenDon).toBe(0);
    expect(state.players.p1.donActive).toBe(3);
    expect(takeBacks(state)).toEqual([]);
  });

  it("only takes back DON!! given this turn, not DON!! the card already had", () => {
    let state = buildScenarioState(
      { p1: { characters: [{ card: "TEST-C2-3000", don: 2 }], don: { active: 1 } }, turn: 3 },
      catalog,
    );
    const uid = character(state);
    expect(takeBacks(state)).toEqual([]);
    state = applyAction(state, give(uid));
    state = applyAction(state, takeBack(uid));
    expect(state.players.p1.characters[0]!.givenDon).toBe(2);
    expect(takeBacks(state)).toEqual([]);
  });

  it("stops once that card attacks, but not when another card attacks", () => {
    let state = start();
    const uid = character(state);
    state = applyAction(state, give(uid));
    state = applyAction(state, give(leader(state)));
    const target = state.players.p2.leader.uid;
    state = applyAction(state, { type: "attack", player: "p1", attacker: leader(state), target });
    while (state.prompt.kind !== "main") {
      const pass = legalActions(state).find((a) => a.type === "pass");
      state = applyAction(state, pass ?? legalActions(state)[0]!);
    }
    expect(takeBacks(state)).toEqual([takeBack(uid)]);
  });

  it("stops when a card is played or the turn ends", () => {
    let state = start(["TEST-C2-3000"], ["TEST-C2-3000"]);
    state = applyAction(state, give(character(state)));
    const card = state.players.p1.hand[0]!.uid;
    state = applyAction(state, { type: "playCard", player: "p1", card });
    expect(takeBacks(state)).toEqual([]);

    state = start();
    state = applyAction(state, give(character(state)));
    state = applyAction(state, { type: "endTurn", player: "p1" });
    expect(state.takeBackDon).toBeUndefined();
  });

  it("can't take back a DON!! that set off a 'when given DON!!' effect", () => {
    let state = start(["TEST-DON-DRAW"]);
    const hand = state.players.p1.hand.length;
    state = applyAction(state, give(character(state)));
    expect(state.players.p1.hand.length).toBe(hand + 1);
    expect(takeBacks(state)).toEqual([]);
  });

  it("is only offered to the player whose turn it is", () => {
    let state = start();
    state = applyAction(state, give(character(state)));
    expect(legalActions(state, "p2").some((a) => a.type === "takeBackDon")).toBe(false);
  });
});
