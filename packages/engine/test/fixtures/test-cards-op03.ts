import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for set OP-03. */
export const OP03_EFFECT_CARDS: CardDefinition[] = [
  {
    id: "TEST-DECK-AT-MOST",
    name: "Test Deck At Most",
    category: "character",
    colors: ["blue"],
    cost: 2,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        conditions: [
          {
            deckAtMost: 20,
          },
        ],
        steps: [
          {
            do: "powerUp",
            target: {
              side: "this",
            },
            amount: 2000,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LIFE-LESS",
    name: "Test Life Less",
    category: "event",
    colors: ["yellow"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "if",
            conditions: [
              {
                lifeLessThanOpponents: true,
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
    ],
  },
  {
    id: "TEST-LEADER-ATTACKED",
    name: "Test Attacked Leader",
    category: "leader",
    colors: ["red"],
    power: 5000,
    life: 4,
    effects: [
      {
        timing: "onOpponentsAttack",
        conditions: [
          {
            thisIsAttackTarget: true,
          },
        ],
        steps: [
          {
            do: "powerUp",
            target: {
              side: "this",
            },
            amount: 1000,
            duration: "battle",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-DAMAGE-WATCHER",
    name: "Test Damage Watcher",
    category: "character",
    colors: ["blue"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "youDealDamage",
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
    id: "TEST-TRASH-LIFE-END",
    name: "Test Trash Life End",
    category: "event",
    colors: ["yellow"],
    cost: 0,
    effects: [
      {
        timing: "main",
        optional: true,
        costs: [
          {
            trashLife: 1,
            from: "topOrBottom",
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
    id: "TEST-SEARCH-TO-TRASH",
    name: "Test Search To Trash",
    category: "event",
    colors: ["black"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "searchDeck",
            look: 3,
            take: 2,
            to: "trash",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-SET-COST",
    name: "Test Set Cost",
    category: "event",
    colors: ["black"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "setCost",
            target: {
              side: "opponent",
              upTo: true,
            },
            cost: 0,
          },
        ],
      },
    ],
  },
];
