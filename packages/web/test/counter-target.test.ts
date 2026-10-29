import { applyAction, buildScenarioState, legalActions, viewFor } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import { TEST_CATALOG } from "../../engine/test/fixtures/test-cards.js";
import { counterFor } from "../src/menu.js";

/** p1's Character attacks p2's Leader; p2 has a [Blocker] and a Counter card in hand. */
function attacked() {
  let state = buildScenarioState(
    {
      p1: { characters: ["TEST-C4-5000"] },
      p2: { characters: ["TEST-BLOCKER"], hand: ["TEST-C4-5000"] },
    },
    TEST_CATALOG,
  );
  const attacker = state.players.p1.characters[0]!.uid;
  const leader = state.players.p2.leader.uid;
  state = applyAction(state, { type: "attack", player: "p1", attacker, target: leader });
  return state;
}

/** The Counter that tapping the hand card would play. */
function tapCounter(state: ReturnType<typeof attacked>) {
  const card = state.players.p2.hand[0]!.uid;
  const actions = legalActions(state, "p2").filter((a) => "card" in a && a.card === card);
  return counterFor(actions, viewFor(state, "p2").battle?.target);
}

describe("Counters from hand", () => {
  it("power up the attacked Leader", () => {
    const state = applyAction(attacked(), { type: "pass", player: "p2" });
    expect(tapCounter(state)).toMatchObject({ target: state.players.p2.leader.uid });
  });

  it("power up the [Blocker] once it steps in, and save it", () => {
    let state = attacked();
    const blocker = state.players.p2.characters[0]!.uid;
    state = applyAction(state, { type: "block", player: "p2", blocker });
    const counter = tapCounter(state);
    expect(counter).toMatchObject({ type: "counter", target: blocker });
    state = applyAction(state, counter!);
    expect(viewFor(state, "p2").powers[blocker]).toBe(4000);
  });
});
