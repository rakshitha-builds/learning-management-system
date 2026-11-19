"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "./utils";

interface Toast { id: number; kind: "success" | "error"; text: string }
const Ctx = createContext<{ success(t: string): void; error(t: string): void }>({ success() {}, error() {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);
  const value = useMemo(() => ({ success: (t: string) => push("success", t), error: (t: string) => push("error", t) }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
            className={cn("pointer-events-auto flex max-w-sm animate-slideIn items-start gap-2.5 rounded-xl border bg-white px-4 py-3 text-sm shadow-pop",
              t.kind === "error" ? "border-red-200" : "border-emerald-200")}>
            {t.kind === "error" ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />}
            <span className="text-ink-900">{t.text}</span>
            <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="ml-1 text-ink-500 hover:text-ink-900" aria-label="Dismiss"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
