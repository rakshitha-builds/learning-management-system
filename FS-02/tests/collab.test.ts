import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { createServer } from "../backend/src/server";
import { prisma } from "../backend/src/db";
import { Api, Peer, addParagraph, connectPeer, registerUser, textOf, waitFor } from "./helpers";

let srv: Awaited<ReturnType<typeof createServer>>;
const peers: Peer[] = [];
const track = (p: Peer) => (peers.push(p), p);

beforeAll(async () => {
  srv = await createServer(0);
});
afterAll(async () => {
  peers.forEach((p) => p.destroy());
  await srv.stop();
  await prisma.$disconnect();
});

async function scenario() {
  const base = `http://localhost:${srv.port}`;
  const [owner, editor, commenter, viewer, outsider] = [1, 2, 3, 4, 5].map(() => new Api(base));
  const users = {
    owner: await registerUser(owner, "Olive Owner"),
    editor: await registerUser(editor, "Ed Editor"),
    commenter: await registerUser(commenter, "Cam Commenter"),
    viewer: await registerUser(viewer, "Vera Viewer"),
    outsider: await registerUser(outsider, "Otis Outsider"),
  };
  const ws = (await owner.post("/api/workspaces", { name: "Collab WS" })).data.workspace;
  await owner.post(`/api/workspaces/${ws.id}/members`, { email: users.editor.email, role: "EDITOR" });
  await owner.post(`/api/workspaces/${ws.id}/members`, { email: users.commenter.email, role: "COMMENTER" });
  await owner.post(`/api/workspaces/${ws.id}/members`, { email: users.viewer.email, role: "VIEWER" });
  const doc = (await owner.post(`/api/workspaces/${ws.id}/documents`, { title: "Shared doc" })).data.document;
  const tok = async (a: Api) => (await a.get("/api/auth/ws-token")).data.token as string;
  return { owner, editor, commenter, viewer, outsider, users, ws, doc, tok, port: srv.port };
}

