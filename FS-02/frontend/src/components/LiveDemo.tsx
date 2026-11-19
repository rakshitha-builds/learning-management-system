"use client";
import { useEffect, useState } from "react";
import { History, MessageSquare, Share2 } from "lucide-react";

type Line = { by: "aisha" | "mateo"; text: string; tag?: "h" | "li" };
const SCRIPT: Line[] = [
  { by: "aisha", tag: "h", text: "Launch plan 🚀" },
  { by: "aisha", text: "Goal: ship real-time editing to every customer this quarter." },
  { by: "mateo", tag: "li", text: "Finalize the sync engine benchmarks" },
  { by: "aisha", tag: "li", text: "Invite 10 design partners" },
  { by: "mateo", tag: "li", text: "Publish the public changelog" },
];
const USERS = {
  aisha: { name: "Aisha", color: "#ec4899" },
  mateo: { name: "Mateo", color: "#10b981" },
};

export default function LiveDemo() {
  const [typed, setTyped] = useState<number[]>(SCRIPT.map(() => 0));
  const [active, setActive] = useState(0);
  const [comment, setComment] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(SCRIPT.map((l) => l.text.length)); setActive(-1); setComment(true);
      return;
    }
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      while (!cancelled) {
        setTyped(SCRIPT.map(() => 0)); setComment(false); setActive(0);
        for (let i = 0; i < SCRIPT.length && !cancelled; i++) {
          setActive(i);
          for (let c = 1; c <= SCRIPT[i].text.length && !cancelled; c++) {
            setTyped((t) => t.map((v, k) => (k === i ? c : v)));
            await wait(SCRIPT[i].tag === "h" ? 70 : 38);
          }
          if (i === 2) setComment(true);
          await wait(350);
        }
        setActive(-1);
        await wait(4200);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const lastLineOf = (u: "aisha" | "mateo") => SCRIPT.map((l, i) => (l.by === u && typed[i] > 0 ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
  const typing = active >= 0 ? SCRIPT[active].by : null;

  const Cursor = ({ u }: { u: "aisha" | "mateo" }) => (
    <span className="relative ml-px inline-block h-[1.15em] w-0.5 translate-y-[3px] align-baseline" style={{ background: USERS[u].color }}>
      <span className="absolute -top-5 left-0 whitespace-nowrap rounded-md rounded-bl-none px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow" style={{ background: USERS[u].color }}>{USERS[u].name}</span>
    </span>
  );

  return (
    <div className="card relative overflow-hidden shadow-[0_30px_80px_-20px_rgba(79,70,229,.35)] ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50/80 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-300" /><span className="h-3 w-3 rounded-full bg-amber-300" /><span className="h-3 w-3 rounded-full bg-emerald-300" />
        <span className="ml-3 truncate text-xs font-medium text-ink-500">Product roadmap · Q4</span>
        <span className="ml-3 hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
        </span>
        <div className="ml-auto flex items-center gap-3">
          {typing && <span className="hidden text-xs font-medium text-ink-500 md:inline">{USERS[typing].name} is editing…</span>}
          <div className="flex -space-x-2">
            {(["aisha", "mateo"] as const).map((u) => (
              <span key={u} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white" style={{ background: USERS[u].color }}>{USERS[u].name[0]}</span>
            ))}
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-ink-100 text-[10px] font-bold text-ink-700">+3</span>
          </div>
          <span className="hidden items-center gap-1 text-ink-500 sm:flex"><MessageSquare className="h-4 w-4" /><History className="h-4 w-4" /><Share2 className="h-4 w-4" /></span>
        </div>
      </div>
      <div className="grid sm:grid-cols-[1fr_250px]">
        <div className="min-h-[300px] space-y-2.5 p-6 text-left sm:p-9">
          {SCRIPT.map((l, i) => {
            const shown = l.text.slice(0, typed[i]);
            const showCursor = typed[i] > 0 && (i === active || i === lastLineOf(l.by));
            if (typed[i] === 0 && i !== active) return null;
            const content = <>{shown}{showCursor && <Cursor u={l.by} />}</>;
            if (l.tag === "h") return <h3 key={i} className="text-2xl font-extrabold tracking-tight">{content}</h3>;
            if (l.tag === "li") return <div key={i} className="flex gap-2.5 text-[15px] text-ink-700"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-500" /><span>{content}</span></div>;
            return <p key={i} className="text-[15px] leading-7 text-ink-700">{content}</p>;
          })}
        </div>
        <aside className="hidden border-l border-stone-100 bg-stone-50/70 p-4 sm:block">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">Comments</p>
          <div className={`space-y-2 transition-all duration-500 ${comment ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
            <div className="rounded-xl border border-stone-200 bg-white p-3 text-[13px] shadow-sm">
              <p className="text-xs font-semibold" style={{ color: USERS.aisha.color }}>Aisha · just now</p>
              <p className="mt-1 text-ink-700">Can we add a target date for the benchmarks?</p>
            </div>
            <div className="ml-4 rounded-xl border border-stone-200 bg-white p-3 text-[13px] shadow-sm">
              <p className="text-xs font-semibold" style={{ color: USERS.mateo.color }}>Mateo · just now</p>
              <p className="mt-1 text-ink-700">Yes — Nov 28 ✅</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
