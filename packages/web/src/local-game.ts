import {
  applyAction,
  chooseBotAction,
  createGame,
  definitionOf,
  findCard,
  legalActions,
  opponentOf,
  type Action,
  type CardCatalog,
  type DeckList,
  type GameState,
  type PlayerId,
} from "@strawhat/engine";
import {
  charge,
  CLOCK_MS,
  FRIEND_GRACE_MS,
  newClock,
  running,
  timeLeft,
  type Clock,
} from "./clock.js";
import { newStats, trackAction, type GameStats } from "./trophies.js";

/**
 * A game as this computer sees it: you against the computer, or against a friend online. It
 * keeps the full game state; the board only ever draws what `viewFor` lets you see.
 */
export interface LocalGame {
  state: GameState;
  human: PlayerId;
  /** Who sits across the table. A friend's moves arrive from online.ts, never from the bot. */
  opponent: "computer" | "friend";
  /** Every action so far, in order. Online, both players keep the same list. */
  actions: Action[];
  log: LogEntry[];
  /** What you've done this game, for trophies. */
  stats: GameStats;
  /** Each player's 15-minute game clock (see clock.ts). */
  clock: Clock;
  /** The player who ran out of time, if that's how the game ended. */
  timedOut?: PlayerId;
  /** The game as it began, so Pro Drills can replay it move by move for its report. */
  initial: GameState;
  /** A Player Development game: the guided New Player game, or a Pro Drill. */
  training?: Training;
  /** Pro Drills: the game before each action, then as it is now, for the end-of-game report. */
  states?: GameState[];
}

/** Player Development modes. Training games have no game clock, so there's time to learn. */
export type Training = { mode: "newPlayer" } | { mode: "drills"; liveCoaching: boolean };

export interface LogEntry {
  id: number;
  player: PlayerId | null;
  text: string;
}

export const HUMAN: PlayerId = "p1";
export const BOT: PlayerId = "p2";

export function newLocalGame(
  catalog: CardCatalog,
  decks: { human: DeckList; bot: DeckList },
  seed: number,
  training?: Training,
): LocalGame {
  const state = createGame({
    catalog,
    decks: { [HUMAN]: decks.human, [BOT]: decks.bot } as Record<PlayerId, DeckList>,
    seed,
    // You win Rock-Paper-Scissors, so you choose who goes first (rule 5-2-1-4).
    chooser: HUMAN,
  });
  const game = started(state, HUMAN, "computer");
  if (!training) return game;
  return training.mode === "drills"
    ? { ...game, training, states: [state] }
    : { ...game, training };
}

/**
 * A game against a friend online. Both computers build it from the same decks and seed, so
 * each ends up with the same shuffles and only the moves have to travel. The host is p1.
 */
export function newOnlineGame(
  catalog: CardCatalog,
  decks: Record<PlayerId, DeckList>,
  seed: number,
  me: PlayerId,
): LocalGame {
  // Rock-Paper-Scissors is left to the seed, so neither player picks it.
  return started(createGame({ catalog, decks, seed }), me, "friend");
}

function started(state: GameState, human: PlayerId, opponent: LocalGame["opponent"]): LocalGame {
  return {
    state,
    initial: state,
    human,
    opponent,
    actions: [],
    log: [{ id: 0, player: null, text: "The game begins." }],
    stats: newStats(state, human),
    clock: newClock(),
  };
}

/** Whether the computer has to act next. */
export function botToAct(game: LocalGame): boolean {
  const prompt = game.state.prompt;
  return game.opponent === "computer" && prompt.kind !== "gameOver" && prompt.player !== game.human;
}

/** Applies your friend's action. Throws IllegalActionError if it isn't allowed. */
export function friendAct(game: LocalGame, action: Action): LocalGame {
  if (action.player === game.human) throw new Error("A move for you came from your friend.");
  return act(game, action);
}

/** Applies your action. Throws IllegalActionError if it isn't allowed. */
export function humanAct(game: LocalGame, action: Action): LocalGame {
  return act(game, action);
}

/** The most moves in a row the computer makes before it just passes or ends its turn. */
const MAX_BOT_STREAK = 300;

