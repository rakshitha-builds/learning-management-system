import Link from "next/link";
import { ArrowRight, Check, History, MessageSquare, Server, ShieldCheck, Users, Zap } from "lucide-react";
import { Logo } from "@/components/ui";
import LiveDemo from "@/components/LiveDemo";

const features = [
  { icon: Zap, title: "Instant sync", text: "Edits show up on every screen in milliseconds, powered by Yjs CRDTs. Concurrent typing never overwrites anyone.", grad: "from-amber-400 to-orange-500" },
  { icon: Users, title: "Live presence", text: "See who is here, where their cursor is and who is typing right now — with names and colours.", grad: "from-pink-500 to-rose-500" },
  { icon: MessageSquare, title: "Comments & replies", text: "Discuss any passage in threads, resolve conversations and keep feedback next to the work.", grad: "from-sky-400 to-blue-600" },
  { icon: History, title: "Version history", text: "Automatic and manual snapshots. Preview an old version and restore it in one click — nothing is lost.", grad: "from-emerald-400 to-teal-600" },
  { icon: ShieldCheck, title: "Granular permissions", text: "Owner, editor, commenter and viewer roles per workspace, with per-page overrides enforced on the server.", grad: "from-violet-500 to-purple-700" },
  { icon: Server, title: "Built to scale", text: "Redis pub/sub keeps multiple WebSocket servers in sync, so you can scale out without losing real-time.", grad: "from-slate-600 to-slate-900" },
];
const steps = [
  { n: "1", title: "Create a workspace", text: "Give your team a home and invite people by email with the right role." },
  { n: "2", title: "Write together", text: "Open a page, start typing and watch teammates' cursors move in real time." },
  { n: "3", title: "Review & roll back", text: "Comment in threads, save versions and restore any earlier state instantly." },
];
const stats = [
  { v: "50", l: "simultaneous editors load-tested" },
  { v: "0", l: "lost edits in 49,000 deliveries" },
  { v: "4", l: "permission roles, enforced server-side" },
  { v: "∞", l: "backend instances via Redis" },
];
const stack = ["Next.js", "TypeScript", "Yjs CRDT", "TipTap", "WebSockets", "PostgreSQL", "Prisma", "Redis", "Tailwind CSS"];

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      {/* animated aurora background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[900px] overflow-hidden" aria-hidden>
        <div className="absolute -left-24 -top-24 h-[480px] w-[480px] animate-drift rounded-full bg-brand-300/40 blur-3xl" />
        <div className="absolute right-0 top-10 h-[420px] w-[420px] animate-drift rounded-full bg-pink-300/40 blur-3xl [animation-delay:-5s]" />
        <div className="absolute left-1/3 top-40 h-[380px] w-[380px] animate-drift rounded-full bg-sky-300/30 blur-3xl [animation-delay:-9s]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_72%)]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/40 bg-stone-50/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Logo className="text-lg" />
          <nav className="hidden items-center gap-7 text-sm font-medium text-ink-700 md:flex">
            <a href="#features" className="hover:text-ink-900">Features</a>
            <a href="#how" className="hover:text-ink-900">How it works</a>
            <a href="#stack" className="hover:text-ink-900">Tech</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-white/70">Sign in</Link>
            <Link href="/register" className="rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Get started</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-5 pb-12 pt-14 text-center sm:pt-20">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white/80 px-3.5 py-1 text-xs font-semibold text-brand-700 shadow-sm backdrop-blur">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
          Real-time collaboration, built on CRDTs
        </span>
        <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl">
          Write together.<br /><span className="gradient-text">Think faster.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-ink-500">
          A calm, fast workspace where teams edit the same page at once, see each other&apos;s cursors, discuss in comments and never lose a single change.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-brand-500 to-brand-600 px-7 text-base font-semibold text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-600 hover:to-brand-700">
            Create your workspace <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center rounded-xl border border-stone-200 bg-white px-7 text-base font-semibold shadow-sm transition hover:bg-stone-50">Sign in</Link>
        </div>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-ink-500">
          {["Free to run locally", "No lock-in", "Open standards (Yjs, ProseMirror)"].map((t) => <span key={t} className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-emerald-500" />{t}</span>)}
        </p>
      </section>

      <section className="relative mx-auto max-w-5xl px-5 pb-8">
        <div className="absolute -inset-x-4 -inset-y-6 -z-10 rounded-[2rem] bg-gradient-to-b from-brand-200/50 via-pink-200/30 to-transparent blur-2xl" aria-hidden />
        <LiveDemo />
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l} className="rounded-2xl border border-stone-200 bg-white/80 p-5 text-center shadow-card backdrop-blur">
              <p className="gradient-text text-4xl font-extrabold tracking-tight">{s.v}</p>
              <p className="mt-1 text-xs leading-5 text-ink-500">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand-600">Features</p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight sm:text-4xl">Everything a team needs to work in sync</h2>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-pop">
              <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${f.grad} opacity-0 blur-2xl transition duration-500 group-hover:opacity-25`} />
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${f.grad} text-white shadow-lg`}><f.icon className="h-6 w-6" /></span>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-500">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-16">
        <p className="text-center text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
        <h2 className="mt-2 text-center text-3xl font-bold tracking-tight sm:text-4xl">From idea to shared doc in three steps</h2>
        <div className="relative mt-12 grid gap-8 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-6 hidden h-px bg-gradient-to-r from-transparent via-brand-300 to-transparent md:block" aria-hidden />
          {steps.map((s) => (
            <div key={s.n} className="relative text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-brand-500/30 ring-4 ring-stone-50">{s.n}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-ink-500">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="stack" className="mx-auto max-w-4xl scroll-mt-20 px-5 py-14 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Under the hood</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">Built on proven open technology</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {stack.map((t) => <span key={t} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-700">{t}</span>)}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 pb-20 pt-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-violet-600 to-pink-500 px-6 py-14 text-center text-white shadow-pop sm:px-12">
          <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-white/15 blur-2xl" aria-hidden />
          <div className="absolute -bottom-16 -right-10 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">Ready to write together?</h2>
          <p className="relative mx-auto mt-3 max-w-lg text-white/85">Create a workspace, invite your team, and see every cursor move in real time.</p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 font-semibold text-brand-700 shadow-lg transition hover:bg-stone-100">Get started free <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/login" className="inline-flex h-12 items-center rounded-xl border border-white/40 px-7 font-semibold text-white transition hover:bg-white/10">Sign in</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 text-sm text-ink-500 sm:flex-row">
          <Logo />
          <p>Built with Next.js, TipTap, Yjs, Prisma, PostgreSQL and Redis.</p>
        </div>
      </footer>
    </div>
  );
}
