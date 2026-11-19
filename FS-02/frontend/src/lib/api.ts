export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, json?.error?.code ?? "ERROR", json?.error?.message ?? `Request failed (${res.status})`, json?.error?.details);
  }
  return json?.data as T;
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Cannot reach the server. Check your connection and that the backend is running.");
  }
  return parse<T>(res);
}

export async function uploadImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "same-origin" });
  return (await parse<{ url: string }>(res)).url;
}

let wsTokenCache: { token: string; at: number } | null = null;
export async function getWsToken(): Promise<string> {
  if (wsTokenCache && Date.now() - wsTokenCache.at < 6 * 60 * 60 * 1000) return wsTokenCache.token;
  const { token } = await api<{ token: string }>("/api/auth/ws-token");
  wsTokenCache = { token, at: Date.now() };
  return token;
}
export const clearWsToken = () => (wsTokenCache = null);

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000";
