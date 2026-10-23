import type { CardCatalog } from "./cards.js";
import { validateDeck } from "./deck.js";
import { nextRandom, shuffleInPlace } from "./rng.js";
import type { CardInstance, GameState, PlayerId, PlayerState } from "./types.js";

export interface DeckList {
  leader: string;
  /** 50 card ids (rule 5-1-2). */
  deck: string[];
}

export interface NewGameOptions {
  catalog: CardCatalog;
  decks: Record<PlayerId, DeckList>;
  seed: number;
  /** Who won Rock-Paper-Scissors (rule 5-2-1-4). Picked at random from the seed if omitted. */
  chooser?: PlayerId;
}

/** Rules 5-2-1-1 to 5-2-1-4. Throws if a deck breaks the construction rules (5-1-2). */
export function createGame(options: NewGameOptions): GameState {
  const { catalog, decks } = options;
  for (const player of ["p1", "p2"] as const) {
    const errors = validateDeck(catalog, decks[player].leader, decks[player].deck);
    if (errors.length > 0) throw new Error(`Invalid deck for ${player}: ${errors.join("; ")}`);
  }

  let rng = options.seed;
  let nextUid = 1;
  const instance = (cardId: string, owner: PlayerId): CardInstance => ({
    uid: `c${nextUid++}`,
    cardId,
    owner,
    rested: false,
    givenDon: 0,
    playedTurn: null,
  });
  const playerState = (player: PlayerId): PlayerState => {
    const deck = decks[player].deck.map((id) => instance(id, player));
    rng = shuffleInPlace(deck, rng);
    return {
      leader: instance(decks[player].leader, player),
      deck,
      hand: [],
      trash: [],
      characters: [],
      stage: null,
      life: [],
      donDeck: 10,
      donActive: 0,
      donRested: 0,
      turnsTaken: 0,
    };
  };

  const players = { p1: playerState("p1"), p2: playerState("p2") };
  let chooser = options.chooser;
  if (!chooser) {
    const [value, next] = nextRandom(rng);
    rng = next;
    chooser = value < 0.5 ? "p1" : "p2";
  }

  return {
    catalog,
    players,
    turn: 0,
    turnPlayer: chooser,
    firstPlayer: null,
    phase: "setup",
    prompt: { kind: "chooseTurnOrder", player: chooser },
    battle: null,
    winner: null,
    stack: [],
    pendingEffects: [],
    modifiers: [],
    usedThisTurn: [],
    delayed: [],
    limbo: null,
    rng,
    nextUid,
  };
}
