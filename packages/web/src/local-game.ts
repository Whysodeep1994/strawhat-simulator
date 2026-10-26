import {
  applyAction,
  chooseBotAction,
  createGame,
  definitionOf,
  findCard,
  opponentOf,
  type Action,
  type CardCatalog,
  type DeckList,
  type GameState,
  type PlayerId,
} from "@strawhat/engine";
import { newStats, trackAction, type GameStats } from "./trophies.js";

/**
 * A game on one computer: you against the computer. It keeps the full game state the way
 * the server will in Phase 6; the board only ever draws what `viewFor` lets you see.
 */
export interface LocalGame {
  state: GameState;
  human: PlayerId;
  log: LogEntry[];
  /** What you've done this game, for trophies. */
  stats: GameStats;
}

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
): LocalGame {
  const state = createGame({
    catalog,
    decks: { [HUMAN]: decks.human, [BOT]: decks.bot } as Record<PlayerId, DeckList>,
    seed,
    // You win Rock-Paper-Scissors, so you choose who goes first (rule 5-2-1-4).
    chooser: HUMAN,
  });
  return {
    state,
    human: HUMAN,
    log: [{ id: 0, player: null, text: "The game begins." }],
    stats: newStats(state, HUMAN),
  };
}

/** Whether the computer has to act next. */
export function botToAct(game: LocalGame): boolean {
  const prompt = game.state.prompt;
  return prompt.kind !== "gameOver" && prompt.player !== game.human;
}

/** Applies your action. Throws IllegalActionError if it isn't allowed. */
export function humanAct(game: LocalGame, action: Action): LocalGame {
  return act(game, action);
}

/** Lets the computer take one action. */
export function botStep(game: LocalGame): LocalGame {
  const prompt = game.state.prompt;
  if (prompt.kind === "gameOver" || prompt.player === game.human) return game;
  return act(game, chooseBotAction(game.state, prompt.player));
}

function act(game: LocalGame, action: Action): LocalGame {
  const before = game.state;
  const after = applyAction(before, action);
  const lines = [describeAction(before, action), ...describeChanges(before, after)];
  let id = game.log.at(-1)?.id ?? 0;
  const entries = lines
    .filter((l): l is { player: PlayerId | null; text: string } => l !== null)
    .map((l) => ({ ...l, id: ++id }));
  return {
    ...game,
    state: after,
    log: [...game.log, ...entries].slice(-200),
    stats: trackAction(game.stats, game.human, before, action, after),
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
};

function describeAction(
  state: GameState,
  action: Action,
): { player: PlayerId; text: string } | null {
  const who = playerName(action.player);
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
          card && card.owner !== action.player ? (card.owner === HUMAN ? "your " : "their ") : "";
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
): { player: PlayerId | null; text: string }[] {
  const lines: { player: PlayerId | null; text: string }[] = [];
  for (const player of ["p1", "p2"] as const) {
    const was = before.players[player];
    const now = after.players[player];
    const who = playerName(player);
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
      text: `Turn ${after.turn}: ${after.turnPlayer === HUMAN ? "your" : "the opponent's"} turn.`,
    });
  }
  if (before.winner === null && after.winner !== null) {
    lines.push({
      player: null,
      text:
        after.winner === "draw"
          ? "The game is a draw."
          : after.winner === HUMAN
            ? "You win!"
            : `${playerName(opponentOf(HUMAN))} wins.`,
    });
  }
  return lines;
}
