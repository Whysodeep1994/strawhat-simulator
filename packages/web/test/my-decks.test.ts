import { describe, expect, it } from "vitest";
import { buildCardData, type Card } from "../src/card-data.js";
import {
  cardList,
  copyOf,
  fromList,
  newDeck,
  playable,
  problemsOf,
  startingDeck,
} from "../src/my-decks.js";

const leader: Card = {
  id: "ST99-001",
  name: "Leader",
  category: "leader",
  colors: ["red"],
  life: 5,
  power: 5000,
  blockIcon: 3,
};
const cards: Card[] = [
  leader,
  ...Array.from(
    { length: 14 },
    (_, i): Card => ({
      id: `ST99-${String(i + 2).padStart(3, "0")}`,
      name: `Card ${i + 2}`,
      category: "character",
      colors: ["red"],
      cost: 2,
      power: 3000,
      blockIcon: 3,
    }),
  ),
  {
    id: "ST98-001",
    name: "Old card",
    category: "character",
    colors: ["red"],
    cost: 1,
    power: 2000,
    blockIcon: 1,
  },
];
const standard = {
  id: "standard",
  name: "Standard",
  legalBlocks: [2, 3, 4, 5, "X"],
  banned: ["ST99-015"],
};
const data = buildCardData(cards, [], "./card-data/", [standard]);

const fifty = cards
  .slice(1, 13)
  .flatMap((c) => Array<string>(4).fill(c.id))
  .concat(["ST99-014", "ST99-014"]);

describe("my decks", () => {
  it("round-trip between a saved deck and a card list", () => {
    const deck = fromList(newDeck(), "ST99-001", fifty);
    expect(deck.leader).toBe("ST99-001");
    expect(cardList(deck)).toHaveLength(50);
    expect(cardList(deck)).toEqual([...fifty].sort((a, b) => a.localeCompare(b)));
    expect(fromList(deck, undefined, []).leader).toBeUndefined();
  });

  it("can be played only when legal in Standard", () => {
    const legal = fromList(newDeck(), "ST99-001", fifty);
    expect(problemsOf(legal, data)).toEqual([]);
    expect(playable(legal, data)).toMatchObject({ leader: "ST99-001", mine: true });

    const rotated = fromList(newDeck(), "ST99-001", [...fifty.slice(0, 49), "ST98-001"]);
    expect(problemsOf(rotated, data).map((p) => p.message)).toEqual([
      "Old card (ST98-001) has rotated out of Standard",
    ]);
    expect(playable(rotated, data)).toBeNull();

    const banned = fromList(newDeck(), "ST99-001", [...fifty.slice(0, 49), "ST99-015"]);
    expect(problemsOf(banned, data)[0]?.message).toMatch(/banned in Standard/);
    expect(playable(fromList(newDeck(), undefined, fifty), data)).toBeNull();
  });

  it("can start as a copy of a Quick deck", () => {
    const quick = { id: "ST99", name: "Test", leader: "ST99-001", deck: fifty, official: true };
    const copy = copyOf(quick, "My Test");
    expect(copy.name).toBe("My Test");
    expect(copy.leader).toBe("ST99-001");
    expect(cardList(copy)).toEqual([...fifty].sort((a, b) => a.localeCompare(b)));
    expect(copy.id).not.toBe(quick.id);
  });

  it("use the base rules until the Standard list is in the card data", () => {
    const noFormat = buildCardData(cards, [], "./card-data/");
    expect(noFormat.formatLoaded).toBe(false);
    const rotated = fromList(newDeck(), "ST99-001", [...fifty.slice(0, 49), "ST98-001"]);
    expect(problemsOf(rotated, noFormat)).toEqual([]);
  });
});

describe("startingDeck", () => {
  const decks = [{ id: "a" }, { id: "b" }];
  it("starts on the deck played last", () => {
    expect(startingDeck(decks, "b", "a")).toBe("b");
  });
  it("falls back when there is no last deck, or it was deleted", () => {
    expect(startingDeck(decks, null, "a")).toBe("a");
    expect(startingDeck(decks, "gone", "a")).toBe("a");
  });
});
