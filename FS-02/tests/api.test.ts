import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../backend/src/server";
import { prisma } from "../backend/src/db";
import { Api, PASSWORD, registerUser, uniqueEmail } from "./helpers";

let srv: Awaited<ReturnType<typeof createServer>>;
let base: string;
const newApi = () => new Api(base);

beforeAll(async () => {
  srv = await createServer(0);
  base = `http://localhost:${srv.port}`;
});
afterAll(async () => {
  await srv.stop();
  await prisma.$disconnect();
});

describe("health", () => {
  it("reports database + redis status", async () => {
    const r = await newApi().get("/api/health");
    expect(r.status).toBe(200);
    expect(r.data.database).toBe(true);
  });
});

describe("authentication", () => {
  it("registers, hashes the password, and signs the user in", async () => {
    const api = newApi();
    const { email, user } = await registerUser(api, "Alice Anderson");
    expect(user.email).toBe(email);
    expect(user).not.toHaveProperty("passwordHash");
    const row = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(row.passwordHash).not.toContain(PASSWORD);
    expect(row.passwordHash.startsWith("$2")).toBe(true); // bcrypt
    expect((await api.get("/api/auth/me")).data.user.id).toBe(user.id);
  });

  it("rejects duplicate emails, weak passwords and invalid emails", async () => {
    const api = newApi();
    const { email } = await registerUser(api, "Dup User");
    expect((await newApi().post("/api/auth/register", { name: "x", email, password: PASSWORD })).status).toBe(409);
    const weak = await newApi().post("/api/auth/register", { name: "x", email: uniqueEmail(), password: "short" });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe("VALIDATION_ERROR");
    expect((await newApi().post("/api/auth/register", { name: "x", email: "nope", password: PASSWORD })).status).toBe(400);
  });

  it("logs in with correct credentials only, and logs out", async () => {
    const a = newApi();
    const { email } = await registerUser(a, "Login User");
    const api = newApi();
    expect((await api.post("/api/auth/login", { email, password: "wrong-password" })).status).toBe(401);
    expect((await api.post("/api/auth/login", { email: uniqueEmail("ghost"), password: PASSWORD })).status).toBe(401);
    expect((await api.post("/api/auth/login", { email: email.toUpperCase(), password: PASSWORD })).status).toBe(200);
    expect((await api.get("/api/auth/me")).status).toBe(200);
    await api.post("/api/auth/logout");
    expect((await api.get("/api/auth/me")).status).toBe(401);
  });

  it("protects every API route without a session", async () => {
    const api = newApi();
    for (const p of ["/api/workspaces", "/api/auth/ws-token", "/api/documents/x", "/api/documents/x/comments"]) {
      expect((await api.get(p)).status).toBe(401);
    }
    expect((await api.post("/api/uploads")).status).toBe(401);
  });

  it("updates the profile and changes the password", async () => {
    const api = newApi();
    const { email } = await registerUser(api, "Profile User");
    const r = await api.patch("/api/users/me", { name: "New Name", bio: "Hello", color: "#ff0000" });
    expect(r.data.user).toMatchObject({ name: "New Name", bio: "Hello", color: "#ff0000" });
    expect((await api.patch("/api/users/me", { color: "red" })).status).toBe(400);
    expect((await api.post("/api/users/me/password", { currentPassword: "nope", newPassword: "another-long-pw" })).status).toBe(400);
    expect((await api.post("/api/users/me/password", { currentPassword: PASSWORD, newPassword: "another-long-pw" })).status).toBe(200);
    const fresh = newApi();
    expect((await fresh.post("/api/auth/login", { email, password: PASSWORD })).status).toBe(401);
    expect((await fresh.post("/api/auth/login", { email, password: "another-long-pw" })).status).toBe(200);
  });
});

