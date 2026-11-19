import { Link } from 'react-router-dom';
import { Clock, Layers, Users } from 'lucide-react';
import { Badge, Card } from './ui';
import { duration, price } from '../lib/format';

const hues = [168, 215, 35, 250, 350, 300, 140];
export const Thumb = ({ course, className = '' }) => (
  course.thumbnailUrl
    ? <img src={course.thumbnailUrl} alt="" loading="lazy" className={`aspect-video w-full object-cover ${className}`} />
    : <div className={`grid aspect-video w-full place-items-center text-white ${className}`} style={{ background: `linear-gradient(135deg, hsl(${hues[(course.title?.length || 0) % 7]},55%,28%), hsl(${hues[(course.title?.length || 0) % 7] + 40},65%,45%))` }}><span className="px-4 text-center font-display text-xl font-semibold">{course.title}</span></div>
);

export default function CourseCard({ course }) {
  return (
    <Link to={`/courses/${course._id}`} className="group block h-full">
      <Card className="flex h-full flex-col overflow-hidden transition group-hover:-translate-y-0.5 group-hover:shadow-lg">
        <div className="overflow-hidden"><Thumb course={course} className="transition duration-500 group-hover:scale-105" /></div>
        <div className="flex flex-1 flex-col p-4">
          <div className="flex items-center gap-2"><Badge tone="accent">{course.category}</Badge><span className="text-xs font-medium capitalize text-stone-500">{course.level}</span></div>
          <h3 className="mt-2 line-clamp-2 font-display text-lg font-semibold leading-snug">{course.title}</h3>
          <p className="mt-1 text-sm text-stone-500">{course.instructor?.name}</p>
          <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-stone-500">
            <span className="inline-flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{course.lessonsCount} lessons</span>
            {course.totalDuration > 0 && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{duration(course.totalDuration)}</span>}
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{course.enrollmentCount}</span>
          </div>
          <p className="mt-3 font-display text-xl font-semibold text-accent-ink">{price(course.price)}</p>
        </div>
      </Card>
    </Link>
  );
}
