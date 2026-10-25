import type { CardDefinition, Keyword } from "./cards.js";
import type {
  CardCount,
  Condition,
  Cost,
  EffectDefinition,
  Filter,
  Status,
  Step,
} from "./effects.js";
import { opponentOf, type CardInstance, type GameState, type PlayerId } from "./types.js";

export type FieldZone = "leader" | "characters" | "stage";

export interface FieldLocation {
  player: PlayerId;
  zone: FieldZone;
  card: CardInstance;
}

/** A card's name plus any "also treat this card's name as [X]" names (rule 2-1-2). */
export function namesOf(def: CardDefinition): string[] {
  return [def.name, ...(def.aliases ?? [])];
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
  return effectsOf(state, card)[index];
}

/**
 * A card's effects, or none while they are negated on the field (rule 8-2). Indexes stay
 * the same: negated effects are left out by returning an empty list.
 */
export function effectsOf(state: GameState, card: CardInstance): EffectDefinition[] {
  const effects = definitionOf(state, card).effects ?? [];
  return effects.length > 0 && isNegated(state, card) ? [] : effects;
}

/** Whether a "negate the effect of" step has given this field card the `negated` status. */
function negatedByStatus(state: GameState, card: CardInstance): boolean {
  return (
    state.modifiers.some((m) => m.target === card.uid && m.status === "negated") &&
    !!findOnField(state, card.uid)
  );
}

/** Whether this field card's effects are negated: by a status or a permanent `negateEffects`. */
export function isNegated(state: GameState, card: CardInstance): boolean {
  if (negatedByStatus(state, card)) return true;
  const anyNegation = (["p1", "p2"] as const).some((player) =>
    fieldCards(state, player).some((source) =>
      (definitionOf(state, source).effects ?? []).some(
        (e) => e.timing === "permanent" && e.steps.some((s) => s.do === "negateEffects"),
      ),
    ),
  );
  return anyNegation && permanentGrants(state, card, "negateEffects").length > 0;
}

/** The [Once Per Turn] key of an effect: shared by effects that name the same key. */
export function oncePerTurnKey(uid: string, effect: EffectDefinition, index: number): string {
  return `${uid}:${typeof effect.oncePerTurn === "string" ? effect.oncePerTurn : index}`;
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
  let power = basePowerOf(state, card);
  if (card.owner === state.turnPlayer) power += card.givenDon * 1000;
  for (const m of state.modifiers) if (m.target === card.uid) power += m.power ?? 0;
  for (const grant of permanentGrants(state, card, "powerUp")) power += grant.power ?? 0;
  return power;
}

/** Printed power, unless an effect says "base power becomes X" (the latest one wins). */
export function basePowerOf(state: GameState, card: CardInstance): number {
  const set = state.modifiers.filter((m) => m.target === card.uid && m.basePower !== undefined);
  const permanent = permanentGrants(state, card, "setBasePower").at(-1)?.basePower;
  return set.at(-1)?.basePower ?? permanent ?? definitionOf(state, card).power ?? 0;
}

