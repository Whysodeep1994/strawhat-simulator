import type { Battle, CardInstance, GameState, PlayerId, Prompt } from "./types.js";

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
  });
}
