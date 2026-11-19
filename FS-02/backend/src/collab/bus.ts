import crypto from "node:crypto";
import type Redis from "ioredis";
import { createRedis } from "../redis";

type Handler = (msg: any) => void;

/**
 * Thin pub/sub layer. With Redis configured, messages fan out to every backend instance.
 * Without Redis it degrades gracefully to a single-instance (no-op) bus.
 */
export class Bus {
  readonly instanceId = crypto.randomUUID();
  private pub: Redis | null;
  private sub: Redis | null;
  private handlers = new Map<string, Handler>();

  constructor() {
    this.pub = createRedis("pub");
    this.sub = createRedis("sub");
    this.sub?.on("message", (channel: string, raw: string) => {
      const h = this.handlers.get(channel);
      if (!h) return;
      try {
        const msg = JSON.parse(raw);
        if (msg.from === this.instanceId) return;
        h(msg);
      } catch (e) {
        console.error("[bus] bad message", e);
      }
    });
  }

  get enabled() {
    return !!this.pub;
  }

  get redis() {
    return this.pub;
  }

  async subscribe(channel: string, handler: Handler) {
    this.handlers.set(channel, handler);
    await this.sub?.subscribe(channel);
  }

  async unsubscribe(channel: string) {
    this.handlers.delete(channel);
    await this.sub?.unsubscribe(channel).catch(() => {});
  }

  publish(channel: string, msg: Record<string, unknown>) {
    if (!this.pub) return;
    this.pub.publish(channel, JSON.stringify({ ...msg, from: this.instanceId })).catch((e) => {
      console.error("[bus] publish failed", e.message);
    });
  }

  async ping(): Promise<boolean> {
    if (!this.pub) return true;
    try {
      return (await this.pub.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  async close() {
    this.handlers.clear();
    await Promise.allSettled([this.pub?.quit(), this.sub?.quit()]);
  }
}
