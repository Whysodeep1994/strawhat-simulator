import { describe, expect, it } from "vitest";
import {
  applyAction,
  createGame,
  legalActions,
  type GameState,
  type PlayerId,
} from "../src/index.js";
import { nextRandom } from "../src/rng.js";
import { TEST_CATALOG } from "./fixtures/test-cards.js";

const deck = [
  "TEST-C2-3000",
  "TEST-C4-5000",
  "TEST-C5-6000",
  "TEST-BLOCKER",
  "TEST-RUSH",
  "TEST-RUSH-CHAR",
  "TEST-DOUBLE",
  "TEST-BANISH",
  "TEST-UNBLOCKABLE",
  "TEST-STAGE",
  "TEST-STAGE-2",
  "TEST-EVENT",
].flatMap((id) => Array<string>(4).fill(id));
deck.push("TEST-FILLER", "TEST-FILLER");

function cardCount(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  return (
    1 +
    p.deck.length +
    p.hand.length +
    p.trash.length +
    p.characters.length +
    p.life.length +
    (p.stage ? 1 : 0)
  );
}

function donCount(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  const given = [p.leader, ...p.characters].reduce((sum, c) => sum + c.givenDon, 0);
  return p.donDeck + p.donActive + p.donRested + given;
}

describe("random games", () => {
  it("100 games of random legal moves never break, lose cards, or lose DON!!", () => {
    for (let seed = 1; seed <= 100; seed++) {
      let state = createGame({
        catalog: TEST_CATALOG,
        decks: { p1: { leader: "TEST-LEADER", deck }, p2: { leader: "TEST-LEADER", deck } },
        seed,
      });
      let rng = seed * 7919;
      for (let step = 0; step < 2000 && state.winner === null; step++) {
        // Concede only shows up when nothing else is possible, which never happens mid-game.
        const options = legalActions(state).filter((a) => a.type !== "concede");
        expect(options.length).toBeGreaterThan(0);
        const [value, next] = nextRandom(rng);
        rng = next;
        state = applyAction(state, options[Math.floor(value * options.length)]!);
        for (const player of ["p1", "p2"] as const) {
          expect(cardCount(state, player)).toBe(51);
          expect(donCount(state, player)).toBe(10);
          expect(state.players[player].characters.length).toBeLessThanOrEqual(5);
        }
      }
      expect(state.winner, `game with seed ${seed} never finished`).not.toBeNull();
    }
  });
});
