// Prisma 7 configuration. The schema + migrations live in ../prisma (repository root).
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Load the root .env (works whether Prisma is run from /backend or the repo root via npm workspaces)
for (const p of [path.resolve(process.cwd(), "../.env"), path.resolve(process.cwd(), ".env")]) {
  if (fs.existsSync(p)) dotenv.config({ path: p });
}

export default defineConfig({
  schema: "../prisma/schema.prisma",
  migrations: { path: "../prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
