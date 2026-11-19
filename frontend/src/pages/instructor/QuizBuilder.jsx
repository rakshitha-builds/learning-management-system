import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import { useCreateQuizMutation, useUpdateQuizMutation } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Button, Input, Select, Textarea, cx } from '../../components/ui';
import { errMsg } from '../../lib/format';

const blankQ = () => ({ text: '', options: ['', ''], correctIndex: 0, marks: 1, explanation: '' });

export default function QuizBuilder({ courseId, quiz, onDone }) {
  const dispatch = useDispatch(); const [create, { isLoading: c }] = useCreateQuizMutation(); const [update, { isLoading: u }] = useUpdateQuizMutation();
  const [f, setF] = useState(quiz ? { title: quiz.title, description: quiz.description || '', durationMinutes: quiz.durationMinutes, passingMarks: quiz.passingMarks, questions: quiz.questions.map((q) => ({ text: q.text, options: q.options.map((o) => o.text), correctIndex: q.correctIndex, marks: q.marks, explanation: q.explanation || '' })) }
    : { title: '', description: '', durationMinutes: 10, passingMarks: 1, questions: [blankQ()] });
  const [errors, setErrors] = useState([]);
  const total = f.questions.reduce((s, q) => s + Number(q.marks || 0), 0);
  const setQ = (i, patch) => setF({ ...f, questions: f.questions.map((q, x) => (x === i ? { ...q, ...patch } : q)) });
  const setOpt = (i, oi, v) => setQ(i, { options: f.questions[i].options.map((o, x) => (x === oi ? v : o)) });

  const validate = () => {
    const e = [];
    if (f.title.trim().length < 3) e.push('Quiz title must be at least 3 characters');
    if (!(f.durationMinutes >= 1)) e.push('Duration must be at least 1 minute');
    if (f.passingMarks > total) e.push(`Passing marks cannot exceed total marks (${total})`);
    f.questions.forEach((q, i) => { if (q.text.trim().length < 3) e.push(`Question ${i + 1}: enter the question text`); if (q.options.some((o) => !o.trim())) e.push(`Question ${i + 1}: fill in all options (or remove empty ones)`); });
    setErrors(e); return e.length === 0;
  };
  const save = async () => {
    if (!validate()) return;
    const body = { title: f.title.trim(), description: f.description.trim() || undefined, durationMinutes: Number(f.durationMinutes), passingMarks: Number(f.passingMarks),
      questions: f.questions.map((q) => ({ text: q.text.trim(), options: q.options.map((o) => o.trim()), correctIndex: q.correctIndex, marks: Number(q.marks), explanation: q.explanation.trim() || undefined })) };
    try { if (quiz) await update({ id: quiz._id, ...body }).unwrap(); else await create({ courseId, ...body }).unwrap(); dispatch(addToast('Quiz saved')); onDone(); } catch (er) { setErrors([errMsg(er)]); }
  };
  return (
    <div className="space-y-5">
      {errors.length > 0 && <ul role="alert" className="list-disc space-y-1 rounded-lg bg-rose-50 p-3 pl-7 text-sm text-rose-700">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <Input label="Quiz title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Textarea label="Description (optional)" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-3"><Input label="Duration (minutes)" type="number" min="1" value={f.durationMinutes} onChange={(e) => setF({ ...f, durationMinutes: e.target.value })} /><Input label={`Passing marks (of ${total})`} type="number" min="0" value={f.passingMarks} onChange={(e) => setF({ ...f, passingMarks: e.target.value })} /><div className="self-end pb-2 text-sm text-stone-500">Total marks: <strong className="text-ink">{total}</strong></div></div>
      {f.questions.map((q, i) => (
        <div key={i} className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
          <div className="flex items-center justify-between"><p className="text-sm font-bold">Question {i + 1}</p>{f.questions.length > 1 && <button type="button" aria-label={`Remove question ${i + 1}`} className="text-rose-600" onClick={() => setF({ ...f, questions: f.questions.filter((_, x) => x !== i) })}><Trash2 className="h-4 w-4" /></button>}</div>
          <Textarea className="mt-2" rows={2} placeholder="Question text" aria-label={`Question ${i + 1} text`} value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
          <div className="mt-3 space-y-2">{q.options.map((o, oi) => (
            <div key={oi} className="flex items-center gap-2"><input type="radio" name={`correct-${i}`} checked={q.correctIndex === oi} onChange={() => setQ(i, { correctIndex: oi })} aria-label={`Mark option ${oi + 1} correct`} className="h-4 w-4 accent-[rgb(var(--accent))]" /><input value={o} onChange={(e) => setOpt(i, oi, e.target.value)} placeholder={`Option ${oi + 1}`} className={cx('flex-1 rounded-lg border px-3 py-2 text-sm', q.correctIndex === oi ? 'border-emerald-400 bg-emerald-50' : 'border-stone-300 bg-white')} />{q.options.length > 2 && <button type="button" aria-label="Remove option" onClick={() => setQ(i, { options: q.options.filter((_, x) => x !== oi), correctIndex: q.correctIndex >= oi && q.correctIndex > 0 ? q.correctIndex - (q.correctIndex === oi ? 1 : 0) : q.correctIndex })} className="text-stone-400 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div>))}
            {q.options.length < 6 && <Button type="button" size="sm" variant="ghost" icon={Plus} onClick={() => setQ(i, { options: [...q.options, ''] })}>Add option</Button>}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[120px_1fr]"><Input label="Marks" type="number" min="1" value={q.marks} onChange={(e) => setQ(i, { marks: e.target.value })} /><Input label="Explanation (shown after submission)" value={q.explanation} onChange={(e) => setQ(i, { explanation: e.target.value })} /></div>
        </div>))}
      <div className="flex flex-wrap justify-between gap-2"><Button type="button" variant="secondary" icon={Plus} onClick={() => setF({ ...f, questions: [...f.questions, blankQ()] })}>Add question</Button><Button loading={c || u} onClick={save}>{quiz ? 'Save changes' : 'Create quiz'}</Button></div>
    </div>
  );
}
