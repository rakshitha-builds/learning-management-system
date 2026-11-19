import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserPlus } from 'lucide-react';
import { useAdminCreateUserMutation, useAdminUserStatusMutation, useAdminUsersQuery } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Badge, Button, ConfirmModal, DataTable, Input, Modal, PageHeader, SearchBox, Select, StatusBadge, Tabs, useDebounced } from '../../components/ui';
import { date, errMsg } from '../../lib/format';

export default function Users() {
  const me = useSelector((s) => s.auth.user); const dispatch = useDispatch();
  const [role, setRole] = useState('student'); const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const res = useAdminUsersQuery({ q: dq, role, status, page, limit: 10 });
  const [setUserStatus] = useAdminUserStatusMutation(); const [createUser, { isLoading }] = useAdminCreateUserMutation();
  const [confirm, setConfirm] = useState(null); const [open, setOpen] = useState(false); const [f, setF] = useState({ name: '', email: '', password: '', role: 'instructor' }); const [err, setErr] = useState('');
  const toggle = async () => { try { await setUserStatus({ id: confirm.id, status: confirm.to }).unwrap(); dispatch(addToast(`User ${confirm.to === 'suspended' ? 'suspended' : 'reactivated'}`)); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } setConfirm(null); };
  const add = async () => { try { await createUser(f).unwrap(); dispatch(addToast('User created')); setOpen(false); setF({ name: '', email: '', password: '', role: 'instructor' }); setErr(''); } catch (e) { setErr(errMsg(e)); } };
  return (
    <>
      <PageHeader title="User management" subtitle="Manage students and instructors." actions={<Button icon={UserPlus} onClick={() => setOpen(true)}>Add user</Button>} />
      <Tabs value={role} onChange={(r) => { setRole(r); setPage(1); }} tabs={[{ id: 'student', label: 'Students' }, { id: 'instructor', label: 'Instructors' }, { id: 'admin', label: 'Admins' }]} />
      <div className="mt-5"><DataTable dense loading={res.isLoading} error={res.error} rows={res.data?.items || []} meta={res.data?.meta} onPage={setPage} emptyTitle="No users match" emptyMessage="Try a different search or filter."
        toolbar={<><SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name or email" className="w-full sm:w-64" /><Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></Select></>}
        columns={[{ key: 'n', header: 'Name', render: (r) => <div><p className="font-semibold">{r.name}</p><p className="text-xs text-stone-500">{r.email}</p></div> }, { key: 'r', header: 'Role', render: (r) => <Badge tone="accent">{r.role}</Badge> },
          { key: 'a', header: role === 'instructor' ? 'Courses' : 'Enrollments', render: (r) => (r.role === 'instructor' ? r.courses : r.enrollments) }, { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'j', header: 'Joined', render: (r) => date(r.createdAt) }, { key: 'l', header: 'Last login', render: (r) => date(r.lastLoginAt) },
          { key: 'x', header: '', render: (r) => r.role !== 'admin' && r._id !== me._id && <Button size="sm" variant={r.status === 'active' ? 'secondary' : 'soft'} onClick={() => setConfirm({ id: r._id, name: r.name, to: r.status === 'active' ? 'suspended' : 'active' })}>{r.status === 'active' ? 'Suspend' : 'Reactivate'}</Button> }]} /></div>
      <ConfirmModal open={!!confirm} danger={confirm?.to === 'suspended'} onClose={() => setConfirm(null)} onConfirm={toggle} title={`${confirm?.to === 'suspended' ? 'Suspend' : 'Reactivate'} ${confirm?.name}?`} confirmLabel={confirm?.to === 'suspended' ? 'Suspend' : 'Reactivate'} message={confirm?.to === 'suspended' ? 'They will be signed out and unable to log in until reactivated.' : 'They will regain access to their account.'} />
      <Modal open={open} onClose={() => setOpen(false)} title="Add user" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Close</Button><Button loading={isLoading} onClick={add}>Create</Button></>}>
        <div className="space-y-4">{err && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}<Input label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><Input label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /><Input label="Temporary password" type="password" value={f.password} hint="8+ characters with a letter and a number" onChange={(e) => setF({ ...f, password: e.target.value })} /><Select label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="student">Student</option><option value="instructor">Instructor</option><option value="admin">Admin</option></Select></div>
      </Modal>
    </>
  );
}
