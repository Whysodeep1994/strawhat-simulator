import type { Action } from "./actions.js";
import { applyAction } from "./apply.js";
import type { CardCatalog } from "./cards.js";
import { legalActions } from "./legal.js";
import type { CardInstance, GameState, PlayerId, PlayerState } from "./types.js";

/**
 * Scenarios set up a game position, play actions, and check the result.
 * Every rules ruling and bug report should become one. See docs/SCENARIOS.md.
 */
export interface Scenario {
  name: string;
  /** Comprehensive Rules numbers this scenario checks, e.g. ["7-1-4-1-1-2"]. */
  rules: string[];
  setup: ScenarioSetup;
  /** Card references like "p1.hand.0" or "p2.leader" are resolved to cards when each action runs. */
  actions: (ScenarioAction & { illegal?: boolean })[];
  /** Paths into the game state. Zones compare by card count, e.g. { "p2.life": 3 }. */
  expect: Record<string, unknown>;
}

export type ScenarioAction = { [K in keyof Action]?: unknown } & {
  type: Action["type"];
  player: PlayerId;
};

export interface ScenarioSetup {
  turn?: number;
  turnPlayer?: PlayerId;
  firstPlayer?: PlayerId;
  p1?: ScenarioPlayer;
  p2?: ScenarioPlayer;
}

export interface ScenarioCharacter {
  card: string;
  rested?: boolean;
  don?: number;
  playedThisTurn?: boolean;
}

export interface ScenarioPlayer {
  /** A Leader can be a card id or `{ "card": "...", "don": 1 }`. */
  leader?: string | ScenarioCharacter;
  characters?: (string | ScenarioCharacter)[];
  stage?: string | null;
  hand?: string[];
  trash?: string[];
  /** A number means that many filler cards. Lists are top card first. */
  deck?: number | string[];
  life?: number | string[];
  don?: { active?: number; rested?: number; deck?: number };
  turnsTaken?: number;
}

export const DEFAULT_LEADER = "TEST-LEADER";
export const FILLER_CARD = "TEST-FILLER";

/** Builds a game state directly in the Main Phase (or wherever `setup` says). */
export function buildScenarioState(setup: ScenarioSetup, catalog: CardCatalog): GameState {
  const turn = setup.turn ?? 3;
  const turnPlayer = setup.turnPlayer ?? "p1";
  const firstPlayer = setup.firstPlayer ?? "p1";
  let nextUid = 1;

  const make = (cardId: string, owner: PlayerId, onField = false, extra?: ScenarioCharacter) => {
    if (!catalog[cardId]) throw new Error(`Scenario uses unknown card "${cardId}"`);
    const card: CardInstance = {
      uid: `c${nextUid++}`,
      cardId,
      owner,
      rested: extra?.rested ?? false,
      givenDon: extra?.don ?? 0,
      playedTurn: onField ? (extra?.playedThisTurn ? turn : turn - 1) : null,
    };
    return card;
  };
  const pile = (spec: number | string[] | undefined, fallback: number, owner: PlayerId) =>
    typeof spec === "object"
      ? spec.map((id) => make(id, owner))
      : Array.from({ length: spec ?? fallback }, () => make(FILLER_CARD, owner));
  const fieldCard = (spec: string | ScenarioCharacter, owner: PlayerId) =>
    typeof spec === "string" ? make(spec, owner, true) : make(spec.card, owner, true, spec);

  const player = (id: PlayerId): PlayerState => {
    const s = setup[id] ?? {};
    const defaultTurns = id === firstPlayer ? Math.ceil(turn / 2) : Math.floor(turn / 2);
    return {
      leader: fieldCard(s.leader ?? DEFAULT_LEADER, id),
      characters: (s.characters ?? []).map((c) => fieldCard(c, id)),
      stage: s.stage ? make(s.stage, id, true) : null,
      hand: (s.hand ?? []).map((c) => make(c, id)),
      trash: (s.trash ?? []).map((c) => make(c, id)),
      deck: pile(s.deck, 20, id),
      life: pile(s.life, 4, id),
      donDeck: s.don?.deck ?? 0,
      donActive: s.don?.active ?? 0,
      donRested: s.don?.rested ?? 0,
      turnsTaken: s.turnsTaken ?? defaultTurns,
    };
  };

  return {
    catalog,
    players: { p1: player("p1"), p2: player("p2") },
    turn,
    turnPlayer,
    firstPlayer,
    phase: "main",
    prompt: { kind: "main", player: turnPlayer },
    battle: null,
    winner: null,
    stack: [],
    pendingEffects: [],
    modifiers: [],
    usedThisTurn: [],
    delayed: [],
    limbo: null,
    rng: 1,
    nextUid,
  };
}

const CARD_FIELDS = ["card", "target", "attacker", "blocker", "trash"] as const;

/** Runs a scenario and returns a list of failures; an empty list means it passed. */
export function runScenario(scenario: Scenario, catalog: CardCatalog): string[] {
  let state = buildScenarioState(scenario.setup, catalog);
  const failures: string[] = [];

  scenario.actions.forEach((raw, i) => {
    const { illegal, ...rest } = raw;
    const action = { ...rest } as Record<string, unknown>;
    for (const field of CARD_FIELDS) {
      const ref = action[field];
      if (typeof ref === "string" && /^p[12]\./.test(ref)) action[field] = resolveCard(state, ref);
    }
    if (Array.isArray(action.cards)) {
      action.cards = action.cards.map((ref: unknown) =>
        typeof ref === "string" && /^p[12]\./.test(ref) ? resolveCard(state, ref) : ref,
      );
    }
    try {
      state = applyAction(state, action as Action);
      if (illegal)
        failures.push(`Action ${i + 1} should have been illegal: ${JSON.stringify(raw)}`);
    } catch (error) {
      if (!illegal) failures.push(`Action ${i + 1} failed: ${(error as Error).message}`);
    }
  });

  for (const [path, expected] of Object.entries(scenario.expect)) {
    const actual = readPath(state, path);
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
  return failures;
}

function resolveCard(state: GameState, ref: string): string {
  const value = readPath(state, ref, false);
  if (value && typeof value === "object" && "uid" in value) return (value as CardInstance).uid;
  throw new Error(`Scenario reference "${ref}" doesn't point to a card`);
}

/**
 * Reads "p1.characters.0.rested", "winner", "prompt.kind", or
 * "legal.p1.attack" (the number of legal actions of that type).
 */
function readPath(state: GameState, path: string, countArrays = true): unknown {
  const parts = path.split(".");
  if (parts[0] === "legal") {
    const player = parts[1] as PlayerId;
    return legalActions(state, player).filter((a) => a.type === parts[2]).length;
  }
  let value: unknown = parts[0] === "p1" || parts[0] === "p2" ? state.players[parts[0]] : state;
  for (const part of parts[0] === "p1" || parts[0] === "p2" ? parts.slice(1) : parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return countArrays && Array.isArray(value) ? value.length : value;
}
