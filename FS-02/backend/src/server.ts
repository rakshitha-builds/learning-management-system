import http from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "./app";
import { CollabServer } from "./collab/server";
import { config } from "./config";
import { prisma } from "./db";

/** Builds the HTTP + WebSocket server. Exported so tests can run several instances in one process. */
export async function createServer(port = config.port) {
  const collab = new CollabServer();
  const app = createApp({ collab });
  const server = http.createServer(app);
  collab.attach(server);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const actualPort = (server.address() as AddressInfo).port;
  return {
    port: actualPort,
    collab,
    async stop() {
      await collab.close();
      await new Promise<void>((r) => server.close(() => r()));
      server.closeAllConnections?.();
    },
  };
}

export async function shutdown() {
  await prisma.$disconnect();
}
