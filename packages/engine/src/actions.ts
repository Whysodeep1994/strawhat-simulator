import type { PlayerId } from "./types.js";

/** Everything a player can do. `legalActions` lists the ones allowed right now. */
export type Action =
  | { type: "chooseTurnOrder"; player: PlayerId; goFirst: boolean }
  | { type: "keepHand"; player: PlayerId }
  | { type: "mulligan"; player: PlayerId }
  /** Characters, Stages, and [Main] Events (rule 6-5-3-1). */
  | { type: "playCard"; player: PlayerId; card: string; trash?: string }
  /** [Activate: Main] effects (rule 6-5-4-1). `effect` is its index on the card. */
  | { type: "activate"; player: PlayerId; card: string; effect: number }
  | { type: "giveDon"; player: PlayerId; target: string }
  | { type: "attack"; player: PlayerId; attacker: string; target: string }
  | { type: "endTurn"; player: PlayerId }
  | { type: "block"; player: PlayerId; blocker: string }
  | { type: "counter"; player: PlayerId; card: string; target: string }
  /** [Counter] Events (rule 7-1-3-1-2). */
  | { type: "counterEvent"; player: PlayerId; card: string }
  | { type: "choose"; player: PlayerId; cards: string[] }
  | { type: "confirm"; player: PlayerId; accept: boolean }
  /** Answers a "choose one" prompt with the option's index. */
  | { type: "chooseOne"; player: PlayerId; option: number }
  | { type: "pass"; player: PlayerId }
  | { type: "concede"; player: PlayerId };
