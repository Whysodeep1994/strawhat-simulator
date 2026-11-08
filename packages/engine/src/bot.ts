import type { Action } from "./actions.js";
import { applyAction } from "./apply.js";
import { legalActions } from "./legal.js";
import { costOf, definitionOf, findCard, powerOf } from "./state.js";
import { opponentOf, type CardInstance, type GameState, type PlayerId } from "./types.js";

/** Choice reasons that cost the chooser something, so the bot gives up as little as it can. */
const COST_REASONS = new Set(["trashFromHand", "trashCharacter", "donMinus"]);

/**
 * A simple computer opponent. It plays its most expensive affordable cards, uses its
 * effects, powers up and attacks when the attack can win, and defends when it matters.
 * It only ever picks from `legalActions`, so it can't break the rules.
 */
export function chooseBotAction(state: GameState, player: PlayerId): Action {
  const actions = legalActions(state, player).filter((a) => a.type !== "concede");
  const prompt = state.prompt;
  const first = actions[0];
  if (!first) return { type: "concede", player };

  switch (prompt.kind) {
    case "chooseTurnOrder":
      return actions.find((a) => a.type === "chooseTurnOrder" && a.goFirst) ?? first;
    case "mulligan":
      return actions.find((a) => a.type === "keepHand") ?? first;
    case "confirm": {
      // "Trash this Character instead" of taking damage: only worth it when the Life is low.
      const accept =
        prompt.reason !== "trashInsteadOfDamage" || state.players[player].life.length <= 1;
      return actions.find((a) => a.type === "confirm" && a.accept === accept) ?? first;
    }
    case "choose":
      return chooseCards(
        state,
        player,
        prompt.options,
        prompt.min,
        prompt.max,
        prompt.reason,
        prompt.maxTotalPower,
        prompt.maxTotalCost,
      );
    case "block":
      return blockOrPass(state, player, actions);
    case "counter":
      return counterOrPass(state, player, actions);
    case "main":
      return mainAction(state, player, actions);
    default:
      return first;
  }
}

function mainAction(state: GameState, player: PlayerId, actions: Action[]): Action {
  const cost = (uid: string) => stat(state, uid, "cost");

  // 1. Play the most expensive card that fits, without trashing one of our Characters.
  // Keep plain Characters with a 2000 counter (no [On Play] or [Activate: Main]) in the hand to
  // defend with, unless the hand is already big.
  const keep = (a: Action) =>
    a.type === "playCard" && isCounterCard(state, a.card) && state.players[player].hand.length < 7;
  const plays = actions.filter((a) => a.type === "playCard" && a.trash === undefined && !keep(a));
  const play = maxBy(plays, (a) => (a.type === "playCard" ? cost(a.card) : 0));
  if (play) return play;

  // 2. Use [Activate: Main] effects, skipping any that would change nothing. An effect
  // without a cost or [Once Per Turn] (like OP10-030's) can be used again and again.
  const activate = actions.find((a) => a.type === "activate" && changesSomething(state, a));
  if (activate) return activate;

  // 3. Give spare DON!! to the Leader, or to a Character, if it is about to attack.
  const opponentLeader = state.players[opponentOf(player)].leader;
  const attacks = actions.filter((a) => a.type === "attack");
  const attackers = new Set(attacks.map((a) => (a.type === "attack" ? a.attacker : "")));
  const gives = actions.filter((a) => a.type === "giveDon" && attackers.has(a.target));
  const leaderUid = state.players[player].leader.uid;
  // First bring attackers up to the opponent's Leader's power, closest first, so more of them
  // can hit; the rest go to the Leader. (Piling every DON!! on the Leader left Characters
  // too weak to attack at all.)
  const opponentPower = power(state, opponentLeader.uid);
  const spare = state.players[player].donActive;
  const shortBy = (a: Action) =>
    a.type === "giveDon" ? opponentPower - power(state, a.target) : Infinity;
  const catchUp = gives.filter((a) => shortBy(a) > 0 && Math.ceil(shortBy(a) / 1000) <= spare);
  const give =
    minBy(catchUp, shortBy) ??
    gives.find((a) => a.type === "giveDon" && a.target === leaderUid) ??
    gives[0];
  if (give) return give;

  // 4. Attack: the Leader when the attack can win, otherwise a rested Character it can K.O.
  const winning = attacks.filter((a) => {
    if (a.type !== "attack") return false;
    return power(state, a.attacker) >= power(state, a.target);
  });
  const onLeader = winning.filter((a) => a.type === "attack" && a.target === opponentLeader.uid);
  const strongest = (list: Action[]) =>
    maxBy(list, (a) => (a.type === "attack" ? power(state, a.attacker) : 0));
  const attack =
    strongest(onLeader) ?? maxBy(winning, (a) => (a.type === "attack" ? cost(a.target) : 0));
  if (attack) return attack;

  return actions.find((a) => a.type === "endTurn") ?? actions[0]!;
}

function blockOrPass(state: GameState, player: PlayerId, actions: Action[]): Action {
  const pass = actions.find((a) => a.type === "pass") ?? actions[0]!;
  const battle = state.battle;
  if (!battle) return pass;
  const p = state.players[player];
  const leaderAttacked = battle.target === p.leader.uid;
  if (!leaderAttacked || p.life.length > 2) return pass;
  // Block with the cheapest [Blocker].
  const blocks = actions.filter((a) => a.type === "block");
  return minBy(blocks, (a) => (a.type === "block" ? stat(state, a.blocker, "cost") : 0)) ?? pass;
}

