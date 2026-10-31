import {
  applyAction,
  checkDeck,
  chooseBotAction,
  copyLimit,
  createGame,
  legalActions,
  type Action,
  type CardCatalog,
  type DeckFormat,
  type DeckList,
  type GameState,
  type PlayerId,
} from "@strawhat/engine";

/**
 * The Matchup Lab: the computer plays deck A against deck B many times, with no board on screen,
 * to estimate how often each deck wins. It can also try small card swaps in deck A to see which
 * ones win more. The numbers are only as good as the computer player (engine/src/bot.ts).
 */

/** How one game went, from deck A's side. */
export interface GameResult {
  winner: "a" | "b" | "draw";
  /** Whether deck A took the first turn. */
  aFirst: boolean;
  turns: number;
  /** Deck A's cards that reached its hand or the field at some point. */
  seen: string[];
}

/** For one card in deck A: games where it was drawn (or played), and how many of those A won. */
export interface CardStat {
  games: number;
  wins: number;
}

/** Many games added up. */
export interface Tally {
  games: number;
  aWins: number;
  bWins: number;
  draws: number;
  /** Games where deck A went first, and how many of those it won. */
  aFirstGames: number;
  aFirstWins: number;
  aSecondGames: number;
  aSecondWins: number;
  turns: number;
  /** Card number → how deck A did in games where that card was drawn. */
  cards: Record<string, CardStat>;
}

/** A game that runs this many moves is going round in circles, so it counts as a draw. */
export const MAX_ACTIONS = 3000;
/** The most moves in a row one player makes before it just passes or ends its turn. */
const MAX_STREAK = 300;

/**
 * Plays one game, computer vs computer. Deck A goes first in even-numbered games and second in
 * odd ones, so both decks get the same share of first turns.
 */
export function playGame(catalog: CardCatalog, a: DeckList, b: DeckList, game: number): GameResult {
  const aFirst = game % 2 === 0;
  // Deck A sits in seat p1. Whoever wins Rock-Paper-Scissors (the chooser) goes first.
  let state = createGame({
    catalog,
    decks: { p1: a, p2: b },
    seed: seedOf(game),
    chooser: aFirst ? "p1" : "p2",
  });
  let streak = 0;
  let last: PlayerId | null = null;
  const seen = new Set<string>();
  for (let n = 0; n < MAX_ACTIONS && state.prompt.kind !== "gameOver"; n++) {
    const player = state.prompt.player;
    if (state.prompt.kind === "chooseTurnOrder") {
      state = applyAction(state, { type: "chooseTurnOrder", player, goFirst: true });
      continue;
    }
    streak = player === last ? streak + 1 : 0;
    last = player;
    state = step(state, player, streak < MAX_STREAK);
    const me = state.players.p1;
    for (const c of me.hand) seen.add(c.cardId);
    for (const c of me.characters) seen.add(c.cardId);
    if (me.stage) seen.add(me.stage.cardId);
  }
  const winner = state.winner;
  return {
    winner: winner === "p1" ? "a" : winner === "p2" ? "b" : "draw",
    aFirst,
    turns: state.turn,
    seen: [...seen],
  };
}

/** One computer move, the safe way: if its choice fails, it passes, then tries anything legal. */
function step(state: GameState, player: PlayerId, think: boolean): GameState {
  if (think) {
    try {
      return applyAction(state, chooseBotAction(state, player));
    } catch {
      // Fall back to a safe move below.
    }
  }
  let legal: Action[] = [];
  try {
    legal = legalActions(state, player).filter((a) => a.type !== "concede");
  } catch {
    // Conceding below still ends the game.
  }
  const safe = legal.filter((a) => a.type === "pass" || a.type === "endTurn");
  const others = legal.filter((a) => a.type !== "pass" && a.type !== "endTurn");
  for (const action of [...safe, ...others, { type: "concede", player } as Action]) {
    try {
      return applyAction(state, action);
    } catch {
      // Try the next one.
    }
  }
  return { ...state, winner: "draw", prompt: { kind: "gameOver" }, phase: "gameOver" };
}

