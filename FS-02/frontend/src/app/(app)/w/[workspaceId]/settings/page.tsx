"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, Trash2, UserMinus } from "lucide-react";
import { useShell } from "@/components/Shell";
import { Avatar, Badge, Button, ErrorState, Input, Modal, Select, Skeleton, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useEvents, useResource } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import { Invite, Member, Role, ROLE_LABEL, WorkspaceSummary } from "@/lib/types";
import { EMOJIS, cn } from "@/lib/utils";

type Detail = { workspace: WorkspaceSummary & { role: Role }; members: Member[]; invites: Invite[] };
const ASSIGNABLE: Role[] = ["EDITOR", "COMMENTER", "VIEWER"];

export default function WorkspaceSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { reloadWorkspaces } = useShell();
  const ws = useResource(() => api<Detail>(`/api/workspaces/${workspaceId}`), [workspaceId]);
  useEvents(`ws:${workspaceId}`, (e) => { if (e.type === "members" || e.type === "workspace") ws.reload(); });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🗂️");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "leave" | { remove: Member }>(null);
  const [busy, setBusy] = useState(false);

  const d = ws.data;
  const isOwner = d?.workspace.role === "OWNER";
  useEffect(() => {
    if (d) { setName(d.workspace.name); setDescription(d.workspace.description ?? ""); setIcon(d.workspace.icon); }
  }, [d?.workspace.id, d?.workspace.name, d?.workspace.description, d?.workspace.icon]); // eslint-disable-line react-hooks/exhaustive-deps

  if (ws.error) return <ErrorState title="Workspace unavailable" text={ws.error.message} action={<Link href="/dashboard"><Button variant="secondary">Back to dashboard</Button></Link>} />;

  const fail = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Something went wrong");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await api(`/api/workspaces/${workspaceId}`, { method: "PATCH", body: { name, description: description || null, icon } }); toast.success("Workspace updated"); ws.reload(); reloadWorkspaces(); }
    catch (e) { fail(e); } finally { setSaving(false); }
  }
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const r = await api<{ status: "added" | "invited" }>(`/api/workspaces/${workspaceId}/members`, { body: { email, role: inviteRole } });
      toast.success(r.status === "added" ? "Member added to the workspace" : "Invitation saved — they'll join automatically when they sign up");
      setEmail(""); ws.reload(); reloadWorkspaces();
    } catch (e) { fail(e); } finally { setInviting(false); }
  }
  async function changeRole(m: Member, role: Role) {
    try { await api(`/api/workspaces/${workspaceId}/members/${m.userId}`, { method: "PATCH", body: { role } }); toast.success(`${m.name} is now “${ROLE_LABEL[role]}”`); ws.reload(); } catch (e) { fail(e); }
  }
  async function doConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm === "delete") { await api(`/api/workspaces/${workspaceId}`, { method: "DELETE" }); toast.success("Workspace deleted"); reloadWorkspaces(); router.replace("/dashboard"); }
      else if (confirm === "leave") { await api(`/api/workspaces/${workspaceId}/members/${user!.id}`, { method: "DELETE" }); toast.success("You left the workspace"); reloadWorkspaces(); router.replace("/dashboard"); }
      else { await api(`/api/workspaces/${workspaceId}/members/${confirm.remove.userId}`, { method: "DELETE" }); toast.success("Member removed"); ws.reload(); reloadWorkspaces(); }
      setConfirm(null);
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    try { await api(`/api/workspaces/${workspaceId}/invites/${id}`, { method: "DELETE" }); ws.reload(); } catch (e) { fail(e); }
  }

  return (
    <div className="mx-auto max-w-3xl animate-fadeIn px-5 py-8 sm:px-8 sm:py-12">
      <Link href={`/w/${workspaceId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Back to workspace</Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">Workspace settings</h1>

      {!d ? <div className="mt-8 space-y-4"><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-64 rounded-2xl" /></div> : (
        <>
          <section className="card mt-8 p-6">
            <h2 className="font-semibold">General</h2>
            <form onSubmit={save} className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map((e) => (
                  <button type="button" key={e} disabled={!isOwner} onClick={() => setIcon(e)} className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-lg transition hover:bg-stone-100 disabled:cursor-not-allowed", icon === e && "bg-brand-50 ring-2 ring-brand-400")}>{e}</button>
                ))}
              </div>
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} maxLength={80} required />
              <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isOwner} rows={2} maxLength={300} />
              {isOwner ? <Button type="submit" loading={saving} disabled={!name.trim()}>Save changes</Button> : <p className="text-sm text-ink-500">Only the workspace owner can change these settings.</p>}
            </form>
          </section>

          <section className="card mt-6 p-6">
            <h2 className="font-semibold">Members <span className="font-normal text-ink-500">· {d.members.length}</span></h2>
            {isOwner && (
              <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="flex-1"><Input type="email" placeholder="Invite by email address" aria-label="Invite by email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)} className="h-11" aria-label="Role">
                  {ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </Select>
                <Button type="submit" loading={inviting} className="h-11"><Mail className="h-4 w-4" /> Invite</Button>
              </form>
            )}
            <ul className="mt-4 divide-y divide-stone-100">
              {d.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 py-3">
                  <Avatar name={m.name} color={m.color} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.name} {m.userId === user?.id && <span className="font-normal text-ink-500">(you)</span>}</p>
                    <p className="truncate text-xs text-ink-500">{m.email}</p>
                  </div>
                  {m.role === "OWNER" ? <Badge tone="brand">Owner</Badge> : isOwner ? (
                    <>
                      <Select value={m.role} onChange={(e) => changeRole(m, e.target.value as Role)} aria-label={`Role for ${m.name}`}>{ASSIGNABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>
                      <button onClick={() => setConfirm({ remove: m })} className="rounded-lg p-2 text-ink-500 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${m.name}`}><UserMinus className="h-4 w-4" /></button>
                    </>
                  ) : <Badge>{ROLE_LABEL[m.role]}</Badge>}
                </li>
              ))}
            </ul>
            {isOwner && d.invites.length > 0 && (
              <div className="mt-4 rounded-xl bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Pending invitations</p>
                <ul className="mt-2 space-y-2">
                  {d.invites.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-ink-500" /><span className="flex-1 truncate">{i.email}</span><Badge tone="amber">{ROLE_LABEL[i.role]}</Badge>
                      <button onClick={() => revoke(i.id)} className="text-xs font-semibold text-red-600 hover:underline">Revoke</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50/40 p-6">
            <h2 className="font-semibold text-red-700">Danger zone</h2>
            {isOwner ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-sm text-ink-700">Deleting this workspace permanently removes all of its pages, comments and version history.</p>
                <Button variant="danger" onClick={() => setConfirm("delete")}><Trash2 className="h-4 w-4" /> Delete workspace</Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-700">You will lose access to this workspace’s pages.</p>
                <Button variant="danger" onClick={() => setConfirm("leave")}>Leave workspace</Button>
              </div>
            )}
          </section>
        </>
      )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === "delete" ? "Delete this workspace?" : confirm === "leave" ? "Leave this workspace?" : "Remove member?"}>
        <p className="text-sm text-ink-700">
          {confirm === "delete" ? "This cannot be undone. Every page, comment and version will be deleted for all members."
            : confirm === "leave" ? "You will need a new invitation to rejoin."
            : confirm && typeof confirm === "object" ? `${confirm.remove.name} will immediately lose access to this workspace.` : ""}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={doConfirm}>{confirm === "delete" ? "Delete workspace" : confirm === "leave" ? "Leave" : "Remove"}</Button>
        </div>
      </Modal>
    </div>
  );
}
