import {
  definitionOf,
  findCard,
  opponentOf,
  powerOf,
  type Action,
  type CardDefinition,
  type GameState,
  type PlayerId,
} from "@strawhat/engine";

/**
 * Trophies, like console achievements: points for finishing games in special ways. The list was
 * approved by the project owner on 2026-10-25. Progress stays in this browser, like saved decks.
 */

export type Tier = "bronze" | "silver" | "gold" | "platinum";

export const TIER_POINTS: Record<Tier, number> = { bronze: 15, silver: 30, gold: 75, platinum: 85 };

export interface Trophy {
  id: string;
  name: string;
  text: string;
  tier: Tier;
}

export const TROPHIES: Trophy[] = [
  {
    id: "setting-sail",
    name: "Setting Sail",
    text: "Finish your first game, win or lose.",
    tier: "bronze",
  },
  { id: "first-victory", name: "First Victory", text: "Win your first game.", tier: "bronze" },
  {
    id: "shipwright",
    name: "Shipwright",
    text: "Save a deck in the Deck Builder that passes the Standard format check.",
    tier: "bronze",
  },
  {
    id: "full-crew",
    name: "Full Crew",
    text: "Have 5 Characters on your field at the same time.",
    tier: "bronze",
  },
  {
    id: "counterpunch",
    name: "Counterpunch",
    text: "Make an opponent's attack fail by using a Counter.",
    tier: "bronze",
  },
  {
    id: "fortunes-favour",
    name: "Fortune's Favour",
    text: "Activate the [Trigger] of one of your Life cards.",
    tier: "bronze",
  },
  { id: "iron-wall", name: "Iron Wall", text: "Block 3 attacks in one game.", tier: "bronze" },
  {
    id: "don-overload",
    name: "DON!! Overload",
    text: "Have 5 or more DON!! cards given to one Leader or Character at once.",
    tier: "bronze",
  },
  { id: "home-waters", name: "Home Waters", text: "Win with a Quick deck.", tier: "bronze" },
  {
    id: "mirror-match",
    name: "Mirror Match",
    text: "Win when the computer is playing the same Leader as you.",
    tier: "bronze",
  },
  {
    id: "finishing-blow",
    name: "Finishing Blow",
    text: "Win with an attack that has 10,000 power or more.",
    tier: "bronze",
  },
  {
    id: "captains-log",
    name: "Captain's Log",
    text: "Win with a deck you built yourself.",
    tier: "silver",
  },
  {
    id: "straw-hat-pride",
    name: "Straw Hat Pride",
    text: "Win while your Leader and every card you played have the Straw Hat Crew type.",
    tier: "silver",
  },
  {
    id: "last-stand",
    name: "Last Stand",
    text: "Win while you have 0 Life cards left.",
    tier: "silver",
  },
  {
    id: "swift-voyage",
    name: "Swift Voyage",
    text: "Win by the end of your 5th turn.",
    tier: "silver",
  },
  {
    id: "clean-sweep",
    name: "Clean Sweep",
    text: "K.O. 3 of the opponent's Characters in one turn.",
    tier: "silver",
  },
  {
    id: "long-voyage",
    name: "The Long Voyage",
    text: "Win because the opponent ran out of cards in their deck.",
    tier: "silver",
  },
  {
    id: "bare-knuckles",
    name: "Bare Knuckles",
    text: "Win without playing any Event cards.",
    tier: "silver",
  },
  {
    id: "underdog",
    name: "Underdog",
    text: "Win a game where you were 3 or more Life cards behind the opponent.",
    tier: "silver",
  },
  {
    id: "rainbow-fleet",
    name: "Rainbow Fleet",
    text: "Win with a Leader of each of the six colours (over any number of games).",
    tier: "silver",
  },
  { id: "seasoned-captain", name: "Seasoned Captain", text: "Win 10 games.", tier: "silver" },
  {
    id: "untouchable",
    name: "Untouchable",
    text: "Win without losing a single Life card.",
    tier: "gold",
  },
  {
    id: "nothing-wasted",
    name: "Nothing Wasted",
    text: "Win with no cards in your trash.",
    tier: "gold",
  },
  {
    id: "one-man-army",
    name: "One-Man Army",
    text: "Win without playing any Characters.",
    tier: "gold",
  },
  { id: "unstoppable", name: "Unstoppable", text: "Win 5 games in a row.", tier: "gold" },
  { id: "grand-fleet", name: "Grand Fleet", text: "Win with 20 different Leaders.", tier: "gold" },
  { id: "emperor", name: "Emperor of the Sea", text: "Win 50 games.", tier: "gold" },
  { id: "pirate-king", name: "Pirate King", text: "Earn every other trophy.", tier: "platinum" },
];

