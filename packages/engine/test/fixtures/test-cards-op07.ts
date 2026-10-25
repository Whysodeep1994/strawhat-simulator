import type { CardDefinition } from "../../src/index.js";

const character = {
  category: "character" as const,
  colors: ["red" as const],
  cost: 0,
  power: 1000,
};

/** Made-up cards for the effect blocks added for set OP-07. */
export const OP07_EFFECT_CARDS: CardDefinition[] = [
  {
    ...character,
    id: "TEST-SET-POWER",
    name: "Test Set Power",
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "setPower", target: { side: "opponent", upTo: true }, power: 0 }],
      },
    ],
  },
  {
    ...character,
    id: "TEST-NEXT-TURN-POWER",
    name: "Test Next Turn Power",
    effects: [
      {
        timing: "onPlay",
        steps: [
          { do: "powerUp", target: { side: "this" }, amount: 2000, duration: "yourNextTurn" },
        ],
      },
    ],
  },
  {
    ...character,
    id: "TEST-DON-STAY",
    name: "Test DON Stay Rested",
    effects: [{ timing: "onPlay", steps: [{ do: "opponentDonNoRefresh", count: 1 }] }],
  },
  {
    ...character,
    id: "TEST-REST-INSTEAD",
    name: "Test Rest Instead",
    power: 5000,
    effects: [
      {
        timing: "replaceRemoval",
        replaces: { side: "this", removal: "remove", byOpponent: true },
        oncePerTurn: true,
        optional: true,
        costs: [{ restOpponentCharacter: 1 }],
        steps: [],
      },
    ],
  },
  {
    ...character,
    id: "TEST-REMOVED-WATCH",
    name: "Test Removed Watcher",
    effects: [
      {
        timing: "characterRemovedByYourEffect",
        conditions: [{ yourTurn: true }],
        oncePerTurn: true,
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
  {
    ...character,
    id: "TEST-RETURN-THIS",
    name: "Test Return This",
    effects: [
      {
        timing: "activateMain",
        optional: true,
        costs: [{ returnThis: true }],
        steps: [{ do: "draw", count: 1, side: "opponent" }],
      },
    ],
  },
  {
    ...character,
    id: "TEST-TRASH-BOTTOM-EVERY",
    name: "Test Trash Bottom Every 3",
    effects: [
      {
        timing: "onPlay",
        steps: [
          {
            do: "trashToDeckBottom",
            side: "self",
            count: 99,
            upTo: true,
            filter: { category: "character" },
          },
          {
            do: "powerUp",
            target: { side: "this" },
            amount: 1000,
            perPrevious: true,
            perPreviousEvery: 3,
          },
        ],
      },
    ],
  },
  {
    ...character,
    id: "TEST-OPP-TRASH-BOTTOM",
    name: "Test Opponent Trash Bottom",
    effects: [
      {
        timing: "onPlay",
        steps: [
          { do: "trashToDeckBottom", side: "opponent", count: 1, upTo: true, youChoose: true },
        ],
      },
    ],
  },
  {
    ...character,
    id: "TEST-HAND-TOP-BOTTOM",
    name: "Test Hand Top or Bottom",
    effects: [{ timing: "onPlay", steps: [{ do: "handToDeckTop", count: 2, orBottom: true }] }],
  },
  {
    ...character,
    id: "TEST-REVEAL-OR-BOTTOM",
    name: "Test Reveal or Bottom",
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "playFromDeckTop", filter: { costAtMost: 2 }, restToBottom: true }],
      },
    ],
  },
  {
    ...character,
    id: "TEST-LIFE-FEWER",
    name: "Test Life Fewer",
    effects: [
      {
        timing: "onPlay",
        conditions: [{ lifeFewerThanOpponent: true }],
        steps: [{ do: "draw", count: 1 }],
      },
    ],
  },
];
