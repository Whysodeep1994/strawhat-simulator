/** Small deterministic random generator (mulberry32), so games and tests can be replayed. */
export function nextRandom(seed: number): [value: number, nextSeed: number] {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** Fisher-Yates shuffle in place. Returns the new seed. */
export function shuffleInPlace<T>(items: T[], seed: number): number {
  let current = seed;
  for (let i = items.length - 1; i > 0; i--) {
    const [value, next] = nextRandom(current);
    current = next;
    const j = Math.floor(value * (i + 1));
    const a = items[i] as T;
    items[i] = items[j] as T;
    items[j] = a;
  }
  return current;
}
