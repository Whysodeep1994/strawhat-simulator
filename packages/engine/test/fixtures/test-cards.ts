import type { CardCatalog, CardDefinition } from "../../src/index.js";
import { EXTRA_BOOSTER_CARDS } from "./test-cards-extra-boosters.js";
import { MORE_EFFECT_CARDS } from "./test-cards-more-effects.js";
import { OP09_EFFECT_CARDS } from "./test-cards-op09.js";
import { OP10_EFFECT_CARDS } from "./test-cards-op10.js";

/** Made-up cards for engine tests. Real cards use their official card numbers instead. */
const cards: CardDefinition[] = [
  {
    id: "TEST-LEADER",
    name: "Test Leader",
    category: "leader",
    colors: ["red"],
    power: 5000,
    life: 5,
  },
  {
    id: "TEST-LEADER-RG",
    name: "Test Leader Red/Green",
    category: "leader",
    colors: ["red", "green"],
    power: 5000,
    life: 4,
  },
  {
    id: "TEST-FILLER",
    name: "Test Filler",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
  },
  {
    id: "TEST-C2-3000",
    name: "Test 3000",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 3000,
    counter: 1000,
    types: ["Test Crew"],
  },
  {
    id: "TEST-C4-5000",
    name: "Test 5000",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 5000,
    counter: 2000,
  },
  {
    id: "TEST-C5-6000",
    name: "Test 6000",
    category: "character",
    colors: ["red"],
    cost: 5,
    power: 6000,
  },
  {
    id: "TEST-RUSH",
    name: "Test Rush",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    keywords: ["rush"],
  },
  {
    id: "TEST-RUSH-CHAR",
    name: "Test Rush: Character",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    keywords: ["rushCharacter"],
  },
  {
    id: "TEST-BLOCKER",
    name: "Test Blocker",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    counter: 1000,
    keywords: ["blocker"],
  },
  {
    id: "TEST-DOUBLE",
    name: "Test Double Attack",
    category: "character",
    colors: ["red"],
    cost: 5,
    power: 6000,
    keywords: ["doubleAttack"],
  },
  {
    id: "TEST-BANISH",
    name: "Test Banish",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 5000,
    keywords: ["banish"],
  },
  {
    id: "TEST-UNBLOCKABLE",
    name: "Test Unblockable",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 5000,
    keywords: ["unblockable"],
  },
  { id: "TEST-STAGE", name: "Test Stage", category: "stage", colors: ["red"], cost: 1 },
  { id: "TEST-STAGE-2", name: "Test Stage 2", category: "stage", colors: ["red"], cost: 1 },
  { id: "TEST-EVENT", name: "Test Event", category: "event", colors: ["red"], cost: 1 },
  {
    id: "TEST-GREEN",
    name: "Test Green",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 2000,
  },
  {
    id: "TEST-RED-GREEN",
    name: "Test Red/Green",
    category: "character",
    colors: ["red", "green"],
    cost: 1,
    power: 2000,
  },

  // Cards with effects, one or two building blocks each.
  {
    id: "TEST-ONPLAY-DRAW",
    name: "Test On Play Draw",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [{ timing: "onPlay", steps: [{ do: "draw", count: 1 }] }],
  },
  {
    id: "TEST-ONPLAY-KO",
    name: "Test On Play K.O.",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 4000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "ko", target: { side: "opponent", filter: { costAtMost: 3 }, upTo: true } }],
      },
    ],
  },
  {
    id: "TEST-ATTACK-POWER",
    name: "Test When Attacking",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    effects: [
      {
        timing: "whenAttacking",
        conditions: [{ donAtLeast: 1 }],
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 2000, duration: "battle" }],
      },
    ],
  },
  {
    id: "TEST-ONKO-DRAW",
    name: "Test On K.O. Draw",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 3000,
    effects: [{ timing: "onKO", steps: [{ do: "draw", count: 1 }] }],
  },
  {
    id: "TEST-ACTIVATE",
    name: "Test Activate",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        costs: [{ restDon: 1 }],
        steps: [{ do: "powerUp", target: { side: "self", zone: "leader" }, amount: 1000 }],
      },
    ],
  },
  {
    id: "TEST-ACTIVATE-REST",
    name: "Test Activate Rest",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [
      { timing: "activateMain", costs: [{ restThis: true }], steps: [{ do: "draw", count: 1 }] },
    ],
  },
  {
    id: "TEST-EVENT-KO",
    name: "Test Event K.O.",
    category: "event",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [{ do: "ko", target: { side: "opponent", filter: { costAtMost: 2 } } }],
      },
    ],
  },
  {
    id: "TEST-EVENT-COUNTER",
    name: "Test Counter Event",
    category: "event",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "counter",
        steps: [
          {
            do: "powerUp",
            target: { side: "self", zone: "leaderOrCharacters", upTo: true },
            amount: 4000,
            duration: "battle",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-TRIGGER-DRAW",
    name: "Test Trigger Draw",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    effects: [{ timing: "trigger", steps: [{ do: "draw", count: 2 }] }],
  },
  {
    id: "TEST-TRIGGER-PLAY",
    name: "Test Trigger Play",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    effects: [{ timing: "trigger", steps: [{ do: "playThis" }] }],
  },
  {
    id: "TEST-PERMANENT",
    name: "Test Permanent",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "permanent",
        conditions: [{ donAtLeast: 1 }, { yourTurn: true }],
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 2000 }],
      },
    ],
  },
  {
    id: "TEST-SEARCH",
    name: "Test Search",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "searchDeck", look: 5, take: 1, filter: { type: "Test Crew" } }],
      },
    ],
  },
  {
    id: "TEST-OPTIONAL",
    name: "Test Optional Cost",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        optional: true,
        costs: [{ trashFromHand: 1 }],
        steps: [{ do: "draw", count: 2 }],
      },
    ],
  },
  {
    id: "TEST-END-TURN",
    name: "Test End of Turn",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [{ timing: "endOfYourTurn", steps: [{ do: "setDonActive", count: 1 }] }],
  },
  {
    id: "TEST-BLOCK-DRAW",
    name: "Test On Block",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    keywords: ["blocker"],
    effects: [{ timing: "onBlock", steps: [{ do: "draw", count: 1 }] }],
  },
  {
    id: "TEST-GIVE-DON",
    name: "Test Give DON!!",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "giveRestedDon",
            target: { side: "self", zone: "leaderOrCharacters", upTo: true },
            count: 1,
          },
        ],
      },
    ],
  },
  {
    id: "TEST-BOUNCE",
    name: "Test Bounce",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "returnToHand",
            target: { side: "opponent", filter: { costAtMost: 3 }, upTo: true },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-PLAY-FROM-HAND",
    name: "Test Play From Hand",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "playFromHand", filter: { costAtMost: 2, category: "character" } }],
      },
    ],
  },
  {
    id: "TEST-IF",
    name: "Test If",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "if", conditions: [{ lifeAtMost: 2 }], steps: [{ do: "draw", count: 1 }] }],
      },
    ],
  },
  {
    id: "TEST-RUSH-GRANT",
    name: "Test Grant Rush",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 5000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "grantKeyword", target: { side: "this" }, keyword: "rush" }],
      },
    ],
  },
  {
    id: "TEST-OPP-ATTACK",
    name: "Test On Opponent's Attack",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "onOpponentsAttack",
        oncePerTurn: true,
        steps: [
          {
            do: "powerUp",
            target: { side: "self", zone: "leader" },
            amount: 2000,
            duration: "battle",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-DON-MINUS",
    name: "Test DON!! Minus",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [
      { timing: "activateMain", costs: [{ donMinus: 2 }], steps: [{ do: "draw", count: 2 }] },
    ],
  },
  {
    id: "TEST-RETURN-OWN",
    name: "Test Return Own",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          { do: "returnToHand", target: { side: "self", filter: { notThis: true }, upTo: true } },
        ],
      },
    ],
  },
  {
    id: "TEST-NO-BLOCKERS",
    name: "Test No Blockers",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    effects: [
      {
        timing: "whenAttacking",
        steps: [
          {
            do: "noBlockers",
            target: { side: "this" },
            blockers: { powerAtLeast: 5000 },
            duration: "battle",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-BIG-BLOCKER",
    name: "Test Big Blocker",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 5000,
    keywords: ["blocker"],
  },
  {
    id: "TEST-KO-BLOCKER",
    name: "Test K.O. Blocker",
    category: "event",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "ko",
            target: { side: "opponent", filter: { keyword: "blocker" }, upTo: true },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-DON8-DRAW",
    name: "Test 8 DON!! Draw",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [
          { do: "if", conditions: [{ donOnFieldAtLeast: 8 }], steps: [{ do: "draw", count: 1 }] },
        ],
      },
    ],
  },
  {
    id: "TEST-NO-DON-DRAW",
    name: "Test No DON!! Draw",
    category: "character",
    colors: ["purple"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        steps: [
          { do: "if", conditions: [{ donOnFieldAtMost: 0 }], steps: [{ do: "draw", count: 1 }] },
        ],
      },
    ],
  },
  {
    id: "TEST-PLAYED-DRAW",
    name: "Test Played This Turn Draw",
    category: "character",
    colors: ["black"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        steps: [
          { do: "if", conditions: [{ playedThisTurn: true }], steps: [{ do: "draw", count: 1 }] },
        ],
      },
    ],
  },
  {
    id: "TEST-LIFE-COST",
    name: "Test Life Cost",
    category: "character",
    colors: ["yellow"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        optional: true,
        costs: [{ lifeToHand: 1 }],
        steps: [{ do: "addDon", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-LIFE-COST-EITHER",
    name: "Test Life Cost Top or Bottom",
    category: "character",
    colors: ["yellow"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "onPlay",
        optional: true,
        costs: [{ lifeToHand: 1, from: "topOrBottom" }],
        steps: [{ do: "addDon", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-TRASH-LIFE-COST",
    name: "Test Trash Life Cost",
    category: "event",
    colors: ["yellow"],
    cost: 1,
    effects: [
      {
        timing: "main",
        optional: true,
        costs: [{ trashLife: 1 }],
        steps: [{ do: "draw", count: 2 }],
      },
    ],
  },
  {
    id: "TEST-FACE-UP",
    name: "Test Face-Up Life",
    category: "character",
    colors: ["yellow"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [{ lifeFaceUp: 1 }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-TRASH-TO-DECK",
    name: "Test Trash to Deck",
    category: "character",
    colors: ["black"],
    cost: 2,
    power: 2000,
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        optional: true,
        costs: [{ trashToDeckBottom: 1 }],
        steps: [{ do: "addDon", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-TRASH-OPP-LIFE",
    name: "Test Trash Opponent's Life",
    category: "character",
    colors: ["yellow"],
    cost: 2,
    power: 2000,
    effects: [{ timing: "onPlay", steps: [{ do: "trashLife", side: "opponent", count: 1 }] }],
  },
  {
    id: "TEST-ARRANGE-LIFE",
    name: "Test Arrange Life",
    category: "character",
    colors: ["yellow"],
    cost: 2,
    power: 2000,
    effects: [{ timing: "onPlay", steps: [{ do: "arrangeLife" }] }],
  },
  {
    id: "TEST-TRIGGER-TO-HAND",
    name: "Test Trigger to Hand",
    category: "character",
    colors: ["yellow"],
    cost: 3,
    power: 3000,
    effects: [{ timing: "trigger", steps: [{ do: "addThisToHand" }] }],
  },
  {
    id: "TEST-TRASH-CHAR",
    name: "Test Trash Character",
    category: "event",
    colors: ["black"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "trashCharacter",
            target: { side: "opponent", filter: { costAtMost: 2 }, upTo: true },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-SEARCH-TRASH",
    name: "Test Search, Trash the Rest",
    category: "event",
    colors: ["black"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [{ do: "searchDeck", look: 3, take: 1, filter: { costAtLeast: 2 }, rest: "trash" }],
      },
    ],
  },
  {
    id: "TEST-KO-BASE-POWER",
    name: "Test K.O. Base Power",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "ko",
            target: { side: "opponent", filter: { basePowerAtMost: 3000 }, upTo: true },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-POWER-DOWN",
    name: "Test Power Down",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [{ do: "powerUp", target: { side: "opponent" }, amount: -3000 }],
      },
    ],
  },
  {
    id: "TEST-COST-DOWN",
    name: "Test Cost Down",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [{ do: "costChange", target: { side: "opponent" }, amount: -2 }],
      },
    ],
  },
  {
    id: "TEST-COST-UP",
    name: "Test Cost Up",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        conditions: [{ count: { side: "self", filter: { baseCostAtLeast: 4 } }, atLeast: 1 }],
        steps: [{ do: "costChange", target: { side: "this" }, amount: 1 }],
      },
    ],
  },
  {
    id: "TEST-HAND-COST",
    name: "Test Hand Cost",
    category: "character",
    colors: ["red"],
    cost: 6,
    power: 6000,
    effects: [
      {
        timing: "permanent",
        zone: "hand",
        conditions: [{ count: { side: "opponent", filter: { powerAtLeast: 6000 } }, atLeast: 1 }],
        steps: [{ do: "costChange", target: { side: "this" }, amount: -4 }],
      },
    ],
  },
  {
    id: "TEST-SEARCH-ANY",
    name: "Test Search Any",
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
            filter: {
              anyOf: [{ type: "Test Crew" }, { typeIncludes: "Works" }],
              notName: "Test Search Any",
            },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-WORKS",
    name: "Test Works",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    types: ["Former Test Works"],
  },
  {
    id: "TEST-LEADER-NAMED",
    name: "Test Captain",
    category: "leader",
    colors: ["red"],
    power: 5000,
    life: 5,
  },
  {
    id: "TEST-LEADER-IS",
    name: "Test Leader Is",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        conditions: [{ anyOf: [{ leaderHasType: "Nobody" }, { leaderIs: "Test Captain" }] }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-RESTED-COUNT",
    name: "Test Rested Count",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        conditions: [{ restedCardsAtLeast: 3 }],
        steps: [{ do: "draw", count: 1 }],
      },
      {
        timing: "permanent",
        conditions: [{ donRestedAtLeast: 2 }],
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 1000 }],
      },
    ],
  },
  {
    id: "TEST-LONG-POWER",
    name: "Test Long Power",
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
            target: { side: "self", zone: "leader" },
            amount: 2000,
            duration: "opponentsNextTurn",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-NO-ATTACK",
    name: "Test No Attack",
    category: "character",
    colors: ["red"],
    cost: 5,
    power: 8000,
    effects: [
      {
        timing: "permanent",
        steps: [{ do: "grantStatus", target: { side: "this" }, status: "cannotAttack" }],
      },
      {
        timing: "permanent",
        steps: [
          {
            do: "grantStatus",
            target: { side: "opponent", zone: "characters", filter: { costAtMost: 2 } },
            status: "cannotAttack",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-STOP-BLOCKER",
    name: "Test Stop Blocker",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "grantStatus",
            target: { side: "opponent", filter: { keyword: "blocker" }, upTo: true },
            status: "cannotBlock",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-BATTLE-PROOF",
    name: "Test Battle Proof",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 1000,
    effects: [
      {
        timing: "permanent",
        steps: [{ do: "grantStatus", target: { side: "this" }, status: "cannotBeKOdInBattle" }],
      },
    ],
  },
  {
    id: "TEST-GUARD",
    name: "Test Guard",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 4000,
    effects: [
      {
        timing: "permanent",
        steps: [
          {
            do: "grantStatus",
            target: { side: "self", zone: "characters", filter: { costAtMost: 3 } },
            status: "cannotBeKOdByOpponentsEffects",
          },
        ],
      },
    ],
  },
  {
    id: "TEST-KO-ANY",
    name: "Test K.O. Any",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [{ do: "ko", target: { side: "opponent", upTo: true } }],
      },
    ],
  },
  {
    id: "TEST-KO-OWN",
    name: "Test K.O. Own",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [{ do: "ko", target: { side: "self", upTo: true } }],
      },
    ],
  },
  {
    id: "TEST-FREEZE",
    name: "Test Freeze",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [{ do: "rest", target: { side: "opponent", upTo: true }, stayRested: true }],
      },
    ],
  },
  {
    id: "TEST-PLAY-RESTED",
    name: "Test Play Rested",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "playFromHand", filter: { costAtMost: 4 }, rested: true }],
      },
    ],
  },
  {
    id: "TEST-TRASH-SELF",
    name: "Test Trash Self",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [{ trashThis: true }],
        steps: [{ do: "draw", count: 2 }],
      },
    ],
  },
  {
    id: "TEST-REST-IF",
    name: "Test Rest If You Do",
    category: "event",
    colors: ["red"],
    cost: 0,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "rest",
            target: { side: "self", upTo: true },
            ifYouDo: [{ do: "rest", target: { side: "opponent", upTo: true } }],
          },
        ],
      },
    ],
  },
  {
    id: "TEST-REST-WATCHER",
    name: "Test Rest Watcher",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "characterRestedByYourEffect",
        conditions: [{ yourTurn: true }],
        oncePerTurn: true,
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    id: "TEST-PROTECTED",
    name: "Test Protected",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 5000,
  },
  {
    id: "TEST-BODYGUARD",
    name: "Test Bodyguard",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    effects: [
      {
        timing: "replaceRemoval",
        replaces: { side: "self", filter: { name: "Test Protected" }, removal: "ko" },
        optional: true,
        costs: [{ trashThis: true }],
        steps: [],
      },
    ],
  },
  {
    id: "TEST-HAND-SHIELD",
    name: "Test Hand Shield",
    category: "character",
    colors: ["red"],
    cost: 5,
    power: 6000,
    types: ["Test Crew"],
    effects: [
      {
        timing: "replaceRemoval",
        replaces: {
          side: "self",
          filter: { type: "Test Crew" },
          removal: "remove",
          byOpponent: true,
        },
        oncePerTurn: true,
        optional: true,
        costs: [{ trashFromHand: 1 }],
        steps: [],
      },
    ],
  },
  {
    id: "TEST-LEADER-NEGATE",
    name: "Test Leader Negate",
    category: "leader",
    colors: ["black"],
    power: 5000,
    life: 5,
    effects: [{ timing: "permanent", steps: [{ do: "negateOnPlay", side: "self" }] }],
  },
  {
    id: "TEST-NEGATE-OPPONENT",
    name: "Test Negate Opponent",
    category: "character",
    colors: ["black"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "activateMain",
        steps: [{ do: "negateOnPlay", side: "opponent", duration: "turn" }],
      },
    ],
  },
  {
    id: "TEST-PER-TRASH",
    name: "Test Per Trash",
    category: "character",
    colors: ["black"],
    cost: 4,
    power: 5000,
    effects: [
      {
        timing: "permanent",
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 1000, perTrash: 4 }],
      },
    ],
  },
  {
    id: "TEST-RETURN-DON",
    name: "Test Return DON",
    category: "character",
    colors: ["yellow"],
    cost: 6,
    power: 7000,
    effects: [
      {
        timing: "activateMain",
        costs: [{ returnGivenDon: 2 }],
        steps: [{ do: "grantKeyword", target: { side: "this" }, keyword: "rush" }],
      },
    ],
  },
  {
    id: "TEST-ATTACK-ACTIVE",
    name: "Test Attack Active",
    category: "character",
    colors: ["yellow"],
    cost: 4,
    power: 5000,
    keywords: ["canAttackActive"],
  },
  {
    id: "TEST-KO-OPPONENT-LIFE",
    name: "Test K.O. Opponent Life",
    category: "character",
    colors: ["yellow"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "onPlay",
        conditions: [{ opponentLifeAtLeast: 3 }],
        steps: [
          {
            do: "ko",
            target: { side: "opponent", filter: { costAtMostOpponentLife: true }, upTo: true },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-COST-PER-TRASH",
    name: "Test Cost Per Trash",
    category: "character",
    colors: ["black"],
    cost: 1,
    power: 1000,
    effects: [
      {
        timing: "permanent",
        steps: [{ do: "costChange", target: { side: "this" }, amount: 1, perTrash: 2 }],
      },
    ],
  },
  {
    id: "TEST-CHARACTER-TO-LIFE",
    name: "Test Character to Life",
    category: "event",
    colors: ["yellow"],
    cost: 1,
    effects: [
      {
        timing: "main",
        steps: [
          {
            do: "characterToLife",
            faceUp: true,
            target: { side: "self", filter: { powerAtMost: 0 }, upTo: true },
          },
        ],
      },
    ],
  },
  {
    id: "TEST-C1-0",
    name: "Test 0 Power",
    category: "character",
    colors: ["yellow"],
    cost: 1,
    power: 0,
  },
  {
    id: "TEST-LIFE-TO-DECK",
    name: "Test Life to Deck",
    category: "event",
    colors: ["yellow"],
    cost: 1,
    effects: [{ timing: "main", steps: [{ do: "lifeToDeckTop" }] }],
  },
];

export const TEST_CATALOG: CardCatalog = Object.fromEntries(
  [
    ...cards,
    ...MORE_EFFECT_CARDS,
    ...OP09_EFFECT_CARDS,
    ...OP10_EFFECT_CARDS,
    ...EXTRA_BOOSTER_CARDS,
  ].map((c) => [c.id, c]),
);
