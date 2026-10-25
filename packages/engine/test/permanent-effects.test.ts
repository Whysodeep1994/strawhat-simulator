import { describe, expect, it } from "vitest";
import { buildScenarioState, costOf, type CardCatalog } from "../src/index.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

/** Like OP14-090: "If there is a Character with a cost of 0 or with a cost of 8 or more ..." */
const CATALOG: CardCatalog = {
  ...TEST_CATALOG,
  "TEST-COST-CHECK": {
    id: "TEST-COST-CHECK",
    name: "Test Cost Check",
    category: "character",
    colors: ["black"],
    cost: 5,
    power: 6000,
    effects: [
      {
        timing: "permanent",
        conditions: [
          {
            anyOf: [
              { count: { side: "self", filter: { costAtMost: 0 } } },
              { count: { side: "opponent", filter: { costAtMost: 0 } } },
              { count: { side: "self", filter: { costAtLeast: 8 } } },
              { count: { side: "opponent", filter: { costAtLeast: 8 } } },
            ],
          },
        ],
        steps: [{ do: "grantKeyword", target: { side: "this" }, keyword: "rushCharacter" }],
      },
    ],
  },
};

describe("permanent effects", () => {
  it("works out costs quickly when many Characters check other Characters' costs", () => {
    const five = Array.from({ length: 5 }, () => "TEST-COST-CHECK");
    const state = buildScenarioState(
      { p1: { characters: five }, p2: { characters: five } },
      CATALOG,
    );
    const start = Date.now();
    for (const card of state.players.p1.characters) expect(costOf(state, card)).toBe(5);
    // Before the fix this took minutes, because each cost re-checked every other cost.
    expect(Date.now() - start).toBeLessThan(2000);
  });
});
