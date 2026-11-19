import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

/** Creates (if needed) and resets the test database by applying the real migration SQL files. */
export default async function setup() {
  const url = new URL(process.env.TEST_DB_URL_RESOLVED!);
  const dbName = url.pathname.slice(1);
  const admin = new URL(url.toString());
  admin.pathname = "/postgres";
  const a = new Client({ connectionString: admin.toString() });
  await a.connect();
  const exists = await a.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) await a.query(`CREATE DATABASE "${dbName}"`);
  await a.end();

  const c = new Client({ connectionString: url.toString() });
  await c.connect();
  await c.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const dir = path.resolve(__dirname, "../prisma/migrations");
  for (const m of fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()).sort()) {
    await c.query(fs.readFileSync(path.join(dir, m, "migration.sql"), "utf8"));
  }
  await c.end();

  const redisUrl = process.env.REDIS_URL;
  fs.rmSync(path.resolve(__dirname, ".tmp-uploads"), { recursive: true, force: true });
  void redisUrl;
}
