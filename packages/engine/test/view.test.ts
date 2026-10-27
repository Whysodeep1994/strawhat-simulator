import { describe, expect, it } from "vitest";
import {
  applyAction,
  buildScenarioState,
  legalActions,
  viewFor,
  type CardCatalog,
} from "../src/index.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

const state = buildScenarioState(
  { p1: { hand: ["TEST-C2-3000"] }, p2: { hand: ["TEST-C4-5000", "TEST-BLOCKER"] } },
  TEST_CATALOG,
);

describe("hidden information", () => {
  it("3-4-2, 3-4-3: you see your own hand but only the size of the opponent's", () => {
    const view = viewFor(state, "p1");
    expect(view.players.p1.hand?.map((c) => c.cardId)).toEqual(["TEST-C2-3000"]);
    expect(view.players.p2.hand).toBeNull();
    expect(view.players.p2.handCount).toBe(2);
  });

  it("3-1-4, 3-2-2, 3-10-2: deck and Life show only how many cards they hold", () => {
    const view = viewFor(state, "p1");
    expect(view.players.p1.deckCount).toBe(20);
    expect(view.players.p1.lifeCount).toBe(4);
    const json = JSON.stringify(view);
    for (const card of [
      ...state.players.p2.hand,
      ...state.players.p1.deck,
      ...state.players.p1.life,
    ]) {
      expect(json).not.toContain(`"${card.uid}"`);
    }
  });

  it("3-1-1, 3-1-2, 3-1-3, 3-1-5: each player has every area; open areas are visible to both", () => {
    const opponent = viewFor(state, "p2").players.p1;
    expect(opponent.leader.cardId).toBe("TEST-LEADER");
    expect(opponent.characters).toEqual([]);
    expect(opponent.stage).toBeNull();
    expect(opponent.trash).toEqual([]);
    expect(opponent.donActive).toBe(0);
  });

  it("3-6-1, 3-6-2, 3-7-1, 3-7-2, 3-8-1, 3-8-2, 3-9-1, 3-5-2, 3-3-2: Leader, Character, Stage, cost area, trash, and DON!! deck are open", () => {
    const board = buildScenarioState(
      {
        p1: {
          characters: ["TEST-C2-3000"],
          stage: "TEST-STAGE",
          trash: ["TEST-FILLER"],
          don: { active: 2, rested: 1, deck: 7 },
        },
      },
      TEST_CATALOG,
    );
    const seen = viewFor(board, "p2").players.p1;
    expect(seen.characters.map((c) => c.cardId)).toEqual(["TEST-C2-3000"]);
    expect(seen.stage?.cardId).toBe("TEST-STAGE");
    expect(seen.trash.map((c) => c.cardId)).toEqual(["TEST-FILLER"]);
    expect([seen.donActive, seen.donRested, seen.donDeck]).toEqual([2, 1, 7]);
  });

  it("3-4, 3-10, 3-10-1, 3-2, 3-2-1: hand, Life, and deck stay secret from the opponent", () => {
    const seen = viewFor(state, "p1").players.p2;
    expect([seen.hand, seen.handCount, seen.lifeCount, seen.deckCount]).toEqual([null, 2, 4, 20]);
  });

  it("3-10-2-1: a face-up Life card is shown to both players and is face-down again once it leaves", () => {
    let board = buildScenarioState(
      {
        turn: 4,
        turnPlayer: "p2",
        p1: { life: ["TEST-C2-3000", "TEST-FILLER"] },
        p2: { characters: ["TEST-C4-5000"] },
      },
      TEST_CATALOG,
    );
    const [top, under] = board.players.p1.life;
    top!.faceUp = true;
    const seen = viewFor(board, "p2").players.p1;
    expect(seen.life.map((c) => c?.cardId ?? null)).toEqual(["TEST-C2-3000", null]);
    expect(JSON.stringify(seen)).not.toContain(`"${under!.uid}"`);

    const attacker = board.players.p2.characters[0]!.uid;
    const leader = board.players.p1.leader.uid;
    board = applyAction(board, { type: "attack", player: "p2", attacker, target: leader });
    board = applyAction(board, { type: "pass", player: "p1" });
    expect(board.players.p1.hand.map((c) => [c.cardId, c.faceUp])).toEqual([
      ["TEST-C2-3000", undefined],
    ]);
  });

  it("never includes the random seed, which would reveal future shuffles", () => {
    expect(JSON.stringify(viewFor(state, "p2"))).not.toContain("rng");
  });
});

describe("legal actions", () => {
  it("only the player being asked gets moves besides conceding", () => {
    expect(legalActions(state, "p2")).toEqual([{ type: "concede", player: "p2" }]);
    expect(legalActions(state, "p1").length).toBeGreaterThan(1);
  });

  it("shows the current power of every Leader and Character, which is public", () => {
    const withDon = buildScenarioState(
      { p1: { leader: { card: "TEST-LEADER", don: 2 }, characters: ["TEST-C2-3000"] } },
      TEST_CATALOG,
    );
    const view = viewFor(withDon, "p2");
    const p1 = withDon.players.p1;
    expect(view.powers[p1.leader.uid]).toBe(7000);
    expect(view.powers[p1.characters[0]!.uid]).toBe(3000);
    expect(view.powers[withDon.players.p2.leader.uid]).toBe(5000);
  });
});

describe("decisions you answer from the board", () => {
  it("shows the card behind a 'choose one' decision on the opponent's turn", () => {
    // Like OP13-001 Monkey.D.Luffy: "[On Your Opponent's Attack] rest any number of DON!!".
    const catalog: CardCatalog = {
      ...TEST_CATALOG,
      "TEST-REST-DON-LEADER": {
        ...TEST_CATALOG["TEST-LEADER"]!,
        id: "TEST-REST-DON-LEADER",
        effects: [{ timing: "onOpponentsAttack", steps: [{ do: "restOwnDon" }] }],
      },
    };
    let game = buildScenarioState(
      {
        turn: 4,
        turnPlayer: "p2",
        p1: { leader: "TEST-REST-DON-LEADER", don: { active: 2 } },
        p2: { characters: ["TEST-C4-5000"] },
      },
      catalog,
    );
    const attack = legalActions(game, "p2").find(
      (a) => a.type === "attack" && a.target === game.players.p1.leader.uid,
    )!;
    game = applyAction(game, attack);
    expect(game.prompt).toMatchObject({ kind: "chooseOne", player: "p1" });
    const view = viewFor(game, "p1");
    expect(view.promptCards.map((c) => c.cardId)).toEqual(["TEST-REST-DON-LEADER"]);
    expect(legalActions(game, "p1").filter((a) => a.type === "chooseOne")).toHaveLength(3);
  });
});
