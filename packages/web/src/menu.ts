/**
 * Moves the highlight in a game-style menu by `step` (+1 down, −1 up), skipping items that
 * can't be picked and wrapping around the ends. Returns `current` when nothing can be picked.
 */
export function moveHighlight(enabled: boolean[], current: number, step: 1 | -1): number {
  const n = enabled.length;
  for (let i = 1; i <= n; i++) {
    const next = (((current + step * i) % n) + n) % n;
    if (enabled[next]) return next;
  }
  return current;
}
