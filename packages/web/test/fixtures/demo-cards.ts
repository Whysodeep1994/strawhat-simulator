import type { CardCatalog, CardDefinition, DeckList, Step } from "@strawhat/engine";

/**
 * Made-up demo cards, so the prototype is playable before real card data is loaded.
 * Real cards come from the strawhat-card-data repo and use official card numbers.
 */

const koUpTo = (filter: Record<string, number | boolean>): Step => ({
  do: "ko",
  target: { side: "opponent", filter, upTo: true },
});
const restUpTo = (costAtMost: number, count = 1): Step => ({
  do: "rest",
  target: { side: "opponent", filter: { costAtMost }, count, upTo: true },
});
const draw = (count: number): Step => ({ do: "draw", count });
const counterPlus = (amount: number): Step => ({
  do: "powerUp",
  target: { side: "self", zone: "leaderOrCharacters", upTo: true },
  amount,
  duration: "battle",
});

const red: CardDefinition[] = [
  {
    id: "DEMO-R00",
    name: "Crimson Captain",
    category: "leader",
    colors: ["red"],
    power: 5000,
    life: 5,
    types: ["Demo Crew"],
    effects: [
      {
        timing: "whenAttacking",
        conditions: [{ donAtLeast: 1 }],
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 1000, duration: "battle" }],
      },
    ],
  },
  {
    id: "DEMO-R01",
    name: "Deckhand",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 2000,
    counter: 1000,
    types: ["Demo Crew"],
  },
  {
    id: "DEMO-R02",
    name: "Lookout",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 1000,
    counter: 1000,
    types: ["Demo Crew"],
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "searchDeck", look: 5, take: 1, filter: { type: "Demo Crew" } }],
      },
    ],
  },
  {
    id: "DEMO-R03",
    name: "Brawler",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 3000,
    counter: 1000,
    types: ["Demo Crew"],
    effects: [{ timing: "trigger", steps: [{ do: "playThis" }] }],
  },
  {
    id: "DEMO-R04",
    name: "Ship's Cook",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    counter: 2000,
    types: ["Demo Crew"],
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "giveRestedDon", target: { side: "self", zone: "leader" }, count: 1 }],
      },
    ],
  },
  {
    id: "DEMO-R05",
    name: "Swift Swordsman",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    types: ["Demo Crew"],
    keywords: ["rush"],
  },
  {
    id: "DEMO-R06",
    name: "Sharp Sniper",
    category: "character",
    colors: ["red"],
    cost: 3,
    power: 4000,
    counter: 1000,
    types: ["Demo Crew"],
    effects: [{ timing: "onPlay", steps: [koUpTo({ costAtMost: 2 })] }],
  },
  {
    id: "DEMO-R07",
    name: "Navigator",
    category: "character",
    colors: ["red"],
    cost: 4,
    power: 5000,
    counter: 1000,
    types: ["Demo Crew"],
    effects: [
      {
        timing: "whenAttacking",
        conditions: [{ donAtLeast: 1 }],
        steps: [{ do: "powerUp", target: { side: "this" }, amount: 2000, duration: "battle" }],
      },
    ],
  },
  {
    id: "DEMO-R08",
    name: "Twin-Fist Brute",
    category: "character",
    colors: ["red"],
    cost: 5,
    power: 6000,
    types: ["Demo Crew"],
    keywords: ["doubleAttack"],
  },
  {
    id: "DEMO-R09",
    name: "Island Giant",
    category: "character",
    colors: ["red"],
    cost: 7,
    power: 9000,
    types: ["Demo Giants"],
    effects: [{ timing: "onPlay", steps: [koUpTo({ powerAtMost: 6000 })] }],
  },
  {
    id: "DEMO-R10",
    name: "Flame Guard",
    category: "event",
    colors: ["red"],
    cost: 1,
    effects: [
      { timing: "counter", steps: [counterPlus(4000)] },
      { timing: "trigger", steps: [draw(1)] },
    ],
  },
  {
    id: "DEMO-R11",
    name: "Cannon Barrage",
    category: "event",
    colors: ["red"],
    cost: 2,
    effects: [
      { timing: "main", steps: [koUpTo({ costAtMost: 3 })] },
      { timing: "trigger", steps: [koUpTo({ costAtMost: 3 })] },
    ],
  },
  {
    id: "DEMO-R12",
    name: "Pirate Galleon",
    category: "stage",
    colors: ["red"],
    cost: 1,
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        costs: [{ restThis: true }],
        steps: [{ do: "giveRestedDon", target: { side: "self", zone: "leader" }, count: 1 }],
      },
    ],
  },
  {
    id: "DEMO-R13",
    name: "Shield Bearer",
    category: "character",
    colors: ["red"],
    cost: 2,
    power: 2000,
    counter: 1000,
    types: ["Demo Crew"],
    keywords: ["blocker"],
  },
];

