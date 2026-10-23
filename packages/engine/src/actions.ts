import type { PlayerId } from "./types.js";

/** Everything a player can do. `legalActions` lists the ones allowed right now. */
export type Action =
  | { type: "chooseTurnOrder"; player: PlayerId; goFirst: boolean }
  | { type: "keepHand"; player: PlayerId }
  | { type: "mulligan"; player: PlayerId }
  | { type: "playCard"; player: PlayerId; card: string; trash?: string }
  | { type: "giveDon"; player: PlayerId; target: string }
  | { type: "attack"; player: PlayerId; attacker: string; target: string }
  | { type: "endTurn"; player: PlayerId }
  | { type: "block"; player: PlayerId; blocker: string }
  | { type: "counter"; player: PlayerId; card: string; target: string }
  | { type: "pass"; player: PlayerId }
  | { type: "concede"; player: PlayerId };
