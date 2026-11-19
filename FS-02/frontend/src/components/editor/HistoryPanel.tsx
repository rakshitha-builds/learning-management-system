"use client";
import { useEffect, useState } from "react";
import { Clock, History as HistoryIcon, RotateCcw, Save } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, ErrorState, Modal, Skeleton, Spinner } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { Role, VersionT, hasRole } from "@/lib/types";
import { fullDate, timeAgo } from "@/lib/utils";

export default function HistoryPanel({ docId, role, rev }: { docId: string; role: Role; rev: number }) {
  const toast = useToast();
  const res = useResource(() => api<{ versions: VersionT[] }>(`/api/documents/${docId}/versions`).then((d) => d.versions), [docId]);
  useEffect(() => { if (rev > 0) res.reload(); }, [rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const canEdit = hasRole(role, "EDITOR");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<VersionT | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fail = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Something went wrong");

  async function save() {
    setSaving(true);
    try { await api(`/api/documents/${docId}/versions`, { body: { label: label.trim() || undefined } }); setLabel(""); toast.success("Version saved"); await res.reload(); }
    catch (e) { fail(e); } finally { setSaving(false); }
  }
  async function open(v: VersionT) {
    setPreview(v); setPreviewText(null);
    try { const d = await api<{ version: { plainText: string } }>(`/api/versions/${v.id}`); setPreviewText(d.version.plainText); } catch (e) { fail(e); setPreview(null); }
  }
  async function restore() {
    if (!preview) return;
    setRestoring(true);
    try { await api(`/api/versions/${preview.id}/restore`, { body: {} }); toast.success("Version restored for everyone in the page"); setPreview(null); await res.reload(); }
    catch (e) { fail(e); } finally { setRestoring(false); }
  }

  return (
    <div className="flex h-full flex-col">
      {canEdit && (
        <div className="border-b border-stone-200 p-3">
          <div className="flex gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="Name this version (optional)" aria-label="Version name"
              onKeyDown={(e) => e.key === "Enter" && save()} className="h-9 min-w-0 flex-1 rounded-lg border border-stone-200 px-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100" />
            <Button size="sm" className="h-9" onClick={save} loading={saving}><Save className="h-3.5 w-3.5" /> Save</Button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-500">Snapshots are also taken automatically while you edit.</p>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        {res.loading && !res.data ? <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
          : res.error ? <ErrorState title="Could not load history" text={res.error.message} />
          : res.data?.length === 0 ? <EmptyState icon={<HistoryIcon className="h-6 w-6" />} title="No versions yet" text="Save a version to create a restore point you can come back to." />
          : <ul className="space-y-1.5">
            {res.data!.map((v) => (
              <li key={v.id}>
                <button onClick={() => open(v)} className="w-full rounded-xl border border-transparent p-3 text-left transition hover:border-stone-200 hover:bg-stone-50">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{v.label || "Untitled version"}</span>
                    {v.auto && <Badge>Auto</Badge>}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
                    <Clock className="h-3 w-3" /><span title={fullDate(v.createdAt)}>{timeAgo(v.createdAt)}</span>
                    {v.createdBy && <><span>·</span><Avatar name={v.createdBy.name} color={v.createdBy.color} size={14} className="!shadow-none" /><span className="truncate">{v.createdBy.name}</span></>}
                  </div>
                </button>
              </li>
            ))}
          </ul>}
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.label || "Version preview"} wide>
        <p className="mb-3 text-xs text-ink-500">Saved {preview && fullDate(preview.createdAt)}{preview?.createdBy ? ` by ${preview.createdBy.name}` : ""}. This is a text preview — formatting is restored with the version.</p>
        <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-ink-700">
          {previewText === null ? <div className="flex justify-center py-6"><Spinner /></div> : previewText || <span className="text-ink-500">This version was empty.</span>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-ink-500">{canEdit ? "Restoring replaces the current content for everyone. The current state is saved first." : "You need edit access to restore versions."}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPreview(null)}>Close</Button>
            {canEdit && <Button onClick={restore} loading={restoring}><RotateCcw className="h-4 w-4" /> Restore this version</Button>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
