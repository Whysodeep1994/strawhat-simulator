import {
  applyAction,
  definitionOf,
  findCard,
  hasKeyword,
  legalActions,
  opponentOf,
  playCostOf,
  powerOf,
  type Action,
  type CardDefinition,
  type CardInstance,
  type GameState,
  type PlayerId,
} from "@strawhat/engine";

/**
 * The coach's shared know-how for Player Development: what a good next move is, and the
 * numbers behind it. The tutor (tutor.ts), the live tips (coach-tips.ts) and the end-of-game
 * report (coach-review.ts) all reason with these, so they never disagree with each other.
 *
 * Everything here only looks at what the player can see: their own hand, both fields, and
 * how many cards the opponent holds. It never peeks at the opponent's hand, deck or Life.
 */

/** A suggested move with the reason for it, in plain words. */
export interface Suggestion {
  action: Action;
  /** What to do, e.g. "Play Nami (cost 1)". */
  say: string;
  /** Why it's a good idea. */
  why: string;
}

export function cardName(state: GameState, uid: string): string {
  const card = findCard(state, uid);
  return card ? definitionOf(state, card).name : "a card";
}

export function power(state: GameState, uid: string): number {
  const card = findCard(state, uid);
  return card ? powerOf(state, card) : 0;
}

function def(state: GameState, uid: string): CardDefinition | null {
  const card = findCard(state, uid);
  return card ? definitionOf(state, card) : null;
}

/** How many DON!! an attacker needs to win against `target` power. Equal power wins (rule 7-1-4-1). */
export function donNeeded(attack: number, target: number): number {
  return Math.max(0, Math.ceil((target - attack) / 1000));
}

/**
 * The power a defender still needs to survive, in whole thousands. 0 means the attack fails
 * already: the attacker wins on equal power, so the defender must end up higher.
 */
export function powerShort(attack: number, defense: number): number {
  return attack < defense ? 0 : Math.ceil((attack - defense + 1) / 1000) * 1000;
}

/** A card's own counter value, as printed. */
export function counterValue(state: GameState, uid: string): number {
  return def(state, uid)?.counter ?? 0;
}

/** Whether a card has an effect with this timing, like [When Attacking]. */
export function hasTiming(state: GameState, uid: string, timing: string): boolean {
  return (def(state, uid)?.effects ?? []).some((e) => e.timing === timing);
}

/** Whether a card has a [DON!! xX] effect, so DON!! on it does more than add power. */
export function usesGivenDon(state: GameState, uid: string): boolean {
  return (def(state, uid)?.effects ?? []).some((e) =>
    (e.conditions ?? []).some((c) => "donAtLeast" in c),
  );
}

/** [Counter] Events in hand and the most DON!! one of them costs, to keep that much spare. */
export function counterEventReserve(state: GameState, player: PlayerId): number {
  const p = state.players[player];
  let reserve = 0;
  for (const card of p.hand) {
    const d = definitionOf(state, card);
    if (d.category !== "event" || !(d.effects ?? []).some((e) => e.timing === "counter")) continue;
    reserve = Math.max(reserve, playCostOf(state, player, card));
  }
  return Math.min(reserve, p.donActive);
}

/** The cards in hand that can be played right now without trashing a Character. */
function playable(state: GameState, player: PlayerId, legal: Action[]) {
  return legal.flatMap((a) => {
    if (a.type !== "playCard" || a.trash !== undefined) return [];
    const card = findCard(state, a.card);
    if (!card) return [];
    const d = definitionOf(state, card);
    return [{ action: a, card, def: d, cost: playCostOf(state, player, card) }];
  });
}

/**
 * The best way to spend this turn's DON!! on cards: the set of playable cards that uses the
 * most DON!!, preferring Characters (they stay and attack) and fewer, bigger cards on ties.
 * It keeps within the 5-Character limit (rule 3-7-6).
 */
