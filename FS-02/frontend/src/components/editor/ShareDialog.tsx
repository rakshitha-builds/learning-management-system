"use client";
import { Avatar, Badge, ErrorState, Modal, Select, Skeleton } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { PermissionRow, ROLE_LABEL, Role } from "@/lib/types";

export default function ShareDialog({ docId, open, onClose, onChanged }: { docId: string; open: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const res = useResource(() => (open ? api<{ permissions: PermissionRow[] }>(`/api/documents/${docId}/permissions`).then((d) => d.permissions) : Promise.resolve(null)), [docId, open]);

  async function change(p: PermissionRow, value: string) {
    try {
      if (value === "DEFAULT") await api(`/api/documents/${docId}/permissions/${p.userId}`, { method: "DELETE" });
      else await api(`/api/documents/${docId}/permissions/${p.userId}`, { method: "PUT", body: { role: value } });
      toast.success(`Updated access for ${p.name}`);
      await res.reload(); onChanged();
    } catch (e) { toast.error(e instanceof ApiError ? e.message : "Could not update access"); }
  }
  return (
    <Modal open={open} onClose={onClose} title="Share & permissions" wide>
      <p className="mb-4 text-sm text-ink-500">Everyone in the workspace can open this page with their workspace role. Override access for this page only below — changes apply immediately, even to people who are editing right now.</p>
      {res.error ? <ErrorState title="Could not load permissions" text={res.error.message} /> : !res.data ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : (
        <ul className="divide-y divide-stone-100">
          {res.data.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 py-3">
              <Avatar name={p.name} color={p.color} size={34} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.name}</p><p className="truncate text-xs text-ink-500">{p.email}</p></div>
              {p.workspaceRole === "OWNER" ? <Badge tone="brand">Owner</Badge> : (
                <Select value={p.override ?? "DEFAULT"} onChange={(e) => change(p, e.target.value)} aria-label={`Access for ${p.name}`}>
                  <option value="DEFAULT">Workspace default ({ROLE_LABEL[p.workspaceRole as Role]})</option>
                  {(["EDITOR", "COMMENTER", "VIEWER"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