/**
 * Game number → shuffle seed. Every deck is tested on the same list of seeds, so two versions
 * of a deck face the same luck of the draw as far as possible, which makes comparisons fairer.
 */
export function seedOf(game: number): number {
  return Math.imul(game + 1, 2654435761) >>> 0 || 1;
}

export function emptyTally(): Tally {
  return {
    games: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    aFirstGames: 0,
    aFirstWins: 0,
    aSecondGames: 0,
    aSecondWins: 0,
    turns: 0,
    cards: {},
  };
}

export function addResult(tally: Tally, r: GameResult): Tally {
  const aWon = r.winner === "a" ? 1 : 0;
  return {
    games: tally.games + 1,
    aWins: tally.aWins + aWon,
    bWins: tally.bWins + (r.winner === "b" ? 1 : 0),
    draws: tally.draws + (r.winner === "draw" ? 1 : 0),
    aFirstGames: tally.aFirstGames + (r.aFirst ? 1 : 0),
    aFirstWins: tally.aFirstWins + (r.aFirst ? aWon : 0),
    aSecondGames: tally.aSecondGames + (r.aFirst ? 0 : 1),
    aSecondWins: tally.aSecondWins + (r.aFirst ? 0 : aWon),
    turns: tally.turns + r.turns,
    cards: mergeCards(
      tally.cards,
      Object.fromEntries(r.seen.map((id) => [id, { games: 1, wins: aWon }])),
    ),
  };
}

export function mergeTallies(x: Tally, y: Tally): Tally {
  const out = emptyTally();
  for (const key of Object.keys(out) as (keyof Tally)[]) {
    if (key !== "cards") out[key] = x[key] + y[key];
  }
  out.cards = mergeCards(x.cards, y.cards);
  return out;
}

function mergeCards(
  x: Record<string, CardStat>,
  y: Record<string, CardStat>,
): Record<string, CardStat> {
  const out = { ...x };
  for (const [id, s] of Object.entries(y)) {
    const old = out[id];
    out[id] = old ? { games: old.games + s.games, wins: old.wins + s.wins } : s;
  }
  return out;
}

/** Plays games `from` to `to - 1`. */
export function playGames(
  catalog: CardCatalog,
  a: DeckList,
  b: DeckList,
  from: number,
  to: number,
): Tally {
  let tally = emptyTally();
  for (let g = from; g < to; g++) tally = addResult(tally, playGame(catalog, a, b, g));
  return tally;
}

/** Deck A's win rate, 0 to 1. A draw counts as half a win. */
export function winRate(t: Tally): number {
  return t.games === 0 ? 0 : (t.aWins + t.draws / 2) / t.games;
}

/**
 * How far off the win rate could be just from luck: 95% of the time the true rate (for these
 * two decks played by this computer player) is within this much of the measured one.
 */
export function margin(t: Tally): number {
  if (t.games === 0) return 1;
  const p = winRate(t);
  return 1.96 * Math.sqrt(Math.max(p * (1 - p), 0.01) / t.games);
}

/** The same, for the gap between two win rates measured over separate games. */
export function gapMargin(x: Tally, y: Tally): number {
  return Math.hypot(margin(x), margin(y));
}

/** A card in deck A, with how deck A did when it was drawn. */
export interface CardImpact {
  card: string;
  copies: number;
  /** Games where it was drawn, out of all games played. */
  drawn: number;
  /** Deck A's win rate in those games, or null when it was hardly ever drawn. */
  rate: number | null;
}

/** Fewer games than this and a card's "win rate when drawn" says too little to use. */
export const MIN_DRAWN = 20;

/**
 * Deck A's cards, best first by "win rate when drawn". Careful: long games draw more cards, so
 * this hints at which cards matter but doesn't prove it. Swaps are tested with real games.
 */
