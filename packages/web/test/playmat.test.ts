import { describe, expect, it } from "vitest";
import { isUpload, MAT_PRESETS, presetChoice, presetOf } from "../src/playmat.js";

describe("playmat choices", () => {
  it("round-trips every ready-made mat", () => {
    for (const p of MAT_PRESETS) expect(presetOf(presetChoice(p.id))).toBe(p.id);
  });

  it("tells uploads, ready-made mats, and the default apart", () => {
    const upload = "data:image/jpeg;base64,AAAA";
    expect(presetOf(upload)).toBeNull();
    expect(isUpload(upload)).toBe(true);
    expect(isUpload(presetChoice("wano"))).toBe(false);
    expect(isUpload(null)).toBe(false);
    expect(presetOf(null)).toBeNull();
  });

  it("falls back to the default for a ready-made mat that no longer exists", () => {
    expect(presetOf("preset:gone")).toBeNull();
    expect(isUpload("preset:gone")).toBe(false);
  });
});