export function bestPlays(
  state: GameState,
  player: PlayerId,
  legal: Action[] = legalActions(state, player),
): { card: CardInstance; def: CardDefinition; cost: number; action: Action }[] {
  const options = playable(state, player, legal).slice(0, 12);
  const budget = state.players[player].donActive;
  const room = 5 - state.players[player].characters.length;
  let best: typeof options = [];
  let bestScore = -1;
  for (let mask = 1; mask < 1 << options.length; mask++) {
    const pick = options.filter((_, i) => mask & (1 << i));
    const cost = pick.reduce((sum, p) => sum + p.cost, 0);
    if (cost > budget) continue;
    const characters = pick.filter((p) => p.def.category === "character").length;
    if (characters > room) continue;
    // A Stage only counts once; playing a second one trashes the first.
    if (pick.filter((p) => p.def.category === "stage").length > 1) continue;
    const score = cost * 100 + characters * 10 - pick.length;
    if (score > bestScore) {
      bestScore = score;
      best = pick;
    }
  }
  return best.sort((a, b) => b.cost - a.cost);
}

/** Every card that can still attack, and what it can attack. */
export function attackOptions(legal: Action[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const a of legal) {
    if (a.type === "attack") map.set(a.attacker, [...(map.get(a.attacker) ?? []), a.target]);
  }
  return map;
}

/** Whether trying an action changes the game; an effect that does nothing isn't worth a click. */
function changesSomething(state: GameState, action: Action): boolean {
  const snapshot = (s: GameState) => JSON.stringify({ ...s, catalog: null, revealed: null });
  try {
    return snapshot(applyAction(state, action)) !== snapshot(state);
  } catch {
    return false;
  }
}

/**
 * Effects that cost Life, cards, DON!! for good, or rest the card: the coach doesn't push you into
 * those without a reason it can explain.
 */
function costsResources(state: GameState, uid: string, effect: number): boolean {
  const e = def(state, uid)?.effects?.[effect];
  return (e?.costs ?? []).some((c) => {
    const kind = typeof c === "object" && c !== null ? Object.keys(c)[0] : String(c);
    return /life|trash|hand|return|donMinus|restThis|restOwn|oneOf/i.test(kind ?? "");
  });
}

/** Whether an effect gives DON!! to cards, which only helps a card that's about to attack. */
function givesDon(state: GameState, uid: string, effect: number): boolean {
  const steps = def(state, uid)?.effects?.[effect]?.steps ?? [];
  return JSON.stringify(steps).includes("Don");
}

/**
 * Whether one of your cards can still attack this turn: it's active, it's not your first turn
 * (rule 6-5-6-1), and a Character wasn't played this turn unless it has [Rush] (rule 3-7-4).
 */
export function canStillAttack(state: GameState, me: PlayerId, uid: string): boolean {
  const p = state.players[me];
  if (state.turnPlayer !== me || p.turnsTaken <= 1) return false;
  const card = [p.leader, ...p.characters].find((c) => c.uid === uid);
  if (!card || card.rested) return false;
  if (card.uid === p.leader.uid) return true;
  const d = definitionOf(state, card);
  return card.playedTurn !== state.turn || hasKeyword(d, "rush");
}

/**
 * The move the coach would make in your Main Phase, worked out in the order a strong player
 * thinks: develop the board with every DON!! you can, use free effects, then give DON!! so each
 * attack lands, then attack (the Leader when it's at 0 Life, a rested Character worth K.O.ing,
 * otherwise the Leader), and only then end the turn.
 */
