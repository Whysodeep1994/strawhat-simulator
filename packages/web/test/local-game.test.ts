import { buildScenarioState, chooseBotAction, validateDeck, viewFor } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";
import { cardText } from "../src/describe.js";
import {
  botStep,
  botToAct,
  canUndo,
  describeChanges,
  humanAct,
  newLocalGame,
  undoMove,
  type LocalGame,
} from "../src/local-game.js";
import { reviewGame } from "../src/coach-review.js";

function newGame(seed: number): LocalGame {
  return newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, seed);
}

/** Plays a whole game, with the computer also making "your" moves. */
function playOut(game: LocalGame): LocalGame {
  for (let i = 0; i < 3000 && game.state.winner === null; i++) {
    game = botToAct(game) ? botStep(game) : humanAct(game, chooseBotAction(game.state, game.human));
  }
  return game;
}

describe("demo decks", () => {
  it("are legal 50-card decks (rule 5-1-2)", () => {
    for (const deck of Object.values(DEMO_DECKS)) {
      expect(validateDeck(DEMO_CATALOG, deck.leader, deck.deck)).toEqual([]);
    }
  });

  it("have readable text for every effect", () => {
    for (const card of Object.values(DEMO_CATALOG)) {
      for (const line of cardText(card)) {
        expect(line).not.toMatch(/undefined|NaN|\[object/);
        expect(line.length).toBeGreaterThan(5);
      }
    }
  });
});

describe("local game against the computer", () => {
  it("starts by asking you, the Rock-Paper-Scissors winner, who goes first", () => {
    const game = newGame(1);
    expect(game.state.prompt).toEqual({ kind: "chooseTurnOrder", player: "p1" });
    expect(botToAct(game)).toBe(false);
  });

  it("plays 20 full games from the turn order choice to a winner", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const game = playOut(newGame(seed));
      expect(game.state.winner, `seed ${seed}`).not.toBeNull();
      expect(game.log.at(-1)?.text).toMatch(/win|draw/);
    }
  });

  it("logs actions in plain words", () => {
    let game = newGame(3);
    game = humanAct(game, { type: "chooseTurnOrder", player: "p1", goFirst: true });
    game = humanAct(game, { type: "keepHand", player: "p1" });
    expect(game.log.map((l) => l.text)).toContain("You chose to go first.");
    expect(game.log.map((l) => l.text)).toContain("You kept the opening hand.");
  });

  it("logs Life cards being turned face-up and face-down (rule 3-10-2-1)", () => {
    let game = newGame(3);
    game = humanAct(game, { type: "chooseTurnOrder", player: "p1", goFirst: true });
    game = humanAct(game, { type: "keepHand", player: "p1" });
    while (botToAct(game)) game = botStep(game);
    const before = structuredClone(game.state);
    const after = structuredClone(game.state);
    after.players.p1.life[0]!.faceUp = true;
    after.players.p1.life[1]!.faceUp = true;
    after.players.p2.life[0]!.faceUp = true;
    const flippedUp = describeChanges(before, after, "p1").map((l) => l.text);
    expect(flippedUp).toContain("Your 2 Life cards were turned face-up.");
    expect(flippedUp).toContain("Opponent's 1 Life card was turned face-up.");
    const flippedDown = structuredClone(after);
    flippedDown.players.p1.life[1]!.faceUp = false;
    expect(describeChanges(after, flippedDown, "p1").map((l) => l.text)).toEqual([
      "Your 1 Life card was turned face-down.",
    ]);
  });

  it("says how many Life cards a hit took, and why when it was [Double Attack]", () => {
    const deck = Array<string>(10).fill("DEMO-R09");
    const state = buildScenarioState(
      {
        p1: { leader: "DEMO-R00", characters: ["DEMO-R08"], deck, life: deck.slice(0, 3) },
        p2: { leader: "DEMO-G00", life: ["DEMO-R09", "DEMO-R09", "DEMO-R09"], deck },
      },
      DEMO_CATALOG,
    );
    let game: LocalGame = { ...newGame(1), state };
    const attacker = state.players.p1.characters[0]!.uid;
    const target = state.players.p2.leader.uid;
    game = humanAct(game, { type: "attack", player: "p1", attacker, target });
    game = humanAct(game, { type: "pass", player: "p2" });
    expect(game.log.map((l) => l.text)).toContain(
      "Opponent lost 2 Life cards ([Double Attack] deals 2 damage). Life: 1.",
    );
  });

  it("never shows the computer's hand in your view", () => {
    let game = newGame(4);
    for (let i = 0; i < 200 && game.state.winner === null; i++) {
      const view = viewFor(game.state, game.human);
      expect(view.players.p2.hand).toBeNull();
      game = botToAct(game)
        ? botStep(game)
        : humanAct(game, chooseBotAction(game.state, game.human));
    }
  });
});

