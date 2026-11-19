import Redis from "ioredis";
import { config } from "./config";

/** Creates a Redis connection, or null when REDIS_URL is not configured (single-instance mode). */
export function createRedis(name: string): Redis | null {
  if (!config.redisUrl) return null;
  const client = new Redis(config.redisUrl, { maxRetriesPerRequest: null, lazyConnect: false });
  let warned = false;
  client.on("error", (err) => {
    if (!warned) {
      console.error(`[redis:${name}] ${err.message}`);
      warned = true;
    }
  });
  client.on("ready", () => {
    warned = false;
  });
  return client;
}
