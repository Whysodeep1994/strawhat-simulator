import type { CardDefinition, Keyword } from "./cards.js";
import type { CardCount, Condition, Cost, EffectDefinition, Filter, Status } from "./effects.js";
import { opponentOf, type CardInstance, type GameState, type PlayerId } from "./types.js";

export type FieldZone = "leader" | "characters" | "stage";

export interface FieldLocation {
  player: PlayerId;
  zone: FieldZone;
  card: CardInstance;
}

export function definitionOf(state: GameState, card: CardInstance): CardDefinition {
  const def = state.catalog[card.cardId];
  if (!def) throw new Error(`Unknown card id "${card.cardId}"`);
  return def;
}

export function effectOf(
  state: GameState,
  card: CardInstance,
  index: number,
): EffectDefinition | undefined {
  return definitionOf(state, card).effects?.[index];
}

/** Finds a card on the field (Leader, Character, or Stage area) by uid. */
export function findOnField(state: GameState, uid: string): FieldLocation | null {
  for (const player of ["p1", "p2"] as const) {
    const p = state.players[player];
    if (p.leader.uid === uid) return { player, zone: "leader", card: p.leader };
    const character = p.characters.find((c) => c.uid === uid);
    if (character) return { player, zone: "characters", card: character };
    if (p.stage?.uid === uid) return { player, zone: "stage", card: p.stage };
  }
  return null;
}

/** Finds a card in any area, including limbo. */
export function findCard(state: GameState, uid: string): CardInstance | null {
  if (state.limbo?.uid === uid) return state.limbo;
  for (const player of ["p1", "p2"] as const) {
    const p = state.players[player];
    for (const card of [p.leader, ...p.characters, ...(p.stage ? [p.stage] : [])]) {
      if (card.uid === uid) return card;
    }
    for (const pile of [p.hand, p.trash, p.deck, p.life]) {
      const card = pile.find((c) => c.uid === uid);
      if (card) return card;
    }
  }
  return null;
}

export function fieldCards(state: GameState, player: PlayerId): CardInstance[] {
  const p = state.players[player];
  return [p.leader, ...p.characters, ...(p.stage ? [p.stage] : [])];
}

/**
 * Current power of a Leader or Character: printed power, +1000 per given DON!!
 * during its owner's turn (rule 6-5-5-2), plus effects and counters.
 */
export function powerOf(state: GameState, card: CardInstance): number {
  let power = definitionOf(state, card).power ?? 0;
  if (card.owner === state.turnPlayer) power += card.givenDon * 1000;
  for (const m of state.modifiers) if (m.target === card.uid) power += m.power ?? 0;
  for (const grant of permanentGrants(state, card, "powerUp")) power += grant.power ?? 0;
  return power;
}

/** Printed keywords plus any gained from effects. */
export function keywordsOf(state: GameState, card: CardInstance): Keyword[] {
  const keywords = new Set(definitionOf(state, card).keywords ?? []);
  for (const m of state.modifiers) if (m.target === card.uid && m.keyword) keywords.add(m.keyword);
  for (const grant of permanentGrants(state, card, "grantKeyword"))
    if (grant.keyword) keywords.add(grant.keyword);
  return [...keywords];
}

export function hasKeywordNow(state: GameState, card: CardInstance, keyword: Keyword): boolean {
  return keywordsOf(state, card).includes(keyword);
}

/** Whether an effect gives the card this status right now, e.g. "cannot attack". */
export function hasStatus(state: GameState, card: CardInstance, status: Status): boolean {
  if (state.modifiers.some((m) => m.target === card.uid && m.status === status)) return true;
  return permanentGrants(state, card, "grantStatus").some((grant) => grant.status === status);
}

/** Current cost of a card on the field: printed cost plus effects (rule 2-7-1). */
export function costOf(state: GameState, card: CardInstance): number {
  let cost = definitionOf(state, card).cost ?? 0;
  if (!findOnField(state, card.uid)) return cost;
  for (const m of state.modifiers) if (m.target === card.uid) cost += m.cost ?? 0;
  for (const grant of permanentGrants(state, card, "costChange")) cost += grant.cost ?? 0;
  return Math.max(0, cost);
}

/** What it costs `player` to play a card from hand, after "give this card in your hand −X cost". */
export function playCostOf(state: GameState, player: PlayerId, card: CardInstance): number {
  let cost = definitionOf(state, card).cost ?? 0;
  for (const effect of definitionOf(state, card).effects ?? []) {
    if (effect.timing !== "permanent" || effect.zone !== "hand") continue;
    if (!conditionsMet(state, player, card, effect.conditions)) continue;
    for (const step of effect.steps) if (step.do === "costChange") cost += step.amount;
  }
  return Math.max(0, cost);
}

