/**
 * Load / stress test: N simulated editors collaborate on ONE document, spread over one or more backend instances.
 * Measures end-to-end propagation latency (writer -> every other client) and throughput.
 *
 *   BACKENDS=http://localhost:4000,http://localhost:4001 CLIENTS=40 EDITS=30 npm run load-test
 *
 * Start the backends first (npm run dev:backend, npm run dev:backend2). With Redis configured the instances
 * relay updates to each other; the more instances you list, the more cross-instance traffic is measured.
 * Optional realistic payload: put a plain-text file (e.g. a Project Gutenberg book) at SAMPLE_TEXT=path.
 */
import fs from "node:fs";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const BACKENDS = (process.env.BACKENDS ?? "http://localhost:4000").split(",");
const CLIENTS = Number(process.env.CLIENTS ?? 20);
const EDITS = Number(process.env.EDITS ?? 25);
const INTERVAL = Number(process.env.INTERVAL_MS ?? 150); // delay between a client's edits
const sample = process.env.SAMPLE_TEXT && fs.existsSync(process.env.SAMPLE_TEXT) ? fs.readFileSync(process.env.SAMPLE_TEXT, "utf8") : null;

async function call(base: string, method: string, path: string, body?: unknown, cookie?: string) {
  const res = await fetch(base + path, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return { json: json.data, cookie: res.headers.getSetCookie()[0]?.split(";")[0] };
}
const pct = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] ?? 0;

async function main() {
  const email = `load-${Date.now()}@example.test`;
  const reg = await call(BACKENDS[0], "POST", "/api/auth/register", { name: "Load Tester", email, password: "load-test-password" });
  const ws = (await call(BACKENDS[0], "POST", "/api/workspaces", { name: "Load test" }, reg.cookie)).json.workspace;
  const doc = (await call(BACKENDS[0], "POST", `/api/workspaces/${ws.id}/documents`, { title: "Load test doc" }, reg.cookie)).json.document;
  const token = (await call(BACKENDS[0], "GET", "/api/auth/ws-token", undefined, reg.cookie)).json.token as string;

  const latencies: number[] = [];
  let received = 0;
  const clients: { ydoc: Y.Doc; provider: WebsocketProvider; arr: Y.Array<any> }[] = [];
  const t0 = Date.now();
  for (let i = 0; i < CLIENTS; i++) {
    const base = BACKENDS[i % BACKENDS.length].replace(/^http/, "ws");
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(`${base}/collab`, doc.id, ydoc, { params: { token }, WebSocketPolyfill: WebSocket as any, disableBc: true });
    const arr = ydoc.getArray<any>("load");
    arr.observe((ev, tr) => {
      if (tr.local) return;
      const now = Date.now();
      ev.changes.added.forEach((item) => item.content.getContent().forEach((c: any) => { if (Array.isArray(c)) { latencies.push(now - c[2]); received++; } }));
    });
    clients.push({ ydoc, provider, arr });
  }
  await Promise.all(clients.map((c) => new Promise<void>((r) => (c.provider.synced ? r() : c.provider.once("sync", () => r())))));
  const connectMs = Date.now() - t0;

  const start = Date.now();
  await Promise.all(clients.map(async (c, i) => {
    await new Promise((r) => setTimeout(r, Math.random() * INTERVAL));
    for (let n = 0; n < EDITS; n++) {
      const payload = sample ? sample.slice((i * 997 + n * 61) % Math.max(1, sample.length - 80)).slice(0, 80) : "lorem ipsum dolor sit amet ".repeat(3);
      c.arr.push([[i, n, Date.now(), payload]]);
      await new Promise((r) => setTimeout(r, INTERVAL));
    }
  }));
  const writeMs = Date.now() - start;

  const expected = CLIENTS * EDITS * (CLIENTS - 1);
  // wait for convergence
  const deadline = Date.now() + 20_000;
  while (received < expected && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  const lens = new Set(clients.map((c) => c.arr.length));
  const converged = lens.size === 1 && clients[0].arr.length === CLIENTS * EDITS;

  const result = {
    backends: BACKENDS.length, clients: CLIENTS, editsPerClient: EDITS, totalEdits: CLIENTS * EDITS,
    connectAllMs: connectMs, writePhaseMs: writeMs,
    editsPerSecond: Math.round((CLIENTS * EDITS) / (writeMs / 1000)),
    deliveries: `${received}/${expected}`,
    latencyMs: { p50: pct(latencies, 50), p95: pct(latencies, 95), p99: pct(latencies, 99), max: Math.max(...latencies, 0) },
    allClientsConverged: converged,
  };
  console.log(JSON.stringify(result, null, 2));
  clients.forEach((c) => { c.provider.destroy(); c.ydoc.destroy(); });
  process.exit(converged && received === expected ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
