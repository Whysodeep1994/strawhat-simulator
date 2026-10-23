import { describe, expect, it } from "vitest";
import type { Card } from "../src/card-data.js";
import { sortCards } from "../src/card-sort.js";

const card = (id: string, extra: Partial<Card>): Card => ({
  id,
  name: id,
  category: "character",
  colors: ["red"],
  ...extra,
});

const cards: Card[] = [
  card("ST99-004", { cost: 4, power: 5000, attribute: "Strike" }),
  card("ST99-001", { category: "leader", power: 5000, attribute: "Slash" }),
  card("ST99-003", { category: "event", cost: 1 }),
  card("ST99-002", { cost: 2, power: 3000, attribute: "Ranged" }),
  card("ST99-005", { category: "stage", cost: 1 }),
];
const ids = (list: Card[]) => list.map((c) => c.id.slice(-1));

describe("library sorting", () => {
  it("sorts by card number", () => {
    expect(ids(sortCards(cards, "number"))).toEqual(["1", "2", "3", "4", "5"]);
    expect(ids(sortCards(cards, "number", true))).toEqual(["5", "4", "3", "2", "1"]);
  });

  it("sorts by cost, with cards without a cost (Leaders) last", () => {
    expect(ids(sortCards(cards, "cost"))).toEqual(["3", "5", "2", "4", "1"]);
    expect(ids(sortCards(cards, "cost", true))).toEqual(["4", "2", "3", "5", "1"]);
  });

  it("sorts by power, with Events and Stages last", () => {
    expect(ids(sortCards(cards, "power"))).toEqual(["2", "4", "1", "3", "5"]);
    expect(ids(sortCards(cards, "power", true))).toEqual(["4", "1", "2", "3", "5"]);
  });

  it("sorts by card type: Leader, Character, Event, Stage", () => {
    expect(ids(sortCards(cards, "category"))).toEqual(["1", "2", "4", "3", "5"]);
  });

  it("sorts by attribute A to Z, cards without one last", () => {
    expect(ids(sortCards(cards, "attribute"))).toEqual(["2", "1", "4", "3", "5"]);
  });

  it("doesn't change the list it's given", () => {
    const before = ids(cards);
    sortCards(cards, "cost");
    expect(ids(cards)).toEqual(before);
  });
});
