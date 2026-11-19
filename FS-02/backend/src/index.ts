import { config } from "./config";
import { createServer, shutdown } from "./server";

async function main() {
  const srv = await createServer(config.port);
  console.log(`[api] listening on http://localhost:${srv.port}  (WebSocket: ws://localhost:${srv.port}/collab/:docId)`);
  console.log(`[api] redis: ${srv.collab.bus.enabled ? "enabled (multi-instance ready)" : "disabled (single instance mode)"}`);
  console.log(`[api] instance id: ${srv.collab.bus.instanceId}`);

  const stop = async () => {
    console.log("[api] shutting down...");
    await srv.stop();
    await shutdown();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
