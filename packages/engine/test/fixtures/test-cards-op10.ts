import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for set OP-10. */
export const OP10_EFFECT_CARDS: CardDefinition[] = [
  {
    id: "TEST-EVENT-WATCH",
    name: "Test Event Watch",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "youActivateEvent", steps: [{ do: "draw", count: 1 }] }],
  },
  {
    id: "TEST-TOTAL-COST",
    name: "Test Total Cost",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        conditions: [{ charactersTotalCostAtLeast: 5 }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-FEWER-CHARACTERS",
    name: "Test Fewer Characters",
    category: "event",
    colors: ["black"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "if",
            conditions: [{ charactersFewerThanOpponentBy: 2 }],
            steps: [{ do: "draw", count: 1 }],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LIFE-FEWER-RUSH",
    name: "Test Life Less",
    category: "character",
    colors: ["yellow"],
    cost: 3,
    power: 5000,
    effects: [
      {
        timing: "permanent",
        conditions: [{ lifeFewerThanOpponent: true }],
        steps: [{ do: "grantKeyword", target: { side: "this" }, keyword: "rush" }],
      },
    ],
  },
  {
    id: "TEST-BATTLE-ONLY-SAVE",
    name: "Test Battle Only Save",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "replaceRemoval",
        replaces: { side: "this", removal: "ko", battleOnly: true },
        optional: true,
        costs: [{ trashFromHand: 1 }],
        steps: [],
      },
    ],
  },
  {
    id: "TEST-LIFE-PLAY",
    name: "Test Life Play",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        steps: [{ do: "playFromLifeTop", filter: { category: "character", costAtMost: 5 } }],
      },
    ],
  },
  {
    id: "TEST-DON-LOCK",
    name: "Test DON!! Lock",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        steps: [{ do: "setDonActive", count: 1 }, { do: "noCharacterDonActive" }],
      },
    ],
  },
  {
    id: "TEST-DON-FREEZE",
    name: "Test DON!! Freeze",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "onPlay", steps: [{ do: "opponentDonNoRefresh", count: 1 }] }],
  },
];
