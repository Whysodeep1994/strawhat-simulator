import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for set OP-06. */
export const OP06_EFFECT_CARDS: CardDefinition[] = [
  {
    id: "TEST-NO-LEADER-ATTACK",
    name: "Test No Leader Attack",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 6000,
    keywords: ["rush"],
    effects: [{ timing: "onPlay", steps: [{ do: "cannotAttackLeader" }] }],
  },
  {
    id: "TEST-EVENT-WATCHER",
    name: "Test Event Watcher",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "opponentActivatesEvent",
        conditions: [{ yourTurn: true }],
        oncePerTurn: true,
        steps: [{ do: "handToDeckBottom", count: 1, side: "opponent" }],
      },
    ],
  },
  {
    id: "TEST-HAND-SHUFFLE",
    name: "Test Hand Shuffle",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [
      { timing: "onPlay", steps: [{ do: "handToDeckShuffle", side: "opponent", draw: 5 }] },
    ],
  },
  {
    id: "TEST-DON-FEWER",
    name: "Test DON Fewer",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        conditions: [{ donFewerThanOpponentBy: 2 }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-DEAL-DAMAGE",
    name: "Test Deal Damage",
    category: "event",
    colors: ["yellow"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          { do: "dealDamage", count: 1 },
          { do: "draw", count: 1 },
        ],
      },
    ],
  },
  {
    id: "TEST-STAGE-TRIGGER",
    name: "Test Stage Trigger",
    category: "stage",
    colors: ["green"],
    cost: 3,
    effects: [{ timing: "trigger", steps: [{ do: "playThis" }] }],
  },
  {
    id: "TEST-ANY-TO-BOTTOM",
    name: "Test Any To Bottom",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        costs: [{ toDeckBottom: 1, side: "any", filter: { costAtMost: 2 } }],
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 3000 }],
      },
    ],
  },
  {
    id: "TEST-TRASH-STAGE",
    name: "Test Trash Stage",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        costs: [{ trashOwnCharacter: 1, zone: "stage" }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
];
