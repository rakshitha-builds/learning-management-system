"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ChevronRight, FilePlus2, LayoutDashboard, LogOut, Menu, Plus, Settings, UserCircle2, X } from "lucide-react";
import { Avatar, Button, FullPageSpinner, Input, Logo, Modal, Skeleton, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useEvents, useResource } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { EMOJIS, cn } from "@/lib/utils";
import { DocSummary, WorkspaceSummary, hasRole } from "@/lib/types";

interface ShellCtx {
  workspaces: WorkspaceSummary[] | null;
  reloadWorkspaces(): void;
  docs: DocSummary[] | null;
  docsLoading: boolean;
  reloadDocs(): void;
  createDoc(workspaceId: string): Promise<void>;
  openNewWorkspace(): void;
}
const Ctx = createContext<ShellCtx>(null as any);
export const useShell = () => useContext(Ctx);

export function NewWorkspaceModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🚀");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const { workspace } = await api<{ workspace: { id: string } }>("/api/workspaces", { body: { name, description: description || null, icon } });
      setName(""); setDescription("");
      onCreated(workspace.id);
    } catch (e) { setError(e instanceof ApiError ? e.message : "Could not create workspace"); } finally { setBusy(false); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Create a workspace">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-700">Icon</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button type="button" key={e} onClick={() => setIcon(e)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-lg transition hover:bg-stone-100", icon === e && "bg-brand-50 ring-2 ring-brand-400")}>{e}</button>
            ))}
          </div>
        </div>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product team" maxLength={80} autoFocus required />
        <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} placeholder="What is this workspace for?" />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>Create workspace</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ workspaceId?: string; docId?: string }>();
  const wid = params?.workspaceId ?? null;
  const toast = useToast();
  const [drawer, setDrawer] = useState(false);
  const [newWs, setNewWs] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [loading, user, router, pathname]);
  useEffect(() => setDrawer(false), [pathname]);

  const workspaces = useResource(() => api<{ workspaces: WorkspaceSummary[] }>("/api/workspaces").then((d) => d.workspaces), [user?.id]);
  const docs = useResource(() => (wid ? api<{ documents: DocSummary[] }>(`/api/workspaces/${wid}/documents`).then((d) => d.documents) : Promise.resolve(null as DocSummary[] | null)), [wid]);

  useEvents(wid ? `ws:${wid}` : null, (e) => {
    if (e.type === "documents" || e.type === "reconnected") docs.reload();
    if (e.type === "workspace" || e.type === "members" || e.type === "reconnected") workspaces.reload();
    if (e.type === "workspace-deleted") { workspaces.reload(); router.replace("/dashboard"); }
  });

  const createDoc = useCallback(async (workspaceId: string) => {
    try {
      const { document } = await api<{ document: { id: string } }>(`/api/workspaces/${workspaceId}/documents`, { body: {} });
      docs.reload(); workspaces.reload();
      router.push(`/w/${workspaceId}/d/${document.id}`);
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not create page"); }
  }, [docs, workspaces, router, toast]);

  if (loading || !user) return <FullPageSpinner />;
  const currentWs = workspaces.data?.find((w) => w.id === wid);

  const sidebar = (
    <div className="flex h-full w-72 flex-col border-r border-stone-200 bg-stone-100/70">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/dashboard"><Logo /></Link>
        <button className="rounded-lg p-1.5 text-ink-500 hover:bg-stone-200 lg:hidden" onClick={() => setDrawer(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />} active={pathname === "/dashboard"}>Dashboard</NavLink>
          <NavLink href="/profile" icon={<UserCircle2 className="h-4 w-4" />} active={pathname === "/profile"}>Profile</NavLink>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Workspaces</span>
            <button onClick={() => setNewWs(true)} className="rounded-md p-1 text-ink-500 hover:bg-stone-200 hover:text-ink-900" aria-label="New workspace"><Plus className="h-4 w-4" /></button>
          </div>
          {workspaces.loading && !workspaces.data ? (
            <div className="space-y-2 px-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
          ) : workspaces.data?.length === 0 ? (
            <p className="px-2 py-2 text-sm text-ink-500">No workspaces yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {workspaces.data?.map((w) => {
                const open = w.id === wid;
                return (
                  <li key={w.id}>
                    <Link href={`/w/${w.id}`} className={cn("group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:bg-stone-200/70", open && "font-semibold text-ink-900")}>
                      <ChevronRight className={cn("h-3.5 w-3.5 text-ink-500 transition-transform", open && "rotate-90")} />
                      <span className="text-base leading-none">{w.icon}</span>
                      <span className="truncate">{w.name}</span>
                    </Link>
                    {open && (
                      <div className="ml-4 mt-0.5 animate-fadeIn border-l border-stone-300 pl-2">
                        {docs.loading && !docs.data ? <div className="space-y-1.5 py-1"><Skeleton className="h-6" /><Skeleton className="h-6" /></div> : (
                          <ul className="space-y-0.5">
                            {docs.data?.map((d) => (
                              <li key={d.id}>
                                <Link href={`/w/${w.id}/d/${d.id}`} className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-ink-700 transition hover:bg-stone-200/70", params?.docId === d.id && "bg-white font-semibold text-ink-900 shadow-sm")}>
                                  <span>{d.icon}</span><span className="truncate">{d.title || "Untitled"}</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-1 flex flex-col gap-0.5">
                          {hasRole(currentWs?.role, "EDITOR") && (
                            <button onClick={() => createDoc(w.id)} className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] font-medium text-brand-700 hover:bg-brand-50"><FilePlus2 className="h-3.5 w-3.5" /> New page</button>
                          )}
                          <Link href={`/w/${w.id}/settings`} className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-ink-500 hover:bg-stone-200/70", pathname.endsWith("/settings") && "font-semibold text-ink-900")}><Settings className="h-3.5 w-3.5" /> Settings & members</Link>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>
      <div className="flex items-center gap-3 border-t border-stone-200 p-3">
        <Avatar name={user.name} color={user.color} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="truncate text-xs text-ink-500">{user.email}</p>
        </div>
        <button onClick={async () => { await logout(); router.replace("/login"); }} className="rounded-lg p-2 text-ink-500 hover:bg-stone-200 hover:text-ink-900" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <Ctx.Provider value={{
      workspaces: workspaces.data, reloadWorkspaces: workspaces.reload, docs: docs.data, docsLoading: docs.loading,
      reloadDocs: docs.reload, createDoc, openNewWorkspace: () => setNewWs(true),
    }}>
      <div className="flex h-screen overflow-hidden">
        <aside className="hidden lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 animate-slideIn shadow-pop">{sidebar}</div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4 lg:hidden">
            <button onClick={() => setDrawer(true)} className="rounded-lg p-2 text-ink-700 hover:bg-stone-100" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <Logo />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
      <NewWorkspaceModal open={newWs} onClose={() => setNewWs(false)} onCreated={(id) => { setNewWs(false); workspaces.reload(); router.push(`/w/${id}`); }} />
    </Ctx.Provider>
  );
}

function NavLink({ href, icon, active, children }: { href: string; icon: React.ReactNode; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-700 transition hover:bg-stone-200/70", active && "bg-white text-ink-900 shadow-sm")}>
      {icon}{children}
    </Link>
  );
}
