import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Clock, ListChecks } from 'lucide-react';
import { useGetCourseQuery, useStartAttemptMutation, useSubmitAttemptMutation } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Button, Card, ConfirmModal, PageLoader, ProgressBar, cx } from '../../components/ui';
import { errMsg } from '../../lib/format';

const mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export default function QuizTake() {
  const { quizId } = useParams(); const navigate = useNavigate(); const dispatch = useDispatch();
  const [start, { isLoading: starting }] = useStartAttemptMutation(); const [submit, { isLoading: submitting }] = useSubmitAttemptMutation();
  const [session, setSession] = useState(null); const [answers, setAnswers] = useState({}); const [idx, setIdx] = useState(0); const [left, setLeft] = useState(0); const [confirm, setConfirm] = useState(false);
  const done = useRef(false);

  const begin = async () => { try { const s = await start(quizId).unwrap(); setSession(s); setLeft(new Date(s.expiresAt) - Date.now()); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } };
  const finish = async (auto = false) => {
    if (done.current || !session) return; done.current = true;
    try { const r = await submit({ attemptId: session.attemptId, answers: session.quiz.questions.map((q) => ({ questionId: q._id, selectedIndex: answers[q._id] ?? null })) }).unwrap(); if (auto) dispatch(addToast('Time is up — your quiz was submitted automatically.', 'warning')); navigate(`/student/results/${r._id}`, { replace: true }); }
    catch (e) { done.current = false; dispatch(addToast(errMsg(e), 'error')); setConfirm(false); }
  };
  useEffect(() => { if (!session) return undefined; const t = setInterval(() => setLeft(new Date(session.expiresAt) - Date.now()), 500); return () => clearInterval(t); }, [session]);
  useEffect(() => { if (session && left <= 0) finish(true); }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session) return (
    <Card className="mx-auto max-w-xl p-8 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-ink"><ListChecks className="h-7 w-7" /></span><h1 className="mt-4 font-display text-2xl font-semibold">Ready to start the quiz?</h1>
      <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-sm text-stone-600"><li>• The timer starts as soon as you begin and cannot be paused.</li><li>• Your quiz is submitted automatically when time runs out.</li><li>• You will see your score and the correct answers right after submitting.</li></ul>
      <Button size="lg" className="mt-6" loading={starting} onClick={begin}>Start quiz</Button></Card>
  );
  const q = session.quiz.questions[idx]; const answered = Object.keys(answers).length; const total = session.quiz.questions.length;
  return (
    <div className="mx-auto max-w-3xl">
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-stone-200 bg-paper/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex items-center justify-between"><h1 className="truncate font-display text-lg font-semibold">{session.quiz.title}</h1><span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums', left < 60000 ? 'bg-rose-100 text-rose-700' : 'bg-accent-soft text-accent-ink')}><Clock className="h-4 w-4" />{mmss(left)}</span></div>
        <ProgressBar value={(answered / total) * 100} className="mt-2" />
      </div>
      <Card className="p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Question {idx + 1} of {total} · {q.marks} mark{q.marks > 1 ? 's' : ''}</p>
        <h2 className="mt-2 text-lg font-semibold">{q.text}</h2>
        <div className="mt-5 space-y-2" role="radiogroup" aria-label={q.text}>
          {q.options.map((o, i) => <button key={o._id} role="radio" aria-checked={answers[q._id] === i} onClick={() => setAnswers({ ...answers, [q._id]: i })} className={cx('flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition', answers[q._id] === i ? 'border-accent bg-accent-soft/60' : 'border-stone-200 hover:border-accent/60')}><span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-bold', answers[q._id] === i ? 'border-accent bg-accent text-white' : 'border-stone-300')}>{String.fromCharCode(65 + i)}</span>{o.text}</button>)}
        </div>
        <div className="mt-6 flex items-center justify-between"><Button variant="secondary" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</Button>{idx < total - 1 ? <Button onClick={() => setIdx(idx + 1)}>Next</Button> : <Button onClick={() => setConfirm(true)}>Submit quiz</Button>}</div>
      </Card>
      <div className="mt-4 flex flex-wrap gap-2">{session.quiz.questions.map((x, i) => <button key={x._id} onClick={() => setIdx(i)} aria-label={`Go to question ${i + 1}`} className={cx('h-9 w-9 rounded-lg border text-sm font-bold', i === idx ? 'border-accent bg-accent text-white' : answers[x._id] !== undefined ? 'border-accent/40 bg-accent-soft text-accent-ink' : 'border-stone-300 bg-white')}>{i + 1}</button>)}<Button variant="ghost" size="sm" className="ml-auto" onClick={() => setConfirm(true)}>Finish now</Button></div>
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} loading={submitting} onConfirm={() => finish(false)} title="Submit your answers?" confirmLabel="Submit" message={answered < total ? `You have answered ${answered} of ${total} questions. Unanswered questions score zero.` : 'You have answered every question. Submit for grading?'} />
    </div>
  );
}