export const TOTAL_POINTS = TROPHIES.reduce((sum, t) => sum + TIER_POINTS[t.tier], 0);

/** A game only counts once you've taken this many of your own turns. */
export const MIN_TURNS = 3;

const STRAW_HAT = "Straw Hat Crew";
const COLORS = ["red", "green", "blue", "purple", "black", "yellow"];

/** What happened in one game, kept up to date after every action. */
export interface GameStats {
  myTurns: number;
  conceded: boolean;
  lostLife: boolean;
  /** The most Life cards you were behind the opponent at any moment. */
  mostBehind: number;
  blocks: number;
  fullCrew: boolean;
  donOverload: boolean;
  triggered: boolean;
  counterpunch: boolean;
  /** An opponent's attack you used a Counter against, until its battle ends. */
  countering: { target: string; life: number } | null;
  /** Opponent's Characters K.O.'d during your current turn. */
  kosThisTurn: number;
  cleanSweep: boolean;
  playedEvent: boolean;
  playedCharacter: boolean;
  /** Every card you played (and your Leader) had the Straw Hat Crew type. */
  allStrawHat: boolean;
  /** The game ended on your attack with 10,000 power or more. */
  finishingBlow: boolean;
}

export function newStats(state: GameState, me: PlayerId): GameStats {
  return {
    myTurns: 0,
    conceded: false,
    lostLife: false,
    mostBehind: 0,
    blocks: 0,
    fullCrew: false,
    donOverload: false,
    triggered: false,
    counterpunch: false,
    countering: null,
    kosThisTurn: 0,
    cleanSweep: false,
    playedEvent: false,
    playedCharacter: false,
    allStrawHat: isStrawHat(definitionOf(state, state.players[me].leader)),
    finishingBlow: false,
  };
}

function isStrawHat(def: CardDefinition | undefined): boolean {
  return !!def?.types?.includes(STRAW_HAT);
}

