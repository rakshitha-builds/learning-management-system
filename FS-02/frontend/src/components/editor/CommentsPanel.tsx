"use client";
import { useEffect, useState } from "react";
import { Check, CornerDownRight, MessageSquarePlus, MessageSquareText, Quote, Trash2, Undo2, X } from "lucide-react";
import { Avatar, Button, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { CommentT, Role, hasRole } from "@/lib/types";
import { cn, fullDate, timeAgo } from "@/lib/utils";

export default function CommentsPanel({ docId, role, rev, getSelection, onCount }: { docId: string; role: Role; rev: number; getSelection: () => string; onCount: (n: number) => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const res = useResource(() => api<{ comments: CommentT[] }>(`/api/documents/${docId}/comments`).then((d) => d.comments), [docId]);
  useEffect(() => { if (rev > 0) res.reload(); }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (res.data) onCount(res.data.filter((c) => !c.resolved).length); }, [res.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const canComment = hasRole(role, "COMMENTER");
  const [body, setBody] = useState("");
  const [quote, setQuote] = useState("");
  const [posting, setPosting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const fail = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Something went wrong");

  async function post(parentId?: string, text?: string) {
    const content = (text ?? body).trim();
    if (!content) return;
    setPosting(true);
    try {
      await api(`/api/documents/${docId}/comments`, { body: { body: content, parentId, quote: parentId ? undefined : quote || undefined } });
      if (!parentId) { setBody(""); setQuote(""); }
      await res.reload();
    } catch (e) { fail(e); } finally { setPosting(false); }
  }
  async function patch(id: string, data: object) { try { await api(`/api/comments/${id}`, { method: "PATCH", body: data }); await res.reload(); } catch (e) { fail(e); } }
  async function remove(id: string) { try { await api(`/api/comments/${id}`, { method: "DELETE" }); await res.reload(); } catch (e) { fail(e); } }

  const open = res.data?.filter((c) => !c.resolved) ?? [];
  const resolved = res.data?.filter((c) => c.resolved) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {res.loading && !res.data ? <><Skeleton className="h-24" /><Skeleton className="h-24" /></>
          : res.error ? <ErrorState title="Could not load comments" text={res.error.message} action={<Button variant="secondary" onClick={() => res.reload()}>Retry</Button>} />
          : open.length === 0 && resolved.length === 0 ? <EmptyState icon={<MessageSquareText className="h-6 w-6" />} title="No comments yet" text={canComment ? "Start a conversation about this page." : "Nobody has commented yet."} />
          : <>
            {open.map((c) => <Thread key={c.id} c={c} role={role} meId={user!.id} onReply={(t) => post(c.id, t)} onResolve={() => patch(c.id, { resolved: true })} onDelete={remove} />)}
            {open.length === 0 && <p className="py-6 text-center text-sm text-ink-500">All conversations are resolved 🎉</p>}
            {resolved.length > 0 && (
              <div>
                <button onClick={() => setShowResolved((s) => !s)} className="text-xs font-semibold text-ink-500 hover:text-ink-900">{showResolved ? "Hide" : "Show"} {resolved.length} resolved</button>
                {showResolved && <div className="mt-2 space-y-3 opacity-70">{resolved.map((c) => <Thread key={c.id} c={c} role={role} meId={user!.id} onReply={(t) => post(c.id, t)} onResolve={() => patch(c.id, { resolved: false })} onDelete={remove} />)}</div>}
              </div>
            )}
          </>}
      </div>

      {canComment ? (
        <div className="border-t border-stone-200 bg-white p-3">
          {quote && (
            <div className="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <Quote className="mt-0.5 h-3 w-3 shrink-0" /><span className="line-clamp-2 flex-1">{quote}</span>
              <button onClick={() => setQuote("")} aria-label="Remove quote"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={2000} placeholder="Add a comment…" aria-label="New comment"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void post(); } }}
            className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <button onClick={() => { const s = getSelection(); if (s) setQuote(s.slice(0, 300)); else toast.error("Select some text in the page first"); }} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-500 hover:text-brand-700"><MessageSquarePlus className="h-3.5 w-3.5" /> Quote selection</button>
            <Button size="sm" onClick={() => post()} loading={posting} disabled={!body.trim()}>Comment</Button>
          </div>
        </div>
      ) : <p className="border-t border-stone-200 bg-stone-50 p-3 text-center text-xs text-ink-500">You have view-only access and cannot comment.</p>}
    </div>
  );
}

function Thread({ c, role, meId, onReply, onResolve, onDelete }: { c: CommentT; role: Role; meId: string; onReply: (t: string) => Promise<void>; onResolve: () => void; onDelete: (id: string) => void }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const canComment = hasRole(role, "COMMENTER");
  return (
    <div className={cn("animate-fadeIn rounded-xl border bg-white p-3 shadow-sm", c.resolved ? "border-stone-200" : "border-stone-200")}>
      <Item c={c} meId={meId} role={role} onDelete={onDelete} />
      {c.quote && <blockquote className="mt-2 line-clamp-3 rounded-md border-l-2 border-amber-400 bg-amber-50 px-2 py-1 text-xs italic text-ink-700">{c.quote}</blockquote>}
      {(c.replies?.length ?? 0) > 0 && (
        <div className="mt-3 space-y-3 border-l-2 border-stone-100 pl-3">
          {c.replies!.map((r) => <Item key={r.id} c={r} meId={meId} role={role} onDelete={onDelete} small />)}
        </div>
      )}
      {canComment && (
        <div className="mt-3 flex items-center gap-3 text-xs font-semibold text-ink-500">
          <button onClick={() => setReplying((s) => !s)} className="inline-flex items-center gap-1 hover:text-brand-700"><CornerDownRight className="h-3.5 w-3.5" /> Reply</button>
          <button onClick={onResolve} className="inline-flex items-center gap-1 hover:text-emerald-700">{c.resolved ? <><Undo2 className="h-3.5 w-3.5" /> Reopen</> : <><Check className="h-3.5 w-3.5" /> Resolve</>}</button>
        </div>
      )}
      {replying && (
        <form className="mt-2 space-y-2" onSubmit={async (e) => { e.preventDefault(); if (!text.trim()) return; setBusy(true); await onReply(text); setBusy(false); setText(""); setReplying(false); }}>
          <textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="Write a reply…" aria-label="Reply"
            className="w-full resize-none rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
          <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button><Button type="submit" size="sm" loading={busy} disabled={!text.trim()}>Reply</Button></div>
        </form>
      )}
    </div>
  );
}

function Item({ c, meId, role, onDelete, small }: { c: CommentT; meId: string; role: Role; onDelete: (id: string) => void; small?: boolean }) {
  const canDelete = c.author.id === meId || role === "OWNER";
  return (
    <div className="group flex gap-2.5">
      <Avatar name={c.author.name} color={c.author.color} size={small ? 24 : 28} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-semibold">{c.author.name}</span>
          <time className="shrink-0 text-[11px] text-ink-500" title={fullDate(c.createdAt)} dateTime={c.createdAt}>{timeAgo(c.createdAt)}</time>
          {canDelete && <button onClick={() => onDelete(c.id)} className="ml-auto text-ink-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100 focus:opacity-100" aria-label="Delete comment" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink-700">{c.body}</p>
      </div>
    </div>
  );
}
