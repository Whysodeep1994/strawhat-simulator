import type { Action } from "@strawhat/engine";

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

/**
 * The Counter a hand card's menu uses: the one that powers up the card being attacked (the
 * [Blocker], once one steps in), never the Leader by mistake.
 */
export function counterFor(actions: Action[], attacked: string | undefined): Action | undefined {
  const counters = actions.filter((a) => a.type === "counter");
  return counters.find((a) => a.type === "counter" && a.target === attacked) ?? counters[0];
}
