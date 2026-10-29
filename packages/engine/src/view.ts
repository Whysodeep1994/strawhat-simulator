import type { Keyword } from "./cards.js";
import { costOf, findCard, keywordsOf, powerOf } from "./state.js";
import type { Battle, CardInstance, GameState, Modifier, PlayerId, Prompt } from "./types.js";

/** A face-up card, or just a count for a face-down pile. */
export interface PlayerView {
  leader: CardInstance;
  characters: CardInstance[];
  stage: CardInstance | null;
  trash: CardInstance[];
  /** Only filled in for the viewer's own hand (rule 3-4-3). */
  hand: CardInstance[] | null;
  handCount: number;
  /** Deck and Life contents are hidden from both players (rules 3-2-2, 3-10-2). */
  deckCount: number;
  lifeCount: number;
  /** Life cards top first: face-up ones are shown to both players, face-down ones are `null` (rule 3-10-2-1). */
  life: (CardInstance | null)[];
  donDeck: number;
  donActive: number;
  donRested: number;
  turnsTaken: number;
}

export interface GameView {
  viewer: PlayerId;
  players: Record<PlayerId, PlayerView>;
  turn: number;
  turnPlayer: PlayerId;
  firstPlayer: PlayerId | null;
  phase: GameState["phase"];
  prompt: Prompt;
  battle: Battle | null;
  winner: GameState["winner"];
  modifiers: Modifier[];
  /** Current power of every Leader and Character on the field, after DON!! and effects. */
  powers: Record<string, number>;
  /** Current cost of every Character and Stage on the field, after effects such as "+5 cost" (rule 2-7-1). */
  costs: Record<string, number>;
  /**
   * Keywords every Leader and Character has right now, printed or gained from an effect,
   * e.g. a Character that gained [Double Attack] this turn.
   */
  keywords: Record<string, Keyword[]>;
  /**
   * Cards the viewer needs to see to answer their prompt, such as the top of
   * their deck during a search or the Life card with a [Trigger].
   */
  promptCards: CardInstance[];
  /** A [Trigger] card being resolved is revealed to both players (rule 10-1-5-1). */
  limbo: CardInstance | null;
  /** Cards an effect just revealed to both players, e.g. from a hand (rule 11-2-1). */
  revealed: CardInstance[];
}

/**
 * What `viewer` is allowed to see. The server sends only this to each client,
 * so hidden cards never leave the server. The random seed is never included.
 */
export function viewFor(state: GameState, viewer: PlayerId): GameView {
  const player = (id: PlayerId): PlayerView => {
    const p = state.players[id];
    return {
      leader: p.leader,
      characters: p.characters,
      stage: p.stage,
      trash: p.trash,
      hand: id === viewer ? p.hand : null,
      handCount: p.hand.length,
      deckCount: p.deck.length,
      lifeCount: p.life.length,
      life: p.life.map((c) => (c.faceUp ? c : null)),
      donDeck: p.donDeck,
      donActive: p.donActive,
      donRested: p.donRested,
      turnsTaken: p.turnsTaken,
    };
  };
  return structuredClone({
    viewer,
    players: { p1: player("p1"), p2: player("p2") },
    turn: state.turn,
    turnPlayer: state.turnPlayer,
    firstPlayer: state.firstPlayer,
    phase: state.phase,
    prompt: state.prompt,
    battle: state.battle,
    winner: state.winner,
    modifiers: state.modifiers,
    powers: Object.fromEntries(
      (["p1", "p2"] as const).flatMap((id) =>
        [state.players[id].leader, ...state.players[id].characters].map((c) => [
          c.uid,
          powerOf(state, c),
        ]),
      ),
    ),
    costs: Object.fromEntries(
      (["p1", "p2"] as const).flatMap((id) => {
        const p = state.players[id];
        return [...p.characters, ...(p.stage ? [p.stage] : [])].map((c) => [
          c.uid,
          costOf(state, c),
        ]);
      }),
    ),
    keywords: Object.fromEntries(
      (["p1", "p2"] as const).flatMap((id) =>
        [state.players[id].leader, ...state.players[id].characters].map((c) => [
          c.uid,
          keywordsOf(state, c),
        ]),
      ),
    ),
    promptCards: promptCardsFor(state, viewer),
    limbo: state.limbo,
    revealed: (state.revealed ?? [])
      .map((uid) => findCard(state, uid))
      .filter((c): c is CardInstance => c !== null),
  });
}

function promptCardsFor(state: GameState, viewer: PlayerId): CardInstance[] {
  const prompt = state.prompt;
  // Face-down options, such as cards in the opponent's hand, stay hidden.
  if (prompt.kind === "choose" && prompt.player === viewer && !prompt.hidden) {
    const uids = [...new Set([...(prompt.revealed ?? []), ...prompt.options])];
    return uids.map((uid) => findCard(state, uid)).filter((c): c is CardInstance => c !== null);
  }
  if ((prompt.kind === "confirm" || prompt.kind === "chooseOne") && prompt.player === viewer) {
    const card = findCard(state, prompt.source);
    return card ? [card] : [];
  }
  return [];
}
