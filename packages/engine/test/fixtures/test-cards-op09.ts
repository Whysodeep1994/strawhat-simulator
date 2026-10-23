import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for set OP-09. */
export const OP09_EFFECT_CARDS: CardDefinition[] = [
  {
    id: "TEST-NEGATE-KO",
    name: "Test Negate K.O.",
    category: "event",
    colors: ["black"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          { do: "grantStatus", target: { side: "opponent", upTo: true }, status: "negated" },
          { do: "ko", target: { side: "chosen", filter: { costAtMost: 3 } } },
        ],
      },
    ],
  },
  {
    id: "TEST-TOTAL-POWER",
    name: "Test Total Power",
    category: "event",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "ko",
            target: { side: "opponent", count: 2, upTo: true, totalPowerAtMost: 4000 },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LEADER-RESTED",
    name: "Test Rested Leader",
    category: "leader",
    colors: ["green"],
    life: 4,
    power: 5000,
    effects: [{ timing: "permanent", steps: [{ do: "playRested" }] }],
  },
  {
    id: "TEST-NOT-BY-LEADERS",
    name: "Test Not By Leaders",
    category: "character",
    colors: ["green"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "permanent",
        steps: [
          { do: "grantStatus", target: { side: "this" }, status: "cannotBeKOdInBattleByLeaders" },
        ],
      },
    ],
  },
  {
    id: "TEST-MILL-SAME",
    name: "Test Mill Same",
    category: "event",
    colors: ["blue"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          { do: "trashFromHand", count: 2, upTo: true },
          { do: "trashFromDeck", count: 0, perPrevious: true },
        ],
      },
    ],
  },
  {
    id: "TEST-HAND-BOTTOM-COST",
    name: "Test Hand Bottom Cost",
    category: "stage",
    colors: ["blue"],
    cost: 1,
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [{ handToDeckBottom: 2 }, { restThis: true }],
        steps: [{ do: "draw", count: 2 }],
      },
    ],
  },
  {
    id: "TEST-MORE-DON",
    name: "Test More DON",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        conditions: [{ opponentHasMoreDon: true }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-HAND-GAP",
    name: "Test Hand Gap",
    category: "character",
    colors: ["black"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        conditions: [{ opponentHandAtLeast: 5 }, { handFewerThanOpponentBy: 3 }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-TOTAL-LIFE",
    name: "Test Total Life",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 1000,
    effects: [
      { timing: "onPlay", conditions: [{ totalLifeAtMost: 5 }], steps: [{ do: "draw", count: 1 }] },
    ],
  },
  {
    id: "TEST-CREW-WATCH",
    name: "Test Crew Watch",
    category: "stage",
    colors: ["purple"],
    cost: 1,
    effects: [
      {
        timing: "characterRemovedByOpponent",
        removed: { type: "Test Crew" },
        conditions: [{ opponentsTurn: true }],
        optional: true,
        costs: [{ restThis: true }],
        steps: [{ do: "addDon", count: 1, rested: true }],
      },
    ],
  },
  {
    id: "TEST-COMEBACK",
    name: "Test Comeback",
    category: "character",
    colors: ["blue"],
    cost: 3,
    power: 5000,
    effects: [{ timing: "koByOpponentsEffect", steps: [{ do: "playThis", rested: true }] }],
  },
  {
    id: "TEST-BLOCK-WIN",
    name: "Test Block Win",
    category: "character",
    colors: ["red"],
    cost: 10,
    power: 13000,
    effects: [
      {
        timing: "onOpponentsBlock",
        conditions: [{ anyOf: [{ lifeAtMost: 0 }, { opponentLifeAtMost: 0 }] }],
        steps: [{ do: "winGame" }],
      },
    ],
  },
  {
    id: "TEST-PLAY-THEN-DRAW",
    name: "Test Play Then Draw",
    category: "character",
    colors: ["yellow"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "playFromHand",
            filter: { costAtMost: 2 },
            ifYouDo: [{ do: "draw", count: 1 }],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-HAND-TO-LIFE",
    name: "Test Hand To Life",
    category: "character",
    colors: ["yellow"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          { do: "handToLife", faceUp: true },
          { do: "lifeToHand", count: 1, from: "topOrBottom" },
        ],
      },
    ],
  },
];
