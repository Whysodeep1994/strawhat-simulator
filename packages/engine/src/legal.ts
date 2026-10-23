import type { Action } from "./actions.js";
import { hasKeyword } from "./cards.js";
import { definitionOf, findOnField } from "./state.js";
import { opponentOf, type CardInstance, type GameState, type PlayerId } from "./types.js";

/**
 * Every action `player` may take right now. The UI uses this to highlight
 * playable cards, so the engine never relies on the UI to enforce rules.
 * Defaults to the player the game is waiting on.
 */
export function legalActions(state: GameState, player?: PlayerId): Action[] {
  const prompt = state.prompt;
  if (prompt.kind === "gameOver") return [];
  const who = player ?? prompt.player;
  const actions: Action[] = [];

  if (prompt.player === who) {
    switch (prompt.kind) {
      case "chooseTurnOrder":
        actions.push(
          { type: "chooseTurnOrder", player: who, goFirst: true },
          { type: "chooseTurnOrder", player: who, goFirst: false },
        );
        break;
      case "mulligan":
        actions.push({ type: "keepHand", player: who }, { type: "mulligan", player: who });
        break;
      case "main":
        actions.push(...playActions(state, who), ...giveDonActions(state, who));
        actions.push(...attackActions(state, who), { type: "endTurn", player: who });
        break;
      case "block":
        actions.push(...blockActions(state, who), { type: "pass", player: who });
        break;
      case "counter":
        actions.push(...counterActions(state, who), { type: "pass", player: who });
        break;
    }
  }

  // Rule 1-2-3: either player may concede at any point.
  actions.push({ type: "concede", player: who });
  return actions;
}

/** Rules 6-5-3-1, 2-7-2, 2-7-4, 3-7-6-1, 3-8-5-1. Events need the effect library (Phase 4). */
function playActions(state: GameState, player: PlayerId): Action[] {
  const p = state.players[player];
  const actions: Action[] = [];
  for (const card of p.hand) {
    const def = definitionOf(state, card);
    if (def.category !== "character" && def.category !== "stage") continue;
    if ((def.cost ?? 0) > p.donActive) continue;
    if (def.category === "character" && p.characters.length >= 5) {
      for (const existing of p.characters) {
        actions.push({ type: "playCard", player, card: card.uid, trash: existing.uid });
      }
    } else {
      actions.push({ type: "playCard", player, card: card.uid });
    }
  }
  return actions;
}

/** Rule 6-5-5-1. */
function giveDonActions(state: GameState, player: PlayerId): Action[] {
  const p = state.players[player];
  if (p.donActive === 0) return [];
  return [p.leader, ...p.characters].map((c) => ({ type: "giveDon", player, target: c.uid }));
}

/** Rules 6-5-6-1, 7-1, 7-1-1-1, 7-1-1-2, 3-7-4, 10-1-1-1, 10-1-6-1. */
function attackActions(state: GameState, player: PlayerId): Action[] {
  const p = state.players[player];
  if (p.turnsTaken <= 1) return [];
  const opponent = state.players[opponentOf(player)];
  const restedCharacters = opponent.characters.filter((c) => c.rested).map((c) => c.uid);
  const actions: Action[] = [];
  for (const attacker of [p.leader, ...p.characters]) {
    if (attacker.rested) continue;
    const targets = attackTargets(state, attacker, opponent.leader.uid, restedCharacters);
    for (const target of targets)
      actions.push({ type: "attack", player, attacker: attacker.uid, target });
  }
  return actions;
}

function attackTargets(
  state: GameState,
  attacker: CardInstance,
  leader: string,
  restedCharacters: string[],
): string[] {
  if (attacker.playedTurn !== state.turn) return [leader, ...restedCharacters];
  const def = definitionOf(state, attacker);
  if (hasKeyword(def, "rush")) return [leader, ...restedCharacters];
  if (hasKeyword(def, "rushCharacter")) return restedCharacters;
  return [];
}

/** Rules 7-1-2-1, 10-1-4-1, 10-1-7-1. */
function blockActions(state: GameState, player: PlayerId): Action[] {
  return eligibleBlockers(state, player).map((c) => ({ type: "block", player, blocker: c.uid }));
}

export function eligibleBlockers(state: GameState, player: PlayerId): CardInstance[] {
  const battle = state.battle;
  if (!battle) return [];
  const attacker = findOnField(state, battle.attacker);
  if (!attacker || hasKeyword(definitionOf(state, attacker.card), "unblockable")) return [];
  return state.players[player].characters.filter(
    (c) => !c.rested && c.uid !== battle.target && hasKeyword(definitionOf(state, c), "blocker"),
  );
}

/** Rule 7-1-3-1-1. [Counter] Events need the effect library (Phase 4). */
function counterActions(state: GameState, player: PlayerId): Action[] {
  const p = state.players[player];
  const targets = [p.leader, ...p.characters].map((c) => c.uid);
  const actions: Action[] = [];
  for (const card of p.hand) {
    const def = definitionOf(state, card);
    if (def.category !== "character" || !def.counter) continue;
    for (const target of targets) actions.push({ type: "counter", player, card: card.uid, target });
  }
  return actions;
}
