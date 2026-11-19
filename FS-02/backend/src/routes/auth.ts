import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import {
  clearSessionCookie, hashPassword, randomColor, requireAuth, setSessionCookie, signSessionToken, signWsToken,
  userSelect, verifyPassword,
} from "../lib/auth";
import { asyncHandler, conflict, unauthorized } from "../lib/errors";
import { rateLimit } from "../lib/rateLimit";
import type { Ctx } from "../app";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").max(128),
});

export function authRoutes(ctx: Ctx) {
  const r = Router();
  const limiter = rateLimit(() => ctx.collab.bus.redis, "auth", 30, 15 * 60);

  r.post("/register", limiter, asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    if (await prisma.user.findUnique({ where: { email: body.email } })) throw conflict("An account with this email already exists");
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password), color: randomColor() },
        select: userSelect,
      });
      // Turn pending invitations for this email into memberships
      const invites = await tx.workspaceInvite.findMany({ where: { email: body.email } });
      for (const inv of invites) {
        await tx.workspaceMember.create({ data: { workspaceId: inv.workspaceId, userId: u.id, role: inv.role } });
      }
      await tx.workspaceInvite.deleteMany({ where: { email: body.email } });
      return u;
    });
    setSessionCookie(res, signSessionToken(user.id));
    res.status(201).json({ data: { user } });
  }));

  r.post("/login", limiter, asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const row = await prisma.user.findUnique({ where: { email: body.email } });
    // Same error for unknown email / wrong password
    if (!row || !(await verifyPassword(body.password, row.passwordHash))) throw unauthorized("Incorrect email or password");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: row.id }, select: userSelect });
    setSessionCookie(res, signSessionToken(user.id));
    res.json({ data: { user } });
  }));

  r.post("/logout", (_req, res) => {
    clearSessionCookie(res);
    res.json({ data: { ok: true } });
  });

  r.get("/me", requireAuth, (req, res) => res.json({ data: { user: req.user } }));

  r.get("/ws-token", requireAuth, (req, res) => res.json({ data: { token: signWsToken(req.user!.id) } }));

  return r;
}
