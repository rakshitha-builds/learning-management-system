import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import multer from "multer";
import { config } from "./config";
import { prisma } from "./db";
import type { CollabServer } from "./collab/server";
import { requireAuth } from "./lib/auth";
import { asyncHandler, badRequest, errorMiddleware, notFound } from "./lib/errors";
import { authRoutes } from "./routes/auth";
import { contentRoutes } from "./routes/content";
import { userRoutes } from "./routes/users";
import { workspaceRoutes } from "./routes/workspaces";

export interface Ctx {
  collab: CollabServer;
}

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

export function createApp(ctx: Ctx) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: config.frontendOrigins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  fs.mkdirSync(config.uploadDir, { recursive: true });
  app.use("/uploads", express.static(config.uploadDir, { fallthrough: false, index: false, maxAge: "7d" }));

  app.get("/api/health", asyncHandler(async (_req, res) => {
    let db = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {}
    const redis = await ctx.collab.bus.ping();
    res.status(db && redis ? 200 : 503).json({
      data: { status: db && redis ? "ok" : "degraded", database: db, redis: ctx.collab.bus.enabled ? redis : "disabled", instance: ctx.collab.bus.instanceId },
    });
  }));

  app.use("/api/auth", authRoutes(ctx));
  app.use("/api/users", userRoutes());
  app.use("/api/workspaces", workspaceRoutes(ctx));

  const upload = multer({
    storage: multer.diskStorage({
      destination: config.uploadDir,
      filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex") + IMAGE_TYPES[file.mimetype]),
    }),
    limits: { fileSize: config.maxUploadBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (!IMAGE_TYPES[file.mimetype]) return cb(badRequest("Only PNG, JPEG, GIF and WebP images are allowed"));
      cb(null, true);
    },
  });
  app.post("/api/uploads", requireAuth, upload.single("file"), (req, res) => {
    if (!req.file) throw badRequest("No file uploaded");
    res.status(201).json({ data: { url: `/uploads/${req.file.filename}` } });
  });

  app.use("/api", contentRoutes(ctx));
  app.use("/api", (_req, _res, next) => next(notFound("Endpoint not found")));
  app.use(errorMiddleware);
  return app;
}
