import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { CalendarPlus, Radio } from 'lucide-react';
import { useCancelLiveMutation, useLiveListQuery, useMyCoursesQuery, useScheduleLiveMutation } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Button, DataTable, Input, Modal, PageHeader, Select, StatusBadge, Tabs, Textarea } from '../../components/ui';
import { dateTime, errMsg } from '../../lib/format';

const localInput = (d) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 16); };

export default function InstructorLive() {
  const dispatch = useDispatch(); const [tab, setTab] = useState('upcoming'); const [open, setOpen] = useState(false);
  const q = useLiveListQuery(tab, { pollingInterval: 15000 }); const courses = useMyCoursesQuery(); const [schedule, { isLoading }] = useScheduleLiveMutation(); const [cancel] = useCancelLiveMutation();
  const [f, setF] = useState({ courseId: '', title: '', description: '', scheduledAt: localInput(new Date(Date.now() + 86400000)), durationMinutes: 60 }); const [err, setErr] = useState('');
  const submit = async () => {
    if (!f.courseId) return setErr('Choose a course'); if (f.title.trim().length < 3) return setErr('Enter a class title');
    try { await schedule({ ...f, scheduledAt: new Date(f.scheduledAt).toISOString(), durationMinutes: Number(f.durationMinutes) }).unwrap(); dispatch(addToast('Live class scheduled. Enrolled students were notified.')); setOpen(false); setErr(''); } catch (e) { setErr(errMsg(e)); }
  };
  return (
    <>
      <PageHeader title="Live classes" subtitle="Schedule and conduct real-time classes with LiveKit." actions={<Button icon={CalendarPlus} onClick={() => setOpen(true)}>Schedule class</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'upcoming', label: 'Upcoming & live' }, { id: 'past', label: 'Past' }]} />
      <div className="mt-5"><DataTable loading={q.isLoading} error={q.error} rows={q.data || []} emptyTitle={tab === 'upcoming' ? 'Nothing scheduled' : 'No past classes'} emptyMessage="Use “Schedule class” to plan a session for your students."
        columns={[{ key: 't', header: 'Class', render: (r) => <div><p className="font-semibold">{r.title}</p><p className="text-xs text-stone-500">{r.course?.title}</p></div> }, { key: 'w', header: 'When', render: (r) => dateTime(r.scheduledAt) }, { key: 'd', header: 'Duration', render: (r) => `${r.durationMinutes} min` }, { key: 's', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'a', header: '', render: (r) => (<div className="flex gap-2">{['scheduled', 'live'].includes(r.status) && <Link to={`/instructor/live/${r._id}`}><Button size="sm" icon={Radio}>{r.status === 'live' ? 'Open room' : 'Start'}</Button></Link>}{r.status === 'scheduled' && <Button size="sm" variant="ghost" onClick={() => window.confirm('Cancel this class?') && cancel(r._id)}>Cancel</Button>}</div>) }]} /></div>
      <Modal open={open} onClose={() => setOpen(false)} title="Schedule a live class" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Close</Button><Button loading={isLoading} onClick={submit}>Schedule</Button></>}>
        <div className="space-y-4">{err && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{err}</p>}
          <Select label="Course" value={f.courseId} onChange={(e) => setF({ ...f, courseId: e.target.value })}><option value="">Select a course…</option>{(courses.data || []).map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}</Select>
          <Input label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /><Textarea label="Description (optional)" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Date & time" type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} /><Input label="Duration (minutes)" type="number" min="5" value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: e.target.value })} /></div></div>
      </Modal>
    </>
  );
}
