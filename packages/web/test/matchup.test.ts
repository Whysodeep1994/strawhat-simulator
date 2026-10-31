import { BASE_RULES, type DeckList } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import {
  addResult,
  bestSwaps,
  cardImpact,
  emptyTally,
  gain,
  margin,
  mergeTallies,
  playGame,
  playGames,
  swapShortlist,
  swapsToTry,
  verdict,
  winRate,
  withSwap,
} from "../src/matchup.js";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";

const red: DeckList = DEMO_DECKS.red;
const green: DeckList = DEMO_DECKS.green;

describe("the Matchup Lab", () => {
  it("plays a whole game with nobody at the table", () => {
    const r = playGame(DEMO_CATALOG, red, green, 0);
    expect(["a", "b", "draw"]).toContain(r.winner);
    expect(r.aFirst).toBe(true);
    expect(r.turns).toBeGreaterThan(1);
    expect(r.seen.length).toBeGreaterThan(0);
  });

  it("gives the same result for the same game number, and alternates who goes first", () => {
    expect(playGame(DEMO_CATALOG, red, green, 3)).toEqual(playGame(DEMO_CATALOG, red, green, 3));
    expect(playGame(DEMO_CATALOG, red, green, 3).aFirst).toBe(false);
  });

  it("adds up many games", () => {
    const t = playGames(DEMO_CATALOG, red, green, 0, 10);
    expect(t.games).toBe(10);
    expect(t.aWins + t.bWins + t.draws).toBe(10);
    expect(t.aFirstGames).toBe(5);
    expect(t.aSecondGames).toBe(5);
    const split = mergeTallies(
      playGames(DEMO_CATALOG, red, green, 0, 4),
      playGames(DEMO_CATALOG, red, green, 4, 10),
    );
    expect(split).toEqual(t);
  });

  it("works out win rates and how much luck could move them", () => {
    let t = emptyTally();
    for (let i = 0; i < 100; i++)
      t = addResult(t, { winner: i < 60 ? "a" : "b", aFirst: i % 2 === 0, turns: 8, seen: [] });
    expect(winRate(t)).toBeCloseTo(0.6);
    // 1.96 × √(0.6 × 0.4 / 100) ≈ 9.6%
    expect(margin(t)).toBeCloseTo(0.096, 3);
  });

  it("only tries swaps that keep the deck legal", () => {
    const swaps = swapsToTry(DEMO_CATALOG, BASE_RULES, red, ["DEMO-G01"]);
    expect(swaps.length).toBeGreaterThan(0);
    // A green card can't go in a red deck, and a card already at 4 copies can't get a fifth.
    expect(swaps.some((s) => s.in === "DEMO-G01")).toBe(false);
    for (const s of swaps) {
      const deck = withSwap(red, s);
      expect(deck.deck).toHaveLength(50);
      expect(deck.deck.filter((id) => id === s.in).length).toBeLessThanOrEqual(4);
    }
  });

  it("shortlists cutting weak cards for strong ones", () => {
    const base = playGames(DEMO_CATALOG, red, green, 0, 40);
    const impact = cardImpact(red, base);
    expect(impact.reduce((n, c) => n + c.copies, 0)).toBe(50);
    const shortlist = swapShortlist(DEMO_CATALOG, BASE_RULES, red, base);
    const legal = swapsToTry(DEMO_CATALOG, BASE_RULES, red);
    for (const s of shortlist) expect(legal).toContainEqual(s);
  });

  it("calls a swap better only when it beats luck", () => {
    const tally = (wins: number) => {
      let t = emptyTally();
      for (let i = 0; i < 1000; i++)
        t = addResult(t, { winner: i < wins ? "a" : "b", aFirst: true, turns: 8, seen: [] });
      return t;
    };
    const big = { swap: { out: "x", in: "y" }, tally: tally(600), base: tally(500) };
    const small = { swap: { out: "x", in: "z" }, tally: tally(510), base: tally(500) };
    expect(gain(big)).toBeCloseTo(0.1);
    expect(verdict(big)).toBe("better");
    expect(verdict(small)).toBe("unclear");
    expect(bestSwaps([small, big], 1)).toEqual([big.swap]);
  });
});
