import { describe, expect, it } from "vitest";
import { BACK_PRESETS, backImage, CLASSIC, presetChoice } from "../src/card-backs.js";

describe("card backs", () => {
  it("has unique preset ids, and every design but classic is a picture", () => {
    expect(new Set(BACK_PRESETS.map((p) => p.id)).size).toBe(BACK_PRESETS.length);
    for (const preset of BACK_PRESETS) {
      if (preset.id === CLASSIC) expect(preset.image).toBeNull();
      else expect(preset.image).toMatch(/^data:image\/svg\+xml,/);
    }
  });

  it("turns a choice into the picture to show", () => {
    expect(backImage(presetChoice(CLASSIC))).toBeNull();
    expect(backImage(presetChoice("grand-line"))).toBe(
      BACK_PRESETS.find((p) => p.id === "grand-line")?.image,
    );
    expect(backImage("data:image/jpeg;base64,AAAA")).toBe("data:image/jpeg;base64,AAAA");
  });

  it("falls back to the classic back for anything it doesn't know", () => {
    expect(backImage(presetChoice("gone"))).toBeNull();
    expect(backImage("https://example.com/back.png")).toBeNull();
  });
});
