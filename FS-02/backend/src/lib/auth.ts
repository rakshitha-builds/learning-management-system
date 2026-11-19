import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { COOKIE_NAME, config } from "../config";
import { prisma } from "../db";
import { unauthorized } from "./errors";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  color: string;
  bio: string | null;
  createdAt: Date;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export const userSelect = { id: true, email: true, name: true, color: true, bio: true, createdAt: true } as const;

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function signSessionToken(userId: string) {
  return jwt.sign({ sub: userId, typ: "session" }, config.jwtSecret, { expiresIn: config.jwtExpiresIn as any });
}

/** Token for authenticating WebSocket connections (collab + events). Cannot be used for REST. */
export function signWsToken(userId: string) {
  return jwt.sign({ sub: userId, typ: "ws" }, config.jwtSecret, { expiresIn: "24h" });
}

export function verifyToken(token: string, typ: "session" | "ws"): string | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    if (payload.typ !== typ || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: config.cookieSecure, path: "/" });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined;
    const token = req.cookies?.[COOKIE_NAME] ?? bearer;
    if (!token) throw unauthorized();
    const userId = verifyToken(token, "session");
    if (!userId) throw unauthorized("Session expired, please sign in again");
    const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) throw unauthorized("Account no longer exists");
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#3b82f6"];
export const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
