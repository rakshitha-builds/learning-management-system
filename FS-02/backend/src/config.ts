import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// backend/src -> ../../.env  and  backend/dist -> ../../.env  (repo root)
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env (or run "npm run setup:env").`
    );
  }
  return v;
}

const portArg = process.argv.find((a) => a.startsWith("--port="));

export const config = {
  env: process.env.NODE_ENV ?? "development",
  port: Number(portArg?.split("=")[1] ?? process.env.BACKEND_PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL?.trim() || "",
  jwtSecret: (() => {
    const s = required("JWT_SECRET");
    if (s.length < 16) throw new Error("JWT_SECRET must be at least 16 characters long.");
    return s;
  })(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === "true",
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "./uploads"),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 5) * 1024 * 1024,
  autoSnapshotMs: Number(process.env.AUTO_SNAPSHOT_MINUTES ?? 10) * 60 * 1000,
};

export const COOKIE_NAME = "cw_token";
