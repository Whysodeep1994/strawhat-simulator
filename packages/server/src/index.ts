/**
 * The Strawhat Simulator website on Cloudflare: the built game (served as static files by the
 * ASSETS binding) and a relay for Play a Friend at /rooms/<name>.
 *
 * Each game room is a Durable Object holding a RoomHub. It uses WebSocket hibernation, so a quiet
 * room costs nothing while both players think; notes are kept in storage to survive that sleep.
 */
import { DurableObject } from "cloudflare:workers";
import { RoomHub, validRoomName, type Note, type Socket } from "./hub.js";

interface Env {
  ASSETS: Fetcher;
  ROOMS: DurableObjectNamespace<DuelRoom>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/rooms") {
      // The app asks this to learn that online play works here.
      return Response.json({ relay: "strawhat", version: 1 });
    }
    if (url.pathname.startsWith("/rooms/")) {
      const name = decodeURIComponent(url.pathname.slice("/rooms/".length));
      if (!validRoomName(name)) return new Response("Bad room name", { status: 400 });
      if (request.headers.get("Upgrade") !== "websocket")
        return new Response("Expected a WebSocket", { status: 426 });
      return env.ROOMS.get(env.ROOMS.idFromName(name)).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class DuelRoom extends DurableObject<Env> {
  private hub: RoomHub;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.hub = new RoomHub((id, note) => {
      if (note) void this.ctx.storage.put(`p:${id}`, note);
      else void this.ctx.storage.delete(`p:${id}`);
    });
    // After hibernation the object starts fresh; bring back the players still connected.
    ctx.blockConcurrencyWhile(async () => {
      const notes = await ctx.storage.list<Note>({ prefix: "p:" });
      const live = new Set<string>();
      for (const ws of ctx.getWebSockets()) {
        const id = (ws.deserializeAttachment() as { id?: string } | null)?.id;
        if (!id) continue;
        live.add(id);
        this.hub.restore(ws as Socket, id, notes.get(`p:${id}`) ?? {});
      }
      // Notes of players whose connections ended while the room slept.
      const stale = [...notes.keys()].filter((key) => !live.has(key.slice(2)));
      if (stale.length) await ctx.storage.delete(stale);
    });
  }

  override async fetch(): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const id = crypto.randomUUID();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id });
    this.hub.join(server as Socket, id);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message === "string") this.hub.receive(ws as Socket, message);
  }

  override async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    this.hub.leave(ws as Socket);
    try {
      ws.close(code === 1005 ? 1000 : code, "Bye");
    } catch {
      // Already closed.
    }
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    this.hub.leave(ws as Socket);
  }
}
