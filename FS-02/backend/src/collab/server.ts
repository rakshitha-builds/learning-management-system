import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { config } from "../config";
import { prisma } from "../db";
import { verifyToken } from "../lib/auth";
import { getDocumentAccess, getWorkspaceRole, hasRole } from "../lib/permissions";
import { Bus } from "./bus";
import { appendUpdate, applySnapshotContent, compact, createVersion, extractText, loadDoc, persistMeta, toU8 } from "./persistence";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;
const REMOTE = Symbol("remote");
const LOAD = Symbol("load");
const SERVER_EDIT = Symbol("server-edit");

const b64 = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString("base64");
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

interface Conn {
  ws: WebSocket;
  userId: string;
  readOnly: boolean;
  controlled: Set<number>;
  alive: boolean;
}

class Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns = new Map<WebSocket, Conn>();
  refs = 0; // temporary REST holders (restore/snapshot)
  pending: Uint8Array[] = [];
  flushTimer: NodeJS.Timeout | null = null;
  metaTimer: NodeJS.Timeout | null = null;
  updatesSinceCompact: number;
  dirty = false;
  closing: Promise<void> | null = null;
  channel: string;

  constructor(
    readonly id: string,
    readonly workspaceId: string,
    loaded: { doc: Y.Doc; updateCount: number },
    private owner: CollabServer
  ) {
    this.doc = loaded.doc;
    this.updatesSinceCompact = loaded.updateCount;
    this.channel = `collab:doc:${id}`;
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.awareness.setLocalState(null); // the server itself is not a participant

    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      syncProtocol.writeUpdate(enc, update);
      const msg = encoding.toUint8Array(enc);
      this.conns.forEach((c) => {
        if (c.ws !== origin) send(c.ws, msg);
      });
      if (origin === REMOTE || origin === LOAD) return;
      this.pending.push(update);
      this.dirty = true;
      this.scheduleFlush();
      this.scheduleMeta();
      this.owner.bus.publish(this.channel, { kind: "update", data: b64(update) });
    });

    this.awareness.on(
      "update",
      ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
        const conn = origin instanceof WebSocket ? this.conns.get(origin) : undefined;
        if (conn) {
          added.forEach((id) => conn.controlled.add(id));
          removed.forEach((id) => conn.controlled.delete(id));
        }
        const changed = added.concat(updated, removed);
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MSG_AWARENESS);
        encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed));
        const msg = encoding.toUint8Array(enc);
        this.conns.forEach((c) => send(c.ws, msg));
        if (origin !== REMOTE) {
          this.owner.bus.publish(this.channel, {
            kind: "awareness",
            data: b64(awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed)),
          });
        }
      }
    );
  }

  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 250);
  }

  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    try {
      await appendUpdate(this.id, batch.length === 1 ? batch[0] : Y.mergeUpdates(batch));
      this.updatesSinceCompact++;
      if (this.updatesSinceCompact >= 100) {
        this.updatesSinceCompact = 0;
        await compact(this.id);
      }
    } catch (e: any) {
      if (e?.code === "P2003" || /foreign key/i.test(String(e?.message))) return; // document was deleted meanwhile
      console.error(`[collab] failed to persist update for ${this.id}`, e);
      this.pending = batch.concat(this.pending); // retry next flush
      this.scheduleFlush();
    }
  }

  scheduleMeta() {
    if (this.metaTimer) return;
    this.metaTimer = setTimeout(() => {
      this.metaTimer = null;
      void this.flushMeta();
    }, 3000);
  }

  async flushMeta() {
    if (this.metaTimer) {
      clearTimeout(this.metaTimer);
      this.metaTimer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    try {
      await persistMeta(this.id, this.doc);
      await this.maybeAutoSnapshot();
    } catch (e) {
      console.error(`[collab] meta flush failed for ${this.id}`, e);
    }
  }

  private async maybeAutoSnapshot() {
    if (extractText(this.doc).length === 0) return;
    const last = await prisma.documentVersion.findFirst({
      where: { documentId: this.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, plainText: true },
    });
    const text = extractText(this.doc);
    if (last && (Date.now() - last.createdAt.getTime() < config.autoSnapshotMs || last.plainText === text)) return;
    await createVersion(this.id, this.doc, { auto: true, label: "Auto-saved" });
    this.owner.emit(`doc:${this.id}`, { type: "versions" });
  }

  async destroy() {
    await this.flush();
    await this.flushMeta();
    if (this.updatesSinceCompact > 0) await compact(this.id).catch(() => {});
    await this.owner.bus.unsubscribe(this.channel);
    this.awareness.destroy();
    this.doc.destroy();
  }
}

function send(ws: WebSocket, msg: Uint8Array) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(msg, (err) => {
    if (err) ws.terminate();
  });
}

