import {
  chooseBotAction,
  definitionOf,
  findCard,
  legalActions,
  opponentOf,
  type Action,
  type GameState,
  type PlayerId,
} from "@strawhat/engine";
import {
  canStillAttack,
  cardName,
  power,
  suggestDefense,
  suggestMain,
  type Suggestion,
} from "./coach.js";

/**
 * Player Development's New Player mode: a guided first game. Before it starts, a few short
 * lessons explain the basics; during it, the tutor explains every decision, suggests the move
 * a good player would make and why, and stops to explain each rule the first time it happens.
 * Rule numbers are from the official Comprehensive Rules v1.2.1.
 */

export interface Lesson {
  title: string;
  lines: string[];
}

/** The decks a new player learns with: the Monkey.D.Luffy starter decks. */
export const LEARNING_DECKS = ["ST01", "ST18", "ST21"];
/** The opponent: Edward.Newgate's one-colour (red) starter deck, simple to read. */
export const LEARNING_OPPONENT = "ST15";

export const LESSONS: Lesson[] = [
  {
    title: "Welcome, new pirate!",
    lines: [
      "This is a guided game. A coach will explain each step and suggest a good move.",
      "You can follow the suggestion with the Do it for me button, or try your own move. Either way is fine.",
    ],
  },
  {
    title: "How to win",
    lines: [
      "Each player has a Leader card. Your Leader starts the game with Life cards, face-down beside it (5 for Luffy).",
      "Every time your Leader is hit, you lose a Life card, and it goes into your hand.",
      "Hit the opponent's Leader when they have 0 Life left, and you win (rule 7-1-4-1-1-1). You also lose if your deck runs out (rule 9-2-1-2).",
    ],
  },
  {
    title: "DON!! is your energy",
    lines: [
      "Each turn you get 2 more DON!! cards, up to 10. The player going first gets only 1 on their first turn (rule 6-4-1).",
      "Playing a card costs DON!!: rest as many as its cost, shown at the top left.",
      "You can also give DON!! to your Leader or a Character: each one gives +1000 power during your turn (rule 6-5-5-2).",
      "Every turn, all your DON!! come back ready to use (rules 6-2-3 and 6-2-4), so try to use them all.",
    ],
  },
  {
    title: "Your turn, step by step",
    lines: [
      "Refresh: your rested cards and DON!! stand up again.",
      "Draw 1 card (the first player skips this on turn 1).",
      "DON!!: add 2 DON!!.",
      "Main: play cards, give DON!!, attack, then end your turn.",
    ],
  },
  {
    title: "Attacking",
    lines: [
      "Rest (turn sideways) your Leader or a Character to attack the opponent's Leader, or one of their rested Characters.",
      "The attacker wins if its power is equal or higher (rule 7-1-4-1). A beaten Leader loses 1 Life; a beaten Character is K.O.'d to the trash.",
      "Nobody can attack on their very first turn (rule 6-5-6-1), and new Characters wait a turn before attacking unless they have [Rush] (rule 3-7-4).",
    ],
  },
  {
    title: "Defending",
    lines: [
      "When you're attacked, a [Blocker] Character can step in and take the attack.",
      "Then, in the Counter Step, you can trash cards from your hand to add their Counter value (+1000 or +2000) to the defender.",
      "Tip: at high Life it's often fine to take the hit, since the Life card comes to your hand anyway. Save counters for when Life runs low.",
    ],
  },
  {
    title: "Ready? Set sail!",
    lines: [
      "You play Monkey.D.Luffy. Your opponent is Edward.Newgate, a simple all-red deck.",
      "Watch for the green glow: it marks the card the coach suggests. Good luck!",
    ],
  },
];

export interface Guide {
  title: string;
  lines: string[];
  suggestion: Suggestion | null;
}

