import type { CardDefinition } from "../../src/index.js";

const draw = { do: "draw", count: 1 } as const;

/** Made-up cards for the effect blocks added for set OP-11. */
export const OP11_EFFECT_CARDS: CardDefinition[] = [
  {
    id: "TEST-SPECIAL-SHIELD",
    name: "Test Special Shield",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        steps: [
          {
            do: "grantStatus",
            target: { side: "this" },
            status: "cannotBeKOdByNonSpecialCharacters",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-SPECIAL-KO",
    name: "Test Special K.O.",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    attribute: "Special",
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "ko", target: { side: "opponent", filter: { costAtMost: 3 }, upTo: true } }],
      },
    ],
  },
  {
    id: "TEST-REST-SHIELD",
    name: "Test Rest Shield",
    category: "character",
    colors: ["blue"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        steps: [
          {
            do: "grantStatus",
            target: { side: "this" },
            status: "cannotBeRestedByOpponentsEffects",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-ONPLAY-REST",
    name: "Test On Play Rest",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      { timing: "onPlay", steps: [{ do: "rest", target: { side: "opponent", upTo: true } }] },
    ],
  },
  {
    id: "TEST-OPP-RESTED",
    name: "Test Opponent Rested",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        conditions: [{ opponentRestedCardsAtLeast: 3 }],
        steps: [draw],
      },
    ],
  },
  {
    id: "TEST-START-TURN",
    name: "Test Start of Turn",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "startOfYourTurn", steps: [{ do: "trashFromDeck", count: 1 }] }],
  },
  {
    id: "TEST-LIFE-WATCH",
    name: "Test Life Watch",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "lifeCardRemoved", steps: [draw] }],
  },
  {
    id: "TEST-LOOK-OPP",
    name: "Test Look Opponent",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "activateMain", steps: [{ do: "lookAtOpponentDeckTop" }, draw] }],
  },
  {
    id: "TEST-GUESS",
    name: "Test Guess Cost",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "activateMain", steps: [{ do: "guessCost", steps: [draw] }] }],
  },
  {
    id: "TEST-LEADER-COLOR",
    name: "Test Leader Color",
    category: "event",
    colors: ["blue"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [{ do: "if", conditions: [{ leaderColorIncludes: "red" }], steps: [draw] }],
      },
    ],
  },
  {
    id: "TEST-SLASH-WATCH",
    name: "Test Slash Watch",
    category: "character",
    colors: ["black"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onOpponentsAttack",
        conditions: [{ attackerMatches: { category: "character", attribute: "Slash" } }],
        steps: [draw],
      },
    ],
  },
  {
    id: "TEST-SLASH",
    name: "Test Slash",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 5000,
    attribute: "Slash",
  },
  {
    id: "TEST-OPP-TRIGGER-WATCH",
    name: "Test Opponent Trigger Watch",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "opponentActivatesTrigger", steps: [draw] }],
  },
  {
    id: "TEST-TOTAL-LIFE-MIN",
    name: "Test Total Life Minimum",
    category: "event",
    colors: ["yellow"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [{ do: "if", conditions: [{ totalLifeAtLeast: 5 }], steps: [draw] }],
      },
    ],
  },
  {
    id: "TEST-PLAY-THEN-BOTTOM",
    name: "Test Play Then Bottom",
    category: "character",
    colors: ["black"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          { do: "playFromHand", filter: { name: "Test Filler" } },
          {
            do: "atEndOfTurn",
            steps: [{ do: "returnToDeckBottom", target: { side: "that" } }],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-HAND-TOP-OR-BOTTOM",
    name: "Test Hand Top or Bottom",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "onPlay", steps: [{ do: "handToDeckTop", count: 2, topOrBottom: true }] }],
  },
  {
    id: "TEST-TRASH-EVENTS-BOTTOM",
    name: "Test Trash Events Bottom",
    category: "character",
    colors: ["black"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          { do: "trashToDeckBottom", side: "opponent", count: 2, filter: { category: "event" } },
        ],
      },
    ],
  },
  {
    id: "TEST-LIFE-TOP",
    name: "Test Life Top",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "characterToLife", target: { side: "opponent", upTo: true }, top: true }],
      },
    ],
  },
];
