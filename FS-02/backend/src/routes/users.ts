import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { hashPassword, requireAuth, userSelect, verifyPassword } from "../lib/auth";
import { asyncHandler, badRequest } from "../lib/errors";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(300).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex value like #6366f1").optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export function userRoutes() {
  const r = Router();
  r.use(requireAuth);

  r.patch("/me", asyncHandler(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user!.id }, data, select: userSelect });
    res.json({ data: { user } });
  }));

  r.post("/me/password", asyncHandler(async (req, res) => {
    const body = passwordSchema.parse(req.body);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await verifyPassword(body.currentPassword, row.passwordHash))) throw badRequest("Current password is incorrect");
    await prisma.user.update({ where: { id: row.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
    res.json({ data: { ok: true } });
  }));

  return r;
}