describe("workspaces, members and documents", () => {
  it("full workspace lifecycle with role-based access", async () => {
    const owner = newApi(), editor = newApi(), commenter = newApi(), viewer = newApi(), outsider = newApi();
    const o = await registerUser(owner, "Olivia Owner");
    const e = await registerUser(editor, "Eddie Editor");
    const c = await registerUser(commenter, "Cora Commenter");
    const v = await registerUser(viewer, "Vic Viewer");
    await registerUser(outsider, "Otto Outsider");

    const ws = (await owner.post("/api/workspaces", { name: "Team Space", icon: "🚀" })).data.workspace;
    expect(ws.role).toBe("OWNER");
    expect((await owner.post("/api/workspaces", { name: "" })).status).toBe(400);

    // invite: existing users are added immediately
    expect((await owner.post(`/api/workspaces/${ws.id}/members`, { email: e.email, role: "EDITOR" })).data.status).toBe("added");
    await owner.post(`/api/workspaces/${ws.id}/members`, { email: c.email, role: "COMMENTER" });
    await owner.post(`/api/workspaces/${ws.id}/members`, { email: v.email, role: "VIEWER" });
    expect((await owner.post(`/api/workspaces/${ws.id}/members`, { email: e.email, role: "EDITOR" })).status).toBe(409);
    expect((await editor.post(`/api/workspaces/${ws.id}/members`, { email: uniqueEmail(), role: "EDITOR" })).status).toBe(403);

    // outsider cannot see anything
    expect((await outsider.get(`/api/workspaces/${ws.id}`)).status).toBe(404);
    expect((await outsider.get(`/api/workspaces/${ws.id}/documents`)).status).toBe(404);

    // documents: editors create, commenters/viewers cannot
    const doc = (await editor.post(`/api/workspaces/${ws.id}/documents`, { title: "Roadmap" })).data.document;
    expect(doc.title).toBe("Roadmap");
    expect((await commenter.post(`/api/workspaces/${ws.id}/documents`, { title: "x" })).status).toBe(403);
    expect((await viewer.post(`/api/workspaces/${ws.id}/documents`, { title: "x" })).status).toBe(403);
    expect((await viewer.get(`/api/documents/${doc.id}`)).data.document.role).toBe("VIEWER");
    expect((await outsider.get(`/api/documents/${doc.id}`)).status).toBe(404);
    expect((await viewer.patch(`/api/documents/${doc.id}`, { title: "hack" })).status).toBe(403);
    expect((await editor.patch(`/api/documents/${doc.id}`, { title: "Roadmap 2027", icon: "🗺️" })).data.document.title).toBe("Roadmap 2027");
    const list = (await viewer.get(`/api/workspaces/${ws.id}/documents`)).data.documents;
    expect(list.map((d: any) => d.title)).toContain("Roadmap 2027");

    // workspace settings: owner only
    expect((await editor.patch(`/api/workspaces/${ws.id}`, { name: "Hacked" })).status).toBe(403);
    expect((await owner.patch(`/api/workspaces/${ws.id}`, { name: "Team Space 2" })).data.workspace.name).toBe("Team Space 2");

    // role change + removal
    expect((await owner.patch(`/api/workspaces/${ws.id}/members/${v.user.id}`, { role: "EDITOR" })).status).toBe(200);
    expect((await viewer.post(`/api/workspaces/${ws.id}/documents`, { title: "Now allowed" })).status).toBe(201);
    expect((await owner.patch(`/api/workspaces/${ws.id}/members/${o.user.id}`, { role: "VIEWER" })).status).toBe(400); // owner immutable
    expect((await owner.del(`/api/workspaces/${ws.id}/members/${e.user.id}`)).status).toBe(200);
    expect((await editor.get(`/api/documents/${doc.id}`)).status).toBe(404);
    expect((await owner.del(`/api/workspaces/${ws.id}/members/${o.user.id}`)).status).toBe(400);

    // members can leave
    expect((await commenter.del(`/api/workspaces/${ws.id}/members/${c.user.id}`)).status).toBe(200);

    // delete document + workspace
    expect((await owner.del(`/api/documents/${doc.id}`)).status).toBe(200);
    expect((await owner.get(`/api/documents/${doc.id}`)).status).toBe(404);
    expect((await viewer.del(`/api/workspaces/${ws.id}`)).status).toBe(403);
    expect((await owner.del(`/api/workspaces/${ws.id}`)).status).toBe(200);
    expect((await owner.get(`/api/workspaces/${ws.id}`)).status).toBe(404);
  });

  it("turns invitations for unregistered emails into memberships on sign-up", async () => {
    const owner = newApi();
    await registerUser(owner, "Inviter");
    const ws = (await owner.post("/api/workspaces", { name: "Invite WS" })).data.workspace;
    const email = uniqueEmail("newbie");
    const inv = await owner.post(`/api/workspaces/${ws.id}/members`, { email, role: "COMMENTER" });
    expect(inv.data.status).toBe("invited");
    expect((await owner.get(`/api/workspaces/${ws.id}`)).data.invites).toHaveLength(1);
    const nb = newApi();
    const reg = await nb.post("/api/auth/register", { name: "Newbie", email, password: PASSWORD });
    expect(reg.status).toBe(201);
    const list = (await nb.get("/api/workspaces")).data.workspaces;
    expect(list.find((w: any) => w.id === ws.id)?.role).toBe("COMMENTER");
    expect((await owner.get(`/api/workspaces/${ws.id}`)).data.invites).toHaveLength(0);
  });

  it("supports per-document permission overrides", async () => {
    const owner = newApi(), member = newApi();
    await registerUser(owner, "Perm Owner");
    const m = await registerUser(member, "Perm Member");
    const ws = (await owner.post("/api/workspaces", { name: "Perm WS" })).data.workspace;
    await owner.post(`/api/workspaces/${ws.id}/members`, { email: m.email, role: "EDITOR" });
    const doc = (await owner.post(`/api/workspaces/${ws.id}/documents`, { title: "Locked" })).data.document;
    const other = (await owner.post(`/api/workspaces/${ws.id}/documents`, { title: "Open" })).data.document;
    expect((await member.get(`/api/documents/${doc.id}`)).data.document.role).toBe("EDITOR");
    expect((await member.get(`/api/documents/${doc.id}/permissions`)).status).toBe(403);

    expect((await owner.put(`/api/documents/${doc.id}/permissions/${m.user.id}`, { role: "VIEWER" })).status).toBe(200);
    expect((await member.get(`/api/documents/${doc.id}`)).data.document.role).toBe("VIEWER");
    expect((await member.patch(`/api/documents/${doc.id}`, { title: "nope" })).status).toBe(403);
    expect((await member.get(`/api/documents/${other.id}`)).data.document.role).toBe("EDITOR"); // other docs unaffected
    const perms = (await owner.get(`/api/documents/${doc.id}/permissions`)).data.permissions;
    expect(perms.find((p: any) => p.userId === m.user.id)).toMatchObject({ workspaceRole: "EDITOR", override: "VIEWER", effectiveRole: "VIEWER" });

    await owner.del(`/api/documents/${doc.id}/permissions/${m.user.id}`);
    expect((await member.get(`/api/documents/${doc.id}`)).data.document.role).toBe("EDITOR");
  });
});

