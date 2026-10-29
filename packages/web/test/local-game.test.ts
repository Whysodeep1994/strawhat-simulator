import { buildScenarioState, chooseBotAction, validateDeck, viewFor } from "@strawhat/engine";
import { describe, expect, it } from "vitest";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";
import { cardText } from "../src/describe.js";
import { botStep, botToAct, humanAct, newLocalGame, type LocalGame } from "../src/local-game.js";

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
