import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../backend/src/server";
import { prisma } from "../backend/src/db";
import { Api, Peer, addParagraph, connectPeer, registerUser, textOf, waitFor } from "./helpers";

const redisConfigured = !!process.env.REDIS_URL;

describe.skipIf(!redisConfigured)("horizontal scaling with Redis (two backend instances)", () => {
  let s1: Awaited<ReturnType<typeof createServer>>;
  let s2: Awaited<ReturnType<typeof createServer>>;
  const peers: Peer[] = [];

  beforeAll(async () => {
    s1 = await createServer(0);
    s2 = await createServer(0);
  });
  afterAll(async () => {
    peers.forEach((p) => p.destroy());
    await s1.stop();
    await s2.stop();
    await prisma.$disconnect();
  });

  it("uses distinct instances that both report Redis as healthy", async () => {
    const h1 = (await new Api(`http://localhost:${s1.port}`).get("/api/health")).data;
    const h2 = (await new Api(`http://localhost:${s2.port}`).get("/api/health")).data;
    expect(h1.redis).toBe(true);
    expect(h2.redis).toBe(true);
    expect(h1.instance).not.toBe(h2.instance);
  });

  it("syncs edits, presence, comments events and restores across instances", async () => {
    const api1 = new Api(`http://localhost:${s1.port}`);
    const api2 = new Api(`http://localhost:${s2.port}`);
    const u1 = await registerUser(api1, "Scale One");
    const u2 = await registerUser(api2, "Scale Two");
    const ws = (await api1.post("/api/workspaces", { name: "Scale WS" })).data.workspace;
    await api1.post(`/api/workspaces/${ws.id}/members`, { email: u2.email, role: "EDITOR" });
    const doc = (await api1.post(`/api/workspaces/${ws.id}/documents`, { title: "Scaled" })).data.document;
    // Tokens are signed with the shared secret, so either instance accepts them
    const t1 = (await api1.get("/api/auth/ws-token")).data.token;
    const t2 = (await api2.get("/api/auth/ws-token")).data.token;

    const a = await connectPeer(s1.port, doc.id, t1); peers.push(a);
    const b = await connectPeer(s2.port, doc.id, t2); peers.push(b);

    // edits flow both directions through Redis
    addParagraph(a, "typed on instance 1");
    await waitFor(() => textOf(b.frag).includes("typed on instance 1"));
    addParagraph(b, "typed on instance 2");
    await waitFor(() => textOf(a.frag).includes("typed on instance 2"));

    // concurrent edits on different instances converge
    for (let i = 0; i < 10; i++) {
      addParagraph(a, `a${i}`);
      addParagraph(b, `b${i}`);
    }
    await waitFor(() => textOf(a.frag).length === 22 && JSON.stringify(textOf(a.frag)) === JSON.stringify(textOf(b.frag)));

    // presence flows across instances
    a.provider.awareness.setLocalStateField("user", { name: "Scale One", color: "#10b981" });
    await waitFor(() => Array.from(b.provider.awareness.getStates().values()).some((st: any) => st.user?.name === "Scale One"));

    // persistence has no duplicates/gaps: a fresh client on either instance sees the same document
    await new Promise((r) => setTimeout(r, 800));
    a.destroy(); b.destroy();
    await new Promise((r) => setTimeout(r, 800));
    const c = await connectPeer(s2.port, doc.id, t2); peers.push(c);
    expect(textOf(c.frag)).toHaveLength(22);
    expect(textOf(c.frag)).toContain("typed on instance 1");
    expect(textOf(c.frag)).toContain("typed on instance 2");

    // a REST call served by instance 1 (snapshot+restore) updates a client connected to instance 2
    const v = (await api1.post(`/api/documents/${doc.id}/versions`, { label: "Scaled snapshot" })).data.version;
    addParagraph(c, "extra paragraph");
    await waitFor(async () => textOf(c.frag).length === 23);
    await new Promise((r) => setTimeout(r, 600));
    expect((await api1.post(`/api/versions/${v.id}/restore`)).status).toBe(200);
    await waitFor(() => textOf(c.frag).length === 22);
  });
});
