import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { BarChart3, CheckCircle2, ChevronDown, Clock, FileQuestion, Lock, PlayCircle, Users } from 'lucide-react';
import { useEnrollMutation, useGetCourseQuery, useGetPlaybackQuery } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Async, Badge, Button, Card, Modal, Spinner, cx } from '../../components/ui';
import { Thumb } from '../../components/CourseCard';
import CheckoutModal from '../../components/CheckoutModal';
import VideoPlayer from '../../components/VideoPlayer';
import { clock, duration, errMsg, price } from '../../lib/format';

function PreviewModal({ lesson, onClose }) {
  const q = useGetPlaybackQuery(lesson?._id, { skip: !lesson });
  return (
    <Modal open={!!lesson} onClose={onClose} title={lesson?.title || ''} wide>
      {q.isLoading ? <div className="grid aspect-video place-items-center"><Spinner className="h-8 w-8" /></div> : q.isError ? <p className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{q.error?.data?.message || 'Preview unavailable'}</p> : <VideoPlayer playback={q.data} />}
    </Modal>
  );
}

export default function CourseDetail() {
  const { id } = useParams(); const user = useSelector((s) => s.auth.user); const dispatch = useDispatch(); const navigate = useNavigate();
  const q = useGetCourseQuery(id); const [enroll, { isLoading }] = useEnrollMutation();
  const [open, setOpen] = useState({ 0: true }); const [checkout, setCheckout] = useState(false); const [preview, setPreview] = useState(null);

  return (
    <Async q={q}>
      {(c) => {
        const onEnroll = async () => {
          if (!user) return navigate('/login', { state: { from: `/courses/${id}` } });
          if (c.price > 0) return setCheckout(true);
          try { await enroll(c._id).unwrap(); dispatch(addToast('Enrolled! Happy learning.')); navigate(`/student/learn/${c._id}`); } catch (e) { dispatch(addToast(errMsg(e), 'error')); }
        };
        const lessonCount = c.curriculum.reduce((n, m) => n + m.lessons.length, 0);
        return (
          <>
            <section className="border-b border-stone-200 bg-[#0c2f2c] text-white">
              <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-8 lg:grid-cols-[1fr_380px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="accent">{c.category}</Badge><span className="text-sm capitalize text-teal-100">{c.level}</span>{!c.isLive && <Badge tone="amber">{c.approvalStatus} · not public</Badge>}</div>
                  <h1 className="mt-3 font-display text-3xl font-semibold leading-tight sm:text-5xl">{c.title}</h1>
                  <p className="mt-4 max-w-2xl text-teal-50/85">{c.description}</p>
                  <div className="mt-5 flex flex-wrap gap-5 text-sm text-teal-100"><span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{c.enrollmentCount} students</span><span className="inline-flex items-center gap-1.5"><PlayCircle className="h-4 w-4" />{lessonCount} lessons</span>{c.totalDuration > 0 && <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{duration(c.totalDuration)}</span>}<span className="inline-flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />{c.level}</span></div>
                  <p className="mt-4 text-sm">Taught by <strong>{c.instructor?.name}</strong>{c.instructor?.headline && <span className="text-teal-200"> — {c.instructor.headline}</span>}</p>
                </div>
                <Card className="self-start overflow-hidden text-ink lg:-mb-24 lg:shadow-2xl">
                  <Thumb course={c} />
                  <div className="p-5">
                    <p className="font-display text-3xl font-semibold text-accent-ink">{price(c.price)}</p>
                    {c.isEnrolled ? <Link to={`/student/learn/${c._id}`}><Button className="mt-4 w-full" size="lg">Continue learning</Button></Link>
                      : c.isOwner ? <Link to={`/instructor/courses/${c._id}`}><Button className="mt-4 w-full" size="lg">Edit this course</Button></Link>
                      : user?.role === 'admin' ? <p className="mt-4 rounded-lg bg-stone-100 p-3 text-center text-sm text-stone-500">Admins review courses from the console.</p>
                      : user?.role === 'instructor' ? <p className="mt-4 rounded-lg bg-stone-100 p-3 text-center text-sm text-stone-500">Sign in as a student to enroll.</p>
                      : <Button className="mt-4 w-full" size="lg" loading={isLoading} onClick={onEnroll}>{!user ? 'Sign in to enroll' : c.price > 0 ? 'Buy now' : 'Enroll for free'}</Button>}
                    <ul className="mt-5 space-y-2 text-sm text-stone-600">{['Lifetime access to all lessons', 'Auto-graded quizzes', 'Live classes with the instructor', 'Verifiable PDF certificate'].map((t) => <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{t}</li>)}</ul>
                  </div>
                </Card>
              </div>
            </section>

            <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 lg:pr-[444px]">
              <h2 className="font-display text-2xl font-semibold">Course content</h2>
              <p className="mt-1 text-sm text-stone-500">{c.curriculum.length} modules · {lessonCount} lessons</p>
              <div className="mt-4 space-y-3">
                {c.curriculum.length === 0 && <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">The curriculum is being prepared.</p>}
                {c.curriculum.map((m, i) => (
                  <Card key={m._id} className="overflow-hidden">
                    <button onClick={() => setOpen({ ...open, [i]: !open[i] })} className="flex w-full items-center justify-between px-5 py-4 text-left" aria-expanded={!!open[i]}><span className="font-semibold">{m.title}<span className="ml-2 text-xs font-normal text-stone-500">{m.lessons.length} lessons</span></span><ChevronDown className={cx('h-5 w-5 text-stone-400 transition', open[i] && 'rotate-180')} /></button>
                    {open[i] && <ul className="divide-y divide-stone-100 border-t border-stone-100">{m.lessons.map((l) => {
                      const canPlay = l.isPreview && l.hasVideo && user && !c.isEnrolled;
                      return <li key={l._id} className="flex items-center gap-3 px-5 py-3 text-sm">{c.isEnrolled || c.isOwner || l.isPreview ? <PlayCircle className="h-4 w-4 text-accent" /> : <Lock className="h-4 w-4 text-stone-400" />}<span className="flex-1">{l.title}</span>{l.isPreview && <button disabled={!canPlay} onClick={() => setPreview(l)} className={cx('rounded-full px-2 py-0.5 text-xs font-semibold', canPlay ? 'bg-accent-soft text-accent-ink hover:brightness-95' : 'bg-stone-100 text-stone-500')}>Free preview</button>}{l.duration > 0 && <span className="text-xs text-stone-400">{clock(l.duration)}</span>}</li>;
                    })}</ul>}
                  </Card>
                ))}
              </div>
              {c.quizzes?.length > 0 && <div className="mt-6"><h3 className="font-display text-xl font-semibold">Quizzes</h3><ul className="mt-2 space-y-2">{c.quizzes.map((z) => <li key={z._id} className="flex items-center gap-2 text-sm text-stone-600"><FileQuestion className="h-4 w-4 text-accent" />{z.title} · {z.questionCount} questions · {z.durationMinutes} min</li>)}</ul></div>}
            </div>
            {checkout && <CheckoutModal course={c} open={checkout} onClose={() => setCheckout(false)} onPaid={() => { setCheckout(false); navigate(`/student/learn/${c._id}`); }} />}
            <PreviewModal lesson={preview} onClose={() => setPreview(null)} />
          </>
        );
      }}
    </Async>
  );
}
