import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useAttemptResultQuery } from '../../app/api';
import { Async, Badge, Button, Card, cx } from '../../components/ui';
import { RingProgress } from '../../components/Charts';

export default function QuizResult() {
  const { attemptId } = useParams(); const q = useAttemptResultQuery(attemptId);
  return (
    <Async q={q}>
      {(r) => (
        <div className="mx-auto max-w-3xl">
          <Card className="flex flex-wrap items-center gap-6 p-6">
            <RingProgress value={Math.round(r.percentage)} size={110} stroke={10} />
            <div className="flex-1"><p className="text-xs font-bold uppercase tracking-wider text-stone-500">{r.quiz?.title}</p><h1 className="mt-1 font-display text-3xl font-semibold">{r.passed ? 'You passed! 🎉' : r.timedOut ? 'Submitted after time limit' : 'Not passed yet'}</h1><p className="mt-1 text-stone-500">Score {r.score}/{r.totalMarks} · pass mark {r.quiz?.passingMarks} · {Math.floor((r.timeTakenSec || 0) / 60)}m {(r.timeTakenSec || 0) % 60}s</p><div className="mt-2">{r.passed ? <Badge tone="green">Passed</Badge> : <Badge tone="red">Failed</Badge>}{r.timedOut && <Badge tone="amber" className="ml-2">Timed out</Badge>}</div></div>
            <Link to={`/student/quiz/${r.quiz?._id}`}><Button variant="secondary">Retake</Button></Link>
          </Card>
          <h2 className="mb-3 mt-8 font-display text-xl font-semibold">Review</h2>
          <div className="space-y-4">
            {r.review?.map((x, i) => (
              <Card key={x.questionId} className="p-5">
                <div className="flex items-start gap-3">{x.isCorrect ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />}<div className="flex-1"><p className="font-semibold">{i + 1}. {x.text}</p><span className="text-xs text-stone-500">{x.marksAwarded}/{x.marks} marks</span></div></div>
                <ul className="mt-3 space-y-1.5">{x.options.map((o, oi) => <li key={oi} className={cx('rounded-lg border px-3 py-2 text-sm', oi === x.correctIndex ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-800' : oi === x.selectedIndex ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-stone-200')}>{o}{oi === x.correctIndex && ' ✓ correct'}{oi === x.selectedIndex && oi !== x.correctIndex && ' — your answer'}{oi === x.selectedIndex && oi === x.correctIndex && ' (your answer)'}</li>)}</ul>
                {x.selectedIndex === null && <p className="mt-2 text-xs font-semibold text-amber-700">Not answered</p>}
                {x.explanation && <p className="mt-3 rounded-lg bg-stone-50 p-3 text-sm text-stone-600"><strong>Explanation:</strong> {x.explanation}</p>}
              </Card>
            ))}
          </div>
        </div>
      )}
    </Async>
  );
}
