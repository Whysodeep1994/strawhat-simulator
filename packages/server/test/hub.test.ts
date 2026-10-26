import { describe, expect, it } from "vitest";
import { MAX_NOTE, MAX_PEERS, RoomHub, validRoomName, type PeersMessage } from "../src/hub.js";

class FakeSocket {
  sent: PeersMessage[] = [];
  closed: number | null = null;
  send(text: string) {
    this.sent.push(JSON.parse(text) as PeersMessage);
  }
  close(code: number) {
    this.closed = code;
  }
  get last() {
    return this.sent.at(-1)!;
  }
}

describe("RoomHub", () => {
  it("tells everyone who is in the room and which of them they are", () => {
    const hub = new RoomHub();
    const a = new FakeSocket();
    const b = new FakeSocket();
    hub.join(a, "a");
    hub.join(b, "b");
    expect(a.last).toEqual({
      t: "peers",
      you: "a",
      peers: [
        { peer: "a", presence: {} },
        { peer: "b", presence: {} },
      ],
    });
    expect(b.last.you).toBe("b");
  });

  it("merges patches into a player's note, and null deletes a field", () => {
    const saved: [string, unknown][] = [];
    const hub = new RoomHub((id, note) => saved.push([id, note]));
    const a = new FakeSocket();
    const b = new FakeSocket();
    hub.join(a, "a");
    hub.join(b, "b");
    hub.receive(a, JSON.stringify({ t: "presence", patch: { deck: "x", moves: [1] } }));
    hub.receive(a, JSON.stringify({ t: "presence", patch: { moves: null, applied: 3 } }));
    expect(b.last.peers.find((p) => p.peer === "a")?.presence).toEqual({ deck: "x", applied: 3 });
    expect(saved.at(-1)).toEqual(["a", { deck: "x", applied: 3 }]);
  });

  it("ignores messages that aren't patches, and notes that grow too big", () => {
    const hub = new RoomHub();
    const a = new FakeSocket();
    hub.join(a, "a");
    const before = a.sent.length;
    hub.receive(a, "not json");
    hub.receive(a, JSON.stringify({ t: "other", patch: {} }));
    hub.receive(a, JSON.stringify({ t: "presence", patch: [1] }));
    hub.receive(a, JSON.stringify({ t: "presence", patch: { big: "x".repeat(MAX_NOTE) } }));
    expect(a.sent.length).toBe(before);
  });

  it("drops a player's note when they leave", () => {
    const saved: [string, unknown][] = [];
    const hub = new RoomHub((id, note) => saved.push([id, note]));
    const a = new FakeSocket();
    const b = new FakeSocket();
    hub.join(a, "a");
    hub.join(b, "b");
    hub.leave(a);
    expect(b.last.peers).toEqual([{ peer: "b", presence: {} }]);
    expect(saved.at(-1)).toEqual(["a", null]);
  });

  it("turns players away once the room is full", () => {
    const hub = new RoomHub();
    for (let i = 0; i < MAX_PEERS; i++) expect(hub.join(new FakeSocket(), `p${i}`)).toBe(true);
    const late = new FakeSocket();
    expect(hub.join(late, "late")).toBe(false);
    expect(late.closed).toBe(4003);
  });

  it("accepts only plain room names", () => {
    expect(validRoomName("duel-ABC123")).toBe(true);
    expect(validRoomName("")).toBe(false);
    expect(validRoomName("../x")).toBe(false);
    expect(validRoomName("a".repeat(49))).toBe(false);
  });
});
