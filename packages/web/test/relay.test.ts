import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomHub } from "../../server/src/hub.js";
import { RelayRoom, type WebSocketLike } from "../src/relay.js";

/** A browser WebSocket wired straight to a RoomHub, the way the relay's Durable Object is. */
class LinkedSocket implements WebSocketLike {
  static count = 0;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private server = {
    send: (text: string) => queueMicrotask(() => this.onmessage?.({ data: text })),
    close: () => this.drop(),
  };

  constructor(private hub: RoomHub) {
    queueMicrotask(() => {
      hub.join(this.server, `peer${++LinkedSocket.count}`);
      this.readyState = 1;
      this.onopen?.();
    });
  }

  send(text: string) {
    this.hub.receive(this.server, text);
  }

  close() {
    this.drop();
  }

  /** The connection dies, as when wifi drops. */
  drop() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.hub.leave(this.server);
    queueMicrotask(() => this.onclose?.());
  }
}

describe("RelayRoom", () => {
  let hub: RoomHub;
  let sockets: LinkedSocket[];
  const open = () => {
    const socket = new LinkedSocket(hub);
    sockets.push(socket);
    return socket;
  };

  beforeEach(() => {
    hub = new RoomHub();
    sockets = [];
  });
  afterEach(() => vi.useRealTimers());

  it("shares each player's note with the other", async () => {
    const host = await RelayRoom.join("ws://x/rooms/duel-A", open);
    const guest = await RelayRoom.join("ws://x/rooms/duel-A", open);
    await host.presence({ deck: "red", moves: [1, 2] });
    await guest.presence({ deck: "blue" });
    await host.presence({ moves: null });
    await vi.waitFor(() => {
      const seen = guest.peers().find((p) => !p.isMe);
      expect(seen?.presence).toEqual({ deck: "red" });
    });
    expect(host.peers().find((p) => !p.isMe)?.presence).toEqual({ deck: "blue" });
    expect(host.connected()).toBe(true);
  });

  it("reconnects after a dropped connection and sends its whole note again", async () => {
    const host = await RelayRoom.join("ws://x/rooms/duel-A", open);
    const guest = await RelayRoom.join("ws://x/rooms/duel-A", open);
    await host.presence({ deck: "red", applied: 4 });
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    sockets[0]!.drop();
    await vi.waitFor(() => expect(host.connected()).toBe(false));
    await host.presence({ applied: 5 });
    vi.advanceTimersByTime(1_000);
    vi.useRealTimers();
    await vi.waitFor(() => {
      const seen = guest.peers().find((p) => !p.isMe);
      expect(seen?.presence).toEqual({ deck: "red", applied: 5 });
    });
    expect(host.connected()).toBe(true);
    expect(hub.size).toBe(2);
  });

  it("fails to join when the relay can't be reached", async () => {
    const dead = (): WebSocketLike => {
      const socket: WebSocketLike = {
        readyState: 3,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
        send() {},
        close() {},
      };
      queueMicrotask(() => socket.onclose?.());
      return socket;
    };
    await expect(RelayRoom.join("ws://x/rooms/duel-A", dead)).rejects.toThrow();
  });

  it("stops reconnecting once it leaves", async () => {
    const host = await RelayRoom.join("ws://x/rooms/duel-A", open);
    await host.leave();
    await new Promise((r) => setTimeout(r, 10));
    expect(hub.size).toBe(0);
    expect(sockets.length).toBe(1);
  });
});
