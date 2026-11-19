import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

const envFile = path.resolve(__dirname, ".env");
if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

// Tests never touch the development database: they use "<db>_test" (created automatically)
// and Redis logical DB 1.
function testDatabaseUrl() {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set. Run `npm run setup:env` first.");
  if (process.env.TEST_DATABASE_URL) return base;
  const u = new URL(base);
  u.pathname = `/${u.pathname.replace(/^\//, "")}_test`;
  return u.toString();
}
const redisBase = process.env.REDIS_URL?.trim();
const testRedis = redisBase ? redisBase.replace(/\/\d+$/, "") + "/1" : "";

process.env.TEST_DB_URL_RESOLVED = testDatabaseUrl();

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl(),
      REDIS_URL: testRedis,
      JWT_SECRET: process.env.JWT_SECRET ?? "test-secret-test-secret-test-secret",
      FRONTEND_ORIGIN: "http://localhost:3000",
      UPLOAD_DIR: path.resolve(__dirname, "tests/.tmp-uploads"),
      AUTO_SNAPSHOT_MINUTES: "10",
    },
  },
});
