import { validateDeck, type CardCatalog } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import {
  buildCardData,
  officialText,
  practiceDeck,
  setLabel,
  type Card,
  type OfficialDeck,
} from "../src/card-data.js";

const leader: Card = {
  id: "ST99-001",
  name: "Test Leader",
  category: "leader",
  colors: ["red"],
  power: 5000,
  life: 5,
  image: "images/ST99-001.png",
};

/** 13 red Characters (enough for 50 cards at 4 copies) and one green one the Leader can't use. */
const characters: Card[] = Array.from({ length: 13 }, (_, i) => ({
  id: `ST99-${String(i + 2).padStart(3, "0")}`,
  name: `Red ${i + 2}`,
  category: "character" as const,
  colors: ["red" as const],
  cost: (i % 5) + 1,
  power: 3000,
}));
const offColor: Card = {
  id: "ST99-015",
  name: "Green",
  category: "character",
  colors: ["green"],
  cost: 1,
  power: 2000,
};
const cards = [leader, ...characters, offColor];
const catalog = Object.fromEntries(cards.map((c) => [c.id, c])) as CardCatalog;

describe("practice decks", () => {
  it("are legal 50-card decks of the Leader's colours (rule 5-1-2)", () => {
    const deck = practiceDeck(cards, leader);
    expect(deck).not.toBeNull();
    expect(deck!.deck).toHaveLength(50);
    expect(deck!.deck).not.toContain("ST99-015");
    expect(validateDeck(catalog, deck!.leader, deck!.deck)).toEqual([]);
    expect(deck!.official).toBe(false);
    expect(deck!.name).toBe("ST-99 practice deck");
  });

  it("get one deck per Leader when a set has several", () => {
    const second: Card = { ...leader, id: "ST99-016", name: "Second" };
    const data = buildCardData([...cards, second], [], "./card-data/");
    expect(data.decks.map((d) => d.id)).toEqual(["ST99-001-practice", "ST99-016-practice"]);
  });

  it("aren't built when the set has too few cards for 50", () => {
    expect(practiceDeck([leader, ...characters.slice(0, 12)], leader)).toBeNull();
  });
});

describe("card data", () => {
  const official: OfficialDeck = {
    id: "ST99",
    name: "Test Deck",
    leader: "ST99-001",
    cards: Object.fromEntries(characters.slice(0, 12).map((c) => [c.id, 4])),
  };

  it("uses an official list in place of the practice deck", () => {
    // 12 × 4 = 48 cards, two short; so add two more copies of the 13th card.
    const full = { ...official, cards: { ...official.cards, "ST99-014": 2 } };
    const data = buildCardData(cards, [full], "./card-data/");
    expect(data.decks.map((d) => [d.id, d.official])).toEqual([["ST99", true]]);
    expect(data.decks[0]!.deck).toHaveLength(50);
  });

  it("skips an official list that isn't a legal deck, and falls back to practice", () => {
    const data = buildCardData(cards, [official], "./card-data/");
    expect(data.decks.map((d) => [d.id, d.official])).toEqual([["ST99-001-practice", false]]);
  });

  it("finds card images next to the card data", () => {
    const data = buildCardData(cards, [], "./card-data/");
    expect(data.imageUrl(leader)).toBe("./card-data/images/ST99-001.png");
    expect(data.imageUrl(offColor)).toBeUndefined();
  });

  it("shows official text line by line, with the [Trigger] last", () => {
    expect(
      officialText({ ...leader, text: "[Blocker]\n(Reminder.)", trigger: "[Trigger] Draw 1." }),
    ).toEqual(["[Blocker]", "(Reminder.)", "[Trigger] Draw 1."]);
    expect(setLabel("OP13")).toBe("OP-13");
  });
});