export function suggestMain(state: GameState, me: PlayerId): Suggestion | null {
  const legal = legalActions(state, me).filter((a) => a.type !== "concede");
  const endTurn = legal.find((a) => a.type === "endTurn");
  if (!endTurn) return null;
  const p = state.players[me];
  const them = state.players[opponentOf(me)];
  const theirLeader = them.leader.uid;
  const theirLeaderPower = power(state, theirLeader);
  const attacks = attackOptions(legal);

  // 1. Put cards on the field.
  const plan = bestPlays(state, me, legal);
  const first = plan[0];
  if (first) {
    const kind =
      first.def.category === "character"
        ? hasKeyword(first.def, "rush")
          ? "It has [Rush], so it can attack this very turn."
          : "Characters can attack from your next turn and defend you meanwhile."
        : first.def.category === "event"
          ? "Events take effect right away, then go to the trash."
          : "A Stage stays on the field and helps every turn.";
    const rest =
      plan.length > 1
        ? ` With the rest of your DON!! you can also play ${plan
            .slice(1)
            .map((x) => x.def.name)
            .join(" and ")}.`
        : "";
    return {
      action: first.action,
      say: `Play ${first.def.name} (cost ${first.cost})`,
      why: `Playing a card rests that many DON!!. ${kind}${rest}`,
    };
  }

  // 2. Free effects that do something. Ones that hand out DON!! wait until something can attack.
  for (const a of legal) {
    if (a.type !== "activate") continue;
    if (costsResources(state, a.card, a.effect) || !changesSomething(state, a)) continue;
    if (givesDon(state, a.card, a.effect) && attacks.size === 0) continue;
    return {
      action: a,
      say: `Use the effect of ${cardName(state, a.card)}`,
      why: "Its [Activate: Main] effect is free value this turn, so use it before attacking.",
    };
  }

  // 3. DON!!: first so each attacker beats their Leader, then the rest on the Leader.
  const spare = p.donActive - counterEventReserve(state, me);
  const give = (target: string, why: string): Suggestion | null => {
    const action = legal.find((a) => a.type === "giveDon" && a.target === target);
    return action ? { action, say: `Give 1 DON!! to ${cardName(state, target)}`, why } : null;
  };
  if (spare > 0) {
    const attackers = [...attacks.keys()].sort((a, b) =>
      a === p.leader.uid ? -1 : b === p.leader.uid ? 1 : power(state, b) - power(state, a),
    );
    for (const uid of attackers) {
      if (!attacks.get(uid)!.includes(theirLeader)) continue;
      const need = donNeeded(power(state, uid), theirLeaderPower);
      if (need > 0 && need <= spare) {
        const s = give(
          uid,
          `${cardName(state, uid)} has ${power(state, uid)} power and their Leader has ${theirLeaderPower}. Each DON!! adds +1000 during your turn, and the attacker wins on equal power.`,
        );
        if (s) return s;
      }
    }
    if (attacks.has(p.leader.uid)) {
      const s = give(
        p.leader.uid,
        "Spare DON!! would go unused this turn. On your Leader, every +1000 makes the opponent spend more counter cards to stop the attack.",
      );
      if (s) return s;
    }
  }

  // 4. Attack.
  const attack = (attacker: string, target: string, why: string): Suggestion => ({
    action: { type: "attack", player: me, attacker, target },
    say: `Attack ${target === theirLeader ? "their Leader" : `their ${cardName(state, target)}`} with ${cardName(state, attacker)}`,
    why,
  });
  const winners = [...attacks].flatMap(([attacker, targets]) =>
    targets
      .filter((t) => power(state, attacker) >= power(state, t))
      .map((target) => ({ attacker, target })),
  );
  if (them.life.length === 0) {
    const lethal = winners.find((w) => w.target === theirLeader);
    if (lethal) {
      return attack(
        lethal.attacker,
        lethal.target,
        "They have 0 Life: one more hit on their Leader wins the game!",
      );
    }
  }
  // A rested Character worth K.O.ing: a Character attacker trades its attack for a whole card.
  const ko = winners
    .filter((w) => w.target !== theirLeader && w.attacker !== p.leader.uid)
    .map((w) => ({ ...w, cost: def(state, w.target)?.cost ?? 0 }))
    .filter((w) => w.cost >= 3)
    .sort((a, b) => b.cost - a.cost)[0];
  if (ko) {
    return attack(
      ko.attacker,
      ko.target,
      `Their ${cardName(state, ko.target)} is rested and has ${power(state, ko.target)} power. K.O.ing a cost ${ko.cost} Character removes a threat they paid a lot for.`,
    );
  }
  const onLeader = winners
    .filter((w) => w.target === theirLeader)
    .sort((a, b) => power(state, b.attacker) - power(state, a.attacker));
  // Smaller attacks first draw out [Blocker]s and counters before your biggest swing.
  const blockers = them.characters.filter(
    (c) => !c.rested && hasKeyword(definitionOf(state, c), "blocker"),
  ).length;
  const pick = blockers > 0 ? onLeader.at(-1) : onLeader[0];
  if (pick) {
    return attack(
      pick.attacker,
      pick.target,
      blockers > 0
        ? `They have an active [Blocker], so attack with your weaker card first to draw the block out. ${cardName(state, pick.attacker)} has ${power(state, pick.attacker)} power against their Leader's ${theirLeaderPower}.`
        : `${cardName(state, pick.attacker)} has ${power(state, pick.attacker)} power against their Leader's ${theirLeaderPower}, so the attack lands unless they counter. Every hit takes 1 Life.`,
    );
  }

  return {
    action: endTurn,
    say: "End your turn",
    why:
      attacks.size > 0
        ? "Your remaining attackers can't beat anything they could attack, so there's nothing more worth doing."
        : "You've played what you can afford and made your attacks.",
  };
}