/** Updates the stats for one action, from the game as it was before and after it. */
export function trackAction(
  stats: GameStats,
  me: PlayerId,
  before: GameState,
  action: Action,
  after: GameState,
): GameStats {
  const s = { ...stats };
  const them = opponentOf(me);
  const mine = after.players[me];
  const was = before.players[me];
  const def = (uid: string, state = before) => {
    const card = findCard(state, uid);
    return card ? definitionOf(state, card) : undefined;
  };

  if (action.type === "concede" && action.player === me) s.conceded = true;

  if (after.turn !== before.turn) {
    s.kosThisTurn = 0;
    if (after.turnPlayer === me && after.turn > 0) s.myTurns++;
  }

  if (action.player === me) {
    if (action.type === "block") s.blocks++;
    if (action.type === "playCard" || action.type === "counterEvent") {
      const card = def(action.card);
      if (card?.category === "event") {
        s.playedEvent = true;
        if (!isStrawHat(card)) s.allStrawHat = false;
      }
    }
    if (
      action.type === "confirm" &&
      action.accept &&
      before.prompt.kind === "confirm" &&
      before.prompt.reason === "trigger"
    ) {
      s.triggered = true;
    }
    if ((action.type === "counter" || action.type === "counterEvent") && before.battle) {
      const attacker = findCard(before, before.battle.attacker);
      if (attacker?.owner === them && !s.countering) {
        s.countering = { target: before.battle.target, life: was.life.length };
      }
    }
  }

  // Cards that came onto your field this action, played from hand or by an effect.
  const onFieldBefore = new Set(
    [...was.characters, ...(was.stage ? [was.stage] : [])].map((c) => c.uid),
  );
  for (const card of [...mine.characters, ...(mine.stage ? [mine.stage] : [])]) {
    if (onFieldBefore.has(card.uid)) continue;
    const cardDef = definitionOf(after, card);
    if (cardDef.category === "character") s.playedCharacter = true;
    if (!isStrawHat(cardDef)) s.allStrawHat = false;
  }

  if (mine.life.length < was.life.length) s.lostLife = true;
  s.mostBehind = Math.max(s.mostBehind, after.players[them].life.length - mine.life.length);
  if (mine.characters.length >= 5) s.fullCrew = true;
  if ([mine.leader, ...mine.characters].some((c) => c.givenDon >= 5)) s.donOverload = true;

  if (before.turnPlayer === me && after.turnPlayer === me) {
    const stillThere = new Set(after.players[them].characters.map((c) => c.uid));
    const inTrash = new Set(after.players[them].trash.map((c) => c.uid));
    for (const card of before.players[them].characters) {
      if (!stillThere.has(card.uid) && inTrash.has(card.uid)) s.kosThisTurn++;
    }
    if (s.kosThisTurn >= 3) s.cleanSweep = true;
  }

  // The battle you countered is over: did the attack fail?
  if (s.countering && !after.battle) {
    const { target, life } = s.countering;
    const failed =
      target === mine.leader.uid
        ? mine.life.length >= life && after.winner !== them
        : mine.characters.some((c) => c.uid === target);
    if (failed) s.counterpunch = true;
    s.countering = null;
  }

  if (before.winner === null && after.winner === me && before.battle) {
    const attacker = findCard(before, before.battle.attacker);
    if (attacker?.owner === me && powerOf(before, attacker) >= 10000) s.finishingBlow = true;
  }
  return s;
}

/** Whether a finished game counts toward trophies. */
export function qualifies(stats: GameStats, state: GameState): boolean {
  return state.winner !== null && !stats.conceded && stats.myTurns >= MIN_TURNS;
}

export interface GameInfo {
  /** You played a deck you built. */
  mine: boolean;
  leader: string;
  opponentLeader: string;
}

/** Trophy progress kept in the browser. */
export interface TrophyProgress {
  /** Trophy id → when it was earned (ISO time). */
  earned: Record<string, string>;
  wins: number;
  streak: number;
  /** Leader colours you've won with. */
  colors: string[];
  /** Leaders you've won with. */
  leaders: string[];
}

export function emptyProgress(): TrophyProgress {
  return { earned: {}, wins: 0, streak: 0, colors: [], leaders: [] };
}

/** Adds the trophies to the progress, plus Pirate King once every other one is earned. */
export function award(
  progress: TrophyProgress,
  ids: string[],
  now = new Date().toISOString(),
): { progress: TrophyProgress; newly: string[] } {
  const earned = { ...progress.earned };
  const newly: string[] = [];
  const add = (id: string) => {
    if (earned[id]) return;
    earned[id] = now;
    newly.push(id);
  };
  ids.forEach(add);
  if (TROPHIES.every((t) => t.id === "pirate-king" || earned[t.id])) add("pirate-king");
  return { progress: { ...progress, earned }, newly };
}

