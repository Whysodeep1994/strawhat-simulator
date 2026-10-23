import { describe, expect, it } from "vitest";
import { PHASES, cardsToDraw, donToPlace, nextPhase } from "../src/index.js";

describe("rule 6-1: turn flow", () => {
  it("runs Refresh, Draw, DON!!, Main, End in order", () => {
    expect(PHASES).toEqual(["refresh", "draw", "don", "main", "end"]);
  });

  it("moves to the next phase, and ends the turn after the End Phase", () => {
    expect(nextPhase("refresh")).toBe("draw");
    expect(nextPhase("main")).toBe("end");
    expect(nextPhase("end")).toBeNull();
  });
});

describe("rule 6-3-1: draw phase", () => {
  it("skips the draw for the first player on turn 1", () => {
    expect(cardsToDraw(1, true)).toBe(0);
  });

  it("draws 1 card otherwise", () => {
    expect(cardsToDraw(1, false)).toBe(1);
    expect(cardsToDraw(2, true)).toBe(1);
  });
});

describe("rule 6-4-1: DON!! phase", () => {
  it("places 1 DON!! for the first player on turn 1", () => {
    expect(donToPlace(1, true)).toBe(1);
  });

  it("places 2 DON!! otherwise", () => {
    expect(donToPlace(1, false)).toBe(2);
    expect(donToPlace(3, true)).toBe(2);
  });
});
