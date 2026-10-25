import { describe, expect, it } from "vitest";
import { moveHighlight } from "../src/menu.js";

describe("moveHighlight", () => {
  it("moves down and up", () => {
    expect(moveHighlight([true, true, true], 0, 1)).toBe(1);
    expect(moveHighlight([true, true, true], 1, -1)).toBe(0);
  });

  it("wraps around the ends", () => {
    expect(moveHighlight([true, true, true], 2, 1)).toBe(0);
    expect(moveHighlight([true, true, true], 0, -1)).toBe(2);
  });

  it("skips items that can't be picked", () => {
    expect(moveHighlight([true, true, false, true], 1, 1)).toBe(3);
    expect(moveHighlight([true, true, false, true], 3, -1)).toBe(1);
  });

  it("stays put when nothing else can be picked", () => {
    expect(moveHighlight([false, true, false], 1, 1)).toBe(1);
    expect(moveHighlight([false, false], 0, 1)).toBe(0);
  });
});
