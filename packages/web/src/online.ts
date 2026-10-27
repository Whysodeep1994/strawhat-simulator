import {
  opponentOf,
  type Action,
  type CardCatalog,
  type DeckList,
  type PlayerId,
} from "@strawhat/engine";
import type { Clock } from "./clock.js";
import { friendAct, humanAct, newOnlineGame, timeOut, type LocalGame } from "./local-game.js";
import { findRelay } from "./relay.js";

/**
 * Playing a friend online, through the live room claude.ai gives the published app.
 *
 * There is no game server. Both computers build the game from the same two decks and the
 * same seed, so their shuffles match, and then only the moves travel. Each player keeps a
 * small "presence" note in a named room (one room per game code) that says:
 *  - who they are (host or guest), their deck, and for the host the seed;
 *  - how many moves they have applied;
 *  - the moves the other player hasn't applied yet.
 * The room re-sends a presence note to anyone who joins or reconnects, so a dropped message
 * or a reloaded page catches up on its own. Notes are capped at 4 KB, so a player who has
 * fallen far behind gets the moves in chunks.
 *
 * The host is p1 and the guest p2; who goes first is left to the seed. A concession is a flag
 * on the note rather than a move, because it can happen while the other player is acting.
 * Running out of time is a flag too, and either page may raise it.
 *
 * Each page keeps both game clocks, but a player's own page is the one that counts: its note
 * says how much time that player has used, and the other page takes that figure over its own,
 * which would otherwise grow by however long each move took to arrive.
 */

/** The part of claude.ai's named room this file uses (see the `room` capability). */
export interface RoomLike {
  presence(patch: Record<string, unknown>): Promise<void>;
  peers(): readonly PeerLike[];
  onPeers(handler: (change: { peers: readonly PeerLike[] }) => void): () => void;
  connected(): boolean;
  leave(): Promise<void>;
}

export interface PeerLike {
  peer: string;
  isMe: boolean;
  presence: Readonly<Record<string, unknown>>;
}

export type Role = "host" | "guest";

/** A deck as it travels: the Leader and how many of each card. */
export interface SharedDeck {
  l: string;
  c: Record<string, number>;
}

/** What each player shows the room. `v` lets a later version tell old notes apart. */
interface Note {
  v: 1;
  role: Role;
  /** Random per game, so a reloaded page is still recognised as the same player. */
  token: string;
  deck: SharedDeck;
  /** The host's seed, which every shuffle comes from. */
  seed?: number;
  /** The token of the player this one is playing. */
  partner?: string;
  applied: number;
  /** Moves `from`, `from + 1`, … of the game, for a partner who is behind. */
  from: number;
  moves: Action[];
  conceded?: boolean;
  /** Milliseconds this player has used on their game clock, up to their last move. */
  clock?: number;
  /** The player who ran out of time. */
  flagged?: PlayerId;
}

/** Everything needed to rejoin a game after the page reloads. */
export interface DuelSave {
  code: string;
  role: Role;
  token: string;
  deck: SharedDeck;
  seed?: number;
  partner?: string;
  actions: Action[];
  conceded?: boolean;
  /** Both game clocks, so time away from the game still counts after a reload. */
  clock?: Clock;
  flagged?: PlayerId;
}

export type DuelStatus =
  /** Host: waiting for a friend to join. Guest: looking for the host. */
  | { kind: "waiting" }
  /** Guest: the host is already playing someone else. */
  | { kind: "full" }
  | { kind: "playing"; game: LocalGame; partnerHere: boolean }
  | { kind: "error"; message: string };

const NOTE_LIMIT = 3800;
const ROOM_PREFIX = "duel-";

/** A short game code that is easy to read out: no 0/O or 1/I/L. */
export function newGameCode(random: () => number = Math.random): string {
  const letters = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += letters[Math.floor(random() * letters.length)];
  return code;
}

/** Tidies what someone typed into a game code, or returns null if it can't be one. */
export function cleanGameCode(typed: string): string | null {
  const code = typed
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return /^[a-z0-9]{4,12}$/.test(code) ? code : null;
}

export function roomName(code: string): string {
  return ROOM_PREFIX + code;
}

export function shareDeck(deck: DeckList): SharedDeck {
  const c: Record<string, number> = {};
  for (const id of deck.deck) c[id] = (c[id] ?? 0) + 1;
  return { l: deck.leader, c };
}

export function unshareDeck(deck: SharedDeck): DeckList {
  return {
    leader: deck.l,
    deck: Object.entries(deck.c).flatMap(([id, n]) => Array<string>(n).fill(id)),
  };
}

export function newSave(code: string, role: Role, deck: DeckList, random = Math.random): DuelSave {
  const save: DuelSave = {
    code,
    role,
    token: newGameCode(random) + newGameCode(random),
    deck: shareDeck(deck),
    actions: [],
  };
  if (role === "host") save.seed = Math.floor(random() * 2 ** 31);
  return save;
}