/** Records a finished game: counts the win and awards what it earned. */
export function recordGame(
  progress: TrophyProgress,
  stats: GameStats,
  state: GameState,
  me: PlayerId,
  info: GameInfo,
  now?: string,
): { progress: TrophyProgress; newly: string[] } {
  const won = state.winner === me;
  if (!qualifies(stats, state)) {
    // Conceding or a too-short game ends a winning streak but earns nothing.
    return { progress: won ? progress : { ...progress, streak: 0 }, newly: [] };
  }
  const next: TrophyProgress = { ...progress, streak: won ? progress.streak + 1 : 0 };
  const ids = ["setting-sail"];
  if (stats.fullCrew) ids.push("full-crew");
  if (stats.counterpunch) ids.push("counterpunch");
  if (stats.triggered) ids.push("fortunes-favour");
  if (stats.blocks >= 3) ids.push("iron-wall");
  if (stats.donOverload) ids.push("don-overload");
  if (stats.cleanSweep) ids.push("clean-sweep");

  if (won) {
    const me_ = state.players[me];
    const them = state.players[opponentOf(me)];
    const leaderColors = definitionOf(state, me_.leader).colors;
    next.wins = progress.wins + 1;
    next.colors = [...new Set([...progress.colors, ...leaderColors])];
    next.leaders = [...new Set([...progress.leaders, info.leader])];
    ids.push("first-victory");
    ids.push(info.mine ? "captains-log" : "home-waters");
    if (info.leader === info.opponentLeader) ids.push("mirror-match");
    if (stats.finishingBlow) ids.push("finishing-blow");
    if (stats.allStrawHat) ids.push("straw-hat-pride");
    if (me_.life.length === 0) ids.push("last-stand");
    const myTurnNow = state.turnPlayer === me;
    if (stats.myTurns < 5 || (stats.myTurns === 5 && myTurnNow)) ids.push("swift-voyage");
    if (them.deck.length === 0) ids.push("long-voyage");
    if (!stats.playedEvent) ids.push("bare-knuckles");
    if (stats.mostBehind >= 3) ids.push("underdog");
    if (COLORS.every((c) => next.colors.includes(c))) ids.push("rainbow-fleet");
    if (next.wins >= 10) ids.push("seasoned-captain");
    if (!stats.lostLife) ids.push("untouchable");
    if (me_.trash.length === 0) ids.push("nothing-wasted");
    if (!stats.playedCharacter) ids.push("one-man-army");
    if (next.streak >= 5) ids.push("unstoppable");
    if (next.leaders.length >= 20) ids.push("grand-fleet");
    if (next.wins >= 50) ids.push("emperor");
  }
  return award(next, ids, now);
}

/** Leaving a game before it ends counts as a loss for your winning streak. */
export function abandonGame(progress: TrophyProgress): TrophyProgress {
  return { ...progress, streak: 0 };
}

/** How far along a counting trophy is, for the Trophies screen. */
export function progressOf(trophy: Trophy, progress: TrophyProgress): [number, number] | null {
  switch (trophy.id) {
    case "seasoned-captain":
      return [Math.min(progress.wins, 10), 10];
    case "emperor":
      return [Math.min(progress.wins, 50), 50];
    case "unstoppable":
      return [Math.min(progress.streak, 5), 5];
    case "rainbow-fleet":
      return [progress.colors.filter((c) => COLORS.includes(c)).length, 6];
    case "grand-fleet":
      return [Math.min(progress.leaders.length, 20), 20];
    case "pirate-king":
      return [
        TROPHIES.filter((t) => t.id !== "pirate-king" && progress.earned[t.id]).length,
        TROPHIES.length - 1,
      ];
    default:
      return null;
  }
}

export function pointsOf(progress: TrophyProgress): number {
  return TROPHIES.filter((t) => progress.earned[t.id]).reduce(
    (sum, t) => sum + TIER_POINTS[t.tier],
    0,
  );
}

export function trophyById(id: string): Trophy | undefined {
  return TROPHIES.find((t) => t.id === id);
}

const KEY = "strawhat.trophies";

export function loadProgress(): TrophyProgress {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(KEY) ?? "null",
    ) as Partial<TrophyProgress> | null;
    if (!parsed || typeof parsed !== "object") return emptyProgress();
    return {
      earned: typeof parsed.earned === "object" && parsed.earned ? parsed.earned : {},
      wins: typeof parsed.wins === "number" ? parsed.wins : 0,
      streak: typeof parsed.streak === "number" ? parsed.streak : 0,
      colors: Array.isArray(parsed.colors) ? parsed.colors : [],
      leaders: Array.isArray(parsed.leaders) ? parsed.leaders : [],
    };
  } catch {
    return emptyProgress();
  }
}

/** Returns false when the browser refused to store it (private mode or out of space). */
export function saveProgress(progress: TrophyProgress): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
