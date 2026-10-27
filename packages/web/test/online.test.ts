import { chooseBotAction } from "@strawhat/engine";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOCK_MS, timeLeft } from "../src/clock.js";
import { DEMO_CATALOG, DEMO_DECKS } from "./fixtures/demo-cards.js";
import { humanAct, type LocalGame } from "../src/local-game.js";
import {
  cleanGameCode,
  DuelLink,
  newGameCode,
  newSave,
  shareDeck,
  unshareDeck,
  type DuelSave,
  type DuelStatus,
  type PeerLike,
  type RoomLike,
} from "../src/online.js";

/** A pretend named room: presence is shared, but only delivered when `flush` runs. */
class Hub {
  notes = new Map<string, Record<string, unknown>>();
  rooms = new Set<FakeRoom>();
  queued = new Set<FakeRoom>();
  biggest = 0;

  flush() {
    for (let i = 0; i < 100 && this.queued.size > 0; i++) {
      const rooms = [...this.queued];
      this.queued.clear();
      for (const room of rooms) room.deliver();
    }
  }
}

let nextPeer = 1;

class FakeRoom implements RoomLike {
  readonly id = `peer${nextPeer++}`;
  private handlers: ((c: { peers: readonly PeerLike[] }) => void)[] = [];
  /** A deaf room hears nothing until it is turned back on. */
  deaf = false;

  constructor(private hub: Hub) {
    hub.rooms.add(this);
  }