function readNote(peer: PeerLike): Note | null {
  const p = peer.presence as Partial<Note>;
  if (p.v !== 1 || (p.role !== "host" && p.role !== "guest")) return null;
  if (typeof p.token !== "string" || typeof p.applied !== "number") return null;
  if (typeof p.from !== "number" || !Array.isArray(p.moves)) return null;
  if (!p.deck || typeof p.deck.l !== "string" || typeof p.deck.c !== "object") return null;
  return p as Note;
}

/**
 * Keeps one online game in step with the friend's computer. `onStatus` hears every change;
 * call `play` with the game the board hands back after you act.
 */
export class DuelLink {
  private save: DuelSave;
  private game: LocalGame | null = null;
  private partnerHere = false;
  private error: string | null = null;
  private full = false;
  private theyConceded = false;
  private sent = "";
  private stop: () => void;

  constructor(
    private readonly room: RoomLike,
    save: DuelSave,
    private readonly catalog: CardCatalog,
    private readonly onStatus: (status: DuelStatus, save: DuelSave) => void,
  ) {
    this.save = save;
    this.stop = room.onPeers(({ peers }) => this.sync(peers));
    this.publish();
    this.sync(room.peers());
  }

  get me(): PlayerId {
    return this.save.role === "host" ? "p1" : "p2";
  }

  /** The board's new game after you acted. Your new moves go to your friend. */
  play(next: LocalGame): void {
    const game = this.game;
    if (!game || this.error) return;
    // Only a game that carries on from the current one: a click on a board that was a move
    // behind is dropped, and the board redraws.
    const last = game.actions.length - 1;
    if (next.actions.length <= game.actions.length || next.actions[last] !== game.actions[last])
      return;
    const fresh = next.actions.slice(game.actions.length);
    const concede = fresh.find((a) => a.type === "concede");
    if (concede) {
      // Not a move: it can land while your friend is mid-move, so it's a flag instead.
      this.save = { ...this.save, conceded: true };
      this.game = { ...next, actions: game.actions };
    } else {
      this.game = next;
      this.save = { ...this.save, actions: next.actions, clock: next.clock };
    }
    this.publish();
    this.report();
  }

  /** Ends the game because `player`'s clock ran out (see outOfTime in local-game.ts). */
  timeOut(player: PlayerId): void {
    const game = this.game;
    if (!game || this.error || game.state.winner !== null) return;
    this.game = flag(game, player);
    this.save = { ...this.save, flagged: player, clock: this.game.clock };
    this.publish();
    this.report();
  }

  async close(): Promise<void> {
    this.stop();
    await this.room.leave().catch(() => undefined);
  }

  private sync(peers: readonly PeerLike[]): void {
    const others = peers.flatMap((p) => {
      const note = !p.isMe ? readNote(p) : null;
      return note && note.role !== this.save.role ? [note] : [];
    });
    let partner = this.save.partner ? others.find((n) => n.token === this.save.partner) : undefined;

    if (!this.save.partner) {
      if (this.save.role === "host") {
        // The first guest to arrive is the one we play.
        partner = others[0];
        if (partner) this.save = { ...this.save, partner: partner.token };
      } else {
        const host = others.find((n) => n.partner === this.save.token);
        if (host) {
          partner = host;
          this.save = { ...this.save, partner: host.token };
          if (typeof host.seed === "number") this.save.seed = host.seed;
        }
        this.full = !host && others.length > 0 && others.every((n) => n.partner !== undefined);
      }
    }
    this.partnerHere = !!partner;

    if (partner && !this.game && !this.error) this.begin(partner);
    if (partner && this.game) this.catchUp(partner);
    this.publish();
    this.report();
  }