/** Printed keywords plus any gained from effects. */
export function keywordsOf(state: GameState, card: CardInstance): Keyword[] {
  // Negated cards lose their printed keywords too; keywords given by other effects stay.
  const printed = isNegated(state, card) ? [] : (definitionOf(state, card).keywords ?? []);
  const keywords = new Set(printed);
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

/**
 * "This Character cannot be K.O.'d by effects of your opponent's Characters with 5000 base
 * power or less": whether one of `card`'s own `koImmunity` effects covers `source`.
 */
export function koImmuneTo(state: GameState, card: CardInstance, source: CardInstance): boolean {
  if (source.owner === card.owner || definitionOf(state, source).category !== "character")
    return false;
  return effectsOf(state, card).some(
    (effect) =>
      effect.timing === "permanent" &&
      conditionsMet(state, card.owner, card, effect.conditions) &&
      effect.steps.some(
        (step) => step.do === "koImmunity" && matchesFilter(state, source, step.from, card, false),
      ),
  );
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
  // "The cost of playing ... from your hand will be reduced by 1" on your field.
  for (const source of fieldCards(state, player)) {
    for (const effect of definitionOf(state, source).effects ?? []) {
      if (effect.timing !== "permanent" || effect.zone === "hand") continue;
      if (!conditionsMet(state, player, source, effect.conditions)) continue;
      for (const step of effect.steps)
        if (step.do === "handCostChange" && matchesFilter(state, card, step.filter, source, false))
          cost += step.amount;
    }
  }
  // "The next time you play [X] from your hand during this turn, the cost will be reduced by 2."
  const leader = state.players[player].leader.uid;
  for (const m of state.modifiers)
    if (
      m.target === leader &&
      m.nextPlayCost &&
      matchesFilter(state, card, m.nextPlayCost.filter, card, false)
    )
      cost += m.nextPlayCost.amount;
  return Math.max(0, cost);
}

interface Grant {
  power?: number;
  cost?: number;
  basePower?: number;
  keyword?: Keyword;
  status?: Status;
}

type GrantStep =
  | "powerUp"
  | "costChange"
  | "grantKeyword"
  | "grantStatus"
  | "setBasePower"
  | "negateEffects";

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
      const effects = definitionOf(state, source).effects ?? [];
      if (!effects.some((e) => e.timing === "permanent")) continue;
      // A negating card's own negation is not checked, so working out negation can't loop.
      if (negatedByStatus(state, source)) continue;
      if (kind !== "negateEffects" && isNegated(state, source)) continue;
      for (const effect of effects) {
        if (effect.timing !== "permanent" || effect.zone === "hand") continue;
        if (!conditionsMet(state, player, source, effect.conditions)) continue;
        for (const step of effect.steps) {
          if (step.do !== kind) continue;
          const t = step.target;
          const applies =
            t.side === "this"
              ? source.uid === card.uid
              : (t.side === "any" ||
                  card.owner === (t.side === "self" ? player : opponentOf(player))) &&
                zoneMatches(state, card, t.zone) &&
                matchesFilter(state, card, t.filter, source, false);
          if (!applies) continue;
          if (step.do === "powerUp") grants.push({ power: powerAmount(state, player, step) });
          else if (step.do === "costChange")
            grants.push({ cost: powerAmount(state, player, step) });
          else if (step.do === "grantKeyword") grants.push({ keyword: step.keyword });
          else if (step.do === "grantStatus") grants.push({ status: step.status });
          else if (step.do === "setBasePower")
            grants.push({
              basePower: step.leaderBase
                ? basePowerOf(state, state.players[player].leader)
                : step.power,
            });
          else grants.push({});
        }
      }
    }
  }
}

/**
 * A power or cost change, scaled by `perTrash` ("for every 4 cards in your trash") or
 * `perRestedDon` ("for every 3 of your rested DON!! cards").
 */
export function powerAmount(
  state: GameState,
  controller: PlayerId,
  step: Extract<Step, { do: "powerUp" | "costChange" }>,
): number {
  const p = state.players[controller];
  if (step.perRestedDon) return step.amount * Math.floor(p.donRested / step.perRestedDon);
  if (step.perCount) return step.amount * countCards(state, controller, null, step.perCount);
  if (!step.perTrash) return step.amount;
  const trash = p.trash.filter((c) => matchesFilter(state, c, step.trashFilter, null, false));
  return step.amount * Math.floor(trash.length / step.perTrash);
}

/**
 * A Character card's Counter in `player`'s hand: printed, plus "have a +1000 Counter"
 * from permanent effects on their field.
 */
export function counterOf(state: GameState, player: PlayerId, card: CardInstance): number {
  let counter = definitionOf(state, card).counter ?? 0;
  for (const source of fieldCards(state, player)) {
    for (const effect of definitionOf(state, source).effects ?? []) {
      if (effect.timing !== "permanent" || effect.zone === "hand") continue;
      if (!conditionsMet(state, player, source, effect.conditions)) continue;
      for (const step of effect.steps)
        if (step.do === "grantCounter" && matchesFilter(state, card, step.target.filter, source))
          counter += step.amount;
    }
  }
  return counter;
}

/**
 * Whether one of `player`'s permanent effects sets a game rule right now, such as
 * `faceUpLifeToDeckBottom` or `winOnDeckOut`.
 */
