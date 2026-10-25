import { chooseBotAction } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";
import { botStep, botToAct, humanAct, newLocalGame, type LocalGame } from "../src/local-game.js";
import {
  abandonGame,
  award,
  emptyProgress,
  pointsOf,
  progressOf,
  qualifies,
  recordGame,
  TOTAL_POINTS,
  TROPHIES,
  trophyById,
  type GameInfo,
} from "../src/trophies.js";

const info: GameInfo = {
  mine: false,
  leader: DEMO_DECKS.red.leader,
  opponentLeader: DEMO_DECKS.green.leader,
};

/** Plays a whole game, with the computer also making "your" moves; counts your blocks. */
function playOut(seed: number): LocalGame & { blocks: number } {
  let game = newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, seed);
  let blocks = 0;
  for (let i = 0; i < 3000 && game.state.winner === null; i++) {
    if (botToAct(game)) {
      game = botStep(game);
    } else {
      const action = chooseBotAction(game.state, game.human);
      if (action.type === "block") blocks++;
      game = humanAct(game, action);
    }
  }
  return { ...game, blocks };
}

const games = Array.from({ length: 12 }, (_, i) => playOut(i + 1));
const won = games.find((g) => g.state.winner === g.human && qualifies(g.stats, g.state))!;
const lost = games.find((g) => g.state.winner !== g.human && qualifies(g.stats, g.state))!;

describe("trophy list", () => {
  it("has 28 trophies worth 1,000 points with unique ids", () => {
    expect(TROPHIES).toHaveLength(28);
    expect(TOTAL_POINTS).toBe(1000);
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(28);
  });
});

describe("game stats", () => {
  it("count your turns and keep track through whole games", () => {
    for (const game of games) {
      expect(game.stats.myTurns).toBeGreaterThan(0);
      expect(game.stats.conceded).toBe(false);
      // You take every other turn, give or take one.
      expect(Math.abs(game.stats.myTurns - game.state.turn / 2)).toBeLessThanOrEqual(1);
      expect(game.stats.blocks).toBe(game.blocks);
    }
    expect(won).toBeDefined();
    expect(lost).toBeDefined();
  });

  it("notice a concession, which never counts", () => {
    let game = newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, 5);
    game = humanAct(game, { type: "concede", player: game.human });
    expect(game.stats.conceded).toBe(true);
    expect(qualifies(game.stats, game.state)).toBe(false);
  });
});

describe("recording a game", () => {
  it("awards the first game and first win trophies once", () => {
    const first = recordGame(emptyProgress(), won.stats, won.state, won.human, info);
    expect(first.newly).toEqual(
      expect.arrayContaining(["setting-sail", "first-victory", "home-waters"]),
    );
    expect(first.newly).not.toContain("captains-log");
    expect(first.progress.wins).toBe(1);
    expect(first.progress.streak).toBe(1);
    expect(first.progress.leaders).toEqual([info.leader]);
    const again = recordGame(first.progress, won.stats, won.state, won.human, info);
    expect(again.newly).not.toContain("first-victory");
    expect(again.progress.wins).toBe(2);
  });

  it("gives Captain's Log for a win with your own deck and Mirror Match for the same Leader", () => {
    const result = recordGame(emptyProgress(), won.stats, won.state, won.human, {
      mine: true,
      leader: "X",
      opponentLeader: "X",
    });
    expect(result.newly).toEqual(expect.arrayContaining(["captains-log", "mirror-match"]));
    expect(result.newly).not.toContain("home-waters");
  });

  it("counts a loss as a finished game but not a win, and ends the streak", () => {
    const start = { ...emptyProgress(), wins: 3, streak: 3 };
    const result = recordGame(start, lost.stats, lost.state, lost.human, info);
    expect(result.newly).toContain("setting-sail");
    expect(result.newly).not.toContain("first-victory");
    expect(result.progress.wins).toBe(3);
    expect(result.progress.streak).toBe(0);
  });

  it("ignores games shorter than 3 of your turns", () => {
    const stats = { ...won.stats, myTurns: 2 };
    const result = recordGame(emptyProgress(), stats, won.state, won.human, info);
    expect(result.newly).toEqual([]);
    expect(result.progress.wins).toBe(0);
  });

  it("awards the condition trophies from the game's stats", () => {
    const stats = {
      ...won.stats,
      myTurns: 4,
      lostLife: false,
      playedEvent: false,
      playedCharacter: false,
      allStrawHat: true,
      mostBehind: 3,
      blocks: 3,
      fullCrew: true,
      donOverload: true,
      triggered: true,
      counterpunch: true,
      cleanSweep: true,
      finishingBlow: true,
    };
    const result = recordGame(emptyProgress(), stats, won.state, won.human, info);
    expect(result.newly).toEqual(
      expect.arrayContaining([
        "untouchable",
        "bare-knuckles",
        "one-man-army",
        "straw-hat-pride",
        "underdog",
        "iron-wall",
        "full-crew",
        "don-overload",
        "fortunes-favour",
        "counterpunch",
        "clean-sweep",
        "finishing-blow",
        "swift-voyage",
      ]),
    );
  });

  it("counts wins, streaks, colours and Leaders across games", () => {
    const start = {
      ...emptyProgress(),
      wins: 49,
      streak: 4,
      colors: ["green", "blue", "purple", "black", "yellow"],
      leaders: Array.from({ length: 19 }, (_, i) => `L${i}`),
    };
    const result = recordGame(start, won.stats, won.state, won.human, info);
    expect(result.newly).toEqual(
      expect.arrayContaining([
        "seasoned-captain",
        "emperor",
        "unstoppable",
        "rainbow-fleet",
        "grand-fleet",
      ]),
    );
  });

  it("breaks the streak when you concede or leave", () => {
    expect(abandonGame({ ...emptyProgress(), streak: 4 }).streak).toBe(0);
  });
});

describe("awarding", () => {
  it("adds Pirate King once every other trophy is earned", () => {
    const others = TROPHIES.map((t) => t.id).filter((id) => id !== "pirate-king");
    const almost = award(emptyProgress(), others.slice(0, -1), "2026-10-25T00:00:00Z");
    expect(almost.newly).not.toContain("pirate-king");
    const all = award(almost.progress, others.slice(-1));
    expect(all.newly).toEqual([others.at(-1), "pirate-king"]);
    expect(pointsOf(all.progress)).toBe(1000);
  });

  it("shows progress for counting trophies", () => {
    const progress = { ...emptyProgress(), wins: 4, colors: ["red", "blue"] };
    expect(progressOf(trophyById("seasoned-captain")!, progress)).toEqual([4, 10]);
    expect(progressOf(trophyById("rainbow-fleet")!, progress)).toEqual([2, 6]);
    expect(progressOf(trophyById("untouchable")!, progress)).toBeNull();
  });
});
