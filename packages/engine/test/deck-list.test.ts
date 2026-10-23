import { describe, expect, it } from "vitest";
import { formatDeckList, parseDeckList } from "../src/index.js";
import { SEARCH_CATALOG } from "./fixtures/search-cards.js";

describe("deck list import and export", () => {
  it("reads the common 4xCARD format, with the Leader as 1x", () => {
    const parsed = parseDeckList(SEARCH_CATALOG, "1xTS01-001\n4xTS01-002\n2xTS01-011\n");
    expect(parsed).toEqual({
      leader: "TS01-001",
      deck: ["TS01-002", "TS01-002", "TS01-002", "TS01-002", "TS01-011", "TS01-011"],
      errors: [],
    });
  });

  it("accepts other common spellings and skips headings and comments", () => {
    const text = [
      "Leader",
      "1 x TS01-001 Test Captain",
      "",
      "Characters (5)",
      "4 ts01-003",
      "TS02-120 x1",
      "// cut for now: 2xTS01-002",
      "# notes",
      "2×TS01-012",
      "1xTP-001_p1",
    ].join("\r\n");
    const parsed = parseDeckList(SEARCH_CATALOG, text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.leader).toBe("TS01-001");
    expect(parsed.deck).toEqual([
      ...Array<string>(4).fill("TS01-003"),
      "TS02-120",
      "TS01-012",
      "TS01-012",
      "TP-001",
    ]);
  });

  it("reports unknown cards and unreadable lines by line number", () => {
    const parsed = parseDeckList(SEARCH_CATALOG, "1xTS01-001\n4xZZ99-999\nfour of TS01-002");
    expect(parsed.errors).toEqual([
      'Line 2: unknown card "ZZ99-999"',
      'Line 3: couldn\'t read "four of TS01-002"',
    ]);
  });

  it("reports a missing or extra Leader", () => {
    expect(parseDeckList(SEARCH_CATALOG, "4xTS01-002").errors).toEqual(["No Leader card found"]);
    expect(parseDeckList(SEARCH_CATALOG, "1xTS01-001\n1xTS02-001").errors).toEqual([
      "Found 2 Leader cards; a deck has exactly 1",
    ]);
  });

  it("writes a deck list that reads back to the same deck", () => {
    const list = { leader: "TS01-001", deck: ["TS02-120", "TS01-002", "TS01-002", "TP-001"] };
    const text = formatDeckList(list);
    expect(text).toBe("1xTS01-001\n1xTP-001\n2xTS01-002\n1xTS02-120");
    const back = parseDeckList(SEARCH_CATALOG, text);
    expect(back.leader).toBe("TS01-001");
    expect([...back.deck].sort()).toEqual([...list.deck].sort());
  });
});
