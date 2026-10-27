import { PLAYER_IDS, type GameState, type PlayerId } from "@strawhat/engine";

/** A sound the table makes. */
export type Cue = "play" | "attack" | "discard" | "yourTurn" | "theirTurn";

/**
 * The sounds for one change of the game, worked out from the states before and after it, so the
 * same thing sounds the same whoever did it: you, the computer, or a friend online.
 */
export function cuesBetween(before: GameState, after: GameState, me: PlayerId): Cue[] {
  // A turn count going backwards is a new game, not a move.
  if (before === after || after.turn < before.turn) return [];
  const cues: Cue[] = [];

  const onField = (s: GameState) =>
    new Set(
      PLAYER_IDS.flatMap((p) => {
        const { characters, stage } = s.players[p];
        return [...characters, ...(stage ? [stage] : [])].map((c) => c.uid);
      }),
    );
  const was = onField(before);
  const placed = [...onField(after)].some((uid) => !was.has(uid));
  // Events played this turn; the list is trimmed to the current turn as each turn starts.
  const eventsNow = (s: GameState) =>
    (s.activatedEvents ?? []).filter((e) => e.turn === after.turn).length;
  const events = Math.max(0, eventsNow(after) - eventsNow(before));
  if (placed || events > 0) cues.push("play");

  if (after.battle && after.battle.attacker !== before.battle?.attacker) cues.push("attack");

  // Cards going to the trash, other than the Events just played (they go there on their own).
  const trashed = PLAYER_IDS.reduce(
    (n, p) => n + Math.max(0, after.players[p].trash.length - before.players[p].trash.length),
    0,
  );
  if (trashed > events) cues.push("discard");

  if (after.turn > before.turn && after.turn >= 1) {
    cues.push(after.turnPlayer === me ? "yourTurn" : "theirTurn");
  }
  return cues;
}
