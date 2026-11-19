import type { NextFunction, Request, Response } from "express";
import type Redis from "ioredis";
import { config } from "../config";
import { AppError } from "./errors";

/** Fixed-window rate limiter. Uses Redis when available (shared across instances), memory otherwise. */
export function rateLimit(redisGetter: () => Redis | null, name: string, limit: number, windowSec: number) {
  const mem = new Map<string, { n: number; reset: number }>();
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (config.env === "test") return next();
    const key = `rl:${name}:${req.ip}`;
    try {
      const redis = redisGetter();
      let count: number;
      if (redis) {
        count = await redis.incr(key);
        if (count === 1) await redis.expire(key, windowSec);
      } else {
        const now = Date.now();
        const e = mem.get(key);
        if (!e || e.reset < now) mem.set(key, { n: 1, reset: now + windowSec * 1000 });
        else e.n++;
        count = mem.get(key)!.n;
      }
      if (count > limit) throw new AppError(429, "RATE_LIMITED", "Too many attempts, please try again in a few minutes");
      next();
    } catch (e) {
      next(e);
    }
  };
}
