import { describe, expect, it } from "vitest";
import {
  BASE_RULES,
  checkDeck,
  copyLimit,
  type CardCatalog,
  type DeckFormat,
} from "../src/index.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

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
const legal = [...Array<string>(4).fill("TEST-C2-3000"), ...base.slice(0, 46)];

const catalog: CardCatalog = {
  ...TEST_CATALOG,
  "TEST-C2-3000": { ...TEST_CATALOG["TEST-C2-3000"]!, blockIcon: 1 },
};

const standard: DeckFormat = {
  id: "standard",
  name: "Standard",
  banned: ["TEST-RUSH"],
  restricted: { "TEST-BLOCKER": 1 },
  bannedPairs: [["TEST-LEADER", "TEST-DOUBLE"]],
};

const messages = (format: DeckFormat, deck: string[], leader: string | undefined = "TEST-LEADER") =>
  checkDeck(catalog, format, leader, deck).map((p) => p.message);

describe("deck formats", () => {
  it("accept a legal deck under the base rules (rule 5-1-2)", () => {
    expect(messages(BASE_RULES, legal)).toEqual([]);
  });

  it("say how many cards to add or remove", () => {
    expect(messages(BASE_RULES, legal.slice(3))).toEqual([
      "The deck has 47 cards; add 3 more to reach 50",
    ]);
    expect(messages(BASE_RULES, [...legal, "TEST-EVENT"])[0]).toMatch(/remove 1/);
  });

  it("ask for a Leader first", () => {
    expect(checkDeck(catalog, BASE_RULES, undefined, legal)).toEqual([
      { message: "Choose a Leader" },
    ]);
  });

  it("flag the 4-copy limit and colors by card name", () => {
    const deck = [...legal.slice(0, 45), "TEST-FILLER", ...Array<string>(4).fill("TEST-GREEN")];
    const found = messages(BASE_RULES, deck);
    expect(found).toContainEqual(expect.stringMatching(/5 copies of .* \(TEST-FILLER\)/));
    expect(found).toContainEqual(expect.stringMatching(/\(TEST-GREEN\) isn't red/));
  });

  it("apply banned cards, restricted cards and banned pairs", () => {
    expect(copyLimit(standard, catalog, "TEST-RUSH")).toBe(0);
    expect(copyLimit(standard, catalog, "TEST-BLOCKER")).toBe(1);
    expect(copyLimit(standard, catalog, "TEST-FILLER")).toBe(4);
    const found = messages(standard, legal);
    expect(found).toContainEqual(expect.stringMatching(/\(TEST-RUSH\) is banned in Standard/));
    expect(found).toContainEqual(expect.stringMatching(/limited to 1 in Standard; you have 4/));
    expect(found).toContainEqual(expect.stringMatching(/TEST-LEADER and TEST-DOUBLE can't/));
  });

  it('apply a Leader\'s "only {type} cards" deck rule', () => {
    const found = messages(BASE_RULES, legal, "TEST-LEADER-EAST");
    expect(found).toContainEqual(expect.stringMatching(/\(TEST-FILLER\) isn't \{Test Crew\} type/));
    expect(found).not.toContainEqual(expect.stringMatching(/TEST-C2-3000/));
  });

  it("rotate out blocks that aren't legal", () => {
    const rotated = { ...BASE_RULES, name: "Standard", legalBlocks: [2, 3] };
    expect(copyLimit(rotated, catalog, "TEST-C2-3000")).toBe(0);
    expect(messages(rotated, legal)).toEqual([
      expect.stringMatching(/\(TEST-C2-3000\) has rotated out of Standard/),
    ]);
    // Cards without a block icon (test cards, promos without data) aren't rotated.
    expect(copyLimit(rotated, catalog, "TEST-FILLER")).toBe(4);
  });

  it("keep exceptions legal: always-legal cards, cards treated as a newer block, Block X", () => {
    const season: DeckFormat = {
      id: "standard",
      name: "Standard",
      legalBlocks: [2, 3, "X"],
      alwaysLegal: ["TEST-FILLER"],
      treatedAsBlock: { "TEST-BLOCKER": 3 },
    };
    const old = {
      ...catalog,
      "TEST-FILLER": { ...catalog["TEST-FILLER"]!, blockIcon: 1 },
      "TEST-BLOCKER": { ...catalog["TEST-BLOCKER"]!, blockIcon: 1 },
      "TEST-DOUBLE": { ...catalog["TEST-DOUBLE"]!, blockIcon: "X" },
    };
    expect(copyLimit(season, old, "TEST-FILLER")).toBe(4);
    expect(copyLimit(season, old, "TEST-BLOCKER")).toBe(4);
    expect(copyLimit(season, old, "TEST-DOUBLE")).toBe(4);
    expect(copyLimit(season, old, "TEST-C2-3000")).toBe(0);
  });

  it("treat parallel prints like their card number", () => {
    const withParallel = { ...catalog, "TEST-RUSH_p1": catalog["TEST-RUSH"]! };
    expect(copyLimit(standard, withParallel, "TEST-RUSH_p1")).toBe(0);
  });
});