const green: CardDefinition[] = [
  {
    id: "DEMO-G00",
    name: "Jade Admiral",
    category: "leader",
    colors: ["green"],
    power: 5000,
    life: 5,
    types: ["Demo Navy"],
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        costs: [{ restDon: 1 }],
        steps: [restUpTo(2)],
      },
    ],
  },
  {
    id: "DEMO-G01",
    name: "Recruit",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 2000,
    counter: 1000,
    types: ["Demo Navy"],
  },
  {
    id: "DEMO-G02",
    name: "Scout",
    category: "character",
    colors: ["green"],
    cost: 1,
    power: 1000,
    counter: 1000,
    types: ["Demo Navy"],
    effects: [
      {
        timing: "onPlay",
        steps: [{ do: "searchDeck", look: 5, take: 1, filter: { type: "Demo Navy" } }],
      },
    ],
  },
  {
    id: "DEMO-G03",
    name: "Harbor Guard",
    category: "character",
    colors: ["green"],
    cost: 2,
    power: 2000,
    counter: 1000,
    types: ["Demo Navy"],
    keywords: ["blocker"],
  },
  {
    id: "DEMO-G04",
    name: "Marksman",
    category: "character",
    colors: ["green"],
    cost: 2,
    power: 3000,
    counter: 1000,
    types: ["Demo Navy"],
    effects: [{ timing: "onPlay", steps: [restUpTo(3)] }],
  },
  {
    id: "DEMO-G05",
    name: "Lieutenant",
    category: "character",
    colors: ["green"],
    cost: 3,
    power: 4000,
    counter: 1000,
    types: ["Demo Navy"],
    effects: [{ timing: "trigger", steps: [{ do: "playThis" }] }],
  },
  {
    id: "DEMO-G06",
    name: "Tactician",
    category: "character",
    colors: ["green"],
    cost: 3,
    power: 3000,
    counter: 2000,
    types: ["Demo Navy"],
    effects: [{ timing: "onPlay", steps: [draw(1)] }],
  },
  {
    id: "DEMO-G07",
    name: "Commodore",
    category: "character",
    colors: ["green"],
    cost: 4,
    power: 5000,
    counter: 1000,
    types: ["Demo Navy"],
    keywords: ["blocker"],
  },
  {
    id: "DEMO-G08",
    name: "Vice Admiral",
    category: "character",
    colors: ["green"],
    cost: 5,
    power: 6000,
    types: ["Demo Navy"],
    effects: [{ timing: "onPlay", steps: [koUpTo({ rested: true, costAtMost: 5 })] }],
  },
  {
    id: "DEMO-G09",
    name: "Fleet Admiral",
    category: "character",
    colors: ["green"],
    cost: 7,
    power: 8000,
    types: ["Demo Navy"],
    keywords: ["blocker"],
    effects: [{ timing: "onPlay", steps: [restUpTo(7, 2)] }],
  },
  {
    id: "DEMO-G10",
    name: "Net Trap",
    category: "event",
    colors: ["green"],
    cost: 1,
    effects: [
      { timing: "counter", steps: [counterPlus(4000)] },
      { timing: "trigger", steps: [restUpTo(4)] },
    ],
  },
  {
    id: "DEMO-G11",
    name: "Ambush",
    category: "event",
    colors: ["green"],
    cost: 2,
    effects: [
      { timing: "main", steps: [restUpTo(5)] },
      { timing: "trigger", steps: [draw(1)] },
    ],
  },
  {
    id: "DEMO-G12",
    name: "Sea Fortress",
    category: "stage",
    colors: ["green"],
    cost: 2,
    effects: [
      {
        timing: "activateMain",
        oncePerTurn: true,
        costs: [{ restThis: true }],
        steps: [
          {
            do: "powerUp",
            target: { side: "self", zone: "leader" },
            amount: 1000,
            duration: "turn",
          },
        ],
      },
    ],
  },
  {
    id: "DEMO-G13",
    name: "Sharpshooter",
    category: "character",
    colors: ["green"],
    cost: 4,
    power: 5000,
    types: ["Demo Navy"],
    keywords: ["unblockable"],
  },
];

export const DEMO_CATALOG: CardCatalog = Object.fromEntries(
  [...red, ...green].map((card) => [card.id, card]),
);

/** Every card 4 times, except the Stage (2 copies): 50 cards (rule 5-1-2). */
function deckOf(cards: CardDefinition[]): string[] {
  return cards
    .filter((c) => c.category !== "leader")
    .flatMap((c) => Array<string>(c.category === "stage" ? 2 : 4).fill(c.id));
}

export const DEMO_DECKS: Record<"red" | "green", DeckList & { name: string }> = {
  red: { name: "Crimson Crew (red, attack)", leader: "DEMO-R00", deck: deckOf(red) },
  green: { name: "Jade Navy (green, control)", leader: "DEMO-G00", deck: deckOf(green) },
};
