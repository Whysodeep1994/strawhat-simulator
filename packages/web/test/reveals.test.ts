import { buildScenarioState } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import { TEST_CATALOG } from "../../engine/test/fixtures/test-cards.js";
import { newClock } from "../src/clock.js";
import { friendAct, humanAct, type LocalGame } from "../src/local-game.js";
import { newStats } from "../src/trophies.js";

/** A friend's game where p1 (the friend) is about to play a search card. */
function friendSearching(): LocalGame {
  const state = buildScenarioState(
    {
      p1: {
        hand: ["TEST-SEARCH"],
        don: { active: 1 },
        deck: ["TEST-FILLER", "TEST-C2-3000", "TEST-FILLER"],
      },
    },
    TEST_CATALOG,
  );
  return {
    state,
    initial: state,
    human: "p2",
    opponent: "friend",
    actions: [],
    log: [],
    stats: newStats(state, "p2"),
    clock: newClock(),
  };
}

describe("revealed cards", () => {
  it("keeps a searched card for the board to show, even when more moves arrive at once", () => {
    let game = friendSearching();
    const p1 = game.state.players.p1;
    game = friendAct(game, { type: "playCard", player: "p1", card: p1.hand[0]!.uid });
    game = friendAct(game, { type: "choose", player: "p1", cards: [p1.deck[1]!.uid] });
    game = friendAct(game, { type: "endTurn", player: "p1" });
    expect(game.reveals).toHaveLength(1);
    expect(game.reveals![0]!.id).toBe(2);
    expect(game.reveals![0]!.cards.map((c) => c.cardId)).toEqual(["TEST-C2-3000"]);
    expect(game.state.revealed).toBeUndefined();
  });

  it("reveals nothing when the search takes no card", () => {
    let game = friendSearching();
    game = humanAct(game, {
      type: "playCard",
      player: "p1",
      card: game.state.players.p1.hand[0]!.uid,
    });
    game = humanAct(game, { type: "choose", player: "p1", cards: [] });
    expect(game.reveals).toBeUndefined();
  });
});