/** What the tutor says right now, and the move it suggests. */
export function guide(state: GameState, me: PlayerId): Guide {
  const prompt = state.prompt;
  const them = opponentOf(me);
  if (prompt.kind === "gameOver") {
    return {
      title: state.winner === me ? "You won!" : "Game over",
      lines: [
        state.winner === me
          ? "Great sailing! You've played a whole game. Try another Luffy deck, or head to Pro Drills to sharpen your play."
          : "Every captain loses a few battles. Play again: you'll be surprised how much faster it gets.",
      ],
      suggestion: null,
    };
  }
  if (prompt.player !== me) {
    return {
      title: "Opponent's turn",
      lines: theirTurnLines(state),
      suggestion: null,
    };
  }
  const legal = legalActions(state, me);
  switch (prompt.kind) {
    case "chooseTurnOrder":
      return {
        title: "Who goes first?",
        lines: [
          "You won Rock-Paper-Scissors, so you choose.",
          "Going first means you play cards first, but you don't draw on turn 1 and get only 1 DON!!.",
        ],
        suggestion: {
          action: { type: "chooseTurnOrder", player: me, goFirst: true },
          say: "Go first",
          why: "It's the easiest way to learn: you'll see each step of a turn right away.",
        },
      };
    case "mulligan": {
      const early = state.players[me].hand.some((c) => {
        const d = definitionOf(state, c);
        return d.category === "character" && (d.cost ?? 0) <= 3;
      });
      return {
        title: "Your opening hand",
        lines: [
          "You drew 5 cards. You may shuffle them back and draw 5 new ones, once (rule 5-2-1-6-1).",
          "A good hand has cheap Characters (cost 1 to 3) to play in your first turns.",
        ],
        suggestion: early
          ? {
              action: { type: "keepHand", player: me },
              say: "Keep this hand",
              why: "It has a cheap Character you can play early.",
            }
          : {
              action: { type: "mulligan", player: me },
              say: "Redraw",
              why: "There's no Character costing 3 or less, so your first turns would be empty.",
            },
      };
    }
    case "main": {
      const p = state.players[me];
      const lines = [`Main Phase. You have ${p.donActive} active DON!! to spend.`];
      if (p.turnsTaken === 1 && state.firstPlayer === me) {
        lines.push("It's your first turn, so you can't attack yet. Play a Character to get ready.");
      } else if (p.turnsTaken === 1) {
        lines.push("It's your first turn, so you can't attack yet (rule 6-5-6-1).");
      }
      if (state.players[them].life.length === 0) {
        lines.push("They have 0 Life! One more hit on their Leader wins.");
      }
      return { title: "Your turn", lines, suggestion: suggestMain(state, me) };
    }
    case "block":
      return {
        title: "Block?",
        lines: [
          `${cardName(state, state.battle?.attacker ?? "")} is attacking. A [Blocker] Character can rest to take the attack instead (rule 10-1-4).`,
        ],
        suggestion: suggestDefense(state, me),
      };
    case "counter":
      return {
        title: "Counter Step",
        lines: [
          "Trash cards from your hand to add their Counter value to your defending card. The attacker wins on equal power, so you need to end up higher.",
        ],
        suggestion: suggestDefense(state, me),
      };
    case "choose":
    case "confirm":
    case "chooseOne": {
      const source = findCard(state, prompt.source);
      const action = choiceFor(state, me, legal);
      return {
        title:
          prompt.kind === "confirm" && prompt.reason === "trigger" ? "[Trigger]!" : "An effect",
        lines: [
          prompt.kind === "confirm" && prompt.reason === "trigger"
            ? "This Life card has a [Trigger]: you may use its effect for free instead of just adding it to your hand (rule 10-1-5)."
            : `${source ? definitionOf(state, source).name : "A card"}'s effect needs a decision. Read the card on the right.`,
        ],
        suggestion: action
          ? {
              action,
              say: describe(state, action),
              why:
                prompt.kind === "confirm" && prompt.reason === "trigger"
                  ? "A [Trigger] is a free effect, so it's almost always worth using."
                  : "It gets the most out of this effect.",
            }
          : null,
      };
    }
  }
}

