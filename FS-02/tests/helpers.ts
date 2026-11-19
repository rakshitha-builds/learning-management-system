import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export class Api {
  cookie = "";
  constructor(public base: string) {}

  async req(method: string, path: string, body?: unknown, extra: RequestInit = {}) {
    const res = await fetch(this.base + path, {
      method,
      headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(this.cookie ? { cookie: this.cookie } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      ...extra,
    });
    const set = res.headers.getSetCookie();
    for (const c of set) {
      const [pair] = c.split(";");
      const [name, value] = pair.split("=");
      if (name === "cw_token") this.cookie = value ? pair : "";
    }
    const json: any = await res.json().catch(() => null);
    return { status: res.status, body: json, data: json?.data };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b?: unknown) => this.req("POST", p, b ?? {});
  patch = (p: string, b: unknown) => this.req("PATCH", p, b);
  put = (p: string, b: unknown) => this.req("PUT", p, b);
  del = (p: string) => this.req("DELETE", p);
}

export const uniqueEmail = (p = "user") => `${p}-${randomUUID().slice(0, 8)}@example.test`;
export const PASSWORD = "Sup3r-secret-pw!";

export async function registerUser(api: Api, name = "Test User") {
  const email = uniqueEmail(name.split(" ")[0].toLowerCase());
  const r = await api.post("/api/auth/register", { name, email, password: PASSWORD });
  if (r.status !== 201) throw new Error("register failed " + JSON.stringify(r.body));
  return { email, user: r.data.user };
}

export async function waitFor<T>(fn: () => T | Promise<T>, timeout = 8000, interval = 25): Promise<T> {
  const start = Date.now();
  let lastErr: unknown;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      lastErr = e;
    }
    if (Date.now() - start > timeout) throw new Error("waitFor timed out" + (lastErr ? `: ${lastErr}` : ""));
    await new Promise((r) => setTimeout(r, interval));
  }
}

export interface Peer {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  frag: Y.XmlFragment;
  closeEvents: number[];
  destroy(): void;
}

/** Connects a real y-websocket client (the same library the browser uses) to a server. */
export async function connectPeer(port: number, docId: string, wsToken: string, opts: { waitSync?: boolean } = {}): Promise<Peer> {
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(`ws://localhost:${port}/collab`, docId, ydoc, {
    params: { token: wsToken },
    WebSocketPolyfill: WebSocket as any,
    disableBc: true,
    maxBackoffTime: 200,
  });
  const closeEvents: number[] = [];
  provider.on("connection-close", (ev: CloseEvent | null) => {
    if (ev) closeEvents.push(ev.code);
  });
  if (opts.waitSync !== false) await waitFor(() => provider.synced, 8000);
  return {
    ydoc, provider, frag: ydoc.getXmlFragment("default"), closeEvents,
    destroy() {
      provider.destroy();
      ydoc.destroy();
    },
  };
}

export function addParagraph(peer: Peer, text: string, index?: number) {
  const p = new Y.XmlElement("paragraph");
  p.insert(0, [new Y.XmlText(text)]);
  peer.frag.insert(index ?? peer.frag.length, [p]);
}

export function textOf(frag: Y.XmlFragment): string[] {
  return frag.toArray().map((n: any) => n.toArray().map((t: any) => t.toString()).join(""));
}
