import {
  definitionOf,
  hasKeyword,
  legalActions,
  opponentOf,
  type Color,
  type GameState,
  type PlayerId,
} from "@strawhat/engine";
import {
  attackOptions,
  bestPlays,
  cardName,
  donNeeded,
  power,
  powerShort,
  suggestDefense,
} from "./coach.js";

/**
 * Pro Drills live coaching: what to look out for before each of your turns, from the Leader
 * matchup and the board, and a word of advice when you're attacked. Only public information is
 * used: the opponent's hand is just a number of cards.
 */
export interface Tip {
  /** "matchup" tips come once a game; "danger" ones are urgent. */
  kind: "matchup" | "plan" | "watch" | "danger";
  text: string;
}

/** How each colour tends to play, and the habit that beats it. */
const COLOR_TIPS: Record<Color, string> = {
  red: "Red decks hit hard with power boosts and [Rush]. Keep your counter cards for when you're at 2 Life or less, and K.O. their big attackers when you can.",
  green:
    "Green decks rest your cards and ramp up DON!!. Rested Characters can be attacked, so expect your rested Characters to be K.O.'d, and watch for [Blocker]s.",
  blue: "Blue decks return your Characters to your hand and draw lots of cards. Don't pour all your DON!! into one big Character that can be bounced; spread your threats.",
  purple:
    "Purple decks ramp DON!! fast for big plays, often paying with their own DON!! or Life. Pressure them early, before their big turns arrive.",
  black:
    "Black decks K.O. Characters by cost and lower your costs. Cheap Characters die easily to them, so value your high-cost ones and don't overextend.",
  yellow:
    "Yellow decks live on Life and [Trigger]s: each Life card you take might flip a free effect, and they can gain Life back. Count your attacks carefully for the final push.",
};

/** One-off tips about the matchup, shown before your first turn. */
export function matchupTips(state: GameState, me: PlayerId): Tip[] {
  const them = opponentOf(me);
  const mine = definitionOf(state, state.players[me].leader);
  const theirs = definitionOf(state, state.players[them].leader);
  const tips: Tip[] = theirs.colors.map((c) => ({ kind: "matchup", text: COLOR_TIPS[c] }));
  const myPower = mine.power ?? 0;
  const theirPower = theirs.power ?? 0;
  const need = donNeeded(myPower, theirPower);
  tips.push({
    kind: "matchup",
    text:
      need > 0
        ? `Their Leader ${theirs.name} has ${theirPower} power, so your ${myPower} Leader needs ${need} DON!! to hit it. Plan your DON!! around that.`
        : `Your Leader (${myPower}) already matches their ${theirs.name} (${theirPower}), so it can attack without DON!!. Extra DON!! makes them spend more counters.`,
  });
  const theirLife = theirs.life ?? 5;
  const myLife = mine.life ?? 5;
  if (theirLife !== myLife) {
    tips.push({
      kind: "matchup",
      text:
        theirLife > myLife
          ? `They start with ${theirLife} Life to your ${myLife}. You need more hits, so build a wide board.`
          : `They start with only ${theirLife} Life to your ${myLife}. Steady pressure on their Leader wins this.`,
    });
  }
  const timings = new Set((theirs.effects ?? []).map((e) => e.timing));
  if (timings.has("endOfYourTurn")) {
    tips.push({
      kind: "matchup",
      text: `${theirs.name} does something at the end of their turn: read their Leader's text and plan for it.`,
    });
  }
  if (timings.has("whenAttacking")) {
    tips.push({
      kind: "matchup",
      text: `${theirs.name} gets an effect when it attacks. Expect it to hit harder than its printed power.`,
    });
  }
  return tips;
}

