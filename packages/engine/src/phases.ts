/**
 * Turn phases, in the order they happen each turn.
 * Comprehensive Rules 6-1 (Turn Flow) and 6-2 through 6-6.
 */
export const PHASES = ["refresh", "draw", "don", "main", "end"] as const;

export type Phase = (typeof PHASES)[number];

/** The phase after `phase`, or `null` once the End Phase finishes and the turn passes. */
export function nextPhase(phase: Phase): Phase | null {
  const index = PHASES.indexOf(phase);
  return PHASES[index + 1] ?? null;
}

/**
 * Cards drawn in the Draw Phase. The player going first skips the draw
 * on their first turn (rule 6-3-1).
 */
export function cardsToDraw(turnNumber: number, isFirstPlayer: boolean): number {
  return turnNumber === 1 && isFirstPlayer ? 0 : 1;
}

/**
 * DON!! cards placed in the DON!! Phase. The player going first places 1
 * on their first turn instead of 2 (rule 6-4-1).
 */
export function donToPlace(turnNumber: number, isFirstPlayer: boolean): number {
  return turnNumber === 1 && isFirstPlayer ? 1 : 2;
}