  private begin(partner: Note): void {
    const host = this.save.role === "host" ? this.save.deck : partner.deck;
    const guest = this.save.role === "host" ? partner.deck : this.save.deck;
    if (typeof this.save.seed !== "number") return;
    try {
      let game = newOnlineGame(
        this.catalog,
        { p1: unshareDeck(host), p2: unshareDeck(guest) },
        this.save.seed,
        this.me,
      );
      // After a reload, replay the moves this page saved.
      for (const action of this.save.actions) game = replay(game, action);
      // The replay took no time, so the saved clocks still say how the game stood.
      if (this.save.clock) game = { ...game, clock: this.save.clock };
      if (this.save.flagged) game = flag(game, this.save.flagged);
      if (this.save.conceded) game = concede(game, this.me);
      this.game = game;
    } catch (e) {
      this.error = `The game couldn't start: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  /** Applies the partner's moves that come next in the game. */
  private catchUp(partner: Note): void {
    let game = this.game;
    if (!game) return;
    for (let i = 0; i < partner.moves.length; i++) {
      const index = partner.from + i;
      if (index < game.actions.length) continue;
      // Past a concession the other player may still have sent a move; it no longer matters.
      if (index > game.actions.length || game.state.winner !== null) break;
      const action = partner.moves[i] as Action;
      // Only your own page moves for you; anything else is ignored.
      if (!action || typeof action !== "object" || action.player === this.me) break;
      try {
        game = friendAct(game, action);
      } catch (e) {
        this.error = `Your games went out of step (${e instanceof Error ? e.message : String(e)}). Start a new game.`;
        break;
      }
    }
    const them = opponentOf(game.human);
    if (typeof partner.clock === "number" && partner.clock !== game.clock.used[them]) {
      game = {
        ...game,
        clock: { ...game.clock, used: { ...game.clock.used, [them]: partner.clock } },
      };
    }
    if ((partner.flagged === "p1" || partner.flagged === "p2") && game.state.winner === null) {
      game = flag(game, partner.flagged);
      this.save = { ...this.save, flagged: partner.flagged };
    }
    if (partner.conceded && !this.theyConceded && game.state.winner === null) {
      this.theyConceded = true;
      game = concede(game, them);
    }
    if (game !== this.game) {
      this.game = game;
      this.save = { ...this.save, actions: game.actions, clock: game.clock };
    }
  }

  private publish(): void {
    const partner = this.room
      .peers()
      .map(readNote)
      .find((n) => n && n.token === this.save.partner && n.role !== this.save.role);
    const actions = this.save.actions;
    const from = Math.min(partner?.applied ?? actions.length, actions.length);
    const moves: Action[] = [];
    let size = 400;
    for (const action of actions.slice(from)) {
      size += JSON.stringify(action).length + 1;
      if (size > NOTE_LIMIT) break;
      moves.push(action);
    }
    const note: Note = {
      v: 1,
      role: this.save.role,
      token: this.save.token,
      deck: this.save.deck,
      applied: actions.length,
      from,
      moves,
    };
    // Presence is merged field by field, so a field that isn't set is sent as null to clear it.
    const patch: Record<string, unknown> = {
      ...note,
      seed: this.save.role === "host" ? (this.save.seed ?? null) : null,
      partner: this.save.partner ?? null,
      conceded: this.save.conceded ? true : null,
      clock: this.game ? Math.round(this.game.clock.used[this.me]) : null,
      flagged: this.save.flagged ?? null,
    };
    // Only send changes: every note wakes the other page, which would answer with its own.
    const text = JSON.stringify(patch);
    if (text === this.sent) return;
    this.sent = text;
    this.room.presence(patch).catch(() => {
      this.sent = "";
    });
  }

  private report(): void {
    const status: DuelStatus = this.error
      ? { kind: "error", message: this.error }
      : this.game
        ? { kind: "playing", game: this.game, partnerHere: this.partnerHere }
        : this.full
          ? { kind: "full" }
          : { kind: "waiting" };
    this.onStatus(status, this.save);
  }
}

/** Re-applies a saved move. Either player's moves, since both are in the saved list. */
function replay(game: LocalGame, action: Action): LocalGame {
  return action.player === game.human ? humanAct(game, action) : friendAct(game, action);
}

/** Ends the game for `player` without adding a move to the shared list. */
function concede(game: LocalGame, player: PlayerId): LocalGame {
  if (game.state.winner !== null) return game;
  return { ...replay(game, { type: "concede", player }), actions: game.actions };
}

/** Ends the game on time for `player` without adding a move to the shared list. */
function flag(game: LocalGame, player: PlayerId): LocalGame {
  if (game.state.winner !== null) return game;
  return { ...timeOut(game, player), actions: game.actions };
}

/** Somewhere to hold game rooms: claude.ai's live room, or the Strawhat relay (relay.ts). */
interface Lobby {
  join(name: string): Promise<RoomLike>;
}

let lobby: Promise<Lobby | null> | null = null;

/**
 * Where this page can play online: the live room claude.ai gives a published page, else the
 * relay on the site serving the game, else null (like `pnpm dev`). Waits at most about 10 s.
 */
export function onlineRoom(): Promise<Lobby | null> {
  lobby ??= (async () => {
    const claude = (window as { claude?: { use?: (name: string) => Promise<unknown> } }).claude;
    if (typeof claude?.use === "function") {
      try {
        return ((await claude.use("room")) as Lobby | null) ?? null;
      } catch {
        return null;
      }
    }
    return findRelay();
  })();
  return lobby;
}

const SAVE_KEY = "strawhat.duel";

/** The online game this browser was last in, so a reload can rejoin it. */
export function loadDuel(): DuelSave | null {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as DuelSave | null;
    return save && typeof save.code === "string" && Array.isArray(save.actions) ? save : null;
  } catch {
    return null;
  }
}

export function storeDuel(save: DuelSave | null): void {
  try {
    if (save) localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    else localStorage.removeItem(SAVE_KEY);
  } catch {
    // Private windows can refuse storage; the game still plays, it just can't be rejoined.
  }
}
