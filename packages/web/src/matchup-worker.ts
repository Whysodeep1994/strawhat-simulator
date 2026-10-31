/// <reference lib="webworker" />
import type { CardCatalog, DeckList } from "@strawhat/engine";
import { playGames, type Tally } from "./matchup.js";

/** A helper that plays Matchup Lab games in the background, so the page stays smooth. */
export type WorkerIn =
  | { type: "cards"; catalog: CardCatalog }
  | { type: "play"; job: number; a: DeckList; b: DeckList; from: number; to: number };
export type WorkerOut = { job: number; tally: Tally } | { job: number; error: string };

let catalog: CardCatalog | null = null;

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.type === "cards") {
    catalog = msg.catalog;
    return;
  }
  try {
    if (!catalog) throw new Error("The cards haven't arrived yet.");
    const tally = playGames(catalog, msg.a, msg.b, msg.from, msg.to);
    self.postMessage({ job: msg.job, tally } satisfies WorkerOut);
  } catch (err) {
    self.postMessage({ job: msg.job, error: String(err) } satisfies WorkerOut);
  }
};
