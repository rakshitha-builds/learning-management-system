"use client";
import { useEffect, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { WS_URL } from "@/lib/api";

export interface Session { ydoc: Y.Doc; provider: WebsocketProvider }

/** Creates the Yjs document + WebSocket provider for a page and tears them down on unmount. */
export function useCollabSession(docId: string, token: string | null): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!token) return;
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(`${WS_URL}/collab`, docId, ydoc, { params: { token } });
    setSession({ ydoc, provider });
    return () => {
      provider.destroy();
      ydoc.destroy();
      setSession(null);
    };
  }, [docId, token]);
  return session;
}
