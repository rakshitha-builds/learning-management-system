import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useUpdateProfileMutation } from '../../app/api';
import { setCredentials } from '../../app/authSlice';
import { addToast } from '../../app/uiSlice';
import { Badge, Button, Card, Input, PageHeader, Textarea } from '../../components/ui';
import { errMsg } from '../../lib/format';

export default function Account() {
  const user = useSelector((s) => s.auth.user); const dispatch = useDispatch(); const [update, { isLoading }] = useUpdateProfileMutation();
  const [form, setForm] = useState({ name: user.name, headline: user.headline || '', bio: user.bio || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' }); const [errors, setErrors] = useState({});
  const save = async (e, body, reset) => {
    e.preventDefault(); setErrors({});
    try { const r = await update(body).unwrap(); dispatch(setCredentials({ user: r.user })); dispatch(addToast('Saved')); reset?.(); } catch (er) { setErrors({ msg: errMsg(er) }); dispatch(addToast(errMsg(er), 'error')); }
  };
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Account" subtitle={user.email} actions={<Badge tone="accent">{user.role}</Badge>} />
      <Card className="p-6"><h2 className="font-display text-lg font-semibold">Profile</h2>
        <form onSubmit={(e) => save(e, form)} className="mt-4 space-y-4"><Input label="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />{user.role === 'instructor' && <><Input label="Headline" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} hint="Shown on your course pages." /><Textarea label="Bio" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></>}<Button type="submit" loading={isLoading}>Save changes</Button></form></Card>
      <Card className="mt-6 p-6"><h2 className="font-display text-lg font-semibold">Change password</h2>
        <form onSubmit={(e) => save(e, pw, () => setPw({ currentPassword: '', newPassword: '' }))} className="mt-4 space-y-4"><Input label="Current password" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /><Input label="New password" type="password" value={pw.newPassword} hint="8+ characters with a letter and a number" error={errors.msg} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /><Button type="submit" variant="secondary" loading={isLoading} disabled={!pw.newPassword}>Update password</Button></form></Card>
    </div>
  );
}