/** What to do when you're attacked: the defending side of the coach. */
export function suggestDefense(state: GameState, me: PlayerId): Suggestion | null {
  const prompt = state.prompt;
  const battle = state.battle;
  if (!battle || (prompt.kind !== "block" && prompt.kind !== "counter") || prompt.player !== me) {
    return null;
  }
  const legal = legalActions(state, me);
  const pass = legal.find((a) => a.type === "pass");
  if (!pass) return null;
  const p = state.players[me];
  const leader = battle.target === p.leader.uid;
  const attack = power(state, battle.attacker);
  const need = powerShort(attack, power(state, battle.target));
  const double = hasKeyword(def(state, battle.attacker) ?? ({} as CardDefinition), "doubleAttack");
  const targetDef = def(state, battle.target);
  const lethal = leader && (p.life.length === 0 || (double && p.life.length <= 1));
  const worthSaving = leader ? lethal || p.life.length <= 2 : (targetDef?.cost ?? 0) >= 5;

  if (need === 0) {
    return {
      action: pass,
      say: prompt.kind === "block" ? "Don't block" : "Don't counter",
      why: "Your card already has more power than the attacker, so the attack fails on its own.",
    };
  }

  if (prompt.kind === "block") {
    const blocks = legal.filter((a) => a.type === "block");
    if (worthSaving && leader && blocks.length > 0) {
      const cheapest = blocks
        .map((a) => (a.type === "block" ? a.blocker : ""))
        .sort((a, b) => (def(state, a)?.cost ?? 0) - (def(state, b)?.cost ?? 0))[0]!;
      return {
        action: { type: "block", player: me, blocker: cheapest },
        say: `Block with ${cardName(state, cheapest)}`,
        why: lethal
          ? "This hit would end the game. A [Blocker] takes the attack in your Leader's place."
          : `You're down to ${p.life.length} Life, so protect it. Your cheapest [Blocker] takes the hit instead.`,
      };
    }
    return {
      action: pass,
      say: "Don't block",
      why: leader
        ? `At ${p.life.length} Life you can afford this hit: the Life card goes to your hand, so you even get a card. Keep your [Blocker] for when it matters.`
        : "This Character isn't worth losing a [Blocker] over.",
    };
  }

  // Counter Step.
  const counters = legal.flatMap((a) =>
    a.type === "counter" && a.target === battle.target
      ? [{ action: a, value: counterValue(state, a.card) }]
      : [],
  );
  const available = counters.reduce((sum, c) => sum + c.value, 0);
  if (worthSaving && available >= need) {
    const enough = counters.filter((c) => c.value >= need).sort((a, b) => a.value - b.value)[0];
    const biggest = [...counters].sort((a, b) => b.value - a.value)[0]!;
    const pick = enough ?? biggest;
    return {
      action: pick.action,
      say: `Counter with ${cardName(state, pick.action.type === "counter" ? pick.action.card : "")} (+${pick.value})`,
      why: `You need +${need} power. ${
        lethal
          ? "This hit would lose you the game, so stop it."
          : leader
            ? `You're at ${p.life.length} Life, so it's time to defend.`
            : `Your ${targetDef?.name} costs ${targetDef?.cost}: saving it is worth a card.`
      } Use the smallest counter that does the job.`,
    };
  }
  return {
    action: pass,
    say: "Take the hit",
    why: lethal
      ? "You don't have enough counter power to stop this one."
      : leader
        ? `At ${p.life.length} Life, taking a hit is fine: the Life card goes to your hand, so you lose nothing in cards. Save your counters for when you're at 2 Life or less.`
        : `Your ${targetDef?.name ?? "Character"} is cheap to replace, so keep your counter cards.`,
  };
}