export function cardImpact(deck: DeckList, t: Tally): CardImpact[] {
  const counts = new Map<string, number>();
  for (const id of deck.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts]
    .map(([card, copies]) => {
      const s = t.cards[card] ?? { games: 0, wins: 0 };
      return { card, copies, drawn: s.games, rate: s.games >= MIN_DRAWN ? s.wins / s.games : null };
    })
    .sort((x, y) => (y.rate ?? -1) - (x.rate ?? -1));
}

/** One card out and one card in. */
export interface Swap {
  out: string;
  in: string;
}

/** The deck with one swap made. */
export function withSwap(deck: DeckList, swap: Swap): DeckList {
  const list = [...deck.deck];
  list.splice(list.indexOf(swap.out), 1);
  list.push(swap.in);
  return { leader: deck.leader, deck: list };
}

/**
 * The swaps worth testing, picked from the first batch of games: take out one of the cards with
 * the lowest win rate when drawn, and put in one with the highest (that has room for another
 * copy) or one of the extra cards the player wants to try.
 */
export function swapShortlist(
  catalog: CardCatalog,
  format: DeckFormat,
  deck: DeckList,
  baseline: Tally,
  extras: string[] = [],
  cuts = 4,
  adds = 3,
): Swap[] {
  const legal = swapsToTry(catalog, format, deck, extras);
  const ranked = cardImpact(deck, baseline).filter((c) => c.rate !== null);
  const outs = new Set(ranked.slice(-cuts).map((c) => c.card));
  const canAdd = new Set(legal.map((s) => s.in));
  const ins = new Set([
    ...ranked
      .map((c) => c.card)
      .filter((id) => canAdd.has(id) && !outs.has(id))
      .slice(0, adds),
    ...extras,
  ]);
  return legal.filter((s) => outs.has(s.out) && ins.has(s.in));
}

/**
 * Every "−1 of one card, +1 of another" change to the deck that keeps it legal: the new card is
 * one already in the deck (with room for another copy) or one of the extra cards to try. A swap
 * may not add a deck-building problem the deck didn't already have.
 */
export function swapsToTry(
  catalog: CardCatalog,
  format: DeckFormat,
  deck: DeckList,
  extras: string[] = [],
): Swap[] {
  const counts = new Map<string, number>();
  for (const id of deck.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
  const before = new Set(problems(catalog, format, deck));
  const ins = [...new Set([...counts.keys(), ...extras])].filter(
    (id) => (counts.get(id) ?? 0) < copyLimit(format, catalog, id),
  );
  const swaps: Swap[] = [];
  for (const out of counts.keys()) {
    for (const add of ins) {
      if (add === out) continue;
      const swap = { out, in: add };
      const after = problems(catalog, format, withSwap(deck, swap));
      if (after.every((p) => before.has(p))) swaps.push(swap);
    }
  }
  return swaps;
}

function problems(catalog: CardCatalog, format: DeckFormat, deck: DeckList): string[] {
  return checkDeck(catalog, format, deck.leader, deck.deck).map((p) => p.message);
}

/** A swap's result next to the deck as it is, both played on the same game numbers. */
export interface SwapResult {
  swap: Swap;
  tally: Tally;
  base: Tally;
}

/** How much the swap changed deck A's win rate (−1 to +1). */
export function gain(r: SwapResult): number {
  return winRate(r.tally) - winRate(r.base);
}

/** "better" only when the gain is bigger than luck alone could explain. */
export function verdict(r: SwapResult): "better" | "worse" | "unclear" {
  const g = gain(r);
  const m = gapMargin(r.tally, r.base);
  return g > m ? "better" : g < -m ? "worse" : "unclear";
}

/** The best swaps from a quick first look, to test again with more games. */
export function bestSwaps(results: SwapResult[], count: number): Swap[] {
  return [...results]
    .sort((x, y) => gain(y) - gain(x))
    .slice(0, count)
    .map((r) => r.swap);
}

/** "62.4%" */
export function percent(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits)}%`;
}
