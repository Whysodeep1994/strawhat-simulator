import type { CardDefinition } from "../../src/index.js";

const character = {
  category: "character" as const,
  colors: ["red" as const],
  cost: 0,
  power: 1000,
};
const drawIf = (
  id: string,
  name: string,
  conditions: CardDefinition["effects"] extends (infer E)[] | undefined
    ? E extends { conditions?: infer C }
      ? C
      : never
    : never,
): CardDefinition => ({
  ...character,
  id,
  name,
  effects: [{ timing: "onPlay", conditions, steps: [{ do: "draw", count: 1 }] }],
});

/** Made-up cards for the effect blocks added for set OP-08. */
export const OP08_EFFECT_CARDS: CardDefinition[] = [
  drawIf("TEST-TRASH-HAS", "Test Trash Has", [{ trashHas: { name: "Test Filler" } }]),
  drawIf("TEST-OPP-RESTED", "Test Opponent Rested", [{ opponentRestedCardsAtLeast: 3 }]),
  {
    ...character,
    id: "TEST-THIS-ACTIVE",
    name: "Test This Active",
    effects: [
      {
        timing: "activateMain",
        conditions: [{ thisActive: true }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    ...character,
    id: "TEST-COST-OPP-DON",
    name: "Test Cost Up To Opponent DON",
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "ko",
            target: {
              side: "opponent",
              filter: { costAtMostOpponentDonOnField: true },
              upTo: true,
            },
          },
        ],
      },
    ],
  },
  {
    ...character,
    id: "TEST-COST-LIFE",
    name: "Test Cost Up To Life",
    effects: [
      {
        timing: "onPlay",
        steps: [
          { do: "ko", target: { side: "opponent", filter: { costAtMostLife: true }, upTo: true } },
        ],
      },
    ],
  },
  {
    ...character,
    id: "TEST-SLASH-SAFE",
    name: "Test Slash Safe",
    effects: [
      {
        timing: "permanent",
        steps: [
          { do: "grantStatus", target: { side: "this" }, status: "cannotBeKOdInBattleBySlash" },
        ],
      },
    ],
  },
  {
    ...character,
    id: "TEST-SLASH-ATTACKER",
    name: "Test Slash Attacker",
    power: 6000,
    attribute: "Slash",
  },
  {
    ...character,
    id: "TEST-ATTACK-TAX",
    name: "Test Attack Tax",
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "grantStatus",
            target: { side: "opponent", count: 99 },
            status: "mustTrashToAttack",
            duration: "opponentsNextTurn",
          },
        ],
      },
    ],
  },
  {
    ...character,
    id: "TEST-REMOVED-ANY",
    name: "Test Removed By Any Effect",
    effects: [
      {
        timing: "yourCharacterRemovedByEffect",
        cardFilter: { name: "Test Filler" },
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    ...character,
    id: "TEST-LIFE-WATCH",
    name: "Test Life Watcher",
    effects: [
      {
        timing: "opponentLifeRemoved",
        conditions: [{ yourTurn: true }],
        oncePerTurn: true,
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    ...character,
    id: "TEST-LIFE-UP-2",
    name: "Test Two Life Face-Up",
    effects: [
      { timing: "activateMain", costs: [{ lifeFaceUp: 2 }], steps: [{ do: "draw", count: 1 }] },
    ],
  },
  {
    ...character,
    id: "TEST-REVEAL-TOP-BOTTOM",
    name: "Test Reveal Top or Bottom",
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "playFromDeckTop", filter: { costAtMost: 2 }, restTopOrBottom: true }],
      },
    ],
  },
  {
    ...character,
    id: "TEST-DON-DOWN",
    name: "Test DON Down",
    effects: [{ timing: "onPlay", steps: [{ do: "donDownToOpponent" }] }],
  },
];
