"use client";
import { useState } from "react";
import { Avatar, Button, Input, Textarea } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { User } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#3b82f6"];

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [color, setColor] = useState(user?.color ?? COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [changing, setChanging] = useState(false);
  const fail = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "Something went wrong");

  if (!user) return null;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { const d = await api<{ user: User }>("/api/users/me", { method: "PATCH", body: { name, bio: bio || null, color } }); setUser(d.user); toast.success("Profile saved"); }
    catch (e) { fail(e); } finally { setSaving(false); }
  }
  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setChanging(true);
    try { await api("/api/users/me/password", { body: { currentPassword: cur, newPassword: next } }); toast.success("Password updated"); setCur(""); setNext(""); }
    catch (e) { fail(e); } finally { setChanging(false); }
  }

  return (
    <div className="mx-auto max-w-2xl animate-fadeIn px-5 py-8 sm:px-8 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
      <p className="mt-1 text-ink-500">This is how teammates see you in the editor.</p>

      <form onSubmit={save} className="card mt-8 space-y-5 p-6">
        <div className="flex items-center gap-4">
          <Avatar name={name || user.name} color={color} size={64} />
          <div>
            <p className="text-sm font-medium text-ink-700">Cursor & avatar colour</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`} aria-pressed={color === c}
                  className={cn("h-7 w-7 rounded-full transition hover:scale-110", color === c && "ring-2 ring-offset-2 ring-ink-900")} style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        <Input label="Email" value={user.email} disabled readOnly />
        <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} placeholder="A line about you" />
        <Button type="submit" loading={saving} disabled={!name.trim()}>Save profile</Button>
      </form>

      <form onSubmit={changePw} className="card mt-6 space-y-4 p-6">
        <h2 className="font-semibold">Change password</h2>
        <Input label="Current password" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
        <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} placeholder="At least 8 characters" required />
        <Button type="submit" variant="secondary" loading={changing}>Update password</Button>
      </form>
    </div>
  );
}
