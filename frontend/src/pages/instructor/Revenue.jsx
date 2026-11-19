import { useState } from 'react';
import { IndianRupee, Percent, ShoppingCart, Wallet } from 'lucide-react';
import { useRevenueSummaryQuery, useRevenueTransactionsQuery } from '../../app/api';
import { Async, Card, DataTable, PageHeader, Select, StatCard, StatusBadge } from '../../components/ui';
import { AreaTrend, Bars, Donut } from '../../components/Charts';
import { dateTime, inr, monthLabel } from '../../lib/format';

export default function Revenue() {
  const s = useRevenueSummaryQuery(); const [status, setStatus] = useState(''); const [page, setPage] = useState(1);
  const tx = useRevenueTransactionsQuery({ status, page, limit: 8 });
  return (
    <>
      <PageHeader title="Revenue" subtitle="Earnings from paid enrollments (payment gateway in test mode)." />
      <Async q={s}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Wallet} label="Total net revenue" value={inr(d.totals.netRevenue)} /><StatCard icon={IndianRupee} label="Gross" value={inr(d.totals.grossRevenue)} />
              <StatCard icon={Percent} label="Platform fees" value={inr(d.totals.platformFees)} hint="Deducted from each sale" /><StatCard icon={ShoppingCart} label="Paid enrollments" value={d.totals.sales} hint={`${d.totalEnrollments} total enrollments`} />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <Card className="p-5 lg:col-span-3"><h2 className="font-display text-lg font-semibold">Monthly revenue</h2><div className="mt-3"><AreaTrend data={d.monthly.map((m) => ({ month: monthLabel(m.month), Net: m.net / 100 }))} x="month" y="Net" color="#4f46e5" format={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} /></div></Card>
              <Card className="p-5 lg:col-span-2"><h2 className="font-display text-lg font-semibold">Transactions by status</h2><Donut data={['success', 'pending', 'failed'].map((k) => ({ name: k, value: d.transactionCounts[k].count }))} colors={['#10b981', '#f59e0b', '#e11d48']} /><div className="flex justify-center gap-4 text-xs">{[['success', '#10b981'], ['pending', '#f59e0b'], ['failed', '#e11d48']].map(([k, c]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{k} ({d.transactionCounts[k].count})</span>)}</div></Card>
            </div>
            <Card className="mt-6 p-5"><h2 className="font-display text-lg font-semibold">Course-wise earnings</h2><div className="mt-3"><Bars data={d.courses.map((c) => ({ name: c.title.slice(0, 18), 'Net earnings (₹)': c.net / 100 }))} x="name" ys={['Net earnings (₹)']} colors={['#4f46e5']} /></div>
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="text-left text-xs uppercase tracking-wider text-stone-500"><tr><th className="py-2">Course</th><th>Price</th><th>Enrollments</th><th>Paid sales</th><th className="text-right">Net earnings</th></tr></thead><tbody className="divide-y divide-stone-100">{d.courses.map((c) => <tr key={c.courseId}><td className="py-2.5 font-semibold">{c.title}</td><td>{c.price ? `₹${c.price}` : 'Free'}</td><td>{c.enrollments}</td><td>{c.sales}</td><td className="text-right font-semibold">{inr(c.net)}</td></tr>)}</tbody></table></div></Card>
          </>
        )}
      </Async>
      <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Payment transactions</h2>
      <DataTable loading={tx.isLoading} error={tx.error} rows={tx.data?.items || []} meta={tx.data?.meta} onPage={setPage} emptyTitle="No transactions" emptyMessage="Payments for your paid courses show up here."
        toolbar={<Select aria-label="Status filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="success">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option></Select>}
        columns={[{ key: 'd', header: 'Date', render: (r) => dateTime(r.createdAt) }, { key: 's', header: 'Student', render: (r) => r.student?.name }, { key: 'c', header: 'Course', render: (r) => r.course?.title }, { key: 'a', header: 'Amount', render: (r) => <strong>{inr(r.amount)}</strong> }, { key: 'st', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'o', header: 'Order', render: (r) => <span className="font-mono text-xs text-stone-500">{r.orderId}</span> }]} />
    </>
  );
}
