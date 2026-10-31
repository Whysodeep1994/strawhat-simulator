import type { CardCatalog, DeckList } from "@strawhat/engine";
import { emptyTally, mergeTallies, playGames, type Tally } from "./matchup.js";
import type { WorkerIn, WorkerOut } from "./matchup-worker.js";

/** Games one helper plays before reporting back, so the progress bar moves often. */
const CHUNK = 10;

/** A batch of games: deck A against deck B, game numbers `from` to `to - 1`. */
export interface Batch {
  a: DeckList;
  b: DeckList;
  from: number;
  to: number;
}

/**
 * Plays batches of games on background helpers (Web Workers), one per spare processor core.
 * Without workers (old browsers, tests) it plays them here, a few at a time.
 */
export class MatchupPool {
  private workers: Worker[] = [];
  private stopped = false;

  constructor(private catalog: CardCatalog) {
    if (typeof Worker === "undefined") return;
    const cores = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < cores; i++) {
      const worker = new Worker(new URL("./matchup-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.postMessage({ type: "cards", catalog } satisfies WorkerIn);
      this.workers.push(worker);
    }
  }

  /** Stops every helper. Unfinished batches never resolve. */
  stop(): void {
    this.stopped = true;
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }

  /**
   * Plays every batch and returns one tally for each. `onGames` is told how many games have
   * finished so far, across all batches.
   */
  async run(batches: Batch[], onGames: (done: number) => void): Promise<Tally[]> {
    const chunks = batches.flatMap((b, i) => {
      const out: { batch: number; from: number; to: number }[] = [];
      for (let g = b.from; g < b.to; g += CHUNK)
        out.push({ batch: i, from: g, to: Math.min(b.to, g + CHUNK) });
      return out;
    });
    const tallies = batches.map(() => emptyTally());
    let done = 0;
    const finish = (batch: number, tally: Tally) => {
      tallies[batch] = mergeTallies(tallies[batch]!, tally);
      done += tally.games;
      onGames(done);
    };

    if (this.workers.length === 0) {
      for (const c of chunks) {
        if (this.stopped) return new Promise(() => {});
        const b = batches[c.batch]!;
        finish(c.batch, playGames(this.catalog, b.a, b.b, c.from, c.to));
        await new Promise((r) => setTimeout(r, 0));
      }
      return tallies;
    }

    let next = 0;
    await Promise.all(
      this.workers.map(async (worker) => {
        while (next < chunks.length) {
          const job = next++;
          const c = chunks[job]!;
          const b = batches[c.batch]!;
          const tally = await new Promise<Tally>((resolve, reject) => {
            worker.onmessage = (e: MessageEvent<WorkerOut>) =>
              "error" in e.data ? reject(new Error(e.data.error)) : resolve(e.data.tally);
            worker.postMessage({
              type: "play",
              job,
              a: b.a,
              b: b.b,
              from: c.from,
              to: c.to,
            } satisfies WorkerIn);
          });
          finish(c.batch, tally);
        }
      }),
    );
    return tallies;
  }
}