export function hasRule(
  state: GameState,
  player: PlayerId,
  rule: "faceUpLifeToDeckBottom" | "winOnDeckOut",
): boolean {
  return fieldCards(state, player).some((source) =>
    (definitionOf(state, source).effects ?? []).some(
      (effect) =>
        effect.timing === "permanent" &&
        effect.steps.some((s) => s.do === rule) &&
        conditionsMet(state, player, source, effect.conditions),
    ),
  );
}

/** Whether `player`'s [On Play] effects are negated right now. */
export function onPlayNegated(state: GameState, player: PlayerId): boolean {
  const leader = state.players[player].leader.uid;
  if (state.modifiers.some((m) => m.negateOnPlay && m.target === leader)) return true;
  for (const owner of ["p1", "p2"] as const) {
    for (const source of fieldCards(state, owner)) {
      for (const effect of effectsOf(state, source)) {
        if (effect.timing !== "permanent") continue;
        if (!conditionsMet(state, owner, source, effect.conditions)) continue;
        const negated = effect.steps.some(
          (s) =>
            s.do === "negateOnPlay" && (s.side === "self" ? owner : opponentOf(owner)) === player,
        );
        if (negated) return true;
      }
    }
  }
  return false;
}

function zoneMatches(state: GameState, card: CardInstance, zone: string | undefined): boolean {
  const location = findOnField(state, card.uid);
  if (!location) return false;
  if (!zone || zone === "leaderOrCharacters") return location.zone !== "stage";
  return zone === "field" || location.zone === zone;
}

/** Field cards counted by a `count` condition. */
function countCards(
  state: GameState,
  controller: PlayerId,
  source: CardInstance | null,
  what: CardCount,
): number {
  const p = state.players[what.side === "self" ? controller : opponentOf(controller)];
  return zoneCards(p, what.zone ?? "characters").filter((c) =>
    matchesFilter(state, c, what.filter, source),
  ).length;
}

