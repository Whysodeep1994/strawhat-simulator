import { chooseBotAction, legalActions } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";
import { replay, reviewGame } from "../src/coach-review.js";
import { matchupTips, turnTips } from "../src/coach-tips.js";
import { donNeeded, powerShort, suggestMain } from "../src/coach.js";
import { botStep, botToAct, humanAct, newLocalGame, type LocalGame } from "../src/local-game.js";
import { guide, LESSONS, newRules } from "../src/tutor.js";

function newGame(seed: number): LocalGame {
  return newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, seed, {
    mode: "newPlayer",
  });
}

/** Plays a game with "you" making the moves `choose` picks. */
function playOut(game: LocalGame, choose: (game: LocalGame) => ReturnType<typeof chooseBotAction>) {
  for (let i = 0; i < 3000 && game.state.winner === null; i++) {
    game = botToAct(game) ? botStep(game) : humanAct(game, choose(game));
  }
  return game;
}

const followTheCoach = (game: LocalGame) =>
  guide(game.state, game.human).suggestion?.action ?? chooseBotAction(game.state, game.human);

describe("the coach's arithmetic", () => {
  it("counts DON!! needed to win a battle, where equal power wins (rule 7-1-4-1)", () => {
    expect(donNeeded(5000, 5000)).toBe(0);
    expect(donNeeded(5000, 6000)).toBe(1);
    expect(donNeeded(5000, 7500)).toBe(3);
  });

  it("counts the power a defender still needs", () => {
    expect(powerShort(5000, 6000)).toBe(0);
    expect(powerShort(5000, 5000)).toBe(1000);
    expect(powerShort(7000, 5000)).toBe(3000);
  });
});

describe("New Player tutor", () => {
  it("has lessons with rule numbers from the Comprehensive Rules", () => {
    expect(LESSONS.length).toBeGreaterThan(4);
    expect(LESSONS.flatMap((l) => l.lines).join(" ")).toMatch(/rule 7-1-4-1/);
  });

  it("suggests going first, then keeping or redrawing the hand", () => {
    let game = newGame(1);
    expect(guide(game.state, "p1").suggestion?.action).toEqual({
      type: "chooseTurnOrder",
      player: "p1",
      goFirst: true,
    });
    game = humanAct(game, guide(game.state, "p1").suggestion!.action);
    expect(guide(game.state, "p1").suggestion?.action.type).toMatch(/keepHand|mulligan/);
  });

  it("only ever suggests legal moves, through whole games", () => {
    for (let seed = 1; seed <= 6; seed++) {
      let game = newGame(seed);
      for (let i = 0; i < 3000 && game.state.winner === null; i++) {
        if (botToAct(game)) {
          game = botStep(game);
          continue;
        }
        const suggestion = guide(game.state, game.human).suggestion;
        expect(suggestion, `seed ${seed}, ${game.state.prompt.kind}`).not.toBeNull();
        const legal = legalActions(game.state, game.human);
        expect(legal).toContainEqual(suggestion!.action);
        game = humanAct(game, suggestion!.action);
      }
      expect(game.state.winner, `seed ${seed}`).not.toBeNull();
    }
  });

  it("explains a rule the first time it happens", () => {
    const game = playOut(newGame(2), followTheCoach);
    const ids = new Set<string>();
    let state = game.initial;
    for (const action of game.actions) {
      const next = humanAct({ ...game, state, actions: [], log: [] }, action).state;
      newRules(state, next, "p1").forEach((n) => ids.add(n.id));
      state = next;
    }
    expect(ids.has("hit") || ids.has("damage")).toBe(true);
  });
});

describe("Pro Drills report", () => {
  it("finds an idle Leader and wasted DON!! when you just end every turn", () => {
    const lazy = (game: LocalGame) => {
      const legal = legalActions(game.state, game.human);
      return (
        legal.find((a) => a.type === "endTurn" || a.type === "pass") ??
        chooseBotAction(game.state, game.human)
      );
    };
    const game = playOut(newGame(3), lazy);
    const review = reviewGame(replay(game.initial, game.actions), game.actions, game.human);
    const titles = review.mistakes.map((m) => m.title);
    expect(titles).toContain("Your Leader didn't attack");
    expect(titles.some((t) => /DON!! unused/.test(t))).toBe(true);
    expect(review.cleanTurns).toBeLessThan(review.turns);
    for (const m of review.mistakes) {
      expect(m.turn).toBeGreaterThan(0);
      expect(m.round).toMatch(/turn \d+/);
      expect(m.why.length).toBeGreaterThan(20);
      expect(m.why + m.better).not.toMatch(/undefined|NaN/);
    }
  });

  it("agrees with the coach: following its suggestions wastes no DON!! and no attacks", () => {
    for (let seed = 1; seed <= 4; seed++) {
      const game = playOut(newGame(seed), followTheCoach);
      const review = reviewGame(replay(game.initial, game.actions), game.actions, game.human);
      const titles = review.mistakes.map((m) => m.title);
      expect(titles, `seed ${seed}`).not.toContain("Your Leader didn't attack");
      expect(
        titles.filter((t) => /DON!! unused/.test(t)),
        `seed ${seed}`,
      ).toEqual([]);
      expect(
        titles.filter((t) => /Missed a winning attack/.test(t)),
        `seed ${seed}`,
      ).toEqual([]);
    }
  });
});

describe("live coaching tips", () => {
  it("covers the matchup and each turn's plan in readable words", () => {
    let game = newGame(4);
    const tips = matchupTips(game.state, "p1");
    expect(tips.some((t) => /Green decks/.test(t.text))).toBe(true);
    for (let i = 0; i < 400 && game.state.players.p1.turnsTaken < 3; i++) {
      game = botToAct(game) ? botStep(game) : humanAct(game, followTheCoach(game));
    }
    const turn = turnTips(game.state, "p1");
    expect(turn.length).toBeGreaterThan(1);
    for (const tip of turn) expect(tip.text).not.toMatch(/undefined|NaN|\[object/);
    expect(suggestMain(game.state, "p1")).not.toBeNull();
  });
});

describe("Pro Drills games", () => {
  it("keep every state as they go, the same as replaying the moves", () => {
    let game = newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, 5, {
      mode: "drills",
      liveCoaching: false,
    });
    game = playOut(game, followTheCoach);
    expect(game.states).toHaveLength(game.actions.length + 1);
    expect(game.states).toEqual(replay(game.initial, game.actions));
    expect(newGame(5).states).toBeUndefined();
  });
});
