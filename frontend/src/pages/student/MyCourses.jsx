import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useMyEnrollmentsQuery } from '../../app/api';
import { Async, Badge, Button, Card, EmptyState, PageHeader, ProgressBar } from '../../components/ui';
import { Thumb } from '../../components/CourseCard';
import { date } from '../../lib/format';

export default function MyCourses() {
  const q = useMyEnrollmentsQuery();
  return (
    <>
      <PageHeader title="My learning" subtitle="All the courses you are enrolled in." actions={<Link to="/courses"><Button variant="secondary">Browse more</Button></Link>} />
      <Async q={q} empty={<EmptyState icon={BookOpen} title="You haven’t enrolled in any course yet" message="Find a course that matches your goals and start learning today." action={<Link to="/courses"><Button>Explore courses</Button></Link>} />}>
        {(items) => (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((e) => (
              <Card key={e._id} className="flex flex-col overflow-hidden">
                <Thumb course={e.course} />
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center justify-between"><Badge tone="accent">{e.course.category}</Badge>{e.status === 'completed' && <Badge tone="green">Completed</Badge>}</div>
                  <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold">{e.course.title}</h3>
                  <p className="text-sm text-stone-500">{e.course.instructor?.name}</p>
                  <div className="mt-4"><div className="mb-1 flex justify-between text-xs font-semibold text-stone-500"><span>{e.progress.completedLessons}/{e.progress.totalLessons} lessons</span><span>{e.progress.percent}%</span></div><ProgressBar value={e.progress.percent} /></div>
                  <p className="mt-2 text-xs text-stone-400">Enrolled {date(e.enrolledAt)}</p>
                  <Link to={`/student/learn/${e.course._id}`} className="mt-4"><Button className="w-full">{e.progress.percent === 0 ? 'Start learning' : e.status === 'completed' ? 'Review course' : 'Continue'}</Button></Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Async>
    </>
  );
}
