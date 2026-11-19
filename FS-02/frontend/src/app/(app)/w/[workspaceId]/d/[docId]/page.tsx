"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ChevronRight, Eye, History, MessageSquare, MessageSquareOff, PanelRightClose, Share2, Trash2, Wifi, WifiOff } from "lucide-react";
import { Button, ErrorState, Modal, Skeleton, Spinner } from "@/components/ui";
import RichEditor from "@/components/editor/RichEditor";
import PresenceBar from "@/components/editor/PresenceBar";
import CommentsPanel from "@/components/editor/CommentsPanel";
import HistoryPanel from "@/components/editor/HistoryPanel";
import ShareDialog from "@/components/editor/ShareDialog";
import { useCollabSession } from "@/components/editor/session";
import { useShell } from "@/components/Shell";
import { api, ApiError, getWsToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDebouncedCallback, useEvents, useResource } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { DocDetail, hasRole } from "@/lib/types";
import { EMOJIS, cn } from "@/lib/utils";

type Panel = "comments" | "history" | null;

export default function DocumentPage() {
  const { workspaceId, docId } = useParams<{ workspaceId: string; docId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { reloadDocs } = useShell();

  const doc = useResource(() => api<{ document: DocDetail }>(`/api/documents/${docId}`).then((d) => d.document), [docId]);
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => { setToken(null); getWsToken().then(setToken).catch(() => {}); }, [docId]);
  const session = useCollabSession(docId, doc.data ? token : null);

  const [panel, setPanel] = useState<Panel>(null);
  const [commentsRev, setCommentsRev] = useState(0);
  const [versionsRev, setVersionsRev] = useState(0);
  const [openComments, setOpenComments] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  useEvents(`doc:${docId}`, (e) => {
    if (e.type === "comments") setCommentsRev((n) => n + 1);
    if (e.type === "versions") setVersionsRev((n) => n + 1);
    if (e.type === "meta" || e.type === "permissions") doc.reload();
    if (e.type === "reconnected") { doc.reload(); setCommentsRev((n) => n + 1); setVersionsRev((n) => n + 1); }
    if (e.type === "deleted") { toast.error("This page was deleted"); reloadDocs(); router.replace(`/w/${workspaceId}`); }
  });

  // ---- title editing
  const [title, setTitle] = useState("");
  const titleFocused = useRef(false);
  useEffect(() => { if (doc.data && !titleFocused.current) setTitle(doc.data.title); }, [doc.data?.title]); // eslint-disable-line react-hooks/exhaustive-deps
  const role = doc.data?.role;
  const canEdit = hasRole(role, "EDITOR");
  const saveTitle = useDebouncedCallback(async (t: string) => {
    try { await api(`/api/documents/${docId}`, { method: "PATCH", body: { title: t.trim() || "Untitled" } }); reloadDocs(); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not rename page"); }
  }, 600);
  async function setIcon(icon: string) {
    setEmojiOpen(false);
    try { await api(`/api/documents/${docId}`, { method: "PATCH", body: { icon } }); doc.reload(); reloadDocs(); } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not change icon"); }
  }
  async function deleteDoc() {
    try { await api(`/api/documents/${docId}`, { method: "DELETE" }); reloadDocs(); router.replace(`/w/${workspaceId}`); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not delete page"); }
  }

  // ---- connection status
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [synced, setSynced] = useState(false);
  const [recentlyEdited, setRecentlyEdited] = useState(false);
  useEffect(() => {
    if (!session) return;
    const p = session.provider;
    const onStatus = (e: { status: "connecting" | "connected" | "disconnected" }) => setStatus(e.status);
    const onSync = (s: boolean) => setSynced(s);
    const onClose = (ev: CloseEvent | null) => { if (ev && ev.code === 4403) doc.reload(); };
    const onError = () => doc.reload(); // access may have been revoked: re-check via REST (404 -> no-access screen)
    p.on("status", onStatus); p.on("sync", onSync); p.on("connection-close", onClose as any); p.on("connection-error", onError);
    setStatus(p.wsconnected ? "connected" : "connecting"); setSynced(p.synced);
    let t: ReturnType<typeof setTimeout>;
    const onUpdate = (_u: Uint8Array, origin: unknown) => { if (origin === p) return; setRecentlyEdited(true); clearTimeout(t); t = setTimeout(() => setRecentlyEdited(false), 900); };
    session.ydoc.on("update", onUpdate);
    return () => { p.off("status", onStatus); p.off("sync", onSync); p.off("connection-close", onClose as any); p.off("connection-error", onError); session.ydoc.off("update", onUpdate); clearTimeout(t); };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSelection = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return "";
    const { from, to } = ed.state.selection;
    return from === to ? "" : ed.state.doc.textBetween(from, to, " ");
  }, []);

  if (doc.error) {
    const gone = doc.error.status === 404 || doc.error.status === 403;
    return <ErrorState title={gone ? "Page not available" : "Could not load this page"}
      text={gone ? "It may have been deleted, or you no longer have access to it." : doc.error.message}
      action={<div className="flex gap-2"><Link href={`/w/${workspaceId}`}><Button variant="secondary">Back to workspace</Button></Link>{!gone && <Button onClick={() => doc.reload(false)}>Retry</Button>}</div>} />;
  }
  if (!doc.data || !user) {
    return <div className="mx-auto max-w-3xl space-y-4 px-6 py-16"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-5" /><Skeleton className="h-5 w-5/6" /><Skeleton className="h-5 w-4/6" /></div>;
  }
  const d = doc.data;
  const me = { id: user.id, name: user.name, color: user.color };
  const live = status === "connected" && synced;
  const statusLabel = status === "disconnected" ? "Offline – reconnecting…" : !live ? "Connecting…" : recentlyEdited ? "Syncing…" : "Saved";

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* collaboration toolbar */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-stone-200 bg-white px-4">
          <nav className="hidden min-w-0 items-center gap-1 text-sm text-ink-500 sm:flex" aria-label="Breadcrumb">
            <Link href={`/w/${workspaceId}`} className="truncate hover:text-ink-900">{d.workspace.icon} {d.workspace.name}</Link>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[16rem] truncate font-medium text-ink-900">{d.icon} {title || "Untitled"}</span>
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
              status === "disconnected" ? "bg-red-50 text-red-700" : live ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")} role="status">
              {status === "disconnected" ? <WifiOff className="h-3.5 w-3.5" /> : live ? <Wifi className="h-3.5 w-3.5" /> : <Spinner className="h-3.5 w-3.5 text-amber-600" />}
              <span className="hidden sm:inline">{statusLabel}</span>
            </span>
            {role === "VIEWER" && <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700"><Eye className="h-3.5 w-3.5" /> View only</span>}
            {role === "COMMENTER" && <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-semibold text-ink-700"><MessageSquare className="h-3.5 w-3.5" /> Comment only</span>}
            {session && <PresenceBar provider={session.provider} me={me} />}
            <span className="hidden h-6 w-px bg-stone-200 sm:block" />
            <Button variant={panel === "comments" ? "secondary" : "ghost"} size="sm" onClick={() => setPanel(panel === "comments" ? null : "comments")} aria-pressed={panel === "comments"}>
              <MessageSquare className="h-4 w-4" /><span className="hidden md:inline">Comments</span>
              {openComments > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{openComments}</span>}
            </Button>
            <Button variant={panel === "history" ? "secondary" : "ghost"} size="sm" onClick={() => setPanel(panel === "history" ? null : "history")} aria-pressed={panel === "history"}>
              <History className="h-4 w-4" /><span className="hidden md:inline">History</span>
            </Button>
            {role === "OWNER" && <Button size="sm" onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4" /><span className="hidden md:inline">Share</span></Button>}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white">
          <div className="mx-auto max-w-3xl px-5 pt-10 sm:px-10 sm:pt-14">
            <div className="relative">
              <button disabled={!canEdit} onClick={() => setEmojiOpen((s) => !s)} className="mb-2 text-5xl leading-none transition hover:scale-105 disabled:cursor-default disabled:hover:scale-100" aria-label="Change page icon">{d.icon}</button>
              {emojiOpen && (
                <div className="absolute z-20 grid animate-fadeIn grid-cols-8 gap-1 rounded-xl border border-stone-200 bg-white p-2 shadow-pop">
                  {EMOJIS.map((e) => <button key={e} onClick={() => setIcon(e)} className="h-8 w-8 rounded-lg text-lg hover:bg-stone-100">{e}</button>)}
                </div>
              )}
            </div>
            <input value={title} readOnly={!canEdit} maxLength={200} aria-label="Page title" placeholder="Untitled"
              onFocus={() => (titleFocused.current = true)} onBlur={() => { titleFocused.current = false; }}
              onChange={(e) => { setTitle(e.target.value); saveTitle(e.target.value); }}
              className="w-full bg-transparent text-4xl font-extrabold tracking-tight outline-none placeholder:text-ink-300 sm:text-5xl" />
            <div className="mt-3 flex items-center gap-3 text-xs text-ink-500">
              {canEdit && (role === "OWNER" || d.role === "EDITOR") && <button onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-1 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /> Delete page</button>}
            </div>
          </div>
          {session ? <RichEditor session={session} user={me} editable={canEdit} onEditor={(e) => { editorRef.current = e; }} />
            : <div className="flex justify-center py-20"><Spinner className="h-7 w-7" /></div>}
        </div>
      </div>

      {panel && (
        <aside className="fixed inset-0 z-30 flex flex-col bg-white lg:static lg:inset-auto lg:z-auto lg:w-[360px] lg:shrink-0 lg:border-l lg:border-stone-200">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200 px-4">
            <h2 className="flex items-center gap-2 font-semibold">{panel === "comments" ? <><MessageSquare className="h-4 w-4" /> Comments</> : <><History className="h-4 w-4" /> Version history</>}</h2>
            <button onClick={() => setPanel(null)} className="rounded-lg p-1.5 text-ink-500 hover:bg-stone-100" aria-label="Close panel"><PanelRightClose className="h-5 w-5" /></button>
          </div>
          <div className="min-h-0 flex-1">
            {panel === "comments" ? <CommentsPanel docId={docId} role={d.role} rev={commentsRev} getSelection={getSelection} onCount={setOpenComments} />
              : <HistoryPanel docId={docId} role={d.role} rev={versionsRev} />}
          </div>
        </aside>
      )}
      {/* keep the comment counter fresh even when the panel is closed */}
      {!panel && <HiddenCounter docId={docId} rev={commentsRev} onCount={setOpenComments} />}

      <ShareDialog docId={docId} open={shareOpen} onClose={() => setShareOpen(false)} onChanged={() => doc.reload()} />
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this page?">
        <p className="text-sm text-ink-700">“{title || "Untitled"}” and all of its comments and version history will be permanently deleted for everyone.</p>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" onClick={deleteDoc}>Delete page</Button></div>
      </Modal>
    </div>
  );
}

function HiddenCounter({ docId, rev, onCount }: { docId: string; rev: number; onCount: (n: number) => void }) {
  useEffect(() => {
    let cancelled = false;
    api<{ comments: { resolved: boolean }[] }>(`/api/documents/${docId}/comments`).then((d) => { if (!cancelled) onCount(d.comments.filter((c) => !c.resolved).length); }).catch(() => {});
    return () => { cancelled = true; };
  }, [docId, rev, onCount]);
  return null;
}
