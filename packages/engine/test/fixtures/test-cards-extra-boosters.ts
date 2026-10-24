import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for Extra Boosters. */
export const EXTRA_BOOSTER_CARDS: CardDefinition[] = [
  {
    id: "TEST-WANO-LEADER",
    name: "Test Counter Leader",
    category: "leader",
    colors: ["red"],
    power: 5000,
    life: 4,
    effects: [
      {
        timing: "permanent",
        steps: [
          {
            do: "grantCounter",
            target: {
              side: "self",
              filter: {
                category: "character",
                noCounter: true,
              },
            },
            amount: 1000,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-SEARCH-PLAY",
    name: "Test Search and Play",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "searchDeck",
            look: 3,
            take: 1,
            play: true,
            filter: {
              costAtMost: 2,
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-MERRY",
    name: "Test Merry",
    category: "stage",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [
          {
            restThis: true,
          },
          {
            returnOwnCharacter: 1,
            filter: {
              basePowerAtMost: 1000,
            },
            to: "deckBottom",
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
    id: "TEST-OTHER-COLOR",
    name: "Test Other Color",
    category: "event",
    colors: ["red"],
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
            differentColor: true,
            filter: {
              costAtMost: 2,
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-RESTED-DON-POWER",
    name: "Test Rested DON Power",
    category: "character",
    colors: ["green"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        steps: [
          {
            do: "powerUp",
            target: {
              side: "this",
            },
            amount: 1000,
            perRestedDon: 3,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-EVENT-POWER",
    name: "Test Event Power",
    category: "character",
    colors: ["blue"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        steps: [
          {
            do: "powerUp",
            target: {
              side: "this",
            },
            amount: 1000,
            perTrash: 2,
            trashFilter: {
              category: "event",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-OPP-RETURNS",
    name: "Test Opponent Returns",
    category: "event",
    colors: ["blue"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "returnToHand",
            target: {
              side: "opponent",
              filter: {
                rested: false,
              },
              chooser: "opponent",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-TOP-TO-BOTTOM",
    name: "Test Top to Bottom",
    category: "event",
    colors: ["blue"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "deckTopToBottom",
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LOGUE",
    name: "Test Logue",
    category: "stage",
    colors: ["blue"],
    cost: 1,
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [
          {
            thisToDeckBottom: true,
          },
          {
            handToDeckBottom: 1,
          },
        ],
        steps: [
          {
            do: "draw",
            count: 2,
          },
        ],
      },
      {
        timing: "trigger",
        steps: [
          {
            do: "playThis",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-HAND-OR-TRASH",
    name: "Test Hand or Trash",
    category: "event",
    colors: ["purple"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "playFromHand",
            orTrash: true,
            filter: {
              name: "Test 6000",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-EB-REDIRECT",
    name: "Test Redirect",
    category: "event",
    colors: ["purple"],
    cost: 0,
    effects: [
      {
        timing: "counter",
        steps: [
          {
            do: "redirectAttack",
            target: {
              side: "self",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-KO-WATCHER",
    name: "Test K.O. Watcher",
    category: "character",
    colors: ["black"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "characterKOd",
        oncePerTurn: true,
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
    id: "TEST-OPP-KO-LIFE",
    name: "Test Opponent K.O. Life",
    category: "character",
    colors: ["yellow"],
    cost: 2,
    power: 1000,
    effects: [
      {
        timing: "koByOpponentsEffect",
        steps: [
          {
            do: "deckToLife",
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-EB-DECK-TRASH",
    name: "Test Deck Trash",
    category: "event",
    colors: ["black"],
    cost: 0,
    effects: [
      {
        timing: "main",
        optional: true,
        costs: [
          {
            trashFromDeckTop: 2,
          },
        ],
        steps: [
          {
            do: "if",
            conditions: [
              {
                trashAtLeast: 3,
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
    id: "TEST-LIFE-ORDER",
    name: "Test Life Order",
    category: "event",
    colors: ["yellow"],
    cost: 0,
    effects: [
      {
        timing: "main",
        costs: [
          {
            lifeFaceUp: 1,
          },
        ],
        steps: [
          {
            do: "reorderLife",
            side: "opponent",
          },
          {
            do: "allLifeFaceDown",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LIFE-DOWN",
    name: "Test Life Down",
    category: "event",
    colors: ["yellow"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "trashLifeDownTo",
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-COPY-POWER",
    name: "Test Copy Power",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "whenAttacking",
        steps: [
          {
            do: "copyPower",
            target: {
              side: "opponent",
              upTo: true,
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LEADER-COST",
    name: "Test Leader Cost",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 3000,
    effects: [
      {
        timing: "whenAttacking",
        optional: true,
        costs: [
          {
            activeLeaderPower: -5000,
          },
        ],
        steps: [
          {
            do: "powerUp",
            target: {
              side: "opponent",
              upTo: true,
            },
            amount: -3000,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-ALIAS",
    name: "Test Alias",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    aliases: ["Test 6000"],
  },
  {
    id: "TEST-PLAY-6000",
    name: "Test Play 6000",
    category: "event",
    colors: ["green"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "playFromHand",
            filter: {
              name: "Test 6000",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-ONLY-CREW",
    name: "Test Only Crew",
    category: "event",
    colors: ["green"],
    cost: 0,
    effects: [
      {
        timing: "main",
        conditions: [
          {
            count: {
              side: "self",
              filter: {
                notType: "Test Crew",
              },
            },
            atMost: 0,
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
    id: "TEST-PUMP-FREEZE",
    name: "Test Pump and Freeze",
    category: "event",
    colors: ["green"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "powerUp",
            target: {
              side: "self",
              upTo: true,
            },
            amount: 6000,
          },
          {
            do: "grantStatus",
            target: {
              side: "that",
            },
            status: "noRefresh",
            duration: "opponentsNextTurn",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-BOUNCE-WATCH",
    name: "Test Bounce Watcher",
    category: "character",
    colors: ["blue"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "opponentCharacterReturned",
        conditions: [
          {
            yourTurn: true,
          },
        ],
        oncePerTurn: true,
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
    id: "TEST-BOUNCE-ANY",
    name: "Test Bounce Any",
    category: "event",
    colors: ["blue"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "returnToHand",
            target: {
              side: "any",
              upTo: true,
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-BATTLE-SAVE",
    name: "Test Battle Save",
    category: "event",
    colors: ["blue"],
    cost: 0,
    effects: [
      {
        timing: "counter",
        steps: [
          {
            do: "replaceBattleKO",
            effect: 1,
          },
        ],
      },
      {
        timing: "battleKOReplacement",
        optional: true,
        costs: [
          {
            trashFromHand: 1,
          },
        ],
        steps: [],
      },
    ],
  },
  {
    id: "TEST-DON-COMPARE",
    name: "Test DON Compare",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        conditions: [
          {
            donOnFieldAtMostOpponents: true,
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
    id: "TEST-SAME-NAME",
    name: "Test Same Name",
    category: "event",
    colors: ["purple"],
    cost: 0,
    effects: [
      {
        timing: "main",
        optional: true,
        costs: [
          {
            trashFromHand: 1,
            filter: {
              powerAtMost: 4000,
            },
          },
        ],
        steps: [
          {
            do: "playFromTrash",
            sameNameAsTrashed: true,
            filter: {
              basePowerAtLeast: 5000,
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-SAME-NAME-SMALL",
    name: "Test Twin",
    category: "character",
    colors: ["purple"],
    cost: 2,
    power: 3000,
  },
  {
    id: "TEST-SAME-NAME-BIG",
    name: "Test Twin",
    category: "character",
    colors: ["purple"],
    cost: 6,
    power: 7000,
  },
  {
    id: "TEST-ACTIVE-DON",
    name: "Test Active DON",
    category: "character",
    colors: ["purple"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "whenAttacking",
        oncePerTurn: true,
        optional: true,
        costs: [
          {
            returnActiveDon: 2,
          },
        ],
        steps: [
          {
            do: "setActive",
            target: {
              side: "this",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-MOVE-DON",
    name: "Test Move DON",
    category: "stage",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [
          {
            restThis: true,
          },
        ],
        steps: [
          {
            do: "moveGivenDon",
            target: {
              side: "self",
              filter: {
                type: "Test Crew",
              },
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-HAND-BOTTOM",
    name: "Test Hand to Bottom",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "onPlay", steps: [{ do: "opponentHandToDeckBottom", count: 1 }] }],
  },
  {
    id: "TEST-EVENT-REPLAY",
    name: "Test Event Replay",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "activateEventFromTrash", filter: { costAtMost: 7 } }],
      },
    ],
  },
  {
    id: "TEST-PING",
    name: "Test Ping",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "onPlay", steps: [{ do: "dealDamage", count: 1 }] }],
  },
  {
    id: "TEST-FACE-UP-KO",
    name: "Test Face-Up K.O.",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "if",
            conditions: [{ faceUpLifeAtLeast: 1 }],
            steps: [{ do: "ko", target: { side: "opponent", upTo: true } }],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-RUSH-NO-ATTACK-EFFECT",
    name: "Test Rush Without When Attacking",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "grantKeyword",
            target: { side: "self", filter: { lacksTiming: "whenAttacking" }, upTo: true },
            keyword: "rush",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-ONLY-TEST-CREW",
    name: "Test Only Test Crew",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    types: ["Test Crew"],
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "if",
            conditions: [
              { count: { side: "self", filter: { notTypeIncludes: "Test" } }, atMost: 0 },
            ],
            steps: [{ do: "draw", count: 1 }],
          },
        ],
      },
    ],
  },
];
