import {
  applyAction,
  definitionOf,
  hasKeyword,
  keywordsOf,
  legalActions,
  opponentOf,
  type Action,
  type GameState,
  type PlayerId,
} from "@strawhat/engine";
import {
  attackOptions,
  bestPlays,
  cardName,
  counterEventReserve,
  counterValue,
  donNeeded,
  hasTiming,
  power,
  powerShort,
  usesGivenDon,
} from "./coach.js";

/**
 * The Pro Drills report: every mistake you made in a game, which turn it was, and why it was a
 * mistake. It replays the game move by move and checks each of your decisions against the
 * habits strong players follow. Only clear-cut, explainable errors are reported; a "minor" one
 * is a habit worth fixing, a "major" one cost real cards, damage or the game.
 */
export interface Mistake {
  /** The game's turn number (both players' turns count). */
  turn: number;
  /** Which of your own turns it was, or of the opponent's when you were defending. */
  round: string;
  severity: "major" | "minor";
  title: string;
  why: string;
  /** What a strong player would have done instead. */
  better: string;
}

export interface Review {
  mistakes: Mistake[];
  /** Your turns played, and how many of them had no mistakes. */
  turns: number;
  cleanTurns: number;
}

interface TurnNotes {
  attacked: Set<string>;
}

interface DefenseNotes {
  /** Which of the opponent's attacks this is. */
  key: number;
  target: string;
  attacker: string;
  /** Character cards trashed as counters this battle, with their values. */
  counters: { uid: string; value: number }[];
  events: number;
  /** Blockers you could have used and didn't. */
  skippedBlock: string[];
  blockedWith?: string;
  lifeBefore: number;
}

/** Every state of a game, from its start, by replaying its actions. */
export function replay(initial: GameState, actions: Action[]): GameState[] {
  const states = [initial];
  for (const action of actions) {
    try {
      states.push(applyAction(states.at(-1)!, action));
    } catch {
      break;
    }
  }
  return states;
}

/**
 * Reviews a game. `states` holds the game before each of `actions` and, last, after them all;
 * Pro Drills keeps them as the game goes, since replaying a long game takes seconds.
 */
