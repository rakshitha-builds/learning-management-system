import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Award, BookOpenCheck, CheckCircle2, Clock, FileQuestion, GraduationCap, Radio, Target } from 'lucide-react';
import { useLiveListQuery, useProgressSummaryQuery } from '../../app/api';
import { Async, Badge, Button, Card, EmptyState, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { Bars, Lines, RingProgress } from '../../components/Charts';
import { dateTime } from '../../lib/format';

export default function Dashboard() {
  const user = useSelector((s) => s.auth.user);
  const q = useProgressSummaryQuery(); const live = useLiveListQuery('upcoming');
  return (
    <>
      <div className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-700 to-emerald-600 p-6 text-white shadow-card sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-100">Your learning space</p>
        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Welcome back, {user.name.split(' ')[0]}.</h1>
        <p className="mt-2 max-w-xl text-teal-50/85">Pick up where you left off, join a live class, or take a quiz to check your progress.</p>
        <div className="mt-5 flex flex-wrap gap-2"><Link to="/student/courses"><Button className="!bg-white !text-teal-900">My learning</Button></Link><Link to="/courses"><Button variant="ghost" className="!text-white ring-1 ring-white/40 hover:!bg-white/10">Find new courses</Button></Link></div>
      </div>
      <Async q={q}>
        {(d) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard icon={GraduationCap} label="Enrolled courses" value={d.cards.enrolledCourses} hint={`${d.cards.completedCourses} completed`} />
              <StatCard icon={CheckCircle2} label="Lessons completed" value={d.cards.lessonsCompleted} />
              <StatCard icon={Clock} label="Watch time" value={`${d.cards.watchTimeMinutes} min`} />
              <StatCard icon={FileQuestion} label="Quizzes taken" value={d.cards.quizzesTaken} />
              <StatCard icon={Target} label="Average quiz score" value={`${d.cards.averageQuizScore}%`} />
              <StatCard icon={Award} label="Courses completed" value={d.cards.completedCourses} />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <Card className="p-5 lg:col-span-3"><h2 className="font-display text-lg font-semibold">Lessons completed · last 14 days</h2><div className="mt-3"><Bars data={d.activity.map((a) => ({ day: a.date.slice(5), Lessons: a.lessons }))} x="day" ys={['Lessons']} colors={['#0f766e']} /></div></Card>
              <Card className="p-5 lg:col-span-2"><h2 className="font-display text-lg font-semibold">Recent quiz scores</h2>{d.quizScores.length ? <div className="mt-3"><Lines data={d.quizScores.map((s, i) => ({ n: `#${i + 1}`, Score: s.percentage }))} x="n" ys={['Score']} colors={['#6366f1']} format={(v) => `${v}%`} /></div> : <p className="mt-6 text-sm text-stone-500">Take a quiz to see your scores here.</p>}</Card>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card className="p-5"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Continue learning</h2><Link to="/student/courses" className="text-sm font-semibold text-accent">View all</Link></div>
                {d.courses.length === 0 ? <div className="mt-4"><EmptyState icon={BookOpenCheck} title="No courses yet" message="Enroll in a course to start tracking progress." action={<Link to="/courses"><Button>Browse courses</Button></Link>} /></div> : (
                  <ul className="mt-4 space-y-3">{d.courses.slice(0, 4).map((c) => (
                    <li key={c.courseId}><Link to={`/student/learn/${c.courseId}`} className="flex items-center gap-4 rounded-xl border border-stone-200 p-3 transition hover:border-accent"><RingProgress value={c.percent} size={56} stroke={6} /><div className="min-w-0 flex-1"><p className="truncate font-semibold">{c.title}</p><p className="text-xs text-stone-500">{c.completedLessons}/{c.totalLessons} lessons · {c.passedQuizzes}/{c.totalQuizzes} quizzes</p></div>{c.status === 'completed' && <Badge tone="green">Completed</Badge>}</Link></li>
                  ))}</ul>)}
              </Card>
              <Card className="p-5"><div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Upcoming live classes</h2><Link to="/student/live" className="text-sm font-semibold text-accent">See all</Link></div>
                <Async q={live} empty={<p className="mt-4 text-sm text-stone-500">No upcoming classes for your courses.</p>}>
                  {(items) => <ul className="mt-4 space-y-3">{items.slice(0, 4).map((l) => <li key={l._id} className="flex items-center gap-3 rounded-xl border border-stone-200 p-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-accent-soft text-accent-ink"><Radio className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{l.title}</p><p className="text-xs text-stone-500">{l.course?.title} · {dateTime(l.scheduledAt)}</p></div><StatusBadge status={l.status} /></li>)}</ul>}
                </Async>
              </Card>
            </div>
          </>
        )}
      </Async>
    </>
  );
}