interface Grant {
  power?: number;
  cost?: number;
  keyword?: Keyword;
  status?: Status;
}

type GrantStep = "powerUp" | "costChange" | "grantKeyword" | "grantStatus";

/** Cards whose grants are being worked out, so an effect that reads its own result can't loop. */
const inProgress = new Set<string>();

/** Power, cost, keywords, or statuses given to `card` by permanent effects on the field (rule 8-1-3-3). */
function permanentGrants(state: GameState, card: CardInstance, kind: GrantStep): Grant[] {
  const grants: Grant[] = [];
  const key = `${card.uid}:${kind}`;
  if (inProgress.has(key) || !findOnField(state, card.uid)) return grants;
  inProgress.add(key);
  try {
    collectGrants(state, card, kind, grants);
  } finally {
    inProgress.delete(key);
  }
  return grants;
}

function collectGrants(state: GameState, card: CardInstance, kind: GrantStep, grants: Grant[]) {
  for (const player of ["p1", "p2"] as const) {
    for (const source of fieldCards(state, player)) {
      for (const effect of definitionOf(state, source).effects ?? []) {
        if (effect.timing !== "permanent" || effect.zone === "hand") continue;
        if (!conditionsMet(state, player, source, effect.conditions)) continue;
        for (const step of effect.steps) {
          if (step.do !== kind) continue;
          const t = step.target;
          const applies =
            t.side === "this"
              ? source.uid === card.uid
              : card.owner === (t.side === "self" ? player : opponentOf(player)) &&
                zoneMatches(state, card, t.zone) &&
                matchesFilter(state, card, t.filter, source, false);
          if (!applies) continue;
          if (step.do === "powerUp") grants.push({ power: step.amount });
          else if (step.do === "costChange") grants.push({ cost: step.amount });
          else if (step.do === "grantKeyword") grants.push({ keyword: step.keyword });
          else grants.push({ status: step.status });
        }
      }
    }
  }
}

function zoneMatches(state: GameState, card: CardInstance, zone: string | undefined): boolean {
  const location = findOnField(state, card.uid);
  if (!location) return false;
  if (!zone || zone === "leaderOrCharacters") return location.zone !== "stage";
  return location.zone === zone;
}

/** Field cards counted by a `count` condition. */
function countCards(
  state: GameState,
  controller: PlayerId,
  source: CardInstance,
  what: CardCount,
): number {
  const p = state.players[what.side === "self" ? controller : opponentOf(controller)];
  const zone = what.zone ?? "characters";
  const cards =
    zone === "leader"
      ? [p.leader]
      : zone === "characters"
        ? p.characters
        : zone === "stage"
          ? p.stage
            ? [p.stage]
            : []
          : [p.leader, ...p.characters];
  return cards.filter((c) => matchesFilter(state, c, what.filter, source)).length;
}

/** Rules 8-3-2 and 8-3-3. */
export function conditionsMet(
  state: GameState,
  controller: PlayerId,
  source: CardInstance,
  conditions: Condition[] | undefined,
): boolean {
  const me = state.players[controller];
  const them = state.players[opponentOf(controller)];
  return (conditions ?? []).every((c) => {
    if ("donAtLeast" in c) return source.givenDon >= c.donAtLeast;
    if ("yourTurn" in c) return state.turnPlayer === controller;
    if ("opponentsTurn" in c) return state.turnPlayer !== controller;
    if ("lifeAtMost" in c) return me.life.length <= c.lifeAtMost;
    if ("lifeAtLeast" in c) return me.life.length >= c.lifeAtLeast;
    if ("opponentLifeAtMost" in c) return them.life.length <= c.opponentLifeAtMost;
    if ("leaderHasType" in c)
      return (definitionOf(state, me.leader).types ?? []).includes(c.leaderHasType);
    if ("charactersAtLeast" in c) return me.characters.length >= c.charactersAtLeast;
    if ("handAtMost" in c) return me.hand.length <= c.handAtMost;
    if ("leaderIs" in c) return definitionOf(state, me.leader).name === c.leaderIs;
    if ("anyOf" in c) return c.anyOf.some((one) => conditionsMet(state, controller, source, [one]));
    if ("count" in c) {
      const n = countCards(state, controller, source, c.count);
      // atLeast defaults to 1, unless only atMost is given ("if you do not have 5 ...").
      const atLeast = c.atLeast ?? (c.atMost === undefined ? 1 : 0);
      return n >= atLeast && n <= (c.atMost ?? Infinity);
    }
    if ("donRestedAtLeast" in c) return me.donRested >= c.donRestedAtLeast;
    if ("restedCardsAtLeast" in c) {
      const rested = fieldCards(state, controller).filter((card) => card.rested).length;
      return me.donRested + rested >= c.restedCardsAtLeast;
    }
    return false;
  });
}

