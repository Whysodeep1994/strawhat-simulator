import type { CardDefinition, Keyword } from "./cards.js";
import type { Condition, Cost, EffectDefinition, Filter } from "./effects.js";
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
  for (const grant of permanentGrants(state, card)) power += grant.power ?? 0;
  return power;
}

/** Printed keywords plus any gained from effects. */
export function keywordsOf(state: GameState, card: CardInstance): Keyword[] {
  const keywords = new Set(definitionOf(state, card).keywords ?? []);
  for (const m of state.modifiers) if (m.target === card.uid && m.keyword) keywords.add(m.keyword);
  for (const grant of permanentGrants(state, card)) if (grant.keyword) keywords.add(grant.keyword);
  return [...keywords];
}

export function hasKeywordNow(state: GameState, card: CardInstance, keyword: Keyword): boolean {
  return keywordsOf(state, card).includes(keyword);
}

/** Power and keywords given to `card` by permanent effects on the field (rule 8-1-3-3). */
function permanentGrants(
  state: GameState,
  card: CardInstance,
): { power?: number; keyword?: Keyword }[] {
  const grants: { power?: number; keyword?: Keyword }[] = [];
  if (!findOnField(state, card.uid)) return grants;
  for (const player of ["p1", "p2"] as const) {
    for (const source of fieldCards(state, player)) {
      for (const effect of definitionOf(state, source).effects ?? []) {
        if (effect.timing !== "permanent") continue;
        if (!conditionsMet(state, player, source, effect.conditions)) continue;
        for (const step of effect.steps) {
          if (step.do !== "powerUp" && step.do !== "grantKeyword") continue;
          const t = step.target;
          const applies =
            t.side === "this"
              ? source.uid === card.uid
              : card.owner === (t.side === "self" ? player : opponentOf(player)) &&
                zoneMatches(state, card, t.zone) &&
                matchesFilter(state, card, t.filter, source, false);
          if (!applies) continue;
          grants.push(step.do === "powerUp" ? { power: step.amount } : { keyword: step.keyword });
        }
      }
    }
  }
  return grants;
}

function zoneMatches(state: GameState, card: CardInstance, zone: string | undefined): boolean {
  const location = findOnField(state, card.uid);
  if (!location) return false;
  if (!zone || zone === "leaderOrCharacters") return location.zone !== "stage";
  return location.zone === zone;
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
    if ("donOnFieldAtLeast" in c) return donOnField(state, controller) >= c.donOnFieldAtLeast;
    if ("donOnFieldAtMost" in c) return donOnField(state, controller) <= c.donOnFieldAtMost;
    if ("playedThisTurn" in c) return source.playedTurn === state.turn;
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
  const cost = def.cost ?? 0;
  const power = usePower && findOnField(state, card.uid) ? powerOf(state, card) : (def.power ?? 0);
  if (filter.category && def.category !== filter.category) return false;
  if (filter.costAtMost !== undefined && cost > filter.costAtMost) return false;
  if (filter.costAtLeast !== undefined && cost < filter.costAtLeast) return false;
  if (filter.powerAtMost !== undefined && power > filter.powerAtMost) return false;
  if (filter.powerAtLeast !== undefined && power < filter.powerAtLeast) return false;
  if (filter.type && !(def.types ?? []).includes(filter.type)) return false;
  if (filter.name && def.name !== filter.name) return false;
  if (filter.nameIncludes && !def.name.includes(filter.nameIncludes)) return false;
  if (filter.color && !def.colors.includes(filter.color)) return false;
  if (filter.rested !== undefined && card.rested !== filter.rested) return false;
  if (filter.notThis && source && card.uid === source.uid) return false;
  if (filter.hasTrigger && !(def.effects ?? []).some((e) => e.timing === "trigger")) return false;
  if (filter.keyword && !hasKeywordNow(state, card, filter.keyword)) return false;
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

/** DON!! cards on a player's field: active and rested in the cost area, plus given ones (rule 6-5-5). */
export function donOnField(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  return (
    p.donActive + p.donRested + [p.leader, ...p.characters].reduce((n, c) => n + c.givenDon, 0)
  );
}

/** Rule 8-3-1-3: costs must be fully payable to activate. */
export function canPayCosts(
  state: GameState,
  player: PlayerId,
  source: CardInstance,
  costs: Cost[],
): boolean {
  const p = state.players[player];
  const hand = p.hand.filter((c) => c.uid !== source.uid);
  let restDon = 0;
  let donMinus = 0;
  let trash = 0;
  let life = 0;
  let fromTrash = 0;
  for (const cost of costs) {
    if ("restDon" in cost) restDon += cost.restDon;
    if ("donMinus" in cost) donMinus += cost.donMinus;
    if ("trashFromHand" in cost) trash += cost.trashFromHand;
    if ("restThis" in cost && source.rested) return false;
    if ("lifeToHand" in cost) life += cost.lifeToHand;
    if ("trashLife" in cost) life += cost.trashLife;
    if ("lifeFaceUp" in cost && (!p.life[0] || p.life[0].faceUp)) return false;
    if ("trashToDeckBottom" in cost) fromTrash += cost.trashToDeckBottom;
  }
  return (
    restDon <= p.donActive &&
    donMinus <= donOnField(state, player) &&
    trash <= hand.length &&
    life <= p.life.length &&
    fromTrash <= p.trash.filter((c) => c.uid !== source.uid).length
  );
}
