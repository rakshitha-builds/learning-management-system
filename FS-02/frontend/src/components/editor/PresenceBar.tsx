"use client";
import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui";
import type { Session } from "./session";

interface Presence { id: string; name: string; color: string; typingAt: number; tabs: number }

export function usePresence(provider: Session["provider"], meId: string) {
  const [states, setStates] = useState<Array<[number, any]>>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const aw = provider.awareness;
    const update = () => setStates(Array.from(aw.getStates().entries()));
    update();
    aw.on("change", update);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { aw.off("change", update); clearInterval(t); };
  }, [provider]);
  return useMemo(() => {
    const byUser = new Map<string, Presence>();
    for (const [, s] of states) {
      const u = s?.user;
      if (!u?.id) continue;
      const prev = byUser.get(u.id);
      byUser.set(u.id, { id: u.id, name: u.name, color: u.color, typingAt: Math.max(prev?.typingAt ?? 0, s.typingAt ?? 0), tabs: (prev?.tabs ?? 0) + 1 });
    }
    const all = Array.from(byUser.values());
    const others = all.filter((p) => p.id !== meId);
    const typing = others.filter((p) => now - p.typingAt < 3000);
    return { others, typing, total: all.length, now };
  }, [states, now, meId]);
}

export default function PresenceBar({ provider, me }: { provider: Session["provider"]; me: { id: string; name: string; color: string } }) {
  const { others, typing, now } = usePresence(provider, me.id);
  const shown = others.slice(0, 4);
  const extra = others.length - shown.length;
  return (
    <div className="flex items-center gap-3" aria-label="People viewing this page">
      {typing.length > 0 && (
        <span className="hidden items-center gap-1.5 text-xs font-medium text-ink-500 md:flex" aria-live="polite">
          <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: `${i * 120}ms` }} />)}</span>
          {typing.length === 1 ? `${typing[0].name.split(" ")[0]} is editing` : `${typing.length} people are editing`}
        </span>
      )}
      <div className="flex items-center -space-x-2">
        {shown.map((p) => (
          <div key={p.id} className="relative" title={`${p.name}${now - p.typingAt < 3000 ? " (editing)" : ""}`}>
            <Avatar name={p.name} color={p.color} size={30} ring={now - p.typingAt < 3000 ? "#10b981" : undefined} />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
        ))}
        {extra > 0 && <span className="z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-700 ring-2 ring-white">+{extra}</span>}
        <div className="relative z-10" title="You"><Avatar name={me.name} color={me.color} size={30} /></div>
      </div>
    </div>
  );
}
