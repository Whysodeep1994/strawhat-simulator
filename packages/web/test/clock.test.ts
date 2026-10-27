import { chooseBotAction, type PlayerId } from "@strawhat/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";
import { CLOCK_MS, FRIEND_GRACE_MS, formatClock, timeLeft } from "../src/clock.js";
import {
  friendAct,
  humanAct,
  newLocalGame,
  newOnlineGame,
  outOfTime,
  timeOut,
  type LocalGame,
} from "../src/local-game.js";

const MINUTE = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

/** Plays sensible moves for both players, a second each, until the game waits on `player`. */
function until(game: LocalGame, player: PlayerId): LocalGame {
  for (let i = 0; i < 50; i++) {
    const prompt = game.state.prompt;
    if (prompt.kind === "gameOver") break;
    if (prompt.player === player && i > 0) return game;
    vi.setSystemTime(Date.now() + 1000);
    game =
      prompt.player === game.human
        ? humanAct(game, chooseBotAction(game.state, prompt.player))
        : friendAct(game, chooseBotAction(game.state, prompt.player));
  }
  throw new Error(`the game never waited on ${player}`);
}

function newGame() {
  return newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, 7);
}

describe("game clocks", () => {
  it("give each player 15 minutes, shown as m:ss", () => {
    const game = newGame();
    expect(timeLeft(game.clock, game.state, "p1", 0)).toBe(CLOCK_MS);
    expect(formatClock(CLOCK_MS)).toBe("15:00");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(-5000)).toBe("0:00");
  });

  it("only run for the player the game is waiting on", () => {
    let game = newGame();
    vi.setSystemTime(2 * MINUTE);
    // You choose the turn order and keep your hand: your clock ran for 2 minutes.
    game = humanAct(game, { type: "chooseTurnOrder", player: "p1", goFirst: false });
    expect(timeLeft(game.clock, game.state, "p1", Date.now())).toBe(CLOCK_MS - 2 * MINUTE);
    expect(timeLeft(game.clock, game.state, "p2", Date.now())).toBe(CLOCK_MS);
    // Now the game waits on whoever decides next, and only their clock moves.
    const next = game.state.prompt.kind === "gameOver" ? null : game.state.prompt.player;
    const other = next === "p1" ? "p2" : "p1";
    const later = Date.now() + 30_000;
    expect(timeLeft(game.clock, game.state, next!, later)).toBe(
      timeLeft(game.clock, game.state, next!, Date.now()) - 30_000,
    );
    expect(timeLeft(game.clock, game.state, other, later)).toBe(
      timeLeft(game.clock, game.state, other, Date.now()),
    );
  });

  it("make the player who runs out lose, against the computer too", () => {
    // Say the computer froze while deciding.
    const game = until(newGame(), "p2");
    expect(outOfTime(game)).toBeNull();
    vi.setSystemTime(game.clock.since + CLOCK_MS - game.clock.used.p2);
    expect(outOfTime(game)).toBe("p2");
    const over = timeOut(game, "p2");
    expect(over.state.winner).toBe("p1");
    expect(over.timedOut).toBe("p2");
    expect(over.log.map((l) => l.text)).toContain("Opponent ran out of time.");
    expect(over.log.map((l) => l.text).join(" ")).not.toContain("conceded");
  });

  it("give a friend a few seconds' grace before your page ends their game", () => {
    const start = newOnlineGame(
      DEMO_CATALOG,
      { p1: DEMO_DECKS.red, p2: DEMO_DECKS.green },
      3,
      "p1",
    );
    const game = until(start, "p2");
    const at = game.clock.since + CLOCK_MS - game.clock.used.p2;
    expect(outOfTime(game, at)).toBeNull();
    expect(outOfTime(game, at + FRIEND_GRACE_MS)).toBe("p2");
    // Your own clock gets no grace.
    const mine = until(start, "p1");
    expect(outOfTime(mine, mine.clock.since + CLOCK_MS - mine.clock.used.p1)).toBe("p1");
  });
});
