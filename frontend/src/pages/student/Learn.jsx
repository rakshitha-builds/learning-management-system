import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Award, Check, CheckCircle2, Circle, FileQuestion, Film, Loader2, PlayCircle } from 'lucide-react';
import { useCourseProgressQuery, useCourseQuizzesQuery, useGetCourseQuery, useGetPlaybackQuery, useIssueCertificateMutation, useUpdateLessonProgressMutation } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Async, Badge, Button, Card, ProgressBar, Tabs, cx } from '../../components/ui';
import VideoPlayer from '../../components/VideoPlayer';
import { downloadCertificate } from '../../lib/upload';
import { clock, errMsg } from '../../lib/format';

export default function Learn() {
  const { courseId } = useParams(); const dispatch = useDispatch(); const token = useSelector((s) => s.auth.token);
  const course = useGetCourseQuery(courseId); const progress = useCourseProgressQuery(courseId); const quizzes = useCourseQuizzesQuery(courseId);
  const [lessonId, setLessonId] = useState(null); const [tab, setTab] = useState('lessons');
  const [saveProgress] = useUpdateLessonProgressMutation(); const [issue, { isLoading: issuing }] = useIssueCertificateMutation();

  const lessons = useMemo(() => course.data?.curriculum.flatMap((m) => m.lessons) || [], [course.data]);
  const doneMap = useMemo(() => new Map((progress.data?.lessons || []).map((l) => [l.lessonId, l])), [progress.data]);
  useEffect(() => { if (!lessonId && lessons.length && progress.data) setLessonId((lessons.find((l) => !doneMap.get(l._id)?.completed) || lessons[0])._id); }, [lessons, progress.data, lessonId, doneMap]);

  const lesson = lessons.find((l) => l._id === lessonId);
  const pb = useGetPlaybackQuery(lessonId, { skip: !lessonId || !lesson?.hasVideo });
  const startAt = doneMap.get(lessonId)?.completed ? 0 : doneMap.get(lessonId)?.watchedSeconds || 0;
  const sent = useRef({});
  const report = (cur, dur) => saveProgress({ lessonId, watchedSeconds: cur, duration: dur });
  const markDone = async () => { try { await saveProgress({ lessonId, completed: true }).unwrap(); dispatch(addToast('Lesson marked as complete')); const i = lessons.findIndex((l) => l._id === lessonId); if (lessons[i + 1]) setLessonId(lessons[i + 1]._id); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } };
  const claim = async () => { try { const c = await issue(courseId).unwrap(); await downloadCertificate(c.certificateId, token); dispatch(addToast('Certificate downloaded 🎉')); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } };

  return (
    <Async q={course}>
      {(c) => (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><Link to="/student/courses" className="text-sm font-semibold text-accent">← My learning</Link><h1 className="truncate font-display text-2xl font-semibold">{c.title}</h1></div>
            {progress.data && <div className="w-full sm:w-72"><div className="mb-1 flex justify-between text-xs font-semibold text-stone-500"><span>{progress.data.completedLessons}/{progress.data.totalLessons} lessons · {progress.data.passedQuizzes}/{progress.data.totalQuizzes} quizzes</span><span>{progress.data.percent}%</span></div><ProgressBar value={progress.data.percent} /></div>}
          </div>
          {progress.data?.eligibleForCertificate && <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center gap-3"><Award className="h-8 w-8 text-emerald-600" /><div><p className="font-semibold text-emerald-800">Congratulations — you completed this course!</p><p className="text-sm text-emerald-700">Your certificate is ready to download.</p></div></div><Button loading={issuing} onClick={claim}>Get certificate</Button></Card>}
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div>
              {lesson ? (
                <>
                  {!lesson.hasVideo ? <div className="grid aspect-video place-items-center rounded-xl bg-stone-900 text-center text-stone-300"><div><Film className="mx-auto h-10 w-10 text-stone-500" /><p className="mt-2 text-sm">The instructor hasn’t uploaded a video for this lesson yet.</p></div></div>
                    : pb.isLoading ? <div className="grid aspect-video place-items-center rounded-xl bg-stone-900"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>
                    : pb.isError ? <div className="grid aspect-video place-items-center rounded-xl bg-stone-900 p-6 text-center text-stone-200"><div><Film className="mx-auto h-10 w-10 text-amber-400" /><p className="mt-2 text-sm">{pb.error?.data?.message || 'Video unavailable'}</p></div></div>
                    : <VideoPlayer key={lessonId} playback={pb.data} startAt={startAt} onProgress={report} onEnded={() => !doneMap.get(lessonId)?.completed && markDone()} />}
                  <div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold">{lesson.title}</h2>{lesson.description && <p className="mt-1 text-sm text-stone-500">{lesson.description}</p>}</div>
                    {doneMap.get(lessonId)?.completed ? <Badge tone="green"><Check className="h-3 w-3" />Completed</Badge> : <Button variant="secondary" onClick={markDone}>Mark as complete</Button>}</div>
                </>
              ) : <Card className="p-10 text-center text-stone-500">This course has no lessons yet.</Card>}
            </div>
            <Card className="self-start overflow-hidden">
              <div className="px-2 pt-2"><Tabs value={tab} onChange={setTab} tabs={[{ id: 'lessons', label: 'Lessons', count: lessons.length }, { id: 'quizzes', label: 'Quizzes', count: quizzes.data?.length }]} /></div>
              <div className="max-h-[560px] overflow-y-auto scrollbar-thin">
                {tab === 'lessons' ? c.curriculum.map((m) => (
                  <div key={m._id}><p className="bg-stone-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-stone-500">{m.title}</p>
                    {m.lessons.map((l) => { const done = doneMap.get(l._id)?.completed; return (
                      <button key={l._id} onClick={() => setLessonId(l._id)} className={cx('flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition hover:bg-stone-50', l._id === lessonId && 'bg-accent-soft/60')}>
                        {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : l._id === lessonId ? <PlayCircle className="h-5 w-5 shrink-0 text-accent" /> : <Circle className="h-5 w-5 shrink-0 text-stone-300" />}
                        <span className="flex-1 font-medium">{l.title}</span>{l.duration > 0 && <span className="text-xs text-stone-400">{clock(l.duration)}</span>}
                      </button>); })}
                  </div>
                )) : (
                  <ul className="divide-y divide-stone-100">{!quizzes.data?.length ? <li className="p-6 text-center text-sm text-stone-500">This course has no quizzes.</li> : quizzes.data.map((z) => (
                    <li key={z._id} className="p-4"><div className="flex items-start gap-3"><FileQuestion className="mt-0.5 h-5 w-5 text-accent" /><div className="flex-1"><p className="font-semibold">{z.title}</p><p className="text-xs text-stone-500">{z.questionCount} questions · {z.durationMinutes} min · pass at {z.passingMarks}/{z.totalMarks}</p>{z.attemptsCount > 0 && <p className="mt-1 text-xs font-semibold">Best: {z.bestPercentage}% {z.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="red">Not passed</Badge>}</p>}</div></div><Link to={`/student/quiz/${z._id}`}><Button size="sm" variant={z.passed ? 'secondary' : 'primary'} className="mt-3 w-full">{z.attemptsCount ? 'Retake quiz' : 'Start quiz'}</Button></Link></li>
                  ))}</ul>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </Async>
  );
}
