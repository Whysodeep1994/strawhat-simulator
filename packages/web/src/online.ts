import {
  opponentOf,
  type Action,
  type CardCatalog,
  type DeckList,
  type PlayerId,
} from "@strawhat/engine";
import type { Clock } from "./clock.js";
import {
  friendAct,
  humanAct,
  newOnlineGame,
  timeOut,
  type LocalGame,
  type Overtime,
} from "./local-game.js";
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
 * Running out of time is a flag too, and either page may raise it. It starts overtime rather than
 * ending the game, so the flag says which turn became overtime turn 0; both pages then end the
 * game at the end of the same turn. If both pages raised it, the earlier turn counts.
 *
 * Each page keeps both game clocks, but a player's own page is the one that counts: its note
 * says how much time that player has used, and the other page takes that figure over its own,
 * which would otherwise grow by however long each move took to arrive.
 *
 * The note also says how the player's side of the table looks: their playmat and card backs, so
 * each player sees the other's choices. A ready-made one travels by name. An uploaded picture is
 * too big for one note, so it goes a piece at a time: the note names the picture and how many
 * pieces it has, carries the next piece the partner is missing, and the partner's note says how
 * many pieces it has so far. Moves always go first; a piece rides along only when there's room.
 *
 * Chat travels the same way as moves: the note carries the lines the partner hasn't got yet, and
 * the partner's note says how many of them it has. Lines come after moves and before pictures.
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

/**
 * How a player's side looks: their playmat (a saved choice from playmat.ts, null for the default)
 * and card back (a choice from card-backs.ts). Ready-made ones are "preset:<id>"; an upload is a
 * picture (a data URL), which travels in pieces.
 */
export interface Looks {
  mat: string | null;
  back: string;
}

/** What the partner has shown so far; a field is missing until it has arrived. */
export type TheirLooks = Partial<Looks>;

/** How a look travels in the note: a preset by name, or "pic:<id>:<pieces>" for a picture. */
type LookRef = string | null;

/** One piece of a picture: piece `i` of the picture called `h`. */
interface Piece {
  h: string;
  i: number;
  d: string;
}

/** One line of chat, kept in the save so a reload still shows the conversation. */
export interface ChatLine {
  mine: boolean;
  text: string;
}

/** Your lines `from`, `from + 1`, … of the chat, for a partner who hasn't got them. */
interface Said {
  from: number;
  lines: string[];
}

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
  /** The turn in which they did: overtime turn 0. */
  flaggedTurn?: number;
  /** This player's playmat and card backs. */
  look?: { mat: LookRef; back: LookRef };
  /** The next piece of a picture the partner is missing. */
  pic?: Piece;
  /** How many pieces of each of the partner's pictures this player has. */
  got?: Record<string, number>;
  /** Chat lines the partner hasn't got yet. */
  said?: Said;
  /** How many of the partner's chat lines this player has. */
  heard?: number;
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
  /** Who ran out of time, and when: the game's overtime. */
  overtime?: Overtime;
  /** The partner's playmat and card backs, kept so a reload needn't fetch their pictures again. */
  theirs?: TheirLooks;
  /** The chat between the two players, oldest first. */
  chat?: ChatLine[];
  /** How many chat lines each player has said this game; the chat itself may have dropped old ones. */
  said?: number;
  heard?: number;
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
/** Characters of a picture per piece. */
export const PIECE = 2000;
/** The longest chat line, in characters. */
export const CHAT_LENGTH = 200;
/** How many lines a game's chat keeps; older ones scroll away. */
const CHAT_KEEP = 300;
export const DEFAULT_LOOKS: Looks = { mat: null, back: "preset:classic" };

const PRESET_LOOK = /^preset:[a-z0-9-]{1,40}$/;
const PICTURE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const PIC_REF = /^pic:([a-z0-9]{1,20}):([1-9][0-9]{0,3})$/;

/** A short name for a picture, so both sides can tell which one a piece belongs to. */
export function pictureId(data: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) h = Math.imul(h ^ data.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36) + data.length.toString(36);
}

/** Whether a look the partner sent is safe to show: a preset name or a picture, nothing else. */
export function safeLook(look: unknown): look is string {
  return typeof look === "string" && (PRESET_LOOK.test(look) || PICTURE.test(look));
}

/** How one of your looks is named in your note. */
function lookRef(look: string | null): LookRef {
  if (look === null || !safeLook(look)) return null;
  if (PRESET_LOOK.test(look)) return look;
  return `pic:${pictureId(look)}:${Math.ceil(look.length / PIECE)}`;
}

