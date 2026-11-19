import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { BookOpen, IndianRupee, Radio, TrendingUp, Users, Wallet } from 'lucide-react';
import { useLiveListQuery, useMyCoursesQuery, useRevenueSummaryQuery } from '../../app/api';
import { Async, Button, Card, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { AreaTrend, Bars } from '../../components/Charts';
import { dateTime, inr, monthLabel } from '../../lib/format';

export default function Dashboard() {
  const user = useSelector((s) => s.auth.user);
  const rev = useRevenueSummaryQuery(); const courses = useMyCoursesQuery(); const live = useLiveListQuery('upcoming');
  return (
    <>
      <PageHeader title={`Good to see you, ${user.name.split(' ')[0]}`} subtitle="Here is how your courses are performing." actions={<><Link to="/instructor/live"><Button variant="secondary" icon={Radio}>Schedule live class</Button></Link><Link to="/instructor/courses"><Button icon={BookOpen}>Manage courses</Button></Link></>} />
      <Async q={rev}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard icon={Wallet} label="Net revenue" value={inr(d.totals.netRevenue)} hint={`After ${inr(d.totals.platformFees)} platform fees`} />
              <StatCard icon={IndianRupee} label="Gross sales" value={inr(d.totals.grossRevenue)} hint={`${d.totals.sales} paid enrollments`} />
              <StatCard icon={Users} label="Total enrollments" value={d.totalEnrollments} />
              <StatCard icon={TrendingUp} label="Pending payments" value={d.transactionCounts.pending.count} hint={`${d.transactionCounts.failed.count} failed`} />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <Card className="p-5 lg:col-span-3"><h2 className="font-display text-lg font-semibold">Net revenue · last 12 months</h2><div className="mt-3"><AreaTrend data={d.monthly.map((m) => ({ month: monthLabel(m.month), Revenue: m.net / 100 }))} x="month" y="Revenue" color="#4f46e5" format={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} /></div></Card>
              <Card className="p-5 lg:col-span-2"><h2 className="font-display text-lg font-semibold">Enrollments by course</h2><div className="mt-3"><Bars horizontal data={d.courses.map((c) => ({ name: c.title.slice(0, 16), Students: c.enrollments }))} x="name" ys={['Students']} colors={['#6366f1']} /></div></Card>
            </div>
          </>
        )}
      </Async>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5"><h2 className="font-display text-lg font-semibold">Your courses</h2>
          <Async q={courses} empty={<p className="mt-3 text-sm text-stone-500">No courses yet. Create your first one.</p>}>{(items) => <ul className="mt-3 divide-y divide-stone-100">{items.slice(0, 5).map((c) => <li key={c._id}><Link to={`/instructor/courses/${c._id}`} className="flex items-center justify-between gap-3 py-3 hover:text-accent"><span className="truncate font-semibold">{c.title}</span><StatusBadge status={c.isPublished ? 'live' : c.approvalStatus} /></Link></li>)}</ul>}</Async></Card>
        <Card className="p-5"><h2 className="font-display text-lg font-semibold">Upcoming live classes</h2>
          <Async q={live} empty={<p className="mt-3 text-sm text-stone-500">Nothing scheduled.</p>}>{(items) => <ul className="mt-3 divide-y divide-stone-100">{items.slice(0, 5).map((l) => <li key={l._id}><Link to={`/instructor/live/${l._id}`} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate font-semibold">{l.title}</p><p className="text-xs text-stone-500">{dateTime(l.scheduledAt)}</p></div><StatusBadge status={l.status} /></Link></li>)}</ul>}</Async></Card>
      </div>
    </>
  );
}