export function reviewGame(states: GameState[], actions: Action[], me: PlayerId): Review {
  const mistakes: Mistake[] = [];
  const them = opponentOf(me);
  let turnNotes: TurnNotes = { attacked: new Set() };
  let turnOf = 0;
  let defense: DefenseNotes | null = null;
  let pendingAttack: { attacker: string; target: string } | null = null;
  let attacksAgainstYou = 0;
  const myTurns = new Set<number>();

  const round = (s: GameState) => {
    const mine = s.turnPlayer === me;
    const n = mine ? s.players[me].turnsTaken : s.players[them].turnsTaken;
    return mine ? `Your turn ${n}` : `Opponent's turn ${n} (defending)`;
  };
  const add = (s: GameState, m: Omit<Mistake, "turn" | "round">) =>
    mistakes.push({ turn: s.turn, round: round(s), ...m });

  for (const [i, action] of actions.entries()) {
    const before = states[i];
    const after = states[i + 1];
    if (!before || !after) break;

    if (before.turn !== turnOf) {
      turnOf = before.turn;
      turnNotes = { attacked: new Set() };
    }
    if (before.turnPlayer === me && before.turn > 0) myTurns.add(before.turn);

    // Your attack reaches the opponent's Block or Counter Step: check it could ever land.
    if (pendingAttack && before.battle && before.prompt.kind !== "gameOver") {
      if (before.prompt.player === them) {
        const { attacker, target } = pendingAttack;
        pendingAttack = null;
        const atk = power(before, attacker);
        const def = power(before, target);
        if (atk < def && !hasTiming(before, attacker, "whenAttacking")) {
          add(before, {
            severity: "minor",
            title: `${cardName(before, attacker)} attacked into a stronger card`,
            why: `${cardName(before, attacker)} had ${atk} power against ${def}. The attacker needs at least equal power, so this attack couldn't land, and it rested your card for nothing.`,
            better: `Give it ${donNeeded(atk, def)} DON!! first (+1000 each), or attack something it can beat.`,
          });
        }
      }
    }

    if (action.player === me) {
      const prompt = before.prompt;
      switch (action.type) {
        case "keepHand": {
          const hand = before.players[me].hand.map((c) => definitionOf(before, c));
          const early = hand.some((d) => d.category === "character" && (d.cost ?? 0) <= 3);
          if (!early) {
            add(before, {
              severity: "minor",
              title: "Kept a hand with no early plays",
              why: "None of your 5 cards was a Character costing 3 or less, so your first turns would pass with nothing on the field.",
              better:
                "Redraw a hand like this. You can redraw once, and early Characters set up your attacks.",
            });
          }
          break;
        }
        case "attack":
          turnNotes.attacked.add(action.attacker);
          pendingAttack = { attacker: action.attacker, target: action.target };
          break;
        case "endTurn":
          if (prompt.kind === "main") endOfTurn(before, turnNotes);
          break;
        case "block":
          notes(before).blockedWith = action.blocker;
          break;
        case "counter":
          notes(before).counters.push({
            uid: action.card,
            value: counterValue(before, action.card),
          });
          break;
        case "counterEvent":
          notes(before).events++;
          break;
        case "pass":
          if (prompt.kind === "block" && before.battle) {
            notes(before).skippedBlock = legalActions(before, me).flatMap((a) =>
              a.type === "block" ? [a.blocker] : [],
            );
          }
          if (prompt.kind === "counter" && before.battle)
            endOfDefense(before, after, notes(before));
          break;
      }
    }

    if (action.player === them && action.type === "attack") attacksAgainstYou++;
  }

  const bad = new Set(mistakes.filter((m) => myTurns.has(m.turn)).map((m) => m.turn));
  return {
    mistakes,
    turns: myTurns.size,
    cleanTurns: [...myTurns].filter((t) => !bad.has(t)).length,
  };

  /** Notes on the attack you're defending against right now. */
  function notes(s: GameState): DefenseNotes {
    if (defense?.key !== attacksAgainstYou) defense = newDefense(s);
    return defense;
  }

  function newDefense(s: GameState): DefenseNotes {
    return {
      key: attacksAgainstYou,
      target: s.battle!.target,
      attacker: s.battle!.attacker,
      counters: [],
      events: 0,
      skippedBlock: [],
      lifeBefore: s.players[me].life.length,
    };
  }

  /** Checks at the moment you end your turn. */
  function endOfTurn(s: GameState, notes: TurnNotes) {
    const legal = legalActions(s, me);
    const p = s.players[me];
    const theirLeader = s.players[them].leader.uid;
    const theirPower = power(s, theirLeader);
    const attacks = attackOptions(legal);
    const leftDon = p.donActive;
    const reserve = counterEventReserve(s, me);
    const spare = leftDon - reserve;

    // A hit on a Leader at 0 Life wins (rule 7-1-4-1-1-1).
    if (s.players[them].life.length === 0) {
      const finisher = [...attacks].find(
        ([uid, targets]) =>
          targets.includes(theirLeader) && power(s, uid) + spare * 1000 >= theirPower,
      );
      if (finisher) {
        add(s, {
          severity: "major",
          title: "Missed a winning attack",
          why: `Your opponent had 0 Life, so one more hit on their Leader would have won the game. ${cardName(s, finisher[0])} could still attack.`,
          better:
            "At 0 Life, attack their Leader with everything you have. Make them use every counter and [Blocker].",
        });
        return;
      }
    }

    // Cards that could still attack their Leader and win the battle.
    const idle = [...attacks].filter(
      ([uid, targets]) =>
        targets.includes(theirLeader) &&
        power(s, uid) + Math.max(0, spare) * 1000 >= theirPower &&
        (uid === p.leader.uid || !hasKeyword(definitionOf(s, findOwn(s, uid)!), "blocker")),
    );
    const leaderIdle = idle.some(([uid]) => uid === p.leader.uid);
    if (leaderIdle) {
      add(s, {
        severity: "major",
        title: "Your Leader didn't attack",
        why: `Your Leader can't block, so leaving it standing does nothing on their turn. It could have attacked their Leader (${power(s, p.leader.uid)} vs ${theirPower}${donNeeded(power(s, p.leader.uid), theirPower) ? ` with ${donNeeded(power(s, p.leader.uid), theirPower)} DON!!` : ""}), forcing them to counter or take damage.`,
        better: "Attack with your Leader every turn you can.",
      });
    }
    const idleCharacters = idle.filter(([uid]) => uid !== p.leader.uid).map(([uid]) => uid);
    if (idleCharacters.length > 0) {
      add(s, {
        severity: "minor",
        title: `${listNames(idleCharacters.map((uid) => cardName(s, uid)))} didn't attack`,
        why: `${idleCharacters.length === 1 ? "It" : "They"} could have attacked their Leader and won the battle. Characters without [Blocker] don't protect you by staying active, they only lose damage you could have dealt.`,
        better:
          "Attack with every Character that can win its battle, unless you're keeping a [Blocker] back.",
      });
    }

    // DON!! left over is lost: every DON!! comes back rested... and set active next turn anyway.
    if (spare > 0) {
      const plays = bestPlays(s, me, legal);
      const couldUse = plays.length > 0 || notes.attacked.size > 0 || attacks.size > 0;
      if (couldUse) {
        add(s, {
          severity: spare >= 2 ? "major" : "minor",
          title: `Ended the turn with ${spare} DON!! unused`,
          why: `All your DON!! become active again next turn, so DON!! you don't use this turn is simply wasted.${reserve > 0 ? ` (Keeping ${reserve} for your [Counter] Event was fine.)` : ""}`,
          better:
            plays.length > 0
              ? `Play ${listNames(plays.map((x) => x.def.name))} with them.`
              : "Give them to your Leader or a Character before it attacks: each one is +1000 power.",
        });
      }
    }

    // DON!! on a card that never attacked only counts during your turn (rule 6-5-5-2).
    const wasted = [p.leader, ...p.characters].filter(
      (c) => c.givenDon > 0 && !notes.attacked.has(c.uid) && !usesGivenDon(s, c.uid),
    );
    for (const card of wasted) {
      add(s, {
        severity: "minor",
        title: `Gave DON!! to ${cardName(s, card.uid)}, which didn't attack`,
        why: `The +1000 per DON!! only counts during your turn, so ${card.givenDon} DON!! on a card that doesn't attack does nothing.`,
        better: "Give DON!! to the cards that are about to attack.",
      });
    }
  }

  /** Checks when you finish defending against one attack. */
  function endOfDefense(s: GameState, after: GameState, d: DefenseNotes) {
    const battle = s.battle!;
    const atk = power(s, battle.attacker);
    const def = power(s, battle.target);
    const hit = atk >= def;
    const p = s.players[me];
    const leader = battle.target === p.leader.uid;
    const used = d.counters.length + d.events;
    const legal = legalActions(s, me);
    const leftCounters = legal.flatMap((a) =>
      a.type === "counter" && a.target === battle.target ? [counterValue(s, a.card)] : [],
    );
    const need = powerShort(atk, def);

    if (hit && used > 0) {
      add(s, {
        severity: "major",
        title: `Used ${used} counter card${used > 1 ? "s" : ""} and still took the hit`,
        why: `${cardName(s, battle.attacker)} still had ${atk} power against your ${def}. Counters that don't stop the attack are cards thrown away.`,
        better:
          leftCounters.reduce((a, b) => a + b, 0) >= need
            ? `Add +${need} more to stop it, or don't counter at all.`
            : "Only counter when you can reach enough power; otherwise keep the cards.",
      });
    }

    if (hit && leader && d.lifeBefore === 0 && after.winner !== null) {
      const total = leftCounters.reduce((a, b) => a + b, 0);
      if (total >= need || d.skippedBlock.length > 0) {
        add(s, {
          severity: "major",
          title: "Lost to an attack you could have stopped",
          why: `You were at 0 Life, so this hit ended the game, and you ${
            d.skippedBlock.length > 0
              ? `had ${cardName(s, d.skippedBlock[0]!)} ready to block`
              : `still had +${total} counter power in hand (+${need} was needed)`
          }.`,
          better: "At 0 Life, stop every attack you can: block, then counter.",
        });
      }
    }

    if (!hit && d.counters.length > 0) {
      const margin = def - atk;
      const spare = d.counters.filter((c) => c.value > 0 && c.value < margin);
      if (spare.length > 0) {
        add(s, {
          severity: "minor",
          title: "Countered more than needed",
          why: `Your card ended on ${def} power against ${atk}. You'd have survived without ${cardName(s, spare[0]!.uid)} (+${spare[0]!.value}), so that card was wasted.`,
          better:
            "Add just enough power to get above the attacker, using the smallest counters that do it.",
        });
      }
      const double = keywordsOf(s, findAny(s, battle.attacker)!).includes("doubleAttack");
      if (leader && d.lifeBefore >= 4 && d.counters.length >= 2 && !double) {
        add(s, {
          severity: "minor",
          title: `Spent ${d.counters.length} cards to save 1 Life at ${d.lifeBefore} Life`,
          why: "When you take damage the Life card goes to your hand, so a hit at high Life costs you no cards. Spending 2 cards to stop it leaves you 2 cards down.",
          better:
            "At 4 or more Life, usually take the hit and save counters for when you're at 2 Life or less.",
        });
      }
    }

    // A [Blocker] worth more than the Life it saved.
    if (d.blockedWith && leader && d.lifeBefore >= 3) {
      const blocker = findOwn(s, d.blockedWith);
      const cost = blocker ? (definitionOf(s, blocker).cost ?? 0) : 0;
      const survived = after.players[me].characters.some((c) => c.uid === d.blockedWith);
      if (!survived && cost >= 4) {
        add(s, {
          severity: "minor",
          title: `Blocked with ${cardName(s, d.blockedWith)} at ${d.lifeBefore} Life`,
          why: `You lost a cost ${cost} Character to save 1 Life, and a lost Life card would have gone to your hand anyway.`,
          better: "At 3 or more Life, block with cheap [Blocker]s only, or take the hit.",
        });
      }
    }
  }

  function findOwn(s: GameState, uid: string) {
    const p = s.players[me];
    return [p.leader, ...p.characters].find((c) => c.uid === uid) ?? null;
  }
  function findAny(s: GameState, uid: string) {
    for (const id of [me, them]) {
      const p = s.players[id];
      const card = [p.leader, ...p.characters].find((c) => c.uid === uid);
      if (card) return card;
    }
    return null;
  }
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
