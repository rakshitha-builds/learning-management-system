"use client";
import Link from "next/link";
import { FileText, Plus, Users } from "lucide-react";
import { useShell } from "@/components/Shell";
import { Badge, EmptyState, Skeleton } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const { workspaces, openNewWorkspace } = useShell();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const totalPages = workspaces?.reduce((n, w) => n + w.documentCount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn px-5 py-8 sm:px-8 sm:py-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-violet-600 to-pink-500 p-7 text-white shadow-pop sm:p-9">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/15 blur-2xl" aria-hidden />
        <div className="absolute -bottom-12 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <h1 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">{greeting}, {user?.name.split(" ")[0]} 👋</h1>
        <p className="relative mt-1.5 text-white/85">Pick up where you left off or start something new.</p>
        <div className="relative mt-6 grid max-w-lg grid-cols-3 gap-3">
          {[["Workspaces", workspaces?.length ?? "–"], ["Pages", workspaces ? totalPages : "–"], ["Teammates", workspaces ? workspaces.reduce((n, w) => n + w.memberCount - 1, 0) : "–"]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl border border-white/25 bg-white/15 px-4 py-3 backdrop-blur"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-white/80">{l}</p></div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your workspaces</h2>
      </div>

      {!workspaces ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
      ) : workspaces.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="🗂️" title="Create your first workspace" text="Workspaces hold your pages and your team. Invite teammates and edit together in real time."
            action={<button onClick={openNewWorkspace} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><Plus className="h-4 w-4" /> New workspace</button>} />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <Link key={w.id} href={`/w/${w.id}`} className="card group relative overflow-hidden p-5 transition duration-300 hover:-translate-y-1 hover:shadow-pop">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-violet-500 to-pink-500 opacity-0 transition group-hover:opacity-100" />
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-pink-50 text-2xl ring-1 ring-stone-200">{w.icon}</span>
                <Badge tone={w.role === "OWNER" ? "brand" : "slate"}>{w.role === "OWNER" ? "Owner" : ROLE_LABEL[w.role]}</Badge>
              </div>
              <h3 className="mt-4 truncate font-semibold group-hover:text-brand-700">{w.name}</h3>
              <p className="mt-0.5 line-clamp-1 h-5 text-sm text-ink-500">{w.description}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{w.documentCount} pages</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{w.memberCount}</span>
                <span className="ml-auto">{timeAgo(w.updatedAt)}</span>
              </div>
            </Link>
          ))}
          <button onClick={openNewWorkspace} className="flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 text-sm font-medium text-ink-500 transition hover:border-brand-400 hover:bg-brand-50/50 hover:text-brand-700">
            <Plus className="h-6 w-6" /> New workspace
          </button>
        </div>
      )}
    </div>
  );
}
