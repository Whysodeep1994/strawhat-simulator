import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for set OP-04. */
export const OP04_EFFECT_CARDS: CardDefinition[] = [
  {
    id: "TEST-DON-ACTIVE-AT-LEAST",
    name: "Test DON Active At Least",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "permanent",
        conditions: [{ donActiveAtLeast: 2 }],
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 1000 }],
      },
    ],
  },
  {
    id: "TEST-LIFE-AND-HAND",
    name: "Test Life And Hand",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        conditions: [{ lifeAndHandAtMost: 4 }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-IN-BATTLE-BOTTOM",
    name: "Test In Battle Bottom",
    category: "character",
    colors: ["blue"],
    cost: 5,
    power: 5000,
    effects: [
      {
        timing: "whenAttacking",
        steps: [
          {
            do: "atEndOfBattle",
            steps: [
              {
                do: "returnToDeckBottom",
                target: { side: "opponent", filter: { inBattle: true, costAtMost: 7 } },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-HAND-SHUFFLE-RETURNED",
    name: "Test Hand Shuffle Returned",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "handToDeckShuffle", side: "self", draw: "returned" }],
      },
    ],
  },
];
