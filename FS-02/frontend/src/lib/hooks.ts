"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getWsToken, WS_URL } from "./api";

/** Tiny data-fetching hook: { data, error, loading, reload }. */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const seq = useRef(0);

  const reload = useCallback(async (silent = true) => {
    const my = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const d = await fetchRef.current();
      if (my === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e instanceof ApiError ? e : new ApiError(0, "ERROR", String(e)));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setData(null);
    void reload(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

/** Subscribes to server push events (comments, versions, documents, members...) for a topic like "doc:<id>" or "ws:<id>". */
export function useEvents(topic: string | null, onEvent: (e: { type: string }) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  useEffect(() => {
    if (!topic) return;
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const connect = async () => {
      try {
        const token = await getWsToken();
        if (closed) return;
        ws = new WebSocket(`${WS_URL}/events?topic=${encodeURIComponent(topic)}&token=${encodeURIComponent(token)}`);
        ws.onopen = () => { if (attempt > 0) handler.current({ type: "reconnected" }); attempt = 0; };
        ws.onmessage = (m) => { try { handler.current(JSON.parse(m.data)); } catch {} };
        ws.onclose = () => { if (!closed) retry = setTimeout(connect, Math.min(10000, 500 * 2 ** attempt++)); };
      } catch {
        if (!closed) retry = setTimeout(connect, Math.min(10000, 500 * 2 ** attempt++));
      }
    };
    void connect();
    return () => { closed = true; clearTimeout(retry); ws?.close(); };
  }, [topic]);
}

export function useDebouncedCallback<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...a: A) => { clearTimeout(t.current); t.current = setTimeout(() => ref.current(...a), ms); }, [ms]);
}
