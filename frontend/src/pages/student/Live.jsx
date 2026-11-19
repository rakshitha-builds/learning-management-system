import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Radio, Video } from 'lucide-react';
import { useLiveListQuery } from '../../app/api';
import { Async, Button, Card, EmptyState, PageHeader, StatusBadge, Tabs } from '../../components/ui';
import { dateTime } from '../../lib/format';

export default function StudentLive() {
  const [tab, setTab] = useState('upcoming');
  const q = useLiveListQuery(tab, { pollingInterval: 15000 });
  return (
    <>
      <PageHeader title="Live classes" subtitle="Real-time classes for the courses you are enrolled in." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'upcoming', label: 'Upcoming & live' }, { id: 'past', label: 'Past' }]} />
      <div className="mt-6">
        <Async q={q} empty={<EmptyState icon={CalendarClock} title={tab === 'upcoming' ? 'No upcoming live classes' : 'No past classes'} message="Your instructors will schedule sessions here." />}>
          {(items) => <div className="grid gap-4 md:grid-cols-2">{items.map((l) => (
            <Card key={l._id} className="p-5">
              <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent-ink">{l.status === 'live' ? <Radio className="h-5 w-5" /> : <Video className="h-5 w-5" />}</span><StatusBadge status={l.status} /></div>
              <h3 className="mt-3 font-display text-lg font-semibold">{l.title}</h3><p className="text-sm text-stone-500">{l.course?.title} · {l.instructor?.name}</p>
              <p className="mt-2 text-sm"><CalendarClock className="mr-1 inline h-4 w-4 text-stone-400" />{dateTime(l.scheduledAt)} · {l.durationMinutes} min</p>
              {l.description && <p className="mt-2 line-clamp-2 text-sm text-stone-500">{l.description}</p>}
              {l.status === 'live' ? <Link to={`/student/live/${l._id}`}><Button className="mt-4 w-full" icon={Radio}>Join live class</Button></Link> : l.status === 'scheduled' ? <Button disabled className="mt-4 w-full" variant="secondary">Starts when the instructor goes live</Button> : null}
            </Card>))}</div>}
        </Async>
      </div>
    </>
  );
}