  async presence(patch: Record<string, unknown>) {
    const merged = { ...(this.hub.notes.get(this.id) ?? {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete merged[k];
      else merged[k] = v;
    }
    this.hub.biggest = Math.max(this.hub.biggest, JSON.stringify(merged).length);
    this.hub.notes.set(this.id, merged);
    for (const room of this.hub.rooms) if (room !== this) this.hub.queued.add(room);
  }

  peers(): PeerLike[] {
    return [...this.hub.rooms].map((r) => ({
      peer: r.id,
      isMe: r === this,
      presence: structuredClone(this.hub.notes.get(r.id) ?? {}),
    }));
  }

  onPeers(handler: (c: { peers: readonly PeerLike[] }) => void) {
    this.handlers.push(handler);
    this.hub.queued.add(this);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  deliver() {
    if (this.deaf) return;
    for (const h of this.handlers) h({ peers: this.peers() });
  }

  connected() {
    return true;
  }

  async leave() {
    this.hub.rooms.delete(this);
    this.hub.notes.delete(this.id);
    for (const room of this.hub.rooms) this.hub.queued.add(room);
  }
}

interface Player {
  room: FakeRoom;
  link: DuelLink;
  status: DuelStatus;
  save: DuelSave;
}

function join(hub: Hub, save: DuelSave): Player {
  const room = new FakeRoom(hub);
  const player = { room, save, status: { kind: "waiting" } } as Player;
  player.link = new DuelLink(room, save, DEMO_CATALOG, (status, next) => {
    player.status = status;
    player.save = next;
  });
  return player;
}

function gameOf(p: Player): LocalGame {
  if (p.status.kind !== "playing") throw new Error(`not playing: ${JSON.stringify(p.status)}`);
  return p.status.game;
}

/** Plays one move for whoever is prompted. Returns false when the game is over. */
function step(hub: Hub, players: Player[]): boolean {
  hub.flush();
  for (const p of players) {
    const game = gameOf(p);
    const prompt = game.state.prompt;
    if (prompt.kind === "gameOver") return false;
    if (prompt.player !== game.human) continue;
    p.link.play(humanAct(game, chooseBotAction(game.state, game.human)));
    return true;
  }
  throw new Error("nobody can move");
}

function start(seed: number) {
  const hub = new Hub();
  const random = mulberry(seed);
  const host = join(hub, newSave("abc234", "host", DEMO_DECKS.red, random));
  const guest = join(hub, newSave("abc234", "guest", DEMO_DECKS.green, random));
  hub.flush();
  return { hub, host, guest };
}

function mulberry(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("game codes", () => {
  it("are six easy-to-read characters", () => {
    for (let i = 0; i < 50; i++) expect(newGameCode()).toMatch(/^[a-hjkmnp-z2-9]{6}$/);
  });

  it("accept what people type", () => {
    expect(cleanGameCode("  ABC-234 ")).toBe("abc234");
    expect(cleanGameCode("ab")).toBeNull();
  });
});

describe("decks sent to a friend", () => {
  it("come back as the same 50 cards", () => {
    const deck = DEMO_DECKS.red;
    const back = unshareDeck(shareDeck(deck));
    expect(back.leader).toBe(deck.leader);
    expect([...back.deck].sort()).toEqual([...deck.deck].sort());
  });
});

describe("playing a friend online", () => {
  it("starts the same game on both computers, with the host as p1", () => {
    const { host, guest } = start(1);
    expect(gameOf(host).human).toBe("p1");
    expect(gameOf(guest).human).toBe("p2");
    expect(gameOf(guest).state).toEqual(gameOf(host).state);
  });

  it("keeps both computers in step for whole games", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const { hub, host, guest } = start(seed);
      let moves = 0;
      while (step(hub, [host, guest]) && moves < 3000) moves++;
      hub.flush();
      expect(gameOf(host).state.winner, `seed ${seed}`).not.toBeNull();
      expect(gameOf(guest).state).toEqual(gameOf(host).state);
      expect(gameOf(guest).actions.length).toBe(moves);
      expect(hub.biggest).toBeLessThan(4096);
    }
  });

  it("catches up a friend who missed updates for a while", () => {
    const { hub, host, guest } = start(3);
    for (let i = 0; i < 40; i++) step(hub, [host, guest]);
    guest.room.deaf = true;
    // The host plays on as far as it can without the guest.
    for (let i = 0; i < 20; i++) {
      const game = gameOf(host);
      if (game.state.prompt.kind === "gameOver" || game.state.prompt.player !== "p1") break;
      host.link.play(humanAct(game, chooseBotAction(game.state, "p1")));
    }
    hub.flush();
    expect(gameOf(guest).actions.length).toBeLessThan(gameOf(host).actions.length);
    guest.room.deaf = false;
    hub.queued.add(guest.room);
    hub.flush();
    expect(gameOf(guest).state).toEqual(gameOf(host).state);
  });

  it("picks up again after a page reloads", () => {
    const { hub, host, guest } = start(4);
    for (let i = 0; i < 30; i++) step(hub, [host, guest]);
    const saved = guest.save;
    void guest.link.close();
    hub.flush();
    const back = join(hub, saved);
    hub.flush();
    expect(gameOf(back).state).toEqual(gameOf(host).state);
    while (step(hub, [host, back]));
    hub.flush();
    expect(gameOf(back).state).toEqual(gameOf(host).state);
  });

  it("ends the game for both when one player concedes", () => {
    const { hub, host, guest } = start(5);
    for (let i = 0; i < 10; i++) step(hub, [host, guest]);
    const game = gameOf(guest);
    guest.link.play(humanAct(game, { type: "concede", player: "p2" }));
    hub.flush();
    expect(gameOf(guest).state.winner).toBe("p1");
    expect(gameOf(host).state.winner).toBe("p1");
  });

  it("tells a third player the game is full", () => {
    const { hub } = start(6);
    const late = join(hub, newSave("abc234", "guest", DEMO_DECKS.red));
    hub.flush();
    expect(late.status.kind).toBe("full");
  });
});

describe("game clocks online", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it("take each player's own count of their time", () => {
    const { hub, host, guest } = start(7);
    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(Date.now() + 10_000);
      step(hub, [host, guest]);
    }
    // The guest's page hears every move a second late.
    vi.setSystemTime(Date.now() + 1000);
    hub.flush();
    expect(gameOf(guest).clock.used.p1).toBe(gameOf(host).clock.used.p1);
    expect(gameOf(host).clock.used.p2).toBe(gameOf(guest).clock.used.p2);
  });

  it("end the game for both when a clock runs out", () => {
    const { hub, host, guest } = start(8);
    for (let i = 0; i < 6; i++) step(hub, [host, guest]);
    hub.flush();
    const prompt = gameOf(host).state.prompt;
    if (prompt.kind === "gameOver") throw new Error("game ended early");
    const slow = prompt.player;
    // The slow player's page raises it; the other page agrees.
    (slow === "p1" ? host : guest).link.timeOut(slow);
    hub.flush();
    const winner = slow === "p1" ? "p2" : "p1";
    expect(gameOf(host).state.winner).toBe(winner);
    expect(gameOf(guest).state.winner).toBe(winner);
    expect(gameOf(host).timedOut).toBe(slow);
    expect(gameOf(guest).timedOut).toBe(slow);
  });

  it("keep counting while a page is closed, and after Rejoin", () => {
    const { hub, host, guest } = start(9);
    for (let i = 0; i < 6; i++) {
      vi.setSystemTime(Date.now() + 20_000);
      step(hub, [host, guest]);
    }
    hub.flush();
    const used = gameOf(guest).clock.used;
    const saved = guest.save;
    void guest.link.close();
    hub.flush();
    vi.setSystemTime(Date.now() + 60_000);
    const back = join(hub, saved);
    hub.flush();
    const game = gameOf(back);
    expect(game.clock.used).toEqual(used);
    const prompt = game.state.prompt;
    if (prompt.kind === "gameOver") throw new Error("game ended early");
    const left = timeLeft(game.clock, game.state, prompt.player, Date.now());
    expect(left).toBe(CLOCK_MS - used[prompt.player] - 60_000);
  });
});
