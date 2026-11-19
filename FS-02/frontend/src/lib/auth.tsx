"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError, clearWsToken } from "./api";
import type { User } from "./types";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  setUser(u: User): void;
}
const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(async (e) => {
        if (e instanceof ApiError && e.status === 401) await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {}); // clear stale cookie
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const d = await api<{ user: User }>("/api/auth/login", { body: { email, password } });
    setUser(d.user);
  }, []);
  const register = useCallback(async (name: string, email: string, password: string) => {
    const d = await api<{ user: User }>("/api/auth/register", { body: { name, email, password } });
    setUser(d.user);
  }, []);
  const logout = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {});
    clearWsToken();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</Ctx.Provider>;
}
