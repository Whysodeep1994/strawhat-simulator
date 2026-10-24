import type { CardDefinition } from "../../src/index.js";

const draw = { do: "draw", count: 1 } as const;

/** A red cost 1, 1000 power Character with these effects. */
function character(
  id: string,
  name: string,
  effects: NonNullable<CardDefinition["effects"]>,
): CardDefinition {
  return { id, name, category: "character", colors: ["red"], cost: 1, power: 1000, effects };
}

/** Made-up cards for the effect blocks added for set OP-12. */
export const OP12_EFFECT_CARDS: CardDefinition[] = [
  character("TEST-GIVE-DON-NAMED", "Test Give DON Named", [
    {
      timing: "activateMain",
      costs: [{ giveActiveDon: 1, filter: { name: "Test Filler" } }],
      steps: [{ do: "powerUp", target: { side: "that" }, amount: 2000 }],
    },
  ]),
  character("TEST-BATTLED-DRAW", "Test Battled Draw", [
    { timing: "activateMain", conditions: [{ battledCharacterThisTurn: true }], steps: [draw] },
  ]),
  character("TEST-ACTIVE-DRAW", "Test Active Draw", [
    { timing: "activateMain", conditions: [{ thisActive: true }], steps: [draw] },
  ]),
  character("TEST-ATTACK-LEADER-DRAW", "Test Attack Leader Draw", [
    { timing: "whenAttacking", conditions: [{ attackingLeader: true }], steps: [draw] },
  ]),
  character("TEST-TRASH-EVENTS", "Test Trash Events", [
    {
      timing: "onPlay",
      conditions: [{ trashAtLeast: 2, filter: { category: "event" } }],
      steps: [draw],
    },
  ]),
  {
    id: "TEST-SLASH-GUARD",
    name: "Test Slash Guard",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 3000,
    effects: [
      {
        timing: "permanent",
        steps: [
          { do: "grantStatus", target: { side: "this" }, status: "cannotBeKOdInBattleBySlash" },
        ],
      },
    ],
  },
  character("TEST-NO-SMALL-TARGETS", "Test No Small Targets", [
    {
      timing: "activateMain",
      steps: [
        {
          do: "restrictAttackTargets",
          filter: { category: "character", baseCostAtMost: 3 },
        },
      ],
    },
  ]),
  {
    id: "TEST-NOT-BY-EFFECT",
    name: "Test Not By Effect",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 3000,
    effects: [{ timing: "permanent", zone: "hand", steps: [{ do: "notPlayableByEffects" }] }],
  },
  character("TEST-ACTIVATE-EVENT", "Test Activate Event", [
    { timing: "onPlay", steps: [{ do: "activateEventFromHand", filter: { costAtMost: 5 } }] },
  ]),
  {
    id: "TEST-EVENT-DRAW-2",
    name: "Test Event Draw 2",
    category: "event",
    colors: ["red"],
    cost: 5,
    effects: [{ timing: "main", steps: [{ do: "draw", count: 2 }] }],
  },
  character("TEST-NEXT-CHEAPER", "Test Next Cheaper", [
    {
      timing: "activateMain",
      oncePerTurn: true,
      steps: [{ do: "nextPlayCostChange", filter: { name: "Test 5000" }, amount: -2 }],
    },
  ]),
  {
    id: "TEST-NAVY-TRASH",
    name: "Test Navy Trash",
    category: "character",
    colors: ["black"],
    cost: 1,
    power: 1000,
    types: ["Navy"],
    effects: [{ timing: "onPlay", steps: [{ do: "trashFromHand", count: 2 }] }],
  },
  character("TEST-PLAIN-TRASH", "Test Plain Trash", [
    { timing: "onPlay", steps: [{ do: "trashFromHand", count: 2 }] },
  ]),
  character("TEST-NAVY-TRASH-WATCH", "Test Navy Trash Watch", [
    {
      timing: "handTrashedByOwnEffect",
      cardFilter: { type: "Navy" },
      steps: [{ do: "draw", count: 1, perPrevious: true }],
    },
  ]),
  character("TEST-OPP-PLAYS-WATCH", "Test Opponent Plays Watch", [
    { timing: "opponentPlaysCharacter", cardFilter: { baseCostAtLeast: 4 }, steps: [draw] },
  ]),
  character("TEST-OPP-EFFECT-PLAY-WATCH", "Test Opponent Effect Play Watch", [
    { timing: "opponentPlaysCharacterByCharacterEffect", steps: [draw] },
  ]),
  character("TEST-NO-DRAW", "Test No Draw", [
    { timing: "onPlay", steps: [draw, { do: "noDrawByOwnEffects" }, draw] },
  ]),
  character("TEST-OPP-ADD-DON", "Test Opponent Add DON", [
    { timing: "onPlay", steps: [{ do: "addDon", count: 1, side: "opponent" }] },
  ]),
  character("TEST-REST-DON-IF", "Test Rest DON If", [
    { timing: "onPlay", steps: [{ do: "restOwnDon", count: 1, ifYouDo: [draw] }] },
  ]),
];
