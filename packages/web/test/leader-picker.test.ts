import { describe, expect, it } from "vitest";
import { buildCardData, type Card, type PlayableDeck } from "../src/card-data.js";
import { deckGroups, deckMatches, deckSubtitle } from "../src/LeaderPicker.js";

const leaders: Card[] = [
  { id: "ST01-001", name: "Monkey.D.Luffy", category: "leader", colors: ["red"], life: 5 },
  { id: "OP04-001", name: "Nefeltari Vivi", category: "leader", colors: ["red", "blue"], life: 4 },
];
const tip = { tip: "Attack fast.", source: "https://example.org", sourceName: "Bandai" };
const data = buildCardData(leaders, [], "./card-data/", [], { "ST01-001": tip });

const deck = (id: string, leader: string, extra: Partial<PlayableDeck> = {}): PlayableDeck => ({
  id,
  name: id,
  leader,
  deck: [],
  official: false,
  ...extra,
});
const starter = deck("ST01", "ST01-001", { name: "Straw Hat Crew", official: true });
const practice = deck("OP04-001-practice", "OP04-001");
const mine = deck("my-1", "OP04-001", { name: "My Vivi", mine: true });

describe("deck picker", () => {
  it("keeps the Leader tips from the card data", () => {
    expect(data.tips["ST01-001"]).toEqual(tip);
    expect(buildCardData(leaders, [], "./").tips).toEqual({});
  });

  it("groups your decks, then official starters, then practice decks", () => {
    expect(deckGroups([mine], [starter, practice]).map((g) => g.label)).toEqual([
      "My decks",
      "Official starter decks",
      "Practice decks",
    ]);
    expect(deckGroups([], [starter]).map((g) => g.label)).toEqual(["Official starter decks"]);
  });

  it("names each deck under its Leader", () => {
    expect(deckSubtitle(starter)).toBe("Straw Hat Crew");
    expect(deckSubtitle(practice)).toBe("OP-04 practice deck");
    expect(deckSubtitle(mine)).toBe("My Vivi");
  });

  it("finds decks by Leader name, colour, set or deck name", () => {
    expect(deckMatches(practice, data, "vivi")).toBe(true);
    expect(deckMatches(practice, data, "blue")).toBe(true);
    expect(deckMatches(practice, data, "OP-04")).toBe(true);
    expect(deckMatches(starter, data, "straw hat")).toBe(true);
    expect(deckMatches(starter, data, "blue")).toBe(false);
    expect(deckMatches(starter, data, "  ")).toBe(true);
  });
});
