import { describe, expect, it } from "vitest";
import { validateDeck } from "../src/index.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

// 46 legal red cards (at most 4 of each), plus 4 copies of the card under test.
const base = [
  "TEST-FILLER",
  "TEST-C4-5000",
  "TEST-C5-6000",
  "TEST-RUSH",
  "TEST-RUSH-CHAR",
  "TEST-BLOCKER",
  "TEST-DOUBLE",
  "TEST-BANISH",
  "TEST-UNBLOCKABLE",
  "TEST-STAGE",
  "TEST-STAGE-2",
  "TEST-EVENT",
].flatMap((id) => Array<string>(4).fill(id));
const fifty = (id: string) => [...Array<string>(4).fill(id), ...base.slice(0, 46)];

describe("rule 5-1-2: deck construction", () => {
  it("accepts 1 Leader and exactly 50 cards", () => {
    expect(validateDeck(TEST_CATALOG, "TEST-LEADER", fifty("TEST-C2-3000"))).toEqual([]);
  });

  it("5-1-2: rejects a deck that isn't exactly 50 cards", () => {
    expect(
      validateDeck(TEST_CATALOG, "TEST-LEADER", fifty("TEST-C2-3000").slice(1)),
    ).toContainEqual(expect.stringMatching(/exactly 50/));
  });

  it("5-1-2-1: rejects a Leader inside the deck", () => {
    const deck = [...fifty("TEST-C2-3000").slice(1), "TEST-LEADER"];
    expect(validateDeck(TEST_CATALOG, "TEST-LEADER", deck)).toContainEqual(
      expect.stringMatching(/Leader/),
    );
  });

  it("5-1-2-2, 2-3-5: every color on a card must be on the Leader", () => {
    expect(validateDeck(TEST_CATALOG, "TEST-LEADER", fifty("TEST-GREEN"))).toContainEqual(
      expect.stringMatching(/color/),
    );
    expect(validateDeck(TEST_CATALOG, "TEST-LEADER", fifty("TEST-RED-GREEN"))).toContainEqual(
      expect.stringMatching(/color/),
    );
    expect(validateDeck(TEST_CATALOG, "TEST-LEADER-RG", fifty("TEST-RED-GREEN"))).toEqual([]);
  });

  it("5-1-2-3, 2-14-2: no more than 4 copies of a card number", () => {
    const deck = [...fifty("TEST-C2-3000").slice(0, -1), "TEST-C2-3000"];
    expect(validateDeck(TEST_CATALOG, "TEST-LEADER", deck)).toContainEqual(
      expect.stringMatching(/5 copies/),
    );
  });
});