/**
 * Lets the computer take one action. It never leaves the game stuck: if its choice fails, it
 * passes or ends the turn, then tries every other legal move, and concedes only if none works.
 */
export function botStep(game: LocalGame): LocalGame {
  const prompt = game.state.prompt;
  if (prompt.kind === "gameOver" || prompt.player === game.human) return game;
  const player = prompt.player;
  // A run of moves this long means the computer is going round in circles.
  const streak = game.actions.length - 1 - game.actions.findLastIndex((a) => a.player !== player);
  if (streak < MAX_BOT_STREAK) {
    try {
      return act(game, chooseBotAction(game.state, player));
    } catch (e) {
      console.error("The computer's move failed, so it plays it safe", e);
    }
  }
  let legal: Action[] = [];
  try {
    legal = legalActions(game.state, player).filter((a) => a.type !== "concede");
  } catch {
    // Conceding below still ends the game.
  }
  const safe = legal.filter((a) => a.type === "pass" || a.type === "endTurn");
  const others = legal.filter((a) => a.type !== "pass" && a.type !== "endTurn");
  for (const action of [...safe, ...others, { type: "concede", player } as Action]) {
    try {
      return act(game, action);
    } catch {
      // Try the next one.
    }
  }
  return game;
}

/**
 * The player whose clock has run out, or null. A friend gets a few seconds' grace on your
 * screen, since their own page ends the game for them at zero and moves take a moment to travel.
 */
export function outOfTime(game: LocalGame, now: number = Date.now()): PlayerId | null {
  if (game.training) return null;
  const player = running(game.state);
  if (!player) return null;
  const grace = game.opponent === "friend" && player !== game.human ? FRIEND_GRACE_MS : 0;
  return timeLeft(game.clock, game.state, player, now) <= -grace ? player : null;
}

/** Ends the game with `player` losing on time. */
export function timeOut(game: LocalGame, player: PlayerId, now: number = Date.now()): LocalGame {
  if (game.state.winner !== null) return game;
  const lastId = game.log.at(-1)?.id ?? 0;
  const next = act(game, { type: "concede", player }, now);
  return {
    ...next,
    timedOut: player,
    clock: { ...next.clock, used: { ...next.clock.used, [player]: CLOCK_MS } },
    log: next.log.map((entry) =>
      entry.id > lastId && entry.text.endsWith(" conceded.")
        ? { ...entry, text: `${playerName(player, game.human)} ran out of time.` }
        : entry,
    ),
  };
}

function act(game: LocalGame, action: Action, now: number = Date.now()): LocalGame {
  const before = game.state;
  const after = applyAction(before, action);
  const lines = [
    describeAction(before, action, game.human),
    ...describeChanges(before, after, game.human),
  ];
  let id = game.log.at(-1)?.id ?? 0;
  const entries = lines
    .filter((l): l is { player: PlayerId | null; text: string } => l !== null)
    .map((l) => ({ ...l, id: ++id }));
  return {
    ...game,
    state: after,
    actions: [...game.actions, action],
    ...(game.states && { states: [...game.states, after] }),
    log: [...game.log, ...entries].slice(-200),
    stats: trackAction(game.stats, game.human, before, action, after),
    clock: charge(game.clock, before, now),
  };
}

export function playerName(player: PlayerId, human: PlayerId = HUMAN): string {
  return player === human ? "You" : "Opponent";
}

function name(state: GameState, uid: string): string {
  const card = findCard(state, uid);
  return card ? definitionOf(state, card).name : "a card";
}

const CHOICE_PURPOSE: Record<string, string> = {
  ko: "to K.O.",
  rest: "to rest",
  setActive: "to set as active",
  returnToHand: "to return to hand",
  returnToDeckBottom: "to put at the bottom of the deck",
  powerUp: "to power up",
  grantKeyword: "to gain an ability",
  giveRestedDon: "to get DON!!",
  searchDeck: "to add to hand",
  trashFromHand: "to trash",
  trashCharacter: "to trash",
  playFromHand: "to play",
  playFromTrash: "to play from the trash",
  deckBottom: "to put at the bottom of the deck",
  deckTopOrder: "to put back on top of the deck, in that order",
  lifeOrder: "to put back in Life, in that order",
  handToDeckTop: "to put on top of the deck",
  handToDeckBottom: "to put at the bottom of the deck",
  revealFromHand: "to reveal",
};

