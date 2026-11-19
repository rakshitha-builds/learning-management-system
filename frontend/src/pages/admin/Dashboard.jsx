import { BookCheck, GraduationCap, IndianRupee, Percent, ShieldAlert, Users, Video } from 'lucide-react';
import { useAdminStatsQuery } from '../../app/api';
import { Async, Card, PageHeader, StatCard } from '../../components/ui';
import { AreaTrend, Bars, Donut } from '../../components/Charts';
import { dateTime, inr, monthLabel } from '../../lib/format';

export default function Dashboard() {
  const q = useAdminStatsQuery();
  return (
    <>
      <PageHeader title="Platform overview" subtitle="Live statistics across students, instructors, courses and revenue." />
      <Async q={q}>
        {(d) => (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Users} label="Total users" value={d.users.total} hint={`${d.users.student || 0} students · ${d.users.instructor || 0} instructors`} />
              <StatCard icon={BookCheck} label="Published courses" value={d.courses.published} hint={`${d.courses.byStatus.pending || 0} awaiting review`} />
              <StatCard icon={GraduationCap} label="Enrollments" value={d.enrollments} hint={`${d.videos?.ready || 0} videos ready · ${d.videos?.failed || 0} failed`} />
              <StatCard icon={IndianRupee} label="Gross revenue" value={inr(d.revenue.gross)} hint={`${inr(d.revenue.platformFees)} platform fees`} />
            </div>
            {(d.courses.byStatus.pending || 0) > 0 && <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800"><ShieldAlert className="h-5 w-5" />{d.courses.byStatus.pending} course(s) are waiting for your review. Open “Courses” to approve or reject.</div>}
            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <Card className="p-5 lg:col-span-3"><h2 className="font-display text-lg font-semibold">Gross revenue · last 6 months</h2><div className="mt-3"><AreaTrend data={d.monthly.map((m) => ({ month: monthLabel(m.month), Revenue: m.revenue / 100 }))} x="month" y="Revenue" color="#d97706" format={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} /></div></Card>
              <Card className="p-5 lg:col-span-2"><h2 className="font-display text-lg font-semibold">Users by role</h2><Donut data={['student', 'instructor', 'admin'].map((r) => ({ name: r, value: d.users[r] || 0 }))} colors={['#d97706', '#6366f1', '#44403c']} /><div className="flex justify-center gap-4 text-xs">{['student', 'instructor', 'admin'].map((r) => <span key={r}>{r}: <strong>{d.users[r] || 0}</strong></span>)}</div></Card>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card className="p-5"><h2 className="font-display text-lg font-semibold">Sign-ups & enrollments</h2><div className="mt-3"><Bars data={d.monthly.map((m) => ({ month: monthLabel(m.month), Signups: m.signups, Enrollments: m.enrollments }))} x="month" ys={['Signups', 'Enrollments']} colors={['#f59e0b', '#44403c']} /></div></Card>
              <Card className="p-5"><h2 className="font-display text-lg font-semibold">Top courses</h2><div className="mt-3"><Bars horizontal data={d.topCourses.map((c) => ({ name: c.title.slice(0, 18), Enrollments: c.enrollments }))} x="name" ys={['Enrollments']} colors={['#d97706']} /></div></Card>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <Card className="p-5 lg:col-span-2"><h2 className="font-display text-lg font-semibold">Recent activity</h2><ul className="mt-3 divide-y divide-stone-100">{d.recentActivity.map((a) => <li key={a._id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="truncate"><strong>{a.actorName || 'System'}</strong> · {a.summary || a.action}</span><span className="shrink-0 text-xs text-stone-400">{dateTime(a.createdAt)}</span></li>)}</ul></Card>
              <Card className="p-5"><h2 className="font-display text-lg font-semibold">Payments & live classes</h2><dl className="mt-3 space-y-2 text-sm">{[['Successful payments', d.payments.success], ['Pending payments', d.payments.pending], ['Failed payments', d.payments.failed], ['Live classes held', d.liveClasses.ended], ['Scheduled classes', d.liveClasses.scheduled]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-stone-500">{k}</dt><dd className="font-bold">{v || 0}</dd></div>)}</dl></Card>
            </div>
          </>
        )}
      </Async>
    </>
  );
}