/** Tips for the turn about to be played: the plan, what to watch for, and any danger. */
export function turnTips(state: GameState, me: PlayerId): Tip[] {
  const them = opponentOf(me);
  const p = state.players[me];
  const o = state.players[them];
  const legal = legalActions(state, me);
  const attacks = attackOptions(legal);
  const tips: Tip[] = [];
  const theirLeader = o.leader.uid;
  const theirPower = power(state, theirLeader);

  // Life race.
  const myLife = p.life.length;
  const theirLife = o.life.length;
  if (theirLife === 0) {
    tips.push({
      kind: "danger",
      text: "They're at 0 Life: one hit on their Leader wins! Attack with everything, smallest first, to use up their counters and [Blocker]s.",
    });
  } else if (myLife <= 1) {
    tips.push({
      kind: "danger",
      text: `You're at ${myLife} Life. Keep counter cards and a [Blocker] ready; one more hit after this could end the game.`,
    });
  } else if (myLife > theirLife + 1) {
    tips.push({
      kind: "watch",
      text: `You lead on Life, ${myLife} to ${theirLife}. You can afford to take hits, so spend cards on the board, not on counters.`,
    });
  } else if (theirLife > myLife + 1) {
    tips.push({
      kind: "watch",
      text: `You're behind on Life, ${myLife} to ${theirLife}. Remove their attackers and keep enough counters to survive.`,
    });
  }

  // Spending DON!!.
  const plays = bestPlays(state, me, legal);
  const spent = plays.reduce((sum, x) => sum + x.cost, 0);
  if (plays.length > 0) {
    const left = p.donActive - spent;
    tips.push({
      kind: "plan",
      text: `You have ${p.donActive} DON!!. Playing ${listNames(plays.map((x) => `${x.def.name} (${x.cost})`))} uses ${spent}${left > 0 ? `, leaving ${left} to give your attackers` : ", every DON!! this turn"}.`,
    });
  } else if (p.donActive > 0 && attacks.size > 0) {
    tips.push({
      kind: "plan",
      text: `Nothing in your hand fits your ${p.donActive} DON!!, so give them all to your attackers: each one is +1000.`,
    });
  }

  // Attacks.
  if (attacks.has(p.leader.uid)) {
    const need = donNeeded(power(state, p.leader.uid), theirPower);
    if (need > 0) {
      tips.push({
        kind: "plan",
        text: `Your Leader needs ${need} DON!! to match their Leader's ${theirPower} power.`,
      });
    }
  }
  const blockers = o.characters.filter(
    (c) => !c.rested && hasKeyword(definitionOf(state, c), "blocker"),
  );
  if (blockers.length > 0 && attacks.size > 1) {
    tips.push({
      kind: "watch",
      text: `They have ${listNames(blockers.map((c) => cardName(state, c.uid)))} active as [Blocker]. Attack with a smaller card first to draw the block, then swing big.`,
    });
  }
  const rested = o.characters.filter((c) => c.rested);
  for (const target of rested) {
    const killers = [...attacks]
      .filter(([, targets]) => targets.includes(target.uid))
      .map(([uid]) => uid)
      .filter((uid) => uid !== p.leader.uid && power(state, uid) >= power(state, target.uid));
    const cost = definitionOf(state, target).cost ?? 0;
    if (killers.length > 0 && cost >= 3) {
      tips.push({
        kind: "plan",
        text: `Their ${cardName(state, target.uid)} (cost ${cost}, ${power(state, target.uid)} power) is rested. Your ${cardName(state, killers[0]!)} can attack it and K.O. it.`,
      });
    }
  }
  const attackers = attacks.size;
  if (theirLife > 0 && attackers >= theirLife + 1) {
    tips.push({
      kind: "watch",
      text: `You have ${attackers} attackers and they have ${theirLife} Life: if they run low on counters, this could be the turn you win. Count it out before you attack.`,
    });
  }

  // Their next turn.
  const theirDonNext = Math.min(10, o.donActive + o.donRested + countGiven(state, them) + 2);
  const biggest = [...o.characters].sort((a, b) => power(state, b.uid) - power(state, a.uid))[0];
  tips.push({
    kind: "watch",
    text: `Next turn they'll have up to ${theirDonNext} DON!! and ${o.hand.length} cards in hand.${
      biggest && power(state, biggest.uid) > power(state, p.leader.uid)
        ? ` Their ${cardName(state, biggest.uid)} (${power(state, biggest.uid)}) already out-powers your Leader: deal with it or keep counters.`
        : ""
    }`,
  });

  // Your own defense for their turn.
  const counterPower = p.hand.reduce((sum, c) => sum + (definitionOf(state, c).counter ?? 0), 0);
  tips.push({
    kind: "watch",
    text: `Your hand holds +${counterPower} counter power. Any card you play now can't be used as a counter on their turn.`,
  });
  return tips;
}

/** A word of advice while you're attacked, from the same brain the tutor uses. */
export function defenseTip(state: GameState, me: PlayerId): Tip | null {
  const advice = suggestDefense(state, me);
  const battle = state.battle;
  if (!advice || !battle) return null;
  const need = powerShort(power(state, battle.attacker), power(state, battle.target));
  return {
    kind: need > 0 && state.players[me].life.length <= 1 ? "danger" : "plan",
    text: `${advice.say}. ${advice.why}`,
  };
}

function countGiven(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  return [p.leader, ...p.characters].reduce((sum, c) => sum + c.givenDon, 0);
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