describe("real-time collaboration", () => {
  it("synchronises edits between two browsers instantly", async () => {
    const s = await scenario();
    const a = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    const b = track(await connectPeer(s.port, s.doc.id, await s.tok(s.editor)));
    addParagraph(a, "Hello from A");
    await waitFor(() => textOf(b.frag).includes("Hello from A"));
    addParagraph(b, "Hello from B");
    await waitFor(() => textOf(a.frag).includes("Hello from B"));
    expect(textOf(a.frag)).toEqual(textOf(b.frag));
  });

  it("merges concurrent edits without overwriting anyone's changes (CRDT)", async () => {
    const s = await scenario();
    const a = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    const b = track(await connectPeer(s.port, s.doc.id, await s.tok(s.editor)));
    addParagraph(a, "base");
    await waitFor(() => textOf(b.frag).length === 1);

    // Both users type into the SAME paragraph at the same time, plus add new paragraphs concurrently
    const ta = a.frag.get(0) as Y.XmlElement, tb = b.frag.get(0) as Y.XmlElement;
    for (let i = 0; i < 25; i++) {
      (ta.get(0) as Y.XmlText).insert(0, "A");
      (tb.get(0) as Y.XmlText).insert((tb.get(0) as Y.XmlText).length, "B");
      if (i % 5 === 0) {
        addParagraph(a, `a-par-${i}`);
        addParagraph(b, `b-par-${i}`);
      }
    }
    await waitFor(() => JSON.stringify(textOf(a.frag)) === JSON.stringify(textOf(b.frag)) && textOf(a.frag).length === 11);
    const t = textOf(a.frag);
    expect(t[0]).toBe("A".repeat(25) + "base" + "B".repeat(25));
    for (let i = 0; i < 25; i += 5) {
      expect(t).toContain(`a-par-${i}`);
      expect(t).toContain(`b-par-${i}`);
    }
  });

  it("shares live presence (cursors, names, colours) between users", async () => {
    const s = await scenario();
    const a = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    const b = track(await connectPeer(s.port, s.doc.id, await s.tok(s.editor)));
    a.provider.awareness.setLocalStateField("user", { id: s.users.owner.user.id, name: "Olive Owner", color: "#ec4899" });
    a.provider.awareness.setLocalStateField("cursor", { anchor: 3, head: 3 });
    await waitFor(() => Array.from(b.provider.awareness.getStates().values()).some((st: any) => st.user?.name === "Olive Owner" && st.cursor?.anchor === 3));
    // late joiner immediately receives existing presence
    const c = track(await connectPeer(s.port, s.doc.id, await s.tok(s.viewer)));
    await waitFor(() => Array.from(c.provider.awareness.getStates().values()).some((st: any) => st.user?.color === "#ec4899"));
    // presence disappears when a user leaves
    a.destroy();
    await waitFor(() => !Array.from(b.provider.awareness.getStates().values()).some((st: any) => st.user?.name === "Olive Owner"));
  });

  it("persists collaborative edits and restores them after everyone disconnects (refresh)", async () => {
    const s = await scenario();
    const a = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    addParagraph(a, "Persist me");
    addParagraph(a, "Me too");
    await new Promise((r) => setTimeout(r, 600)); // server flush debounce
    a.destroy();
    // wait for room teardown + compaction
    await waitFor(async () => (await prisma.document.findUnique({ where: { id: s.doc.id } }))?.ydocState != null);
    expect(await prisma.documentUpdate.count({ where: { documentId: s.doc.id } })).toBe(0); // compacted

    const b = track(await connectPeer(s.port, s.doc.id, await s.tok(s.editor)));
    expect(textOf(b.frag)).toEqual(["Persist me", "Me too"]);
    // plain-text projection is saved for previews
    await waitFor(async () => (await prisma.document.findUnique({ where: { id: s.doc.id } }))!.plainText.includes("Persist me"));
  });

  it("enforces permissions: viewers and commenters can read but never modify", async () => {
    const s = await scenario();
    const ed = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    addParagraph(ed, "Original");
    const viewer = track(await connectPeer(s.port, s.doc.id, await s.tok(s.viewer)));
    const commenter = track(await connectPeer(s.port, s.doc.id, await s.tok(s.commenter)));
    await waitFor(() => textOf(viewer.frag).includes("Original") && textOf(commenter.frag).includes("Original"));

    addParagraph(viewer, "VIEWER HACK");
    addParagraph(commenter, "COMMENTER HACK");
    await new Promise((r) => setTimeout(r, 700));
    expect(textOf(ed.frag)).toEqual(["Original"]);
    // a fresh reader also sees the clean document
    const fresh = track(await connectPeer(s.port, s.doc.id, await s.tok(s.editor)));
    expect(textOf(fresh.frag)).toEqual(["Original"]);
    // but viewers still receive live edits
    addParagraph(ed, "Live update");
    await waitFor(() => textOf(viewer.frag).includes("Live update"));
  });

  it("rejects unauthenticated, non-member and forged-token connections", async () => {
    const s = await scenario();
    const attempt = (url: string) =>
      new Promise<string>((resolve) => {
        const ws = new WebSocket(url);
        ws.on("open", () => (ws.close(), resolve("open")));
        ws.on("unexpected-response", (_req, res) => resolve(String(res.statusCode)));
        ws.on("error", () => resolve("error"));
      });
    const base = `ws://localhost:${s.port}/collab/${s.doc.id}`;
    expect(await attempt(base)).toBe("401");
    expect(await attempt(`${base}?token=garbage`)).toBe("401");
    expect(await attempt(`${base}?token=${await s.tok(s.outsider)}`)).toBe("403");
    // a session JWT (cookie token) must not be usable as a ws token
    const sessionToken = s.owner.cookie.split("=")[1];
    expect(await attempt(`${base}?token=${sessionToken}`)).toBe("401");
    expect(await attempt(`${base}?token=${await s.tok(s.owner)}`)).toBe("open");
  });

  it("applies permission changes live: demoting an editor forces a reconnect as read-only", async () => {
    const s = await scenario();
    const ed = track(await connectPeer(s.port, s.doc.id, await s.tok(s.editor)));
    const own = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    addParagraph(ed, "editor writes");
    await waitFor(() => textOf(own.frag).includes("editor writes"));

    await s.owner.patch(`/api/workspaces/${s.ws.id}/members/${s.users.editor.user.id}`, { role: "VIEWER" });
    await waitFor(() => ed.closeEvents.includes(4403));
    await waitFor(() => ed.provider.synced && ed.provider.wsconnected);
    addParagraph(ed, "after demotion");
    await new Promise((r) => setTimeout(r, 600));
    expect(textOf(own.frag)).toEqual(["editor writes"]);

    // removing the member entirely locks them out
    await s.owner.del(`/api/workspaces/${s.ws.id}/members/${s.users.editor.user.id}`);
    await waitFor(() => !ed.provider.wsconnected);
  });

  it("creates version snapshots and restores a previous version for all connected users", async () => {
    const s = await scenario();
    const a = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    const b = track(await connectPeer(s.port, s.doc.id, await s.tok(s.editor)));
    addParagraph(a, "Version one");
    await waitFor(() => textOf(b.frag).includes("Version one"));

    const v1 = (await s.owner.post(`/api/documents/${s.doc.id}/versions`, { label: "First draft" })).data.version;
    expect(v1.label).toBe("First draft");

    addParagraph(b, "Added later");
    await waitFor(() => textOf(a.frag).length === 2);
    (await s.owner.post(`/api/documents/${s.doc.id}/versions`, { label: "Second draft" })).data.version;

    const list = (await s.viewer.get(`/api/documents/${s.doc.id}/versions`)).data.versions;
    expect(list.map((v: any) => v.label)).toEqual(expect.arrayContaining(["First draft", "Second draft"]));
    const detail = (await s.viewer.get(`/api/versions/${v1.id}`)).data.version;
    expect(detail.plainText).toBe("Version one");
    expect(detail).not.toHaveProperty("snapshot");

    // viewers cannot snapshot or restore
    expect((await s.viewer.post(`/api/documents/${s.doc.id}/versions`, {})).status).toBe(403);
    expect((await s.viewer.post(`/api/versions/${v1.id}/restore`)).status).toBe(403);
    expect((await s.outsider.get(`/api/versions/${v1.id}`)).status).toBe(404);

    expect((await s.owner.post(`/api/versions/${v1.id}/restore`)).status).toBe(200);
    await waitFor(() => JSON.stringify(textOf(a.frag)) === JSON.stringify(["Version one"]) && JSON.stringify(textOf(b.frag)) === JSON.stringify(["Version one"]));

    // the pre-restore state was preserved, so nothing is lost
    const after = (await s.owner.get(`/api/documents/${s.doc.id}/versions`)).data.versions;
    expect(after.some((v: any) => v.label === "Before restore")).toBe(true);

    // restored content persists
    a.destroy(); b.destroy();
    await new Promise((r) => setTimeout(r, 500));
    const c = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    expect(textOf(c.frag)).toEqual(["Version one"]);
  });

  it("restores rich formatting exactly (numeric attributes such as heading level survive)", async () => {
    const s = await scenario();
    const a = track(await connectPeer(s.port, s.doc.id, await s.tok(s.owner)));
    // Same node shapes TipTap produces: heading{level:2}, orderedList{start:3}, bold mark
    const h = new Y.XmlElement("heading");
    h.setAttribute("level", 2 as any);
    h.insert(0, [new Y.XmlText("Title")]);
    const ol = new Y.XmlElement("orderedList");
    ol.setAttribute("start", 3 as any);
    const li = new Y.XmlElement("listItem");
    const para = new Y.XmlElement("paragraph");
    const txt = new Y.XmlText();
    txt.insert(0, "bold item", { bold: {} });
    para.insert(0, [txt]);
    li.insert(0, [para]);
    ol.insert(0, [li]);
    a.frag.insert(0, [h, ol]);
    await new Promise((r) => setTimeout(r, 500));
    const v = (await s.owner.post(`/api/documents/${s.doc.id}/versions`, { label: "rich" })).data.version;
    a.frag.delete(0, a.frag.length);
    addParagraph(a, "replacement");
    await waitFor(() => textOf(a.frag).includes("replacement"));
    await new Promise((r) => setTimeout(r, 400));
    expect((await s.owner.post(`/api/versions/${v.id}/restore`)).status).toBe(200);
    await waitFor(() => a.frag.length === 2);
    const rh = a.frag.get(0) as Y.XmlElement;
    const rol = a.frag.get(1) as Y.XmlElement;
    expect(rh.nodeName).toBe("heading");
    expect(rh.getAttribute("level")).toBe(2);
    expect(rol.getAttribute("start")).toBe(3);
    const rtxt = ((rol.get(0) as Y.XmlElement).get(0) as Y.XmlElement).get(0) as Y.XmlText;
    expect(rtxt.toDelta()).toEqual([{ insert: "bold item", attributes: { bold: {} } }]);
  });

  it("pushes comment events to connected clients over the events socket", async () => {
    const s = await scenario();
    const token = await s.tok(s.viewer);
    const ws = new WebSocket(`ws://localhost:${s.port}/events?topic=doc:${s.doc.id}&token=${token}`);
    const msgs: any[] = [];
    ws.on("message", (d) => msgs.push(JSON.parse(d.toString())));
    await new Promise((r) => ws.on("open", r));
    await s.commenter.post(`/api/documents/${s.doc.id}/comments`, { body: "ping" });
    await waitFor(() => msgs.some((m) => m.type === "comments"));
    ws.close();
    // outsiders cannot subscribe
    const bad = new WebSocket(`ws://localhost:${s.port}/events?topic=doc:${s.doc.id}&token=${await s.tok(s.outsider)}`);
    expect(await new Promise((r) => bad.on("unexpected-response", (_q, res) => r(res.statusCode)))).toBe(403);
  });
});