/** Tidies a chat line: one line of plain text, at most CHAT_LENGTH characters, or null if empty. */
export function cleanChat(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const line = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return line ? [...line].slice(0, CHAT_LENGTH).join("") : null;
}

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
  /** Your uploaded pictures by their id, to send in pieces. */
  private pictures = new Map<string, string>();
  /** Pieces of the partner's pictures that have arrived, by picture id. */
  private incoming = new Map<string, string[]>();

  constructor(
    private readonly room: RoomLike,
    save: DuelSave,
    private readonly catalog: CardCatalog,
    private readonly onStatus: (status: DuelStatus, save: DuelSave) => void,
    private readonly looks: Looks = DEFAULT_LOOKS,
  ) {
    this.save = save;
    for (const look of [looks.mat, looks.back]) {
      if (look && safeLook(look) && !PRESET_LOOK.test(look))
        this.pictures.set(pictureId(look), look);
    }
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

  /** Starts overtime because `player`'s clock ran out (see outOfTime in local-game.ts). */
  timeOut(player: PlayerId): void {
    const game = this.game;
    if (!game || this.error || game.state.winner !== null || game.overtime) return;
    const overtime = { by: player, from: game.state.turn };
    this.game = timeOut(game, overtime.by, overtime.from);
    this.save = { ...this.save, overtime, clock: this.game.clock };
    this.publish();
    this.report();
  }

  /** Sends a line of chat to your friend. */
  say(text: string): void {
    const line = cleanChat(text);
    if (!line || this.error) return;
    this.save = {
      ...this.save,
      chat: keep([...(this.save.chat ?? []), { mine: true, text: line }]),
      said: (this.save.said ?? 0) + 1,
    };
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

    if (partner) this.receiveLooks(partner);
    if (partner) this.hear(partner);
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
      // Overtime first, so the replay ends the game at the end of its last turn.
      const overtime = this.save.overtime;
      if (overtime) game = timeOut(game, overtime.by, overtime.from);
      // After a reload, replay the moves this page saved.
      for (const action of this.save.actions) game = replay(game, action);
      // The replay took no time, so the saved clocks still say how the game stood.
      if (this.save.clock) game = { ...game, clock: this.save.clock };
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
    // Overtime before the moves, since they may end its last turn.
    game = this.overtimeFrom(game, partner);
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
    if (partner.conceded && !this.theyConceded && game.state.winner === null) {
      this.theyConceded = true;
      game = concede(game, them);
    }
    if (game !== this.game) {
      this.game = game;
      this.save = { ...this.save, actions: game.actions, clock: game.clock };
    }
  }

  /**
   * The game with the overtime your friend's page started, if any. When both pages started it,
   * the earlier turn wins, so both end the game at the same point.
   */
  private overtimeFrom(game: LocalGame, partner: Note): LocalGame {
    const by = partner.flagged;
    if ((by !== "p1" && by !== "p2") || game.state.winner !== null) return game;
    const from = typeof partner.flaggedTurn === "number" ? partner.flaggedTurn : game.state.turn;
    if (game.overtime && game.overtime.from <= from) return game;
    // Theirs started earlier than ours (or ours hasn't started): take theirs.
    const next = timeOut(game, by, from);
    this.save = { ...this.save, overtime: { by, from }, clock: next.clock };
    return next;
  }

  /** Takes in the partner's chat lines that come next. */
  private hear(partner: Note): void {
    const said = partner.said;
    if (!said || typeof said !== "object" || typeof said.from !== "number") return;
    if (!Array.isArray(said.lines)) return;
    let count = this.save.heard ?? 0;
    // Lines from before what the partner still keeps are gone; carry on from the first one sent.
    if (said.from > count) count = said.from;
    const heard: ChatLine[] = [];
    for (let i = 0; i < said.lines.length; i++) {
      if (said.from + i < count) continue;
      // A line that isn't plain text still counts, so the two sides stay in step.
      const text = cleanChat(said.lines[i]);
      if (text) heard.push({ mine: false, text });
      count++;
    }
    if (count !== (this.save.heard ?? 0))
      this.save = { ...this.save, chat: keep([...(this.save.chat ?? []), ...heard]), heard: count };
  }

  /** Your chat lines the partner hasn't got, as many as fit in `room` characters. */
  private toSay(partner: Note | null | undefined, room: number): Said | null {
    if (!partner) return null;
    const said = this.save.said ?? 0;
    const mine = (this.save.chat ?? []).filter((l) => l.mine).map((l) => l.text);
    // Lines the chat no longer keeps are skipped.
    const first = said - mine.length;
    const from = Math.max(typeof partner.heard === "number" ? partner.heard : 0, first);
    if (from >= said) return null;
    const lines: string[] = [];
    let size = 40;
    for (const text of mine.slice(from - first)) {
      size += JSON.stringify(text).length + 1;
      if (size > room) break;
      lines.push(text);
    }
    return lines.length ? { from, lines } : null;
  }

  /** Takes in the partner's playmat and card backs, and any piece of a picture they sent. */
  private receiveLooks(partner: Note): void {
    const look = partner.look;
    if (!look || typeof look !== "object") return;
    const theirs: TheirLooks = { ...this.save.theirs };
    let changed = false;
    for (const key of ["mat", "back"] as const) {
      const ref = look[key];
      let value: string | null | undefined;
      if (ref === null && key === "mat") value = null;
      else if (typeof ref === "string" && PRESET_LOOK.test(ref)) value = ref;
      else if (typeof ref === "string" && PIC_REF.test(ref)) {
        const [, id, count] = PIC_REF.exec(ref) as RegExpExecArray;
        const n = Number(count);
        // Already have it, from before a reload.
        const have = theirs[key];
        if (have && safeLook(have) && pictureId(have) === id) continue;
        const pieces = this.incoming.get(id as string) ?? [];
        this.incoming.set(id as string, pieces);
        const pic = partner.pic;
        if (pic && pic.h === id && pic.i === pieces.length && typeof pic.d === "string")
          pieces.push(pic.d);
        if (pieces.length < n) continue;
        const data = pieces.join("");
        this.incoming.delete(id as string);
        // A picture that doesn't add up is fetched again from the start.
        if (!PICTURE.test(data) || pictureId(data) !== id) continue;
        value = data;
      } else continue;
      if (theirs[key] !== value) {
        if (value === null) theirs.mat = null;
        else theirs[key] = value;
        changed = true;
      }
    }
    if (changed) this.save = { ...this.save, theirs };
  }

  /** How many pieces of each of the partner's pictures this page has, for the partner's note. */
  private gotPieces(partner: Note | null | undefined): Record<string, number> | null {
    const look = partner?.look;
    if (!look) return null;
    const got: Record<string, number> = {};
    for (const key of ["mat", "back"] as const) {
      const match = typeof look[key] === "string" ? PIC_REF.exec(look[key] as string) : null;
      if (!match) continue;
      const [, id, count] = match as unknown as [string, string, string];
      const have = this.save.theirs?.[key];
      got[id] =
        have && safeLook(have) && pictureId(have) === id
          ? Number(count)
          : (this.incoming.get(id)?.length ?? 0);
    }
    return Object.keys(got).length ? got : null;
  }

  /** The next piece of one of your pictures that the partner is missing, if any. */
  private nextPiece(partner: Note | null | undefined): Piece | null {
    if (!partner) return null;
    const got = partner.got && typeof partner.got === "object" ? partner.got : {};
    // The card back first: it's small, and on screen the whole game.
    for (const look of [this.looks.back, this.looks.mat]) {
      if (!look) continue;
      const id = pictureId(look);
      if (!this.pictures.has(id)) continue;
      const have = typeof got[id] === "number" ? got[id] : 0;
      const n = Math.ceil(look.length / PIECE);
      if (have >= n || have < 0) continue;
      return { h: id, i: have, d: look.slice(have * PIECE, (have + 1) * PIECE) };
    }
    return null;
  }

  private publish(): void {
    const partner = this.room
      .peers()
      .map(readNote)
      .find((n) => n && n.token === this.save.partner && n.role !== this.save.role);
    const actions = this.save.actions;
    const from = Math.min(partner?.applied ?? actions.length, actions.length);
    const moves: Action[] = [];
    let size = 600;
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
      flagged: this.save.overtime?.by ?? null,
      flaggedTurn: this.save.overtime?.from ?? null,
      look: { mat: lookRef(this.looks.mat), back: lookRef(this.looks.back) },
      got: this.gotPieces(partner),
      heard: this.save.heard ?? 0,
      said: null,
      pic: null,
    };
    // Chat after the moves, then a piece of a picture, each only when it fits.
    const said = this.toSay(partner, NOTE_LIMIT - JSON.stringify(patch).length);
    if (said) patch.said = said;
    // A piece of a picture only when it fits beside the moves.
    const piece = this.nextPiece(partner);
    if (piece && JSON.stringify(patch).length + piece.d.length + 60 <= NOTE_LIMIT)
      patch.pic = piece;
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

/** The last CHAT_KEEP lines of a chat. */
function keep(chat: ChatLine[]): ChatLine[] {
  return chat.length > CHAT_KEEP ? chat.slice(-CHAT_KEEP) : chat;
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