function choiceFor(state: GameState, me: PlayerId, legal: Action[]): Action | null {
  const prompt = state.prompt;
  // DON!! from an effect belongs on a card that's still going to attack, the Leader first.
  if (prompt.kind === "choose" && /Don/.test(prompt.reason) && prompt.max > 0) {
    const leader = state.players[me].leader.uid;
    const ready = prompt.options
      .filter((uid) => canStillAttack(state, me, uid))
      .sort((a, b) => (a === leader ? -1 : b === leader ? 1 : power(state, b) - power(state, a)));
    if (ready.length > 0) return { type: "choose", player: me, cards: ready.slice(0, prompt.max) };
    if (prompt.min === 0) return { type: "choose", player: me, cards: [] };
  }
  try {
    return chooseBotAction(state, me);
  } catch {
    return legal[0] ?? null;
  }
}

function describe(state: GameState, action: Action): string {
  switch (action.type) {
    case "choose":
      return action.cards.length === 0
        ? "Choose none"
        : `Choose ${action.cards.map((uid) => cardName(state, uid)).join(", ")}`;
    case "confirm":
      return action.accept ? "Yes" : "No";
    case "chooseOne": {
      const prompt = state.prompt;
      return prompt.kind === "chooseOne" ? (prompt.labels[action.option] ?? "Choose") : "Choose";
    }
    default:
      return "Continue";
  }
}

function theirTurnLines(state: GameState): string[] {
  const battle = state.battle;
  if (battle) {
    return [
      `They attack with ${cardName(state, battle.attacker)} (${power(state, battle.attacker)} power). You'll get the chance to defend.`,
    ];
  }
  if (state.turn === 0) return ["The opponent is getting ready."];
  return ["Watch what they do: every move shows up in the list of moves on the right."];
}

/** A rule worth explaining the first time it shows up in the game. */
export interface RuleNote {
  id: string;
  title: string;
  text: string;
}

/** Rules seen for the first time between two states, to explain as they happen. */
export function newRules(before: GameState, after: GameState, me: PlayerId): RuleNote[] {
  const them = opponentOf(me);
  const notes: RuleNote[] = [];
  const was = before.players;
  const now = after.players;
  if (now[me].life.length < was[me].life.length) {
    notes.push({
      id: "damage",
      title: "You took damage",
      text: "Your top Life card went into your hand (rule 4-6-2-1). Losing Life gives you cards, but at 0 Life the next hit loses the game.",
    });
  }
  if (now[them].life.length < was[them].life.length) {
    notes.push({
      id: "hit",
      title: "A hit!",
      text: "Their Leader lost a Life card, which went into their hand. Keep hitting until they're at 0 Life, then land one more hit to win.",
    });
  }
  const ko = (id: PlayerId) =>
    was[id].characters.some(
      (c) =>
        !now[id].characters.some((n) => n.uid === c.uid) &&
        now[id].trash.some((t) => t.uid === c.uid),
    );
  if (ko(me) || ko(them)) {
    notes.push({
      id: "ko",
      title: "K.O.!",
      text: "A Character that loses a battle is K.O.'d and goes to the trash (rule 7-1-4-1-2). Only rested Characters can be attacked, so attacking leaves yours open.",
    });
  }
  if (
    after.turnPlayer === me &&
    after.phase === "main" &&
    before.phase !== "main" &&
    now[me].turnsTaken === 2
  ) {
    notes.push({
      id: "refresh",
      title: "A new turn",
      text: "Your rested cards stood up again, you drew a card and got 2 more DON!!. Every turn starts like this.",
    });
  }
  if (before.battle && after.battle?.target !== before.battle.target && after.battle) {
    notes.push({
      id: "blocker",
      title: "Blocked!",
      text: "A [Blocker] stepped in front of the attack, so it hits the Blocker instead.",
    });
  }
  return notes;
}
