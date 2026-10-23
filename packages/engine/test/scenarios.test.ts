import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runScenario, type Scenario } from "../src/index.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

const dir = join(import.meta.dirname, "..", "scenarios");
const files = readdirSync(dir, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".json"))
  .sort();

describe("scenarios", () => {
  it("has at least one scenario", () => expect(files.length).toBeGreaterThan(0));

  for (const file of files) {
    const scenario = JSON.parse(readFileSync(join(dir, file), "utf8")) as Scenario;
    it(`${file}: ${scenario.name} (rules ${scenario.rules.join(", ")})`, () => {
      expect(runScenario(scenario, TEST_CATALOG)).toEqual([]);
    });
  }
});
