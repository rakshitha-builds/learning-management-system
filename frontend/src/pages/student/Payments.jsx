import { useMyPaymentsQuery } from '../../app/api';
import { DataTable, PageHeader, StatusBadge, Badge } from '../../components/ui';
import { dateTime, inr } from '../../lib/format';

export default function Payments() {
  const q = useMyPaymentsQuery();
  return (
    <>
      <PageHeader title="Payments" subtitle="Your purchase history. All payments run in test mode." />
      <DataTable loading={q.isLoading} error={q.error} rows={q.data || []} clientSearch={(r) => `${r.course?.title} ${r.status}`} emptyTitle="No payments yet" emptyMessage="Purchases of paid courses will appear here."
        columns={[
          { key: 'course', header: 'Course', render: (r) => <span className="font-semibold">{r.course?.title}</span> }, { key: 'amount', header: 'Amount', render: (r) => inr(r.amount) },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'gateway', header: 'Gateway', render: (r) => <Badge tone={r.gateway === 'razorpay' ? 'blue' : 'amber'}>{r.gateway === 'razorpay' ? 'Razorpay test' : 'Simulated'}</Badge> },
          { key: 'date', header: 'Date', render: (r) => dateTime(r.createdAt) }, { key: 'note', header: 'Note', render: (r) => <span className="text-xs text-stone-500">{r.failureReason || ''}</span> },
        ]} />
    </>
  );
}
