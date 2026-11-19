import { useState } from 'react';
import { useAdminActivityQuery, useAdminEnrollmentsQuery, useAdminTransactionsQuery } from '../../app/api';
import { Badge, DataTable, PageHeader, Select, StatusBadge } from '../../components/ui';
import { dateTime, inr } from '../../lib/format';

export function AdminEnrollments() {
  const [page, setPage] = useState(1); const q = useAdminEnrollmentsQuery({ page, limit: 12 });
  return (<><PageHeader title="Enrollments" subtitle="Every student enrollment on the platform." />
    <DataTable dense loading={q.isLoading} error={q.error} rows={q.data?.items || []} meta={q.data?.meta} onPage={setPage} clientSearch={(r) => `${r.student?.name} ${r.student?.email} ${r.course?.title}`} emptyTitle="No enrollments yet"
      columns={[{ key: 's', header: 'Student', render: (r) => <div><p className="font-semibold">{r.student?.name}</p><p className="text-xs text-stone-500">{r.student?.email}</p></div> }, { key: 'c', header: 'Course', render: (r) => r.course?.title }, { key: 'p', header: 'Type', render: (r) => (r.payment ? <Badge tone="blue">Paid</Badge> : <Badge>Free</Badge>) }, { key: 'st', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'd', header: 'Enrolled', render: (r) => dateTime(r.createdAt) }]} /></>);
}
export function AdminTransactions() {
  const [page, setPage] = useState(1); const [status, setStatus] = useState(''); const q = useAdminTransactionsQuery({ page, status, limit: 12 });
  return (<><PageHeader title="Transactions" subtitle="All payments across the platform (test mode)." />
    <DataTable dense loading={q.isLoading} error={q.error} rows={q.data?.items || []} meta={q.data?.meta} onPage={setPage} emptyTitle="No transactions"
      toolbar={<Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="success">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option></Select>}
      columns={[{ key: 'd', header: 'Date', render: (r) => dateTime(r.createdAt) }, { key: 's', header: 'Student', render: (r) => r.student?.name }, { key: 'c', header: 'Course', render: (r) => <div>{r.course?.title}<p className="text-xs text-stone-500">by {r.instructor?.name}</p></div> }, { key: 'a', header: 'Amount', render: (r) => <strong>{inr(r.amount)}</strong> }, { key: 'st', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'g', header: 'Gateway', render: (r) => <Badge tone={r.gateway === 'razorpay' ? 'blue' : 'amber'}>{r.gateway}</Badge> }, { key: 'o', header: 'Order', render: (r) => <span className="font-mono text-xs text-stone-500">{r.orderId}</span> }]} /></>);
}
export function AdminActivity() {
  const [page, setPage] = useState(1); const q = useAdminActivityQuery({ page, limit: 15 });
  return (<><PageHeader title="Platform activity" subtitle="Audit trail of important actions." />
    <DataTable dense loading={q.isLoading} error={q.error} rows={q.data?.items || []} meta={q.data?.meta} onPage={setPage} clientSearch={(r) => `${r.actorName} ${r.action} ${r.summary}`} emptyTitle="No activity recorded"
      columns={[{ key: 'd', header: 'When', render: (r) => dateTime(r.createdAt) }, { key: 'a', header: 'Actor', render: (r) => r.actorName || 'System' }, { key: 'x', header: 'Action', render: (r) => <Badge tone="accent">{r.action}</Badge> }, { key: 's', header: 'Details', render: (r) => r.summary }]} /></>);
}
