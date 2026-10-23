import { describe, expect, it } from "vitest";
import { searchCards, searchOptions, setOf } from "../src/index.js";
import { SEARCH_CATALOG } from "./fixtures/search-cards.js";

const ids = (search: Parameters<typeof searchCards>[1]) =>
  searchCards(SEARCH_CATALOG, search).map((c) => c.id);

describe("deck builder card search", () => {
  it("returns every card, in card number order, when nothing is set", () => {
    expect(ids({})).toEqual([
      "TP-001",
      "TS01-001",
      "TS01-002",
      "TS01-003",
      "TS01-010",
      "TS01-011",
      "TS01-012",
      "TS02-001",
      "TS02-005",
      "TS02-120",
    ]);
  });

  it("reads the set code from a card number", () => {
    expect(setOf("OP13-001")).toBe("OP13");
    expect(setOf("P-001")).toBe("P");
  });

  it("filters by set", () => {
    expect(ids({ sets: ["TS02"] })).toEqual(["TS02-001", "TS02-005", "TS02-120"]);
    expect(ids({ sets: ["tp", "TS02"] })).toHaveLength(4);
  });

  it("filters by colour, matching cards with any chosen colour", () => {
    expect(ids({ colors: ["blue"] })).toEqual(["TS01-010", "TS02-001", "TS02-005"]);
  });

  it("filters by card category and by type", () => {
    expect(ids({ categories: ["leader"] })).toEqual(["TS01-001", "TS02-001"]);
    expect(ids({ types: ["test kitchen"] })).toEqual(["TS01-003"]);
    expect(ids({ types: ["Test Navy"], categories: ["character"] })).toEqual(["TS01-010"]);
  });

  it("finds a card by its number, however it is typed", () => {
    for (const typed of ["TS01-002", "ts01-002", "ts01 002", "TS01-2", "ts01002"]) {
      expect(ids({ id: typed })).toEqual(["TS01-002"]);
    }
  });

  // A short number is read both ways while typing: "TS01-01" is TS01-001 and the start of TS01-01x.
  it("lists every card that starts with a partial card number", () => {
    expect(ids({ id: "ts01-01" })).toEqual(["TS01-010", "TS01-011", "TS01-012", "TS01-001"].sort());
    expect(ids({ id: "TS02" })).toEqual(["TS02-001", "TS02-005", "TS02-120"]);
  });

  it("filters by a cost range, inclusive, and leaves out cards with no cost", () => {
    expect(ids({ cost: { min: 4, max: 6 } })).toEqual(["TS01-003", "TS01-010", "TS02-120"]);
    expect(ids({ cost: { min: 7 } })).toEqual(["TS02-005"]);
    expect(ids({ cost: { max: 1 } })).toEqual(["TS01-011"]);
  });

  it("searches names, card numbers, and types with free text", () => {
    expect(ids({ text: "captain" })).toEqual(["TS01-001", "TS01-010"]);
    expect(ids({ text: "kitchen" })).toEqual(["TS01-003"]);
  });

  it("5-1-2-1, 5-1-2-2: shows only cards that can go in the chosen Leader's deck", () => {
    expect(ids({ leader: "TS01-001", cost: { min: 4 } })).toEqual(["TS01-003", "TS02-120"]);
    expect(ids({ leader: "TS01-002" })).toEqual([]);
  });

  it("combines every filter", () => {
    expect(
      ids({
        sets: ["TS01"],
        colors: ["red", "green"],
        categories: ["character"],
        cost: { min: 3, max: 4 },
      }),
    ).toEqual(["TS01-002", "TS01-003"]);
  });

  it("lists the menu choices and slider range for the cards available", () => {
    expect(searchOptions(SEARCH_CATALOG)).toEqual({
      sets: ["TP", "TS01", "TS02"],
      colors: ["red", "green", "blue"],
      categories: ["leader", "character", "event", "stage"],
      types: ["Test Crew", "Test Giants", "Test Kitchen", "Test Navy"],
      cost: { min: 1, max: 7 },
    });
  });
});