export class CollabServer {
  readonly bus = new Bus();
  private rooms = new Map<string, Promise<Room>>();
  private wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 * 1024 });
  private eventsWss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  private eventSockets = new Map<WebSocket, { userId: string; topic: string; workspaceId: string }>();
  private heartbeat: NodeJS.Timeout;

  constructor() {
    void this.bus.subscribe("collab:events", (m) => this.deliverEvent(m.topic, m.payload));
    void this.bus.subscribe("collab:control", (m) => this.handleControl(m));
    this.heartbeat = setInterval(() => {
      const pingAll = (ws: WebSocket, c: { alive: boolean }) => {
        if (!c.alive) return ws.terminate();
        c.alive = false;
        ws.ping();
      };
      this.rooms.forEach(async (p) => {
        const room = await p;
        room.conns.forEach((c, ws) => pingAll(ws, c));
      });
    }, 30_000);
    this.heartbeat.unref();
  }

  // ------------------------------------------------------------------ HTTP upgrade
  attach(server: Server) {
    server.on("upgrade", (req, socket, head) => {
      this.onUpgrade(req, socket, head).catch((e) => {
        console.error("[ws] upgrade error", e);
        reject(socket, 500, "Internal Server Error");
      });
    });
  }

  private originAllowed(req: IncomingMessage) {
    const origin = req.headers.origin;
    return !origin || config.frontendOrigins.includes(origin) || config.env === "test";
  }

  private async onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!this.originAllowed(req)) return reject(socket, 403, "Forbidden origin");
    const userId = verifyToken(url.searchParams.get("token") ?? "", "ws");
    if (!userId) return reject(socket, 401, "Unauthorized");

    if (url.pathname.startsWith("/collab/")) {
      const docId = decodeURIComponent(url.pathname.slice("/collab/".length));
      const access = await getDocumentAccess(userId, docId);
      if (!access) return reject(socket, 403, "Forbidden");
      const room = await this.getRoom(docId, access.doc.workspaceId);
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.onCollabConnection(ws, room, userId, !hasRole(access.role, "EDITOR"));
      });
      return;
    }

    if (url.pathname === "/events") {
      const topic = url.searchParams.get("topic") ?? "";
      let workspaceId: string | null = null;
      if (topic.startsWith("doc:")) {
        workspaceId = (await getDocumentAccess(userId, topic.slice(4)))?.doc.workspaceId ?? null;
      } else if (topic.startsWith("ws:")) {
        workspaceId = (await getWorkspaceRole(userId, topic.slice(3))) ? topic.slice(3) : null;
      }
      if (!workspaceId) return reject(socket, 403, "Forbidden");
      this.eventsWss.handleUpgrade(req, socket, head, (ws) => {
        this.eventSockets.set(ws, { userId, topic, workspaceId: workspaceId! });
        ws.on("close", () => this.eventSockets.delete(ws));
        ws.on("error", () => ws.terminate());
      });
      return;
    }
    reject(socket, 404, "Not Found");
  }

  // ------------------------------------------------------------------ rooms
  async getRoom(docId: string, workspaceId: string): Promise<Room> {
    for (;;) {
      const existing = this.rooms.get(docId);
      if (!existing) break;
      const room = await existing;
      if (!room.closing) return room;
      await room.closing;
    }
    const promise = (async () => {
      const loaded = await loadDoc(docId, LOAD);
      if (!loaded) throw new Error("document not found");
      const room = new Room(docId, workspaceId, loaded, this);
      await this.bus.subscribe(room.channel, (m) => this.onRemoteDocMessage(room, m));
      // Ask other instances for their live state (they may hold edits not yet flushed to the DB)
      this.bus.publish(room.channel, { kind: "sync-request" });
      return room;
    })();
    this.rooms.set(docId, promise);
    promise.catch(() => this.rooms.delete(docId));
    return promise;
  }

  private onRemoteDocMessage(room: Room, m: any) {
    switch (m.kind) {
      case "update":
        Y.applyUpdate(room.doc, unb64(m.data), REMOTE);
        break;
      case "awareness":
        awarenessProtocol.applyAwarenessUpdate(room.awareness, unb64(m.data), REMOTE);
        break;
      case "sync-request": {
        this.bus.publish(room.channel, { kind: "update", data: b64(Y.encodeStateAsUpdate(room.doc)) });
        const ids = Array.from(room.awareness.getStates().keys());
        if (ids.length) {
          this.bus.publish(room.channel, {
            kind: "awareness",
            data: b64(awarenessProtocol.encodeAwarenessUpdate(room.awareness, ids)),
          });
        }
        break;
      }
    }
  }

  private async releaseIfIdle(room: Room) {
    if (room.conns.size > 0 || room.refs > 0 || room.closing) return;
    room.closing = (async () => {
      await room.destroy();
      this.rooms.delete(room.id);
    })();
    await room.closing;
  }

  /** Run `fn` with a live room for the document (used by REST endpoints: restore, snapshots). */
  async withRoom<T>(docId: string, workspaceId: string, fn: (room: Room) => Promise<T> | T): Promise<T> {
    const room = await this.getRoom(docId, workspaceId);
    room.refs++;
    try {
      return await fn(room);
    } finally {
      room.refs--;
      void this.releaseIfIdle(room);
    }
  }

  async snapshot(docId: string, workspaceId: string, label: string | null, userId: string) {
    return this.withRoom(docId, workspaceId, async (room) => {
      await room.flush();
      return createVersion(docId, room.doc, { label, userId });
    });
  }

  async restore(docId: string, workspaceId: string, snapshot: Uint8Array, userId: string) {
    return this.withRoom(docId, workspaceId, async (room) => {
      // Safety net: keep what is being replaced
      await createVersion(docId, room.doc, { label: "Before restore", auto: true, userId });
      applySnapshotContent(room.doc, toU8(snapshot), SERVER_EDIT);
      await room.flush();
      room.dirty = true;
      await room.flushMeta();
    });
  }

  // ------------------------------------------------------------------ connections
  private onCollabConnection(ws: WebSocket, room: Room, userId: string, readOnly: boolean) {
    ws.binaryType = "arraybuffer";
    const conn: Conn = { ws, userId, readOnly, controlled: new Set(), alive: true };
    room.conns.set(ws, conn);

    ws.on("pong", () => (conn.alive = true));
    ws.on("message", (data: ArrayBuffer) => {
      conn.alive = true;
      try {
        this.onCollabMessage(room, conn, new Uint8Array(data));
      } catch (e) {
        console.error("[collab] message error", e);
      }
    });
    ws.on("error", () => ws.terminate());
    ws.on("close", () => {
      room.conns.delete(ws);
      awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(conn.controlled), null);
      void this.releaseIfIdle(room);
    });

    // initial handshake: sync step 1 + current awareness
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MSG_SYNC);
    syncProtocol.writeSyncStep1(enc, room.doc);
    send(ws, encoding.toUint8Array(enc));
    const states = room.awareness.getStates();
    if (states.size > 0) {
      const aenc = encoding.createEncoder();
      encoding.writeVarUint(aenc, MSG_AWARENESS);
      encoding.writeVarUint8Array(aenc, awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys())));
      send(ws, encoding.toUint8Array(aenc));
    }
  }

  private onCollabMessage(room: Room, conn: Conn, message: Uint8Array) {
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);
    if (type === MSG_SYNC) {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC);
      const syncType = decoding.readVarUint(decoder);
      if (syncType === syncProtocol.messageYjsSyncStep1) {
        syncProtocol.readSyncStep1(decoder, enc, room.doc);
      } else if (conn.readOnly) {
        return; // viewers/commenters can never modify the document - updates are dropped
      } else if (syncType === syncProtocol.messageYjsSyncStep2) {
        syncProtocol.readSyncStep2(decoder, room.doc, conn.ws);
      } else if (syncType === syncProtocol.messageYjsUpdate) {
        syncProtocol.readUpdate(decoder, room.doc, conn.ws);
      }
      if (encoding.length(enc) > 1) send(conn.ws, encoding.toUint8Array(enc));
    } else if (type === MSG_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), conn.ws);
    }
  }

  // ------------------------------------------------------------------ events (comments, versions, doc meta, ...)
  emit(topic: string, payload: Record<string, unknown>) {
    this.deliverEvent(topic, payload);
    this.bus.publish("collab:events", { topic, payload });
  }

  private deliverEvent(topic: string, payload: unknown) {
    const msg = JSON.stringify({ topic, ...(payload as object) });
    this.eventSockets.forEach((meta, ws) => {
      if (meta.topic === topic && ws.readyState === WebSocket.OPEN) ws.send(msg);
    });
  }

  /** After a role/membership change: drop the user's live sockets so permissions are re-evaluated on reconnect. */
  async recheckUser(userId: string, workspaceId: string) {
    this.handleControl({ type: "recheck", userId, workspaceId });
    this.bus.publish("collab:control", { type: "recheck", userId, workspaceId });
  }

  private handleControl(m: { type: string; userId: string; workspaceId: string }) {
    if (m.type !== "recheck") return;
    this.rooms.forEach(async (p) => {
      const room = await p.catch(() => null);
      if (!room || room.workspaceId !== m.workspaceId) return;
      room.conns.forEach((c, ws) => {
        if (c.userId === m.userId) ws.close(4403, "permissions changed");
      });
    });
    this.eventSockets.forEach((meta, ws) => {
      if (meta.userId === m.userId && meta.workspaceId === m.workspaceId) ws.close(4403, "permissions changed");
    });
  }

  async close() {
    clearInterval(this.heartbeat);
    const rooms = await Promise.all(Array.from(this.rooms.values()).map((p) => p.catch(() => null)));
    for (const room of rooms) {
      if (!room) continue;
      room.conns.forEach((_, ws) => ws.terminate());
      await room.destroy().catch(() => {});
    }
    this.eventSockets.forEach((_, ws) => ws.terminate());
    this.wss.close();
    this.eventsWss.close();
    await this.bus.close();
  }
}

function reject(socket: Duplex, status: number, text: string) {
  socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}
