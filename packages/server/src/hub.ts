/**
 * The game room the relay keeps for each online game: a note per player that the others see.
 *
 * It mirrors the claude.ai live room the app was first built on (see packages/web/src/online.ts):
 * each player patches their own note, a null field deletes it, and every change goes out to
 * everyone in the room as the full list of players and their notes. The relay knows nothing about
 * the game itself; both browsers replay the same moves.
 */

/** One player's open connection. */
export interface Socket {
  send(text: string): void;
  close(code: number, reason: string): void;
}

export type Note = Record<string, unknown>;

/** What a browser sends: a change to its own note. */
export interface PatchMessage {
  t: "presence";
  patch: Note;
}

/** What the relay sends: everyone in the room, and which of them is you. */
export interface PeersMessage {
  t: "peers";
  you: string;
  peers: { peer: string; presence: Note }[];
}

/** Notes bigger than this are refused, so one room can't fill the relay's memory. */
export const MAX_NOTE = 8 * 1024;
/** Two players, plus room for a reconnect that arrives before the old connection is noticed. */
export const MAX_PEERS = 6;

const ROOM_NAME = /^[A-Za-z0-9-]{1,48}$/;

export function validRoomName(name: string): boolean {
  return ROOM_NAME.test(name);
}

export class RoomHub {
  private members = new Map<Socket, { id: string; note: Note }>();

  /** `save` is told about every note change, so a room can survive the relay going to sleep. */
  constructor(private save: (id: string, note: Note | null) => void = () => {}) {}

  get size(): number {
    return this.members.size;
  }

  /** Brings back a player after the relay woke up, without telling anyone. */
  restore(socket: Socket, id: string, note: Note): void {
    this.members.set(socket, { id, note });
  }

  /** Lets a player in, or turns them away when the room is full. */
  join(socket: Socket, id: string): boolean {
    if (this.members.size >= MAX_PEERS) {
      socket.close(4003, "This game room is full.");
      return false;
    }
    this.members.set(socket, { id, note: {} });
    this.broadcast();
    return true;
  }

  /** Handles one message from a player. Anything that isn't a valid patch is ignored. */
  receive(socket: Socket, text: string): void {
    const member = this.members.get(socket);
    if (!member || text.length > MAX_NOTE * 2) return;
    let message: Partial<PatchMessage>;
    try {
      message = JSON.parse(text) as Partial<PatchMessage>;
    } catch {
      return;
    }
    const patch = message?.patch;
    if (message?.t !== "presence" || !patch || typeof patch !== "object" || Array.isArray(patch))
      return;
    const note = { ...member.note };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete note[key];
      else note[key] = value;
    }
    if (JSON.stringify(note).length > MAX_NOTE) return;
    member.note = note;
    this.save(member.id, note);
    this.broadcast();
  }

  /** A player left or their connection dropped. */
  leave(socket: Socket): void {
    const member = this.members.get(socket);
    if (!member) return;
    this.members.delete(socket);
    this.save(member.id, null);
    this.broadcast();
  }

  private broadcast(): void {
    const peers = [...this.members.values()].map((m) => ({ peer: m.id, presence: m.note }));
    for (const [socket, member] of this.members) {
      const message: PeersMessage = { t: "peers", you: member.id, peers };
      try {
        socket.send(JSON.stringify(message));
      } catch {
        // A connection that just closed; its close event removes it.
      }
    }
  }
}
