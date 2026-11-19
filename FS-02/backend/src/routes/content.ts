import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../lib/auth";
import { asyncHandler, badRequest, forbidden, notFound } from "../lib/errors";
import { getDocumentAccess, hasRole, requireDocumentRole, requireWorkspaceRole } from "../lib/permissions";
import type { Ctx } from "../app";

const docCreate = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  icon: z.string().trim().min(1).max(8).optional(),
});
const docUpdate = docCreate.partial();
const commentCreate = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
  parentId: z.string().optional(),
  quote: z.string().trim().max(500).optional(),
});
const commentUpdate = z.object({
  body: z.string().trim().min(1).max(2000).optional(),
  resolved: z.boolean().optional(),
});
const authorSelect = { select: { id: true, name: true, color: true } } as const;

export function contentRoutes(ctx: Ctx) {
  const r = Router();
  r.use(requireAuth);

  // ------------------------------------------------------------------ documents
  r.get("/workspaces/:wid/documents", asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.user!.id, req.params.wid, "VIEWER");
    const docs = await prisma.document.findMany({
      where: { workspaceId: req.params.wid },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, icon: true, plainText: true, createdAt: true, updatedAt: true, createdBy: { select: { id: true, name: true } } },
    });
    res.json({ data: { documents: docs.map(({ plainText, ...d }) => ({ ...d, preview: plainText.slice(0, 140) })) } });
  }));

  r.post("/workspaces/:wid/documents", asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.user!.id, req.params.wid, "EDITOR");
    const body = docCreate.parse(req.body);
    const doc = await prisma.document.create({
      data: { workspaceId: req.params.wid, createdById: req.user!.id, ...body },
      select: { id: true, title: true, icon: true, workspaceId: true, createdAt: true, updatedAt: true },
    });
    ctx.collab.emit(`ws:${req.params.wid}`, { type: "documents" });
    res.status(201).json({ data: { document: doc } });
  }));

  r.get("/documents/:id", asyncHandler(async (req, res) => {
    const access = await getDocumentAccess(req.user!.id, req.params.id);
    if (!access) throw notFound("Document not found");
    const ws = await prisma.workspace.findUnique({ where: { id: access.doc.workspaceId }, select: { id: true, name: true, icon: true } });
    res.json({ data: { document: { ...access.doc, role: access.role, workspace: ws } } });
  }));

  r.patch("/documents/:id", asyncHandler(async (req, res) => {
    const access = await requireDocumentRole(req.user!.id, req.params.id, "EDITOR");
    const data = docUpdate.parse(req.body);
    const doc = await prisma.document.update({
      where: { id: req.params.id }, data,
      select: { id: true, title: true, icon: true, updatedAt: true },
    });
    ctx.collab.emit(`doc:${doc.id}`, { type: "meta" });
    ctx.collab.emit(`ws:${access.doc.workspaceId}`, { type: "documents" });
    res.json({ data: { document: doc } });
  }));

  r.delete("/documents/:id", asyncHandler(async (req, res) => {
    const access = await requireDocumentRole(req.user!.id, req.params.id, "EDITOR");
    if (access.role !== "OWNER" && access.doc.createdById !== req.user!.id) throw forbidden("Only the workspace owner or the page creator can delete this page");
    await prisma.document.delete({ where: { id: req.params.id } });
    ctx.collab.emit(`doc:${req.params.id}`, { type: "deleted" });
    ctx.collab.emit(`ws:${access.doc.workspaceId}`, { type: "documents" });
    res.json({ data: { ok: true } });
  }));

  // ------------------------------------------------------------------ per-document permissions
  r.get("/documents/:id/permissions", asyncHandler(async (req, res) => {
    const access = await requireDocumentRole(req.user!.id, req.params.id, "OWNER");
    const [members, overrides] = await Promise.all([
      prisma.workspaceMember.findMany({ where: { workspaceId: access.doc.workspaceId }, select: { role: true, user: { select: { id: true, name: true, email: true, color: true } } } }),
      prisma.documentPermission.findMany({ where: { documentId: req.params.id } }),
    ]);
    const byUser = new Map(overrides.map((o) => [o.userId, o.role]));
    res.json({
      data: {
        permissions: members.map((m) => ({
          userId: m.user.id, name: m.user.name, email: m.user.email, color: m.user.color,
          workspaceRole: m.role, override: byUser.get(m.user.id) ?? null,
          effectiveRole: m.role === "OWNER" ? "OWNER" : byUser.get(m.user.id) ?? m.role,
        })),
      },
    });
  }));

  r.put("/documents/:id/permissions/:userId", asyncHandler(async (req, res) => {
    const access = await requireDocumentRole(req.user!.id, req.params.id, "OWNER");
    const { role } = z.object({ role: z.enum(["EDITOR", "COMMENTER", "VIEWER"]) }).parse(req.body);
    const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: access.doc.workspaceId, userId: req.params.userId } } });
    if (!member) throw notFound("That user is not a member of this workspace");
    if (member.role === "OWNER") throw badRequest("The workspace owner always has full access");
    await prisma.documentPermission.upsert({
      where: { documentId_userId: { documentId: req.params.id, userId: req.params.userId } },
      create: { documentId: req.params.id, userId: req.params.userId, role },
      update: { role },
    });
    await ctx.collab.recheckUser(req.params.userId, access.doc.workspaceId);
    ctx.collab.emit(`doc:${req.params.id}`, { type: "permissions" });
    res.json({ data: { userId: req.params.userId, role } });
  }));

  r.delete("/documents/:id/permissions/:userId", asyncHandler(async (req, res) => {
    const access = await requireDocumentRole(req.user!.id, req.params.id, "OWNER");
    await prisma.documentPermission.deleteMany({ where: { documentId: req.params.id, userId: req.params.userId } });
    await ctx.collab.recheckUser(req.params.userId, access.doc.workspaceId);
    ctx.collab.emit(`doc:${req.params.id}`, { type: "permissions" });
    res.json({ data: { ok: true } });
  }));

  // ------------------------------------------------------------------ comments
  r.get("/documents/:id/comments", asyncHandler(async (req, res) => {
    await requireDocumentRole(req.user!.id, req.params.id, "VIEWER");
    const comments = await prisma.comment.findMany({
      where: { documentId: req.params.id, parentId: null },
      orderBy: { createdAt: "asc" },
      include: { author: authorSelect, replies: { orderBy: { createdAt: "asc" }, include: { author: authorSelect } } },
    });
    res.json({ data: { comments } });
  }));

  r.post("/documents/:id/comments", asyncHandler(async (req, res) => {
    await requireDocumentRole(req.user!.id, req.params.id, "COMMENTER");
    const body = commentCreate.parse(req.body);
    if (body.parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: body.parentId } });
      if (!parent || parent.documentId !== req.params.id) throw notFound("Comment to reply to was not found");
      if (parent.parentId) throw badRequest("Replies cannot be nested more than one level deep");
    }
    const comment = await prisma.comment.create({
      data: { documentId: req.params.id, authorId: req.user!.id, body: body.body, parentId: body.parentId, quote: body.parentId ? undefined : body.quote },
      include: { author: authorSelect, replies: true },
    });
    ctx.collab.emit(`doc:${req.params.id}`, { type: "comments" });
    res.status(201).json({ data: { comment } });
  }));

  async function loadComment(userId: string, id: string) {
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment) throw notFound("Comment not found");
    const access = await getDocumentAccess(userId, comment.documentId);
    if (!access) throw notFound("Comment not found");
    return { comment, access };
  }

  r.patch("/comments/:id", asyncHandler(async (req, res) => {
    const { comment, access } = await loadComment(req.user!.id, req.params.id);
    const data = commentUpdate.parse(req.body);
    if (data.body !== undefined && comment.authorId !== req.user!.id) throw forbidden("You can only edit your own comments");
    if (!hasRole(access.role, "COMMENTER")) throw forbidden();
    const updated = await prisma.comment.update({ where: { id: comment.id }, data, include: { author: authorSelect } });
    ctx.collab.emit(`doc:${comment.documentId}`, { type: "comments" });
    res.json({ data: { comment: updated } });
  }));

  r.delete("/comments/:id", asyncHandler(async (req, res) => {
    const { comment, access } = await loadComment(req.user!.id, req.params.id);
    if (comment.authorId !== req.user!.id && access.role !== "OWNER") throw forbidden("You can only delete your own comments");
    await prisma.comment.delete({ where: { id: comment.id } });
    ctx.collab.emit(`doc:${comment.documentId}`, { type: "comments" });
    res.json({ data: { ok: true } });
  }));

  // ------------------------------------------------------------------ version history
  r.get("/documents/:id/versions", asyncHandler(async (req, res) => {
    await requireDocumentRole(req.user!.id, req.params.id, "VIEWER");
    const versions = await prisma.documentVersion.findMany({
      where: { documentId: req.params.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, label: true, title: true, auto: true, createdAt: true, createdBy: { select: { id: true, name: true, color: true } } },
    });
    res.json({ data: { versions } });
  }));

  r.post("/documents/:id/versions", asyncHandler(async (req, res) => {
    const access = await requireDocumentRole(req.user!.id, req.params.id, "EDITOR");
    const { label } = z.object({ label: z.string().trim().max(100).optional() }).parse(req.body ?? {});
    const version = await ctx.collab.snapshot(req.params.id, access.doc.workspaceId, label || null, req.user!.id);
    ctx.collab.emit(`doc:${req.params.id}`, { type: "versions" });
    res.status(201).json({ data: { version } });
  }));

  async function loadVersion(userId: string, id: string, min: "VIEWER" | "EDITOR") {
    const version = await prisma.documentVersion.findUnique({ where: { id } });
    if (!version) throw notFound("Version not found");
    const access = await requireDocumentRole(userId, version.documentId, min);
    return { version, access };
  }

  r.get("/versions/:id", asyncHandler(async (req, res) => {
    const { version } = await loadVersion(req.user!.id, req.params.id, "VIEWER");
    const { snapshot, ...rest } = version;
    res.json({ data: { version: rest } });
  }));

  r.post("/versions/:id/restore", asyncHandler(async (req, res) => {
    const { version, access } = await loadVersion(req.user!.id, req.params.id, "EDITOR");
    await ctx.collab.restore(version.documentId, access.doc.workspaceId, version.snapshot, req.user!.id);
    ctx.collab.emit(`doc:${version.documentId}`, { type: "versions" });
    res.json({ data: { ok: true } });
  }));

  return r;
}
