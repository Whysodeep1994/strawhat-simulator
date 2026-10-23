import type { Action } from "./actions.js";
import {
  canPayCosts,
  conditionsMet,
  definitionOf,
  fieldCards,
  findOnField,
  hasKeywordNow,
  hasStatus,
  matchesFilter,
  playCostOf,
} from "./state.js";
import { opponentOf, type CardInstance, type GameState, type PlayerId } from "./types.js";

/**
 * Every action `player` may take right now. The UI uses this to highlight
 * playable cards, so the engine never relies on the UI to enforce rules.
 * Defaults to the player the game is waiting on.
 *
 * For a "choose" prompt with many options, this lists a sample; any pick
 * within the prompt's options and min/max is legal (see `isLegal`).
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
        actions.push(
          ...playActions(state, who),
          ...activateActions(state, who),
          ...giveDonActions(state, who),
        );
        actions.push(...attackActions(state, who), { type: "endTurn", player: who });
        break;
      case "block":
        actions.push(...blockActions(state, who), { type: "pass", player: who });
        break;
      case "counter":
        actions.push(...counterActions(state, who), { type: "pass", player: who });
        break;
      case "choose":
        for (const cards of combinations(prompt.options, prompt.min, prompt.max, 64)) {
          actions.push({ type: "choose", player: who, cards });
        }
        break;
      case "chooseOne":
        prompt.labels.forEach((_, option) =>
          actions.push({ type: "chooseOne", player: who, option }),
        );
        break;
      case "confirm":
        actions.push(
          { type: "confirm", player: who, accept: true },
          { type: "confirm", player: who, accept: false },
        );
        break;
    }
  }

  // Rule 1-2-3: either player may concede at any point.
  actions.push({ type: "concede", player: who });
  return actions;
}

/** Whether `action` is allowed right now. */
export function isLegal(state: GameState, action: Action): boolean {
  if (action.type === "choose") {
    const prompt = state.prompt;
    if (prompt.kind !== "choose" || prompt.player !== action.player) return false;
    const unique = new Set(action.cards);
    return (
      unique.size === action.cards.length &&
      action.cards.length >= prompt.min &&
      action.cards.length <= prompt.max &&
      action.cards.every((c) => prompt.options.includes(c))
    );
  }
  const key = actionKey(action);
  return legalActions(state, action.player).some((a) => actionKey(a) === key);
}

function actionKey(action: Action): string {
  const entries = Object.entries(action).filter(([, v]) => v !== undefined);
  entries.sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function combinations(options: string[], min: number, max: number, limit: number): string[][] {
  const result: string[][] = [];
  const walk = (start: number, picked: string[]) => {
    if (result.length >= limit) return;
    if (picked.length >= min) result.push(picked);
    if (picked.length === max) return;
    for (let i = start; i < options.length; i++) walk(i + 1, [...picked, options[i] as string]);
  };
  walk(0, []);
  return result;
}

/** Rules 6-5-3-1, 2-7-2 to 2-7-4, 3-7-6-1, 3-8-5-1, 10-2-3. */
function playActions(state: GameState, player: PlayerId): Action[] {
  const p = state.players[player];
  const actions: Action[] = [];
  for (const card of p.hand) {
    const def = definitionOf(state, card);
    const cost = playCostOf(state, player, card);
    if (cost > p.donActive) continue;
    if (def.category === "event") {
      const effect = (def.effects ?? []).find((e) => e.timing === "main");
      if (!effect || !conditionsMet(state, player, card, effect.conditions)) continue;
      const afterCost = {
        ...state,
        players: { ...state.players, [player]: { ...p, donActive: p.donActive - cost } },
      };
      if (!effect.optional && !canPayCosts(afterCost, player, card, effect.costs ?? [])) continue;
      actions.push({ type: "playCard", player, card: card.uid });
    } else if (def.category === "character" && p.characters.length >= 5) {
      for (const existing of p.characters) {
        actions.push({ type: "playCard", player, card: card.uid, trash: existing.uid });
      }
    } else if (def.category === "character" || def.category === "stage") {
      actions.push({ type: "playCard", player, card: card.uid });
    }
  }
  return actions;
}

/** Rules 6-5-4-1, 8-1-3-2, 10-2-2, 10-2-13. */
function activateActions(state: GameState, player: PlayerId): Action[] {
  const actions: Action[] = [];
  for (const card of fieldCards(state, player)) {
    (definitionOf(state, card).effects ?? []).forEach((effect, index) => {
      if (effect.timing !== "activateMain") return;
      if (effect.oncePerTurn && state.usedThisTurn.includes(`${card.uid}:${index}`)) return;
      if (!conditionsMet(state, player, card, effect.conditions)) return;
      if (!canPayCosts(state, player, card, effect.costs ?? [])) return;
      actions.push({ type: "activate", player, card: card.uid, effect: index });
    });
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
    if (attacker.rested || hasStatus(state, attacker, "cannotAttack")) continue;
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
  if (hasKeywordNow(state, attacker, "rush")) return [leader, ...restedCharacters];
  if (hasKeywordNow(state, attacker, "rushCharacter")) return restedCharacters;
  return [];
}

/** Rules 7-1-2-1, 10-1-4-1, 10-1-7-1. */
function blockActions(state: GameState, player: PlayerId): Action[] {
  return eligibleBlockers(state, player).map((c) => ({ type: "block", player, blocker: c.uid }));
}

export function eligibleBlockers(state: GameState, player: PlayerId): CardInstance[] {
  const battle = state.battle;
  if (!battle || battle.blocked) return [];
  const attacker = findOnField(state, battle.attacker);
  if (!attacker || hasKeywordNow(state, attacker.card, "unblockable")) return [];
  // Rule 10-1-4-1: effects can stop [Blocker] from being activated.
  const bans = state.modifiers.filter((m) => m.target === battle.attacker && m.noBlockers);
  return state.players[player].characters.filter(
    (c) =>
      !c.rested &&
      c.uid !== battle.target &&
      hasKeywordNow(state, c, "blocker") &&
      !hasStatus(state, c, "cannotBlock") &&
      !bans.some((m) => matchesFilter(state, c, m.noBlockers, null)),
  );
}

/** Rules 7-1-3-1-1 and 7-1-3-1-2. */
function counterActions(state: GameState, player: PlayerId): Action[] {
  const p = state.players[player];
  const targets = [p.leader, ...p.characters].map((c) => c.uid);
  const actions: Action[] = [];
  for (const card of p.hand) {
    const def = definitionOf(state, card);
    if (def.category === "character" && def.counter) {
      for (const target of targets)
        actions.push({ type: "counter", player, card: card.uid, target });
    }
    if (def.category === "event" && playCostOf(state, player, card) <= p.donActive) {
      const effect = (def.effects ?? []).find((e) => e.timing === "counter");
      if (effect && conditionsMet(state, player, card, effect.conditions)) {
        actions.push({ type: "counterEvent", player, card: card.uid });
      }
    }
  }
  return actions;
}
