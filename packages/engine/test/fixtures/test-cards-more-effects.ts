import type { CardDefinition } from "../../src/index.js";

/** Made-up cards for the effect blocks added for starter decks ST-15 to ST-17. */
export const MORE_EFFECT_CARDS: CardDefinition[] = [
  {
    id: "TEST-RETURN-ANY",
    name: "Test Return Any",
    category: "event",
    colors: ["blue"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          { do: "returnToHand", target: { side: "any", filter: { costAtMost: 3 }, upTo: true } },
        ],
      },
    ],
  },
  {
    id: "TEST-TRASH-CREW-COST",
    name: "Test Trash Crew Cost",
    category: "character",
    colors: ["green"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [{ trashFromHand: 1, filter: { type: "Test Crew" } }],
        steps: [{ do: "draw", count: 2 }],
      },
    ],
  },
  {
    id: "TEST-HAND-TO-DECK",
    name: "Test Hand To Deck",
    category: "character",
    colors: ["blue"],
    cost: 2,
    power: 3000,
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        optional: true,
        costs: [{ handToDeckTop: 1 }],
        steps: [{ do: "giveRestedDon", target: { side: "self", zone: "leader" }, count: 2 }],
      },
    ],
  },
  {
    id: "TEST-RETURN-OWN-COST",
    name: "Test Return Own Cost",
    category: "character",
    colors: ["blue"],
    cost: 3,
    power: 4000,
    effects: [
      {
        timing: "onPlay",
        optional: true,
        costs: [{ returnOwnCharacter: 1 }],
        steps: [{ do: "draw", count: 2 }],
      },
    ],
  },
  {
    id: "TEST-REST-OWN",
    name: "Test Rest Own",
    category: "event",
    colors: ["green"],
    cost: 1,
    effects: [
      {
        timing: "main",
        optional: true,
        costs: [{ restOwn: { name: "Test Leader" } }],
        steps: [{ do: "restOpponentDon", count: 2 }],
      },
    ],
  },
  {
    id: "TEST-NO-LIFE",
    name: "Test No Life",
    category: "event",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [{ do: "noLifeToHand" }, { do: "lifeToHand", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-TRASH-TO-HAND",
    name: "Test Trash To Hand",
    category: "character",
    colors: ["blue"],
    cost: 4,
    power: 5000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "trashToHand", filter: { category: "character", costAtMost: 2 } }],
      },
    ],
  },
  {
    id: "TEST-ARRANGE",
    name: "Test Arrange",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 2000,
    effects: [{ timing: "onPlay", steps: [{ do: "arrangeDeckTop", look: 3 }] }],
  },
  {
    id: "TEST-ARRANGE-BOTTOM",
    name: "Test Arrange Bottom",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 2000,
    effects: [{ timing: "onPlay", steps: [{ do: "arrangeDeckTop", look: 3, bottom: true }] }],
  },
  {
    id: "TEST-SEARCH-TOP-BOTTOM",
    name: "Test Search Top Bottom",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "searchDeck",
            look: 2,
            take: 1,
            filter: { type: "Test Crew" },
            rest: "topOrBottom",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-PLAY-DECK-TOP",
    name: "Test Play Deck Top",
    category: "character",
    colors: ["blue"],
    cost: 3,
    power: 4000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "playFromDeckTop", filter: { costAtMost: 4 }, rested: true }],
      },
    ],
  },
  {
    id: "TEST-REVEAL-DRAW",
    name: "Test Reveal Draw",
    category: "character",
    colors: ["blue"],
    cost: 4,
    power: 5000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "if",
            conditions: [{ deckTopMatches: { type: "Test Crew" } }],
            steps: [
              { do: "draw", count: 2 },
              { do: "handToDeckTop", count: 1 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-ONKO-COMEBACK",
    name: "Test On K.O. Comeback",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 5000,
    effects: [{ timing: "onKO", steps: [{ do: "playThis", rested: true }] }],
  },
  {
    id: "TEST-KO-BY-EFFECT",
    name: "Test K.O. By Effect",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    effects: [
      {
        timing: "koByEffect",
        steps: [
          { do: "powerUp", target: { side: "self", zone: "leader", upTo: true }, amount: 2000 },
        ],
      },
    ],
  },
  {
    id: "TEST-KO-EVENT",
    name: "Test K.O. Event",
    category: "event",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [{ do: "ko", target: { side: "opponent", upTo: true } }],
      },
    ],
  },
  {
    id: "TEST-CHOOSE-ONE",
    name: "Test Choose One",
    category: "event",
    colors: ["green"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "chooseOne",
            options: [
              { label: "Draw 1 card", steps: [{ do: "draw", count: 1 }] },
              {
                label: "K.O. up to 1 of your opponent's rested Characters",
                steps: [
                  { do: "ko", target: { side: "opponent", filter: { rested: true }, upTo: true } },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-OPPONENT-CHOOSES",
    name: "Test Opponent Chooses",
    category: "event",
    colors: ["yellow"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "chooseOne",
            chooser: "opponent",
            options: [
              { label: "Your opponent draws 2 cards", steps: [{ do: "draw", count: 2 }] },
              {
                label: "Your opponent adds DON!!",
                steps: [{ do: "addDon", count: 1 }],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-PER-TRASHED",
    name: "Test Per Trashed",
    category: "event",
    colors: ["green"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          { do: "trashFromHand", count: 5, upTo: true, filter: { type: "Test Crew" } },
          {
            do: "powerUp",
            target: { side: "self", zone: "leader" },
            amount: 1000,
            perPrevious: true,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-AT-END",
    name: "Test At End Of Turn",
    category: "event",
    colors: ["green"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "atEndOfTurn",
            steps: [{ do: "setActive", target: { side: "self", count: 5 } }],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-DON-RETURN-LEADER",
    name: "Test DON!! Return Leader",
    category: "leader",
    colors: ["purple", "black"],
    power: 5000,
    life: 4,
    effects: [
      {
        timing: "donReturned",
        returnedAtLeast: 2,
        conditions: [{ yourTurn: true }],
        oncePerTurn: true,
        steps: [
          { do: "addDon", count: 1 },
          { do: "addDon", count: 1, rested: true },
        ],
      },
    ],
  },
  {
    id: "TEST-DON-MINUS-OR-MORE",
    name: "Test Return 1 or More DON!!",
    category: "character",
    colors: ["purple"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "activateMain",
        costs: [{ donMinus: 1, orMore: true }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-BASE-POWER",
    name: "Test Base Power",
    category: "character",
    colors: ["purple"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "activateMain",
        steps: [
          {
            do: "if",
            conditions: [{ leaderMulticolored: true }, { opponentDonOnFieldAtLeast: 5 }],
            steps: [
              {
                do: "setBasePower",
                target: { side: "self", zone: "leader" },
                power: 7000,
                duration: "opponentsNextTurn",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-COUNTER-DON-MINUS",
    name: "Test Counter DON!! Minus",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "counter",
        costs: [{ donMinus: 2 }],
        steps: [
          {
            do: "powerUp",
            target: { side: "self", zone: "leader" },
            amount: 4000,
            duration: "battle",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-REVEAL-LEADER",
    name: "Test Reveal Leader",
    category: "leader",
    colors: ["blue"],
    power: 5000,
    life: 4,
    types: ["Test Crew Pirates"],
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        optional: true,
        costs: [{ revealFromHand: 1, filter: { typeIncludes: "Test Crew" } }],
        steps: [{ do: "draw", count: 1 }, { do: "revealedToDeckTop" }],
      },
    ],
  },
  {
    id: "TEST-HAND-TO-BOTTOM",
    name: "Test Hand To Bottom",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        conditions: [{ leaderTypeIncludes: "Test Crew" }],
        steps: [
          { do: "draw", count: 1 },
          { do: "handToDeckBottom", count: 1 },
        ],
      },
    ],
  },
  {
    id: "TEST-RETURN-OTHER",
    name: "Test Return Other",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        costs: [{ returnOwnCharacter: 1, filter: { notThis: true } }],
        steps: [{ do: "lifeToHand", count: 1, fromBottom: true }],
      },
    ],
  },
  {
    id: "TEST-LEADER-BLOCKER",
    name: "Test Leader Blocker",
    category: "leader",
    colors: ["green"],
    power: 5000,
    life: 4,
    keywords: ["blocker"],
  },
  {
    id: "TEST-SAVE-IN-BATTLE",
    name: "Test Save In Battle",
    category: "character",
    colors: ["green"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "replaceRemoval",
        replaces: { side: "this", removal: "ko", battle: true },
        optional: true,
        costs: [{ trashFromHand: 1 }],
        steps: [{ do: "powerUp", target: { side: "that" }, amount: -1000 }],
      },
    ],
  },
  {
    id: "TEST-EXTRA-TURN",
    name: "Test Extra Turn",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "activateMain", steps: [{ do: "extraTurn" }] }],
  },
  {
    id: "TEST-HAND-DOWN",
    name: "Test Hand Down",
    category: "character",
    colors: ["blue"],
    cost: 1,
    power: 1000,
    effects: [{ timing: "onPlay", steps: [{ do: "handDownTo", count: 1, both: true }] }],
  },
  {
    id: "TEST-LIFE-COMPARE",
    name: "Test Life Compare",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        conditions: [{ lifeAtMostOpponents: true }],
        steps: [
          { do: "handToLife", count: 1 },
          {
            do: "ko",
            target: { side: "opponent", filter: { costAtMostTotalLife: true }, upTo: true },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LEADER-KO-WATCH",
    name: "Test Leader K.O. Watch",
    category: "leader",
    colors: ["black"],
    power: 5000,
    life: 5,
    effects: [
      {
        timing: "characterKOd",
        conditions: [{ yourTurn: true }],
        steps: [{ do: "giveRestedDon", target: { side: "this" }, count: 1 }],
      },
    ],
  },
  {
    id: "TEST-LEADER-VANILLA-BOOST",
    name: "Test Leader Vanilla Boost",
    category: "leader",
    colors: ["red"],
    power: 5000,
    life: 5,
    effects: [
      {
        timing: "activateMain",
        steps: [
          {
            do: "powerUp",
            target: { side: "self", filter: { noBaseEffect: true }, upTo: true },
            amount: 2000,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LEADER-LIFE-COST",
    name: "Test Leader Character to Life Cost",
    category: "leader",
    colors: ["yellow"],
    power: 5000,
    life: 4,
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [{ characterToLife: 1, filter: { costAtLeast: 5 }, faceUp: true }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-LEADER-FACE-UP-RULES",
    name: "Test Leader Face-Up Rules",
    category: "leader",
    colors: ["yellow"],
    power: 5000,
    life: 4,
    effects: [
      { timing: "permanent", steps: [{ do: "faceUpLifeToDeckBottom" }] },
      {
        timing: "activateMain",
        steps: [
          {
            do: "handToLife",
            count: 2,
            fromTrash: true,
            faceUp: true,
            filter: { category: "character", costAtLeast: 5, costAtMost: 5 },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-TRASH-FACE-UP",
    name: "Test Trash Face-Up Life",
    category: "event",
    colors: ["yellow"],
    cost: 1,
    effects: [{ timing: "main", steps: [{ do: "trashFaceUpLife" }] }],
  },
  {
    id: "TEST-SEARCH-TO-LIFE",
    name: "Test Search to Life",
    category: "event",
    colors: ["yellow"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "searchDeck",
            look: 5,
            take: 1,
            filter: { category: "character", costAtLeast: 5, costAtMost: 5 },
            to: "lifeFaceUp",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-LEADER-EAST",
    name: "Test Leader East",
    category: "leader",
    colors: ["red"],
    power: 5000,
    life: 5,
    effects: [
      {
        timing: "permanent",
        steps: [{ do: "deckOnlyType", type: "Test Crew" }, { do: "winOnDeckOut" }],
      },
      { timing: "attackDealsDamage", optional: true, steps: [{ do: "trashDeckTop", count: 1 }] },
    ],
  },
  {
    id: "TEST-LEADER-SLASH",
    name: "Test Leader Slash",
    category: "leader",
    colors: ["green"],
    power: 5000,
    life: 4,
    attribute: "Slash",
  },
  {
    id: "TEST-ONE-OF-COST",
    name: "Test One Of Cost",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        optional: true,
        costs: [
          { oneOf: [{ restOwn: { category: "leader", attribute: "Slash" } }, { restDon: 1 }] },
        ],
        steps: [
          { do: "draw", count: 2 },
          { do: "trashFromHand", count: 1 },
        ],
      },
    ],
  },
  {
    id: "TEST-TRASHED-DISCOUNT",
    name: "Test Trashed Discount",
    category: "character",
    colors: ["blue"],
    cost: 6,
    power: 6000,
    effects: [
      {
        timing: "permanent",
        zone: "hand",
        conditions: [{ handTrashedByEffectThisTurn: true }],
        steps: [{ do: "costChange", target: { side: "this" }, amount: -3 }],
      },
    ],
  },
  {
    id: "TEST-GIVEN-DON",
    name: "Test Given DON",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        conditions: [{ givenDonAtLeast: 3 }],
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 3000 }],
      },
    ],
  },
  {
    id: "TEST-PER-COUNT",
    name: "Test Per Count",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "powerUp",
            target: { side: "opponent", upTo: true },
            amount: -1000,
            perCount: { side: "self", zone: "field" },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-NO-REST",
    name: "Test No Rest",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "grantStatus",
            target: { side: "opponent" },
            status: "cannotBeRested",
            duration: "opponentsNextTurn",
          },
          { do: "rest", target: { side: "opponent", upTo: true } },
        ],
      },
    ],
  },
  {
    id: "TEST-BECOMES-RESTED",
    name: "Test Becomes Rested",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "becomesRested",
        conditions: [{ yourTurn: true }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-DECK-TRASH",
    name: "Test Deck Trash",
    category: "character",
    colors: ["black"],
    cost: 3,
    power: 4000,
    effects: [
      {
        timing: "whenAttacking",
        optional: true,
        costs: [{ trashFromDeckTop: 2 }],
        steps: [
          {
            do: "if",
            conditions: [{ opponentHandAtLeast: 7 }],
            steps: [{ do: "opponentTrashesFromHand", count: 1 }],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-REDIRECT",
    name: "Test Redirect",
    category: "character",
    colors: ["yellow"],
    cost: 6,
    power: 7000,
    effects: [
      {
        timing: "onOpponentsAttack",
        oncePerTurn: true,
        optional: true,
        costs: [{ lifeFaceDown: 1, from: "topOrBottom" }],
        steps: [{ do: "redirectAttack", target: { side: "self", filter: { name: "Test 6000" } } }],
      },
      {
        timing: "activateMain",
        oncePerTurn: true,
        optional: true,
        costs: [{ lifeFaceUp: 1, from: "topOrBottom" }],
        steps: [{ do: "giveRestedDon", target: { side: "self", zone: "leader" }, count: 1 }],
      },
    ],
  },
];
