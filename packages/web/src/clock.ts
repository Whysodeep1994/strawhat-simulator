import type { GameState, PlayerId } from "@strawhat/engine";

/**
 * Chess-clock style timers. Each player has 15 minutes for the whole game. A player's clock
 * runs whenever the game is waiting on them, which includes Counter, Blocker and [Trigger]
 * choices on the other player's turn. When it reaches zero, that player loses.
 */
export const CLOCK_MS = 15 * 60 * 1000;

/**
 * How far past zero a friend's clock may go on your screen before your page ends the game for
 * them. Their own page ends it at zero; this only covers a page that froze or was closed.
 */
export const FRIEND_GRACE_MS = 5000;

export interface Clock {
  /** Time each player has used, up to `since`. */
  used: Record<PlayerId, number>;
  /** When the current decision started (milliseconds since 1970, like Date.now()). */
  since: number;
}

export function newClock(now: number = Date.now()): Clock {
  return { used: { p1: 0, p2: 0 }, since: now };
}

/** Whose clock is running: the player the game is waiting on, or null once it's over. */
export function running(state: GameState): PlayerId | null {
  return state.prompt.kind === "gameOver" ? null : state.prompt.player;
}

/** Charges the time since the last decision to whoever was deciding. */
export function charge(clock: Clock, state: GameState, now: number): Clock {
  const player = running(state);
  const spent = Math.max(0, now - clock.since);
  if (!player || spent === 0) return { ...clock, since: Math.max(clock.since, now) };
  return { used: { ...clock.used, [player]: clock.used[player] + spent }, since: now };
}

/** Milliseconds `player` has left. Below zero once their time has run out. */
export function timeLeft(clock: Clock, state: GameState, player: PlayerId, now: number): number {
  const live = running(state) === player ? Math.max(0, now - clock.since) : 0;
  return CLOCK_MS - clock.used[player] - live;
}

/** Shows time left as m:ss, never below 0:00. */
export function formatClock(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
