import { chooseBotAction } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";
import { cuesBetween, type Cue } from "../src/game-sounds.js";
import { botStep, botToAct, humanAct, newLocalGame } from "../src/local-game.js";
import { parseSound, DEFAULT_SOUND } from "../src/sound-settings.js";

describe("table sounds", () => {
  it("sound for plays, attacks, trashing and turn changes over a whole game", () => {
    let game = newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, 3);
    const heard = new Map<Cue, number>();
    let turns = 0;
    for (let i = 0; i < 3000 && game.state.winner === null; i++) {
      const before = game.state;
      game = botToAct(game)
        ? botStep(game)
        : humanAct(game, chooseBotAction(game.state, game.human));
      const cues = cuesBetween(before, game.state, game.human);
      for (const c of cues) heard.set(c, (heard.get(c) ?? 0) + 1);
      if (game.state.turn > before.turn) turns++;
      // Never the same sound twice for one move.
      expect(new Set(cues).size).toBe(cues.length);
    }
    expect(heard.get("play")).toBeGreaterThan(5);
    expect(heard.get("attack")).toBeGreaterThan(5);
    expect(heard.get("discard")).toBeGreaterThan(0);
    // One turn sound per turn, split between the two players.
    expect((heard.get("yourTurn") ?? 0) + (heard.get("theirTurn") ?? 0)).toBe(turns);
    expect(heard.get("yourTurn")).toBeGreaterThan(0);
    expect(heard.get("theirTurn")).toBeGreaterThan(0);
  });

  it("stay quiet when a new game replaces an old one", () => {
    const old = newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, 1);
    let later = old;
    while (later.state.turn < 3) {
      later = botToAct(later)
        ? botStep(later)
        : humanAct(later, chooseBotAction(later.state, later.human));
    }
    expect(cuesBetween(later.state, old.state, old.human)).toEqual([]);
    expect(cuesBetween(old.state, old.state, old.human)).toEqual([]);
  });
});

describe("sound settings", () => {
  it("fall back to the defaults for missing or broken values", () => {
    expect(parseSound(null)).toEqual(DEFAULT_SOUND);
    expect(parseSound("not json")).toEqual(DEFAULT_SOUND);
    expect(parseSound('{"musicOn":false,"musicVolume":7,"effectsVolume":"loud"}')).toEqual({
      ...DEFAULT_SOUND,
      musicOn: false,
      musicVolume: 1,
    });
  });
});
