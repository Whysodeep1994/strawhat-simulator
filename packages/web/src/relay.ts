/**
 * Play a Friend outside claude.ai: a game room on the Strawhat relay (packages/server), reached
 * over a WebSocket at /rooms/<name> on the site that serves the game.
 *
 * It behaves like the claude.ai live room DuelLink was written for (see RoomLike in online.ts):
 * each player keeps a note the others see, and a null field deletes it. A dropped connection
 * reconnects by itself and sends this player's whole note again, since the relay forgets the
 * notes of players who disconnect.
 */
import type { PeerLike, RoomLike } from "./online.js";

/** The parts of the browser's WebSocket this file uses, so tests can stand in for it. */
export interface WebSocketLike {
  readonly readyState: number;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(text: string): void;
  close(): void;
}

export type OpenSocket = (url: string) => WebSocketLike;

const OPEN = 1;

interface PeersMessage {
  t: "peers";
  you: string;
  peers: { peer: string; presence: Record<string, unknown> }[];
}

export class RelayRoom implements RoomLike {
  private socket: WebSocketLike | null = null;
  private mine: Record<string, unknown> = {};
  private me = "";
  private list: PeerLike[] = [];
  private handlers = new Set<(change: { peers: readonly PeerLike[] }) => void>();
  private closed = false;
  private retries = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  private constructor(
    private url: string,
    private open: OpenSocket,
  ) {}

  /** Opens the room, resolving once the relay has let this player in. */
  static join(url: string, open: OpenSocket, timeoutMs = 10_000): Promise<RelayRoom> {
    const room = new RelayRoom(url, open);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        void room.leave();
        reject(new Error("The game room didn't answer."));
      }, timeoutMs);
      room.connect(
        () => {
          clearTimeout(timer);
          resolve(room);
        },
        () => {
          clearTimeout(timer);
          void room.leave();
          reject(new Error("Couldn't reach the game room."));
        },
      );
    });
  }

  private connect(onFirst?: () => void, onFail?: () => void): void {
    const socket = this.open(this.url);
    this.socket = socket;
    let welcomed = false;
    socket.onopen = () => {
      this.retries = 0;
      if (Object.keys(this.mine).length)
        socket.send(JSON.stringify({ t: "presence", patch: this.mine }));
    };
    socket.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      let message: PeersMessage;
      try {
        message = JSON.parse(event.data) as PeersMessage;
      } catch {
        return;
      }
      if (message?.t !== "peers" || !Array.isArray(message.peers)) return;
      this.me = message.you;
      this.list = message.peers.map((p) => ({
        peer: p.peer,
        isMe: p.peer === message.you,
        presence: p.presence ?? {},
      }));
      if (!welcomed) {
        welcomed = true;
        onFirst?.();
      }
      for (const handler of this.handlers) handler({ peers: this.list });
    };
    socket.onerror = () => {};
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      if (!welcomed && onFail) return onFail();
      if (this.closed) return;
      // Others see this player vanish until the reconnect lands.
      this.list = this.list.filter((p) => p.isMe);
      for (const handler of this.handlers) handler({ peers: this.list });
      const wait = Math.min(10_000, 500 * 2 ** this.retries++);
      this.timer = setTimeout(() => {
        this.timer = null;
        if (!this.closed) this.connect();
      }, wait);
    };
  }

  async presence(patch: Record<string, unknown>): Promise<void> {
    const next = { ...this.mine };
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) delete next[key];
      else next[key] = value;
    }
    this.mine = next;
    const me = this.list.find((p) => p.isMe);
    if (me) me.presence = next;
    // While disconnected the note waits; the reconnect sends all of it.
    if (this.socket?.readyState === OPEN)
      this.socket.send(JSON.stringify({ t: "presence", patch }));
  }

  peers(): readonly PeerLike[] {
    return this.list;
  }

  onPeers(handler: (change: { peers: readonly PeerLike[] }) => void): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  connected(): boolean {
    return this.socket?.readyState === OPEN && this.me !== "";
  }

  async leave(): Promise<void> {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    const socket = this.socket;
    this.socket = null;
    socket?.close();
  }
}

/** The relay on the site serving this page, or null if there isn't one (claude.ai, `pnpm dev`). */
export async function findRelay(
  origin: string = location.origin,
  open: OpenSocket = (url) => new WebSocket(url) as unknown as WebSocketLike,
): Promise<{ join(name: string): Promise<RoomLike> } | null> {
  if (!/^https?:/.test(origin)) return null;
  try {
    const answer = await fetch(`${origin}/rooms`, { signal: AbortSignal.timeout(5_000) });
    const info = (await answer.json()) as { relay?: string };
    if (info?.relay !== "strawhat") return null;
  } catch {
    return null;
  }
  const base = origin.replace(/^http/, "ws");
  return { join: (name) => RelayRoom.join(`${base}/rooms/${encodeURIComponent(name)}`, open) };
}
