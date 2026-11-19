"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FilePlus2, Search, Settings } from "lucide-react";
import { useShell } from "@/components/Shell";
import { Avatar, Badge, Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { useEvents, useResource } from "@/lib/hooks";
import { Member, ROLE_LABEL, WorkspaceSummary, hasRole } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

export default function WorkspaceHome() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { docs, docsLoading, createDoc } = useShell();
  const [q, setQ] = useState("");
  const ws = useResource(() => api<{ workspace: WorkspaceSummary & { role: any }; members: Member[] }>(`/api/workspaces/${workspaceId}`), [workspaceId]);
  useEvents(`ws:${workspaceId}`, (e) => { if (e.type === "members" || e.type === "workspace") ws.reload(); });

  const filtered = useMemo(() => (docs ?? []).filter((d) => d.title.toLowerCase().includes(q.toLowerCase()) || d.preview.toLowerCase().includes(q.toLowerCase())), [docs, q]);

  if (ws.error) return <ErrorState title={ws.error.status === 404 ? "Workspace not found" : "Could not load workspace"} text={ws.error.status === 404 ? "It may have been deleted, or you no longer have access." : ws.error.message} action={<Link href="/dashboard"><Button variant="secondary">Back to dashboard</Button></Link>} />;
  const w = ws.data?.workspace;
  const canEdit = hasRole(w?.role, "EDITOR");

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn px-5 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {!w ? <Skeleton className="h-9 w-64" /> : (
            <div className="flex items-center gap-3">
              <span className="text-4xl">{w.icon}</span>
              <div className="min-w-0">
                <h1 className="truncate text-3xl font-bold tracking-tight">{w.name}</h1>
                {w.description && <p className="mt-1 text-ink-500">{w.description}</p>}
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <div className="flex -space-x-2">{ws.data?.members.slice(0, 5).map((m) => <Avatar key={m.userId} name={m.name} color={m.color} size={30} />)}</div>
            {ws.data && <span className="text-sm text-ink-500">{ws.data.members.length} member{ws.data.members.length === 1 ? "" : "s"}</span>}
            {w && <Badge tone="brand">{w.role === "OWNER" ? "Owner" : ROLE_LABEL[w.role as keyof typeof ROLE_LABEL]}</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/w/${workspaceId}/settings`}><Button variant="secondary"><Settings className="h-4 w-4" /> Settings</Button></Link>
          {canEdit && <Button onClick={() => createDoc(workspaceId)}><FilePlus2 className="h-4 w-4" /> New page</Button>}
        </div>
      </div>

      <div className="relative mt-8">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pages…" aria-label="Search pages"
          className="h-11 w-full rounded-xl border border-stone-200 bg-white pl-10 pr-3 text-sm shadow-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
      </div>

      <div className="mt-6">
        {docsLoading && !docs ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        ) : docs && docs.length === 0 ? (
          <EmptyState icon="📝" title="No pages yet" text={canEdit ? "Create your first page and invite teammates to write with you." : "Nobody has created a page yet."}
            action={canEdit ? <Button onClick={() => createDoc(workspaceId)}><FilePlus2 className="h-4 w-4" /> Create a page</Button> : undefined} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🔎" title="No matching pages" text={`Nothing matches “${q}”.`} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <Link key={d.id} href={`/w/${workspaceId}/d/${d.id}`} className="card group flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
                <span className="text-2xl">{d.icon}</span>
                <h3 className="mt-3 truncate font-semibold group-hover:text-brand-700">{d.title || "Untitled"}</h3>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-ink-500">{d.preview || "Empty page"}</p>
                <p className="mt-3 text-xs text-ink-500">Edited {timeAgo(d.updatedAt)} · {d.createdBy.name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
