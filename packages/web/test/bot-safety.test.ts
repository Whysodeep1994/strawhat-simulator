import { describe, expect, it, vi } from "vitest";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";

// Lets a test make the computer pick a move that isn't allowed.
const broken = vi.hoisted(() => ({ on: false }));
vi.mock("@strawhat/engine", async (importOriginal) => {
  const engine = await importOriginal<typeof import("@strawhat/engine")>();
  return {
    ...engine,
    chooseBotAction: (...args: Parameters<typeof engine.chooseBotAction>) =>
      broken.on
        ? { type: "attack", player: args[1], attacker: "nope", target: "nope" }
        : engine.chooseBotAction(...args),
  };
});

const { chooseBotAction } = await import("@strawhat/engine");
const { BOT, botStep, botToAct, humanAct, newLocalGame } = await import("../src/local-game.js");
type LocalGame = ReturnType<typeof newLocalGame>;

/** Plays until the computer is in its own Main Phase. */
function untilBotMain(seed: number): LocalGame {
  let game = newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, seed);
  game = humanAct(game, { type: "chooseTurnOrder", player: "p1", goFirst: false });
  for (let i = 0; i < 100; i++) {
    if (game.state.prompt.kind === "main" && game.state.prompt.player === BOT) return game;
    game = botToAct(game) ? botStep(game) : humanAct(game, chooseBotAction(game.state, "p1"));
  }
  throw new Error("The computer never reached its Main Phase.");
}

describe("the computer never leaves the game stuck", () => {
  it("plays a safe move when its own choice isn't allowed", () => {
    const game = untilBotMain(1);
    broken.on = true;
    try {
      const next = botStep(game);
      expect(next.actions.at(-1)).toEqual({ type: "endTurn", player: BOT });
    } finally {
      broken.on = false;
    }
  });

  it("ends its turn after a long run of moves in a row", () => {
    const game = untilBotMain(2);
    const run = Array.from({ length: 300 }, () => ({ type: "endTurn", player: BOT }) as const);
    const next = botStep({ ...game, actions: [...game.actions, ...run] });
    expect(next.actions.at(-1)).toEqual({ type: "endTurn", player: BOT });
  });
});
