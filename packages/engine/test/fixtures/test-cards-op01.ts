import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for set OP-01. */
export const OP01_EFFECT_CARDS: CardDefinition[] = [
  {
    id: "TEST-CYCLE",
    name: "Test Cycle",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        optional: true,
        costs: [
          {
            handToDeckBottom: 1,
          },
        ],
        steps: [
          {
            do: "draw",
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-REST-TWO",
    name: "Test Rest Two",
    category: "event",
    colors: ["green"],
    cost: 0,
    effects: [
      {
        timing: "main",
        optional: true,
        costs: [
          {
            restCharacters: 2,
          },
        ],
        steps: [
          {
            do: "draw",
            count: 2,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-WAKE-IT",
    name: "Test Wake It",
    category: "event",
    colors: ["green"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "setActive",
            target: {
              side: "self",
              upTo: true,
            },
          },
          {
            do: "powerUp",
            target: {
              side: "that",
            },
            amount: 1000,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-SWAP-COLOR",
    name: "Test Swap Color",
    category: "event",
    colors: ["green"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "returnToHand",
            target: {
              side: "self",
            },
          },
          {
            do: "playFromHand",
            filter: {
              category: "character",
            },
            differentColor: true,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-EVENT-WATCHER",
    name: "Test Event Watcher",
    category: "character",
    colors: ["blue"],
    cost: 2,
    power: 3000,
    effects: [
      {
        timing: "opponentActivatesEvent",
        steps: [
          {
            do: "draw",
            count: 1,
          },
        ],
      },
      {
        timing: "youActivateEvent",
        optional: true,
        steps: [
          {
            do: "draw",
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-KO-WATCHER-OP01",
    name: "Test K.O. Watcher",
    category: "character",
    colors: ["purple"],
    cost: 2,
    power: 3000,
    effects: [
      {
        timing: "opponentCharacterKOd",
        steps: [
          {
            do: "addDon",
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-STRIKER",
    name: "Test Striker",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 6000,
    attribute: "Strike",
  },
  {
    id: "TEST-STRIKE-PROOF",
    name: "Test Strike Proof",
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
            target: {
              side: "this",
            },
            status: "cannotBeKOdInBattle",
            by: {
              attribute: "Strike",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-BLIND-TRASH",
    name: "Test Blind Trash",
    category: "event",
    colors: ["green"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "trashFromHand",
            count: 1,
            chooser: "opponent",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LURE",
    name: "Test Lure",
    category: "character",
    colors: ["green"],
    cost: 3,
    power: 5000,
    effects: [
      {
        timing: "permanent",
        conditions: [
          {
            opponentsTurn: true,
          },
          {
            thisRested: true,
          },
        ],
        steps: [
          {
            do: "grantStatus",
            target: {
              side: "this",
            },
            status: "onlyAttackTarget",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-PEEK",
    name: "Test Peek",
    category: "event",
    colors: ["blue"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "revealOpponentHand",
            count: 1,
            ifRevealed: {
              category: "event",
            },
            steps: [
              {
                do: "lifeToDeckBottom",
                side: "opponent",
                count: 1,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-EVENT-DISCOUNT",
    name: "Test Event Discount",
    category: "character",
    colors: ["blue"],
    cost: 3,
    power: 4000,
    effects: [
      {
        timing: "permanent",
        steps: [
          {
            do: "handCostChange",
            filter: {
              category: "event",
            },
            amount: -1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-EVENT-C1",
    name: "Test Cost 1 Event",
    category: "event",
    colors: ["blue"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "draw",
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-BIG-HAND",
    name: "Test Big Hand",
    category: "character",
    colors: ["blue"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        conditions: [
          {
            handAtLeast: 3,
          },
        ],
        steps: [
          {
            do: "grantKeyword",
            target: {
              side: "this",
            },
            keyword: "doubleAttack",
          },
        ],
      },
      {
        timing: "permanent",
        steps: [
          {
            do: "powerUp",
            target: {
              side: "this",
            },
            amount: 1000,
            per: {
              zone: "hand",
            },
          },
        ],
      },
      {
        timing: "permanent",
        steps: [
          {
            do: "powerUp",
            target: {
              side: "this",
            },
            amount: 1000,
            per: {
              zone: "trash",
              filter: {
                category: "event",
              },
              every: 2,
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-TUTOR",
    name: "Test Tutor",
    category: "event",
    colors: ["purple"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "searchWholeDeck",
            filter: {
              name: "Test 5000",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-TUTOR-PLAY",
    name: "Test Tutor Play",
    category: "event",
    colors: ["purple"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "searchWholeDeck",
            filter: {
              category: "character",
              costAtMost: 4,
            },
            play: true,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-SEARCH-PLAY-OP01",
    name: "Test Search Play",
    category: "event",
    colors: ["purple"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "searchDeck",
            look: 3,
            take: 1,
            filter: {
              category: "character",
            },
            rest: "trash",
            play: true,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-ALIAS-OP01",
    name: "Test Alias",
    category: "character",
    colors: ["green"],
    cost: 2,
    power: 3000,
    aliases: ["Test 5000"],
  },
  {
    id: "TEST-ANY-NUMBER",
    name: "Test Any Number",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    anyNumberInDeck: true,
  },
  {
    id: "TEST-HIT-AND-RUN",
    name: "Test Hit and Run",
    category: "character",
    colors: ["blue"],
    cost: 3,
    power: 6000,
    effects: [
      {
        timing: "whenAttacking",
        steps: [
          {
            do: "atEndOfBattle",
            steps: [
              {
                do: "returnToDeckBottom",
                target: {
                  side: "this",
                },
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-DISCOUNT-NEXT",
    name: "Test Discount Next",
    category: "event",
    colors: ["green"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "nextPlayCostChange",
            filter: {
              category: "character",
              costAtLeast: 3,
            },
            amount: -1,
          },
        ],
      },
    ],
  },
];