describe("Undo against the computer", () => {
  /** Plays until it's your main phase with the computer having just moved, then returns. */
  function toMyMain(game: LocalGame): LocalGame {
    for (let i = 0; i < 400; i++) {
      if (botToAct(game)) game = botStep(game);
      else if (game.state.prompt.kind === "main" && game.state.players.p1.turnsTaken >= 2) break;
      else game = humanAct(game, chooseBotAction(game.state, game.human));
    }
    return game;
  }

  it("takes back your last move and everything the computer did after it", () => {
    let game = toMyMain(newGame(5));
    const before = game;
    game = humanAct(game, { type: "endTurn", player: "p1" });
    while (botToAct(game)) game = botStep(game);
    expect(game.actions.length).toBeGreaterThan(before.actions.length + 1);
    expect(canUndo(game)).toBe(true);

    const undone = undoMove(game, game.clock.since + 1000);
    expect(undone.state).toBe(before.state);
    expect(undone.actions).toEqual(before.actions);
    expect(undone.undos).toHaveLength(1);
    expect(undone.undos![0]!.move).toBe("You ended the turn.");
    expect(undone.log.at(-1)?.text).toMatch(/You used Undo/);
    // The time you spent stays on your clock.
    expect(undone.clock.used.p1 + undone.clock.used.p2).toBeGreaterThanOrEqual(
      game.clock.used.p1 + game.clock.used.p2,
    );
  });

  it("can take back several moves in a row, then runs out", () => {
    let game = newGame(2);
    game = humanAct(game, { type: "chooseTurnOrder", player: "p1", goFirst: true });
    game = humanAct(game, { type: "keepHand", player: "p1" });
    while (botToAct(game)) game = botStep(game);
    game = undoMove(undoMove(game));
    expect(game.state.prompt).toEqual({ kind: "chooseTurnOrder", player: "p1" });
    expect(game.undos).toHaveLength(2);
    expect(canUndo(game)).toBe(false);
    expect(undoMove(game)).toBe(game);
  });

  it("isn't offered online or once the game is over", () => {
    const online = humanAct(
      { ...newGame(1), opponent: "friend" },
      { type: "chooseTurnOrder", player: "p1", goFirst: true },
    );
    expect(canUndo(online)).toBe(false);
    expect(canUndo(playOut(newGame(4)))).toBe(false);
  });

  it("counts each Undo in the Pro Drills report", () => {
    let game = newLocalGame(DEMO_CATALOG, { human: DEMO_DECKS.red, bot: DEMO_DECKS.green }, 7, {
      mode: "drills",
      liveCoaching: false,
    });
    game = toMyMain(game);
    game = humanAct(game, { type: "endTurn", player: "p1" });
    while (botToAct(game)) game = botStep(game);
    game = undoMove(game);
    expect(game.states).toHaveLength(game.actions.length + 1);
    game = playOut(game);
    const plain = reviewGame(game.states!, game.actions, "p1");
    const review = reviewGame(game.states!, game.actions, "p1", game.undos);
    expect(review.undos).toHaveLength(1);
    expect(review.cleanTurns).toBeLessThanOrEqual(plain.cleanTurns);
    const turn = game.undos![0]!.turn;
    const hadErrors = plain.mistakes.some((m) => m.turn === turn);
    expect(review.cleanTurns).toBe(plain.cleanTurns - (hadErrors ? 0 : 1));
  });
});