export function matchesFilter(
  state: GameState,
  card: CardInstance,
  filter: Filter | undefined,
  source: CardInstance | null,
  usePower = true,
): boolean {
  if (!filter) return true;
  const def = definitionOf(state, card);
  const baseCost = def.cost ?? 0;
  const basePower = def.power ?? 0;
  const cost =
    filter.costAtMost !== undefined || filter.costAtLeast !== undefined
      ? costOf(state, card)
      : baseCost;
  const power = usePower && findOnField(state, card.uid) ? powerOf(state, card) : basePower;
  if (filter.category && def.category !== filter.category) return false;
  if (filter.costAtMost !== undefined && cost > filter.costAtMost) return false;
  if (filter.costAtLeast !== undefined && cost < filter.costAtLeast) return false;
  if (filter.baseCostAtMost !== undefined && baseCost > filter.baseCostAtMost) return false;
  if (filter.baseCostAtLeast !== undefined && baseCost < filter.baseCostAtLeast) return false;
  if (filter.powerAtMost !== undefined && power > filter.powerAtMost) return false;
  if (filter.powerAtLeast !== undefined && power < filter.powerAtLeast) return false;
  if (filter.basePowerAtMost !== undefined && basePower > filter.basePowerAtMost) return false;
  if (filter.basePowerAtLeast !== undefined && basePower < filter.basePowerAtLeast) return false;
  if (filter.type && !(def.types ?? []).includes(filter.type)) return false;
  if (filter.typeIncludes && !(def.types ?? []).some((t) => t.includes(filter.typeIncludes ?? "")))
    return false;
  if (filter.name && def.name !== filter.name) return false;
  if (filter.notName && def.name === filter.notName) return false;
  if (filter.nameIncludes && !def.name.includes(filter.nameIncludes)) return false;
  if (filter.color && !def.colors.includes(filter.color)) return false;
  if (filter.rested !== undefined && card.rested !== filter.rested) return false;
  if (filter.notThis && source && card.uid === source.uid) return false;
  if (filter.hasTrigger && !(def.effects ?? []).some((e) => e.timing === "trigger")) return false;
  if (filter.keyword && !hasKeywordNow(state, card, filter.keyword)) return false;
  if (filter.anyOf && !filter.anyOf.some((f) => matchesFilter(state, card, f, source, usePower)))
    return false;
  return true;
}

/**
 * A card leaving the field becomes a new card (rules 3-1-6, 10-2-13-4): its
 * effects, modifiers, and [Once Per Turn] uses are gone, and its given DON!!
 * go to the cost area rested (rule 6-5-5-4).
 */
export function leaveField(state: GameState, card: CardInstance): void {
  state.players[card.owner].donRested += card.givenDon;
  card.givenDon = 0;
  card.rested = false;
  card.playedTurn = null;
  state.modifiers = state.modifiers.filter((m) => m.target !== card.uid);
  state.usedThisTurn = state.usedThisTurn.filter((k) => !k.startsWith(`${card.uid}:`));
}

/** Rule 8-3-1-3: costs must be fully payable to activate. */
export function canPayCosts(
  state: GameState,
  player: PlayerId,
  source: CardInstance,
  costs: Cost[],
): boolean {
  const p = state.players[player];
  const fieldDon =
    p.donActive + p.donRested + [p.leader, ...p.characters].reduce((n, c) => n + c.givenDon, 0);
  let restDon = 0;
  let donMinus = 0;
  let trash = 0;
  for (const cost of costs) {
    if ("restDon" in cost) restDon += cost.restDon;
    if ("donMinus" in cost) donMinus += cost.donMinus;
    if ("trashFromHand" in cost) trash += cost.trashFromHand;
    if ("restThis" in cost && source.rested) return false;
    if ("trashThis" in cost && !findOnField(state, source.uid)) return false;
  }
  return restDon <= p.donActive && donMinus <= fieldDon && trash <= p.hand.length;
}
