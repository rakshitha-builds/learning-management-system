import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../lib/auth";
import { asyncHandler, badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { requireWorkspaceRole } from "../lib/permissions";
import type { Ctx } from "../app";

const assignableRole = z.enum(["EDITOR", "COMMENTER", "VIEWER"]);
const createSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80),
  description: z.string().trim().max(300).nullable().optional(),
  icon: z.string().trim().min(1).max(8).optional(),
});
const updateSchema = createSchema.partial();
const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address"), role: assignableRole.default("EDITOR") });

export function workspaceRoutes(ctx: Ctx) {
  const r = Router();
  r.use(requireAuth);

  r.get("/", asyncHandler(async (req, res) => {
    const rows = await prisma.workspaceMember.findMany({
      where: { userId: req.user!.id },
      orderBy: { workspace: { updatedAt: "desc" } },
      select: {
        role: true,
        workspace: { select: { id: true, name: true, description: true, icon: true, ownerId: true, updatedAt: true, _count: { select: { members: true, documents: true } } } },
      },
    });
    res.json({
      data: {
        workspaces: rows.map((m) => ({
          id: m.workspace.id, name: m.workspace.name, description: m.workspace.description, icon: m.workspace.icon,
          updatedAt: m.workspace.updatedAt, role: m.role,
          memberCount: m.workspace._count.members, documentCount: m.workspace._count.documents,
        })),
      },
    });
  }));

  r.post("/", asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    const ws = await prisma.workspace.create({
      data: { ...body, ownerId: req.user!.id, members: { create: { userId: req.user!.id, role: "OWNER" } } },
    });
    res.status(201).json({ data: { workspace: { ...ws, role: "OWNER" } } });
  }));

  r.get("/:id", asyncHandler(async (req, res) => {
    const role = await requireWorkspaceRole(req.user!.id, req.params.id, "VIEWER");
    const ws = await prisma.workspace.findUnique({
      where: { id: req.params.id },
      include: {
        members: { orderBy: { createdAt: "asc" }, select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true, color: true } } } },
        invites: role === "OWNER" ? { orderBy: { createdAt: "asc" }, select: { id: true, email: true, role: true, createdAt: true } } : false,
      },
    });
    if (!ws) throw notFound("Workspace not found");
    const { members, invites, ...workspace } = ws as any;
    res.json({
      data: {
        workspace: { ...workspace, role },
        members: members.map((m: any) => ({ userId: m.user.id, name: m.user.name, email: m.user.email, color: m.user.color, role: m.role, joinedAt: m.createdAt })),
        invites: invites ?? [],
      },
    });
  }));

  r.patch("/:id", asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.user!.id, req.params.id, "OWNER");
    const data = updateSchema.parse(req.body);
    const ws = await prisma.workspace.update({ where: { id: req.params.id }, data });
    ctx.collab.emit(`ws:${ws.id}`, { type: "workspace" });
    res.json({ data: { workspace: ws } });
  }));

  r.delete("/:id", asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.user!.id, req.params.id, "OWNER");
    await prisma.workspace.delete({ where: { id: req.params.id } });
    ctx.collab.emit(`ws:${req.params.id}`, { type: "workspace-deleted" });
    res.json({ data: { ok: true } });
  }));

  // ---- members & invitations
  r.post("/:id/members", asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.user!.id, req.params.id, "OWNER");
    const { email, role } = inviteSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const existing = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: req.params.id, userId: user.id } } });
      if (existing) throw conflict("This person is already a member of the workspace");
      await prisma.workspaceMember.create({ data: { workspaceId: req.params.id, userId: user.id, role } });
      ctx.collab.emit(`ws:${req.params.id}`, { type: "members" });
      return res.status(201).json({ data: { status: "added", member: { userId: user.id, name: user.name, email: user.email, color: user.color, role } } });
    }
    const invite = await prisma.workspaceInvite.upsert({
      where: { workspaceId_email: { workspaceId: req.params.id, email } },
      create: { workspaceId: req.params.id, email, role, invitedById: req.user!.id },
      update: { role },
      select: { id: true, email: true, role: true, createdAt: true },
    });
    ctx.collab.emit(`ws:${req.params.id}`, { type: "members" });
    res.status(201).json({ data: { status: "invited", invite } });
  }));

  r.patch("/:id/members/:userId", asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.user!.id, req.params.id, "OWNER");
    const { role } = z.object({ role: assignableRole }).parse(req.body);
    const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.userId } } });
    if (!target) throw notFound("Member not found");
    if (target.role === "OWNER") throw badRequest("The workspace owner's role cannot be changed");
    await prisma.workspaceMember.update({ where: { id: target.id }, data: { role } });
    await ctx.collab.recheckUser(target.userId, req.params.id);
    ctx.collab.emit(`ws:${req.params.id}`, { type: "members" });
    res.json({ data: { userId: target.userId, role } });
  }));

  r.delete("/:id/members/:userId", asyncHandler(async (req, res) => {
    const myRole = await requireWorkspaceRole(req.user!.id, req.params.id, "VIEWER");
    const self = req.params.userId === req.user!.id;
    if (!self && myRole !== "OWNER") throw forbidden("Only the owner can remove members");
    const target = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.userId } } });
    if (!target) throw notFound("Member not found");
    if (target.role === "OWNER") throw badRequest("The workspace owner cannot be removed. Delete the workspace instead.");
    await prisma.$transaction([
      prisma.documentPermission.deleteMany({ where: { userId: target.userId, document: { workspaceId: req.params.id } } }),
      prisma.workspaceMember.delete({ where: { id: target.id } }),
    ]);
    await ctx.collab.recheckUser(target.userId, req.params.id);
    ctx.collab.emit(`ws:${req.params.id}`, { type: "members" });
    res.json({ data: { ok: true } });
  }));

  r.delete("/:id/invites/:inviteId", asyncHandler(async (req, res) => {
    await requireWorkspaceRole(req.user!.id, req.params.id, "OWNER");
    const res2 = await prisma.workspaceInvite.deleteMany({ where: { id: req.params.inviteId, workspaceId: req.params.id } });
    if (res2.count === 0) throw notFound("Invitation not found");
    ctx.collab.emit(`ws:${req.params.id}`, { type: "members" });
    res.json({ data: { ok: true } });
  }));

  return r;
}