function describeAction(
  state: GameState,
  action: Action,
  human: PlayerId,
): { player: PlayerId; text: string } | null {
  const who = playerName(action.player, human);
  const say = (text: string) => ({ player: action.player, text: `${who} ${text}` });
  switch (action.type) {
    case "chooseTurnOrder":
      return say(`chose to go ${action.goFirst ? "first" : "second"}.`);
    case "keepHand":
      return say("kept the opening hand.");
    case "mulligan":
      return say("redrew the opening hand.");
    case "playCard":
      return say(`played ${name(state, action.card)}.`);
    case "activate":
      return say(`activated ${name(state, action.card)}.`);
    case "giveDon":
      return say(`gave DON!! to ${name(state, action.target)}.`);
    case "attack":
      return say(`attacked ${name(state, action.target)} with ${name(state, action.attacker)}.`);
    case "endTurn":
      return say("ended the turn.");
    case "block":
      return say(`blocked with ${name(state, action.blocker)}.`);
    case "counter": {
      const card = findCard(state, action.card);
      const value = card ? (definitionOf(state, card).counter ?? 0) : 0;
      return say(`used ${name(state, action.card)} as a +${value} Counter.`);
    }
    case "counterEvent":
      return say(`played the Counter Event ${name(state, action.card)}.`);
    case "choose": {
      if (action.cards.length === 0) return say("chose nothing.");
      const prompt = state.prompt;
      const purpose = prompt.kind === "choose" ? CHOICE_PURPOSE[prompt.reason] : undefined;
      const names = action.cards.map((uid) => {
        const card = findCard(state, uid);
        const owner =
          card && card.owner !== action.player ? (card.owner === human ? "your " : "their ") : "";
        return `${owner}${name(state, uid)}`;
      });
      return say(`chose ${names.join(", ")}${purpose ? ` ${purpose}` : ""}.`);
    }
    case "confirm": {
      const prompt = state.prompt;
      if (prompt.kind === "confirm" && prompt.reason === "trigger") {
        return action.accept
          ? say(`activated the [Trigger] of ${name(state, prompt.source)}.`)
          : say("didn't activate the [Trigger].");
      }
      return null;
    }
    case "chooseOne": {
      const prompt = state.prompt;
      const label = prompt.kind === "chooseOne" ? prompt.labels[action.option] : undefined;
      return label ? say(`chose: ${label}.`) : null;
    }
    case "pass":
      return state.prompt.kind === "block" ? say("didn't block.") : null;
    case "concede":
      return say("conceded.");
  }
}

function describeChanges(
  before: GameState,
  after: GameState,
  human: PlayerId,
): { player: PlayerId | null; text: string }[] {
  const lines: { player: PlayerId | null; text: string }[] = [];
  for (const player of ["p1", "p2"] as const) {
    const was = before.players[player];
    const now = after.players[player];
    const who = playerName(player, human);
    if (now.life.length < was.life.length) {
      lines.push({ player, text: `${who} took damage. Life: ${now.life.length}.` });
    }
    const onField = new Set(now.characters.map((c) => c.uid));
    for (const card of was.characters) {
      if (onField.has(card.uid)) continue;
      const def = definitionOf(before, card);
      const where = now.trash.some((c) => c.uid === card.uid)
        ? "was K.O.'d"
        : now.hand.some((c) => c.uid === card.uid)
          ? "returned to hand"
          : "left the field";
      lines.push({
        player,
        text: `${who === "You" ? "Your" : "Opponent's"} ${def.name} ${where}.`,
      });
    }
  }
  if (before.turn !== after.turn && after.turn > 0 && after.winner === null) {
    lines.push({
      player: after.turnPlayer,
      text: `Turn ${after.turn}: ${after.turnPlayer === human ? "your" : "the opponent's"} turn.`,
    });
  }
  if (before.winner === null && after.winner !== null) {
    lines.push({
      player: null,
      text:
        after.winner === "draw"
          ? "The game is a draw."
          : after.winner === human
            ? "You win!"
            : `${playerName(opponentOf(human), human)} wins.`,
    });
  }
  return lines;
}