describe("comments", () => {
  it("adds, replies, resolves and deletes with proper authorization", async () => {
    const owner = newApi(), commenter = newApi(), viewer = newApi();
    await registerUser(owner, "Cmt Owner");
    const c = await registerUser(commenter, "Cmt Commenter");
    const v = await registerUser(viewer, "Cmt Viewer");
    const ws = (await owner.post("/api/workspaces", { name: "Cmt WS" })).data.workspace;
    await owner.post(`/api/workspaces/${ws.id}/members`, { email: c.email, role: "COMMENTER" });
    await owner.post(`/api/workspaces/${ws.id}/members`, { email: v.email, role: "VIEWER" });
    const doc = (await owner.post(`/api/workspaces/${ws.id}/documents`, {})).data.document;

    const top = (await commenter.post(`/api/documents/${doc.id}/comments`, { body: "First!", quote: "some text" })).data.comment;
    expect(top.author.name).toBe("Cmt Commenter");
    expect(top.createdAt).toBeTruthy();
    expect((await viewer.post(`/api/documents/${doc.id}/comments`, { body: "viewer cannot" })).status).toBe(403);
    expect((await commenter.post(`/api/documents/${doc.id}/comments`, { body: "   " })).status).toBe(400);

    const reply = (await owner.post(`/api/documents/${doc.id}/comments`, { body: "Thanks", parentId: top.id })).data.comment;
    expect((await owner.post(`/api/documents/${doc.id}/comments`, { body: "nested", parentId: reply.id })).status).toBe(400);

    const list = (await viewer.get(`/api/documents/${doc.id}/comments`)).data.comments;
    expect(list).toHaveLength(1);
    expect(list[0].replies).toHaveLength(1);
    expect(list[0].quote).toBe("some text");

    expect((await viewer.patch(`/api/comments/${top.id}`, { resolved: true })).status).toBe(403);
    expect((await owner.patch(`/api/comments/${top.id}`, { body: "edited by owner" })).status).toBe(403);
    expect((await commenter.patch(`/api/comments/${top.id}`, { body: "edited", resolved: true })).data.comment.resolved).toBe(true);

    expect((await viewer.del(`/api/comments/${top.id}`)).status).toBe(403);
    expect((await commenter.del(`/api/comments/${reply.id}`)).status).toBe(403); // not the author
    expect((await owner.del(`/api/comments/${reply.id}`)).status).toBe(200); // owner may moderate
    expect((await commenter.del(`/api/comments/${top.id}`)).status).toBe(200);
    expect((await viewer.get(`/api/documents/${doc.id}/comments`)).data.comments).toHaveLength(0);
  });
});

describe("uploads", () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

  it("accepts images and rejects other file types", async () => {
    const api = newApi();
    await registerUser(api, "Uploader");
    const fd = new FormData();
    fd.append("file", new Blob([png], { type: "image/png" }), "pixel.png");
    const ok = await api.req("POST", "/api/uploads", undefined, { body: fd });
    expect(ok.status).toBe(201);
    const img = await fetch(base + ok.data.url);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toContain("image/png");

    const bad = new FormData();
    bad.append("file", new Blob(["<script>alert(1)</script>"], { type: "text/html" }), "x.html");
    expect((await api.req("POST", "/api/uploads", undefined, { body: bad })).status).toBe(400);
    const svg = new FormData();
    svg.append("file", new Blob(["<svg onload=alert(1)/>"], { type: "image/svg+xml" }), "x.svg");
    expect((await api.req("POST", "/api/uploads", undefined, { body: svg })).status).toBe(400);
  });
});

describe("error handling", () => {
  it("returns structured errors for unknown routes and malformed JSON", async () => {
    const api = newApi();
    await registerUser(api, "Err User");
    const nf = await api.get("/api/nope");
    expect(nf.status).toBe(404);
    expect(nf.body.error.code).toBe("NOT_FOUND");
    const bad = await fetch(base + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
    expect(bad.status).toBe(400);
  });
});