function counterOrPass(state: GameState, player: PlayerId, actions: Action[]): Action {
  const pass = actions.find((a) => a.type === "pass") ?? actions[0]!;
  const battle = state.battle;
  if (!battle) return pass;
  const target = findCard(state, battle.target);
  if (!target) return pass;
  const gap = power(state, battle.attacker) - powerOf(state, target);
  if (gap < 0) return pass; // The attack already fails.

  const p = state.players[player];
  const isLeader = target.uid === p.leader.uid;
  const worthSaving = isLeader ? p.life.length <= 2 : (definitionOf(state, target).cost ?? 0) >= 4;
  if (!worthSaving) return pass;

  // Use the smallest Character counter that wins the battle; otherwise the biggest one.
  const counters = actions.filter((a) => a.type === "counter" && a.target === target.uid);
  const value = (a: Action) => (a.type === "counter" ? stat(state, a.card, "counter") : 0);
  const enough = counters.filter((a) => value(a) > gap);
  const pick = minBy(enough, value) ?? maxBy(counters, value);
  if (pick) return pick;
  if (isLeader && p.life.length <= 1) {
    return actions.find((a) => a.type === "counterEvent") ?? pass;
  }
  return pass;
}

function chooseCards(
  state: GameState,
  player: PlayerId,
  options: string[],
  min: number,
  max: number,
  reason: string,
  maxTotalPower?: number,
  maxTotalCost?: number,
): Action {
  const cards = options
    .map((uid) => findCard(state, uid))
    .filter((c): c is CardInstance => c !== null);
  const value = (c: CardInstance) => {
    const def = definitionOf(state, c);
    return (def.cost ?? 0) * 1000 + (def.power ?? 0);
  };
  if (COST_REASONS.has(reason)) {
    const cheapest = [...cards].sort((a, b) => value(a) - value(b)).slice(0, min);
    return { type: "choose", player, cards: cheapest.map((c) => c.uid) };
  }
  // Effects that help: pick as many as allowed, the most valuable first. On the opponent's
  // cards (K.O., rest, bounce) the most valuable is the biggest threat.
  let ranked = [...cards].sort((a, b) => value(b) - value(a));
  // Lowering an opponent's Character's power (like EB04-001 Bonney's −1000) is best spent on
  // a rested one we can then K.O. in battle.
  if (reason === "powerUp" && cards.length > 0 && cards.every((c) => c.owner !== player)) {
    const reach = attackReach(state, player);
    const ko = (c: CardInstance) => c.rested && powerOf(state, c) - 1000 <= reach;
    ranked = [...ranked.filter(ko), ...ranked.filter((c) => !ko(c))];
  }
  const limit = maxTotalPower ?? maxTotalCost;
  if (limit === undefined) {
    return { type: "choose", player, cards: ranked.slice(0, max).map((c) => c.uid) };
  }
  // "Up to N Characters with a total power (or cost) of X or less": take the best that still
  // fit. Without this the computer broke the total-cost limit (OP17-079) and its move was refused.
  const amount = (c: CardInstance) =>
    maxTotalPower !== undefined ? powerOf(state, c) : costOf(state, c);
  const picked: CardInstance[] = [];
  let total = 0;
  for (const card of ranked) {
    if (picked.length === max) break;
    if (total + amount(card) > limit) continue;
    picked.push(card);
    total += amount(card);
  }
  return { type: "choose", player, cards: picked.map((c) => c.uid) };
}

/** Roughly the most power one of our attacks can reach this turn: our strongest ready attacker plus our spare DON!!. */
function attackReach(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  const ready = [p.leader, ...p.characters].filter((c) => !c.rested);
  const best = Math.max(0, ...ready.map((c) => powerOf(state, c)));
  return best + p.donActive * 1000;
}

// Small helpers.

/** A Character worth more as a 2000 counter than on the field (like EB04-056 Pacifista). */
function isCounterCard(state: GameState, uid: string): boolean {
  const found = findCard(state, uid);
  if (!found) return false;
  const def = definitionOf(state, found);
  if (def.category !== "character" || (def.counter ?? 0) < 2000 || (def.power ?? 0) > 6000)
    return false;
  return !(def.effects ?? []).some((e) => e.timing === "onPlay" || e.timing === "activateMain");
}

function changesSomething(state: GameState, action: Action): boolean {
  const snapshot = (s: GameState) => JSON.stringify({ ...s, catalog: null, revealed: null });
  try {
    return snapshot(applyAction(state, action)) !== snapshot(state);
  } catch {
    return false;
  }
}

function stat(state: GameState, uid: string, key: "cost" | "counter"): number {
  const found = findCard(state, uid);
  return found ? (definitionOf(state, found)[key] ?? 0) : 0;
}

function power(state: GameState, uid: string): number {
  const found = findCard(state, uid);
  return found ? powerOf(state, found) : 0;
}

function maxBy<T>(items: T[], score: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>(
    (best, item) => (best === undefined || score(item) > score(best) ? item : best),
    undefined,
  );
}

function minBy<T>(items: T[], score: (item: T) => number): T | undefined {
  return maxBy(items, (item) => -score(item));
}