/** A player's cards in a target zone. */
export function zoneCards(
  p: GameState["players"]["p1"],
  zone: "leader" | "characters" | "leaderOrCharacters" | "stage" | "field",
): CardInstance[] {
  if (zone === "leader") return [p.leader];
  if (zone === "characters") return p.characters;
  if (zone === "stage") return p.stage ? [p.stage] : [];
  if (zone === "field") return [p.leader, ...p.characters, ...(p.stage ? [p.stage] : [])];
  return [p.leader, ...p.characters];
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
    if ("opponentLifeAtLeast" in c) return them.life.length >= c.opponentLifeAtLeast;
    if ("leaderHasType" in c)
      return (definitionOf(state, me.leader).types ?? []).includes(c.leaderHasType);
    if ("charactersAtLeast" in c) return me.characters.length >= c.charactersAtLeast;
    if ("handAtMost" in c) return me.hand.length <= c.handAtMost;
    if ("donOnFieldAtLeast" in c) return donOnField(state, controller) >= c.donOnFieldAtLeast;
    if ("donOnFieldAtMost" in c) return donOnField(state, controller) <= c.donOnFieldAtMost;
    if ("playedThisTurn" in c) return source.playedTurn === state.turn;
    if ("deckTopMatches" in c) {
      const top = me.deck[0];
      return !!top && matchesFilter(state, top, c.deckTopMatches, source, false);
    }
    if ("leaderIs" in c) return namesOf(definitionOf(state, me.leader)).includes(c.leaderIs);
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
    if ("lifeAtMostOpponents" in c) return me.life.length <= them.life.length;
    if ("lifeLessThanOpponents" in c) return me.life.length < them.life.length;
    if ("charactersTotalCostAtLeast" in c)
      return (
        me.characters.reduce((n, x) => n + costOf(state, x), 0) >= c.charactersTotalCostAtLeast
      );
    if ("charactersFewerThanOpponentBy" in c)
      return me.characters.length <= them.characters.length - c.charactersFewerThanOpponentBy;
    if ("givenDonAtLeast" in c)
      return [me.leader, ...me.characters].reduce((n, x) => n + x.givenDon, 0) >= c.givenDonAtLeast;
    if ("leaderAttribute" in c)
      return (definitionOf(state, me.leader).attribute ?? "").includes(c.leaderAttribute);
    if ("handTrashedByEffectThisTurn" in c)
      return state.handTrashedTurn?.[controller] === state.turn;
    if ("leaderTypeIncludes" in c)
      return (definitionOf(state, me.leader).types ?? []).some((t) =>
        t.includes(c.leaderTypeIncludes),
      );
    if ("leaderMulticolored" in c) return definitionOf(state, me.leader).colors.length > 1;
    if ("donActiveAtMost" in c) return me.donActive <= c.donActiveAtMost;
    if ("opponentDonOnFieldAtLeast" in c)
      return donOnField(state, opponentOf(controller)) >= c.opponentDonOnFieldAtLeast;
    if ("thisPowerAtLeast" in c) return powerOf(state, source) >= c.thisPowerAtLeast;
    if ("opponentHasMoreDon" in c)
      return donOnField(state, opponentOf(controller)) > donOnField(state, controller);
    if ("donFewerThanOpponentBy" in c)
      return (
        donOnField(state, controller) <=
        donOnField(state, opponentOf(controller)) - c.donFewerThanOpponentBy
      );
    if ("handAtLeast" in c) return me.hand.length >= c.handAtLeast;
    if ("opponentHandAtLeast" in c) return them.hand.length >= c.opponentHandAtLeast;
    if ("handFewerThanOpponentBy" in c)
      return me.hand.length <= them.hand.length - c.handFewerThanOpponentBy;
    if ("totalLifeAtMost" in c) return me.life.length + them.life.length <= c.totalLifeAtMost;
    if ("totalLifeAtLeast" in c) return me.life.length + them.life.length >= c.totalLifeAtLeast;
    if ("opponentRestedCardsAtLeast" in c) {
      const rested = fieldCards(state, opponentOf(controller)).filter((card) => card.rested).length;
      return them.donRested + rested >= c.opponentRestedCardsAtLeast;
    }
    if ("leaderColorIncludes" in c)
      return definitionOf(state, me.leader).colors.includes(c.leaderColorIncludes);
    if ("attackerMatches" in c) {
      const attacker = state.battle && findCard(state, state.battle.attacker);
      return !!attacker && matchesFilter(state, attacker, c.attackerMatches, source);
    }
    if ("trashAtLeast" in c)
      return (
        me.trash.filter((card) => matchesFilter(state, card, c.filter, source, false)).length >=
        c.trashAtLeast
      );
    if ("thisActive" in c) return !source.rested;
    if ("attackingLeader" in c) return !!state.battle && state.battle.target === them.leader.uid;
    if ("battledCharacterThisTurn" in c)
      return state.battledCharacter?.includes(source.uid) ?? false;
    if ("thisRested" in c) return source.rested;
    if ("not" in c) return !conditionsMet(state, controller, source, [c.not]);
    if ("opponentLeaderAttribute" in c)
      return (definitionOf(state, them.leader).attribute ?? "").includes(c.opponentLeaderAttribute);
    if ("donOnFieldAtMostOpponents" in c)
      return donOnField(state, controller) <= donOnField(state, opponentOf(controller));
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
  // Power is only worked out when the filter needs it: it can depend on permanent effects.
  const basePower = () =>
    findOnField(state, card.uid) ? basePowerOf(state, card) : (def.power ?? 0);
  const cost =
    filter.costAtMost !== undefined ||
    filter.costAtLeast !== undefined ||
    filter.costAtMostOpponentLife ||
    filter.costAtMostDonOnField ||
    filter.costAtMostTotalLife
      ? costOf(state, card)
      : baseCost;
  const power = () =>
    usePower && findOnField(state, card.uid) ? powerOf(state, card) : basePower();
  if (filter.category && def.category !== filter.category) return false;
  if (filter.costAtMost !== undefined && cost > filter.costAtMost) return false;
  if (filter.costAtLeast !== undefined && cost < filter.costAtLeast) return false;
  if (filter.costAtMostOpponentLife && source) {
    if (cost > state.players[opponentOf(source.owner)].life.length) return false;
  }
  if (
    filter.costAtMostTotalLife &&
    cost > state.players.p1.life.length + state.players.p2.life.length
  )
    return false;
  if (filter.noCounter && def.counter) return false;
  if (filter.baseCostAtMost !== undefined && baseCost > filter.baseCostAtMost) return false;
  if (filter.baseCostAtLeast !== undefined && baseCost < filter.baseCostAtLeast) return false;
  if (filter.powerAtMost !== undefined && power() > filter.powerAtMost) return false;
  if (filter.powerAtLeast !== undefined && power() < filter.powerAtLeast) return false;
  if (filter.basePowerAtMost !== undefined && basePower() > filter.basePowerAtMost) return false;
  if (filter.basePowerAtLeast !== undefined && basePower() < filter.basePowerAtLeast) return false;
  if (filter.costAtMostDonOnField && source) {
    if (cost > donOnField(state, source.owner)) return false;
  }
  if (filter.type && !(def.types ?? []).includes(filter.type)) return false;
  if (filter.notType && (def.types ?? []).includes(filter.notType)) return false;
  if (
    filter.notTypeIncludes &&
    (def.types ?? []).some((t) => t.includes(filter.notTypeIncludes ?? ""))
  )
    return false;
  if (filter.typeIncludes && !(def.types ?? []).some((t) => t.includes(filter.typeIncludes ?? "")))
    return false;
  const names = namesOf(def);
  if (filter.name && !names.includes(filter.name)) return false;
  if (filter.notName && names.includes(filter.notName)) return false;
  if (filter.nameIncludes && !names.some((n) => n.includes(filter.nameIncludes ?? "")))
    return false;
  if (filter.color && !def.colors.includes(filter.color)) return false;
  if (filter.rested !== undefined && card.rested !== filter.rested) return false;
  if (filter.notThis && source && card.uid === source.uid) return false;
  if (filter.hasTrigger && !(def.effects ?? []).some((e) => e.timing === "trigger")) return false;
  if (filter.keyword && !hasKeywordNow(state, card, filter.keyword)) return false;
  if (filter.attribute && !(def.attribute ?? "").includes(filter.attribute)) return false;
  if (filter.anyOf && !filter.anyOf.some((f) => matchesFilter(state, card, f, source, usePower)))
    return false;
  if (filter.noBaseEffect && ((def.effects ?? []).length > 0 || (def.keywords ?? []).length > 0))
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

/** DON!! cards given to a player's Leader and Characters. */
export function givenDon(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  return [p.leader, ...p.characters].reduce((n, c) => n + c.givenDon, 0);
}

/**
 * Whether a "you cannot play ..." effect stops `player` playing this card now.
 * `fromHand` is true for plays from the hand.
 */
export function playBlocked(
  state: GameState,
  player: PlayerId,
  card: CardInstance,
  fromHand: boolean,
): boolean {
  const leader = state.players[player].leader.uid;
  return state.modifiers.some(
    (m) =>
      m.target === leader &&
      m.cannotPlay &&
      (fromHand || !m.cannotPlay.fromHand) &&
      matchesFilter(state, card, m.cannotPlay.filter, null, false),
  );
}

/** DON!! cards on a player's field: active and rested in the cost area, plus given ones (rule 6-5-5). */
/** The cards a `toDeckBottom` cost can place: your Stage, your Characters, or (`side: "any"`) any Character. */
export function toDeckBottomOptions(
  state: GameState,
  player: PlayerId,
  source: CardInstance,
  cost: Extract<Cost, { toDeckBottom: number }>,
): CardInstance[] {
  const p = state.players[player];
  if (cost.zone === "stage") return p.stage ? [p.stage] : [];
  const pile =
    cost.side === "any"
      ? [...p.characters, ...state.players[opponentOf(player)].characters]
      : p.characters;
  return pile.filter((c) => matchesFilter(state, c, cost.filter, source));
}

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
  let fromHand = 0;
  let returnGiven = 0;
  let life = 0;
  let fromTrash = 0;
  let restCards = 0;
  for (const cost of costs) {
    if ("restCards" in cost) restCards += cost.restCards;
    if ("restDon" in cost) restDon += cost.restDon;
    if ("giveActiveDon" in cost) restDon += cost.giveActiveDon;
    if ("trashOwnCharacter" in cost) {
      const pile = cost.zone === "stage" ? (p.stage ? [p.stage] : []) : p.characters;
      const own = pile.filter((c) => matchesFilter(state, c, cost.filter, source));
      if (own.length < cost.trashOwnCharacter) return false;
    }
    if ("donMinus" in cost) donMinus += cost.donMinus;
    if ("trashFromHand" in cost) {
      fromHand += cost.trashFromHand;
      const matching = hand.filter((c) => matchesFilter(state, c, cost.filter, source, false));
      if (matching.length < cost.trashFromHand) return false;
    }
    if ("handToDeckTop" in cost) fromHand += cost.handToDeckTop;
    if ("handToDeckBottom" in cost) fromHand += cost.handToDeckBottom;
    if ("thisToDeckBottom" in cost && !findOnField(state, source.uid)) return false;
    if ("returnThis" in cost && findOnField(state, source.uid)?.zone !== "characters") return false;
    if ("activeLeaderPower" in cost && p.leader.rested) return false;
    if ("returnActiveDon" in cost) restDon += cost.returnActiveDon;
    if ("returnOwnCharacter" in cost) {
      const own = p.characters.filter((c) => matchesFilter(state, c, cost.filter, source));
      if (own.length < cost.returnOwnCharacter) return false;
    }
    if ("revealFromHand" in cost) {
      const matching = hand.filter((c) => matchesFilter(state, c, cost.filter, source, false));
      if (matching.length < cost.revealFromHand) return false;
    }
    if ("restOwn" in cost) {
      const own = fieldCards(state, player).filter(
        (c) =>
          !c.rested &&
          !hasStatus(state, c, "cannotBeRested") &&
          matchesFilter(state, c, cost.restOwn, source),
      );
      if (own.length === 0) return false;
    }
    if ("restThis" in cost && (source.rested || hasStatus(state, source, "cannotBeRested")))
      return false;
    if ("returnGivenDon" in cost) returnGiven += cost.returnGivenDon;
    if ("lifeToHand" in cost) life += cost.lifeToHand;
    if ("trashLife" in cost) life += cost.trashLife;
    if ("lifeFaceUp" in cost) {
      const ends = cost.from === "topOrBottom" ? [p.life[0], p.life.at(-1)] : [p.life[0]];
      if (!ends.some((c) => c && !c.faceUp)) return false;
    }
    if ("lifeFaceDown" in cost) {
      const ends = cost.from === "topOrBottom" ? [p.life[0], p.life.at(-1)] : [p.life[0]];
      if (!ends.some((c) => c?.faceUp)) return false;
    }
    if ("trashFromDeckTop" in cost && p.deck.length < cost.trashFromDeckTop) return false;
    if ("oneOf" in cost && !cost.oneOf.some((one) => canPayCosts(state, player, source, [one])))
      return false;
    if ("trashToDeckBottom" in cost) {
      fromTrash += cost.trashToDeckBottom;
      const matching = p.trash.filter(
        (c) => c.uid !== source.uid && matchesFilter(state, c, cost.filter, source, false),
      );
      if (matching.length < cost.trashToDeckBottom) return false;
    }
    if ("trashThis" in cost && !findOnField(state, source.uid)) return false;
    if (
      "toDeckBottom" in cost &&
      toDeckBottomOptions(state, player, source, cost).length < cost.toDeckBottom
    )
      return false;
    if ("trashToDeck" in cost) fromTrash += cost.trashToDeck;
    if ("koOwnCharacter" in cost) {
      const own = p.characters.filter((c) => matchesFilter(state, c, cost.filter, source));
      if (own.length < cost.koOwnCharacter) return false;
    }
    if ("playFromHand" in cost) {
      const matching = hand.filter((c) =>
        matchesFilter(state, c, cost.playFromHand, source, false),
      );
      if (matching.length === 0) return false;
    }
    if ("characterToLife" in cost) {
      const own = p.characters.filter((c) => matchesFilter(state, c, cost.filter, source));
      if (own.length < cost.characterToLife) return false;
    }
  }
  const activeCards = fieldCards(state, player).filter(
    (c) => !c.rested && !hasStatus(state, c, "cannotBeRested"),
  ).length;
  return (
    restDon <= p.donActive &&
    restCards <= activeCards + p.donActive - restDon &&
    donMinus <= donOnField(state, player) &&
    fromHand <= hand.length &&
    life <= p.life.length &&
    fromTrash <= p.trash.filter((c) => c.uid !== source.uid).length &&
    returnGiven <= [p.leader, ...p.characters].reduce((n, c) => n + c.givenDon, 0)
  );
}
