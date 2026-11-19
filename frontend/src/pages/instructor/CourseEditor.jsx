import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AlertTriangle, CheckCircle2, FileQuestion, Film, ImagePlus, Pencil, Plus, RotateCw, Trash2, Upload } from 'lucide-react';
import { api, useCourseStudentsQuery, useCourseQuizzesQuery, useCreateLessonMutation, useCreateModuleMutation, useDeleteCourseMutation, useDeleteLessonMutation, useDeleteModuleMutation, useDeleteQuizMutation, useDeleteVideoMutation, useGetCategoriesQuery, useGetCourseQuery, usePublishCourseMutation, useRetryVideoMutation, useSubmitCourseMutation, useUpdateCourseMutation, useUpdateLessonMutation, useUploadThumbnailMutation } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Async, Badge, Button, Card, ConfirmModal, DataTable, Input, Modal, ProgressBar, StatusBadge, Tabs, cx } from '../../components/ui';
import { Thumb } from '../../components/CourseCard';
import { uploadVideo } from '../../lib/upload';
import { clock, date, errMsg } from '../../lib/format';
import { CourseForm } from './Courses';
import QuizBuilder from './QuizBuilder';

function VideoCell({ lesson, courseId }) {
  const dispatch = useDispatch(); const token = useSelector((s) => s.auth.token); const input = useRef(null);
  const [pct, setPct] = useState(null); const [retry, { isLoading: retrying }] = useRetryVideoMutation(); const [del] = useDeleteVideoMutation();
  const v = lesson.video;
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    setPct(0);
    try { await uploadVideo({ lessonId: lesson._id, file, token, onProgress: setPct }); dispatch(addToast('Upload complete. Processing started.')); dispatch(api.util.invalidateTags([{ type: 'Course', id: courseId }])); }
    catch (er) { dispatch(addToast(er.message, 'error')); } finally { setPct(null); }
  };
  return (
    <div className="mt-2 rounded-lg bg-stone-50 p-3 text-sm">
      <input ref={input} type="file" accept="video/*" hidden onChange={pick} />
      {pct !== null ? <div><p className="mb-1 text-xs font-semibold text-stone-600">Uploading… {pct}%</p><ProgressBar value={pct} /></div>
        : !v ? <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-stone-500"><Film className="h-4 w-4" />No video yet</span><Button size="sm" variant="secondary" icon={Upload} onClick={() => input.current.click()}>Upload video</Button></div>
        : <div>
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><StatusBadge status={v.status} />{v.status === 'ready' && v.metadata?.duration && <span className="text-xs text-stone-500">{clock(v.metadata.duration)}</span>}</span>
              <span className="flex gap-1">{v.status === 'failed' && <Button size="sm" variant="secondary" icon={RotateCw} loading={retrying} onClick={() => retry(v._id).unwrap().then(() => dispatch(addToast('Retry queued'))).catch((e) => dispatch(addToast(errMsg(e), 'error')))}>Retry</Button>}
                {!['queued', 'processing'].includes(v.status) && <><Button size="sm" variant="ghost" onClick={() => input.current.click()}>Replace</Button><Button size="sm" variant="ghost" aria-label="Delete video" onClick={() => del({ id: v._id, courseId })}><Trash2 className="h-4 w-4 text-rose-600" /></Button></>}</span></div>
            {['queued', 'processing'].includes(v.status) && <div className="mt-2"><p className="mb-1 text-xs text-stone-500">{v.status === 'queued' ? 'Waiting in the BullMQ queue…' : `Transcoding with FFmpeg… ${v.progress}%`}</p><ProgressBar value={v.progress} /></div>}
            {v.status === 'failed' && <p className="mt-2 flex items-start gap-1.5 text-xs text-rose-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{v.error || 'Processing failed'}</p>}
          </div>}
    </div>
  );
}

function Curriculum({ course }) {
  const dispatch = useDispatch(); const id = course._id;
  const [addModule] = useCreateModuleMutation(); const [addLesson] = useCreateLessonMutation(); const [updLesson] = useUpdateLessonMutation(); const [delLesson] = useDeleteLessonMutation(); const [delModule] = useDeleteModuleMutation();
  const [modal, setModal] = useState(null); const [text, setText] = useState(''); const [confirm, setConfirm] = useState(null);
  const run = (p, ok) => p.unwrap().then(() => ok && dispatch(addToast(ok))).catch((e) => dispatch(addToast(errMsg(e), 'error')));
  const submit = async () => {
    if (text.trim().length < 2) return;
    if (modal.type === 'module') await run(addModule({ courseId: id, title: text.trim() }), 'Module added');
    if (modal.type === 'lesson') await run(addLesson({ courseId: id, moduleId: modal.moduleId, title: text.trim() }), 'Lesson added');
    if (modal.type === 'rename') await run(updLesson({ id: modal.lessonId, courseId: id, title: text.trim() }), 'Lesson renamed');
    setModal(null); setText('');
  };
  return (
    <div className="space-y-4">
      {course.curriculum.length === 0 && <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">Start by adding a module (a section of your course).</p>}
      {course.curriculum.map((m, mi) => (
        <Card key={m._id} className="p-5">
          <div className="flex items-center justify-between"><h3 className="font-display text-lg font-semibold">Module {mi + 1}: {m.title}</h3><div className="flex gap-1"><Button size="sm" variant="secondary" icon={Plus} onClick={() => { setText(''); setModal({ type: 'lesson', moduleId: m._id }); }}>Lesson</Button><Button size="sm" variant="ghost" aria-label="Delete module" onClick={() => setConfirm({ kind: 'module', id: m._id, name: m.title })}><Trash2 className="h-4 w-4 text-rose-600" /></Button></div></div>
          <ul className="mt-3 space-y-3">{m.lessons.length === 0 && <li className="text-sm text-stone-500">No lessons in this module.</li>}
            {m.lessons.map((l, li) => (
              <li key={l._id} className="rounded-xl border border-stone-200 p-3">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{mi + 1}.{li + 1} {l.title}</span>{l.isPreview && <Badge tone="blue">Free preview</Badge>}
                  <span className="ml-auto flex items-center gap-1"><label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-stone-500"><input type="checkbox" checked={!!l.isPreview} onChange={(e) => run(updLesson({ id: l._id, courseId: id, isPreview: e.target.checked }))} className="accent-[rgb(var(--accent))]" />Preview</label>
                    <Button size="sm" variant="ghost" aria-label="Rename lesson" onClick={() => { setText(l.title); setModal({ type: 'rename', lessonId: l._id }); }}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="ghost" aria-label="Delete lesson" onClick={() => setConfirm({ kind: 'lesson', id: l._id, name: l.title })}><Trash2 className="h-4 w-4 text-rose-600" /></Button></span></div>
                <VideoCell lesson={l} courseId={id} />
              </li>))}</ul>
        </Card>))}
      <Button variant="secondary" icon={Plus} onClick={() => { setText(''); setModal({ type: 'module' }); }}>Add module</Button>
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.type === 'module' ? 'Add module' : modal?.type === 'rename' ? 'Rename lesson' : 'Add lesson'} footer={<><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button onClick={submit}>Save</Button></>}><Input label="Title" autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} /></Modal>
      <ConfirmModal open={!!confirm} danger onClose={() => setConfirm(null)} title={`Delete ${confirm?.kind}?`} confirmLabel="Delete" message={`“${confirm?.name}” ${confirm?.kind === 'module' ? 'and all its lessons and videos ' : 'and its video '}will be permanently deleted.`} onConfirm={async () => { await run(confirm.kind === 'module' ? delModule({ id: confirm.id, courseId: id }) : delLesson({ id: confirm.id, courseId: id }), 'Deleted'); setConfirm(null); }} />
    </div>
  );
}

function Quizzes({ courseId }) {
  const q = useCourseQuizzesQuery(courseId); const [del] = useDeleteQuizMutation(); const dispatch = useDispatch();
  const [editing, setEditing] = useState(null); const [full, setFull] = useState(null);
  const edit = async (quiz) => { const r = await dispatch(api.endpoints.quizManage.initiate(quiz._id, { forceRefetch: true })); setFull(r.data); setEditing(true); };
  return (
    <>
      <div className="mb-4 flex justify-end"><Button icon={Plus} onClick={() => { setFull(null); setEditing(true); }}>Create quiz</Button></div>
      <Async q={q} empty={<p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">No quizzes yet. Students must pass every quiz to earn the certificate.</p>}>
        {(items) => <div className="space-y-3">{items.map((z) => <Card key={z._id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="flex items-center gap-3"><FileQuestion className="h-6 w-6 text-accent" /><div><p className="font-semibold">{z.title}</p><p className="text-xs text-stone-500">{z.questionCount} questions · {z.durationMinutes} min · pass {z.passingMarks}/{z.totalMarks}</p></div></div><div className="flex gap-2"><Button size="sm" variant="secondary" icon={Pencil} onClick={() => edit(z)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => window.confirm('Delete this quiz and its attempts?') && del(z._id)}><Trash2 className="h-4 w-4 text-rose-600" /></Button></div></Card>)}</div>}
      </Async>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={full ? 'Edit quiz' : 'Create quiz'} wide>{editing && <QuizBuilder key={full?._id || 'new'} courseId={courseId} quiz={full} onDone={() => setEditing(null)} />}</Modal>
    </>
  );
}

export default function CourseEditor() {
  const { id } = useParams(); const navigate = useNavigate(); const dispatch = useDispatch();
  const [tab, setTab] = useState('curriculum');
  const poll = useRef(0);
  const q = useGetCourseQuery(id, { pollingInterval: poll.current });
  poll.current = q.data?.curriculum?.some((m) => m.lessons.some((l) => ['queued', 'processing'].includes(l.video?.status))) ? 2500 : 0;
  const { data: cats = [] } = useGetCategoriesQuery();
  const [update, { isLoading: saving }] = useUpdateCourseMutation(); const [submitReview, { isLoading: submitting }] = useSubmitCourseMutation(); const [publish] = usePublishCourseMutation(); const [del, { isLoading: deleting }] = useDeleteCourseMutation(); const [thumb, { isLoading: thumbLoading }] = useUploadThumbnailMutation();
  const students = useCourseStudentsQuery(id, { skip: tab !== 'students' }); const fileRef = useRef(null); const [confirmDel, setConfirmDel] = useState(false);
  const run = (p, ok) => p.unwrap().then(() => ok && dispatch(addToast(ok))).catch((e) => dispatch(addToast(errMsg(e), 'error')));

  return (
    <Async q={q}>
      {(c) => (
        <>
          <Link to="/instructor/courses" className="text-sm font-semibold text-accent">← My courses</Link>
          <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4"><div className="w-28 overflow-hidden rounded-xl"><Thumb course={c} /></div><div><h1 className="font-display text-2xl font-semibold">{c.title}</h1><div className="mt-1 flex flex-wrap items-center gap-2"><StatusBadge status={c.isPublished ? 'live' : c.approvalStatus} />{c.approvalStatus === 'rejected' && <span className="text-xs text-rose-700">Rejected: {c.rejectionReason}</span>}</div></div></div>
            <div className="flex flex-wrap gap-2">
              {['draft', 'rejected'].includes(c.approvalStatus) && <Button loading={submitting} onClick={() => run(submitReview(c._id), 'Submitted for admin review')}>Submit for review</Button>}
              {c.approvalStatus === 'pending' && <Badge tone="amber">Awaiting admin approval</Badge>}
              {c.approvalStatus === 'approved' && <Button variant={c.isPublished ? 'secondary' : 'primary'} onClick={() => run(publish({ id: c._id, publish: !c.isPublished }), c.isPublished ? 'Course unpublished' : 'Course published')}>{c.isPublished ? 'Unpublish' : 'Publish'}</Button>}
              <Link to={`/courses/${c._id}`} target="_blank"><Button variant="secondary">Preview page</Button></Link>
            </div>
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'curriculum', label: 'Curriculum' }, { id: 'details', label: 'Details' }, { id: 'quizzes', label: 'Quizzes' }, { id: 'students', label: 'Students', count: c.enrollmentCount }]} />
          <div className="mt-6">
            {tab === 'curriculum' && <Curriculum course={c} />}
            {tab === 'details' && (
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <Card className="p-6"><CourseForm key={c.updatedAt} cats={cats} loading={saving} initial={{ title: c.title, description: c.description, category: c.category, level: c.level, price: c.price }} onSubmit={(b) => run(update({ id: c._id, ...b }), 'Course updated')} submitLabel="Save changes" /></Card>
                <div className="space-y-4"><Card className="p-5"><h3 className="font-display font-semibold">Thumbnail</h3><div className="mt-3 overflow-hidden rounded-xl"><Thumb course={c} /></div><input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) run(thumb({ id: c._id, file: f }), 'Thumbnail updated'); }} /><Button className="mt-3 w-full" variant="secondary" icon={ImagePlus} loading={thumbLoading} onClick={() => fileRef.current.click()}>Upload image</Button><p className="mt-2 text-xs text-stone-500">JPG, PNG or WebP · up to 5 MB</p></Card>
                  <Card className="border-rose-200 p-5"><h3 className="font-display font-semibold text-rose-700">Danger zone</h3><p className="mt-1 text-xs text-stone-500">Courses with enrolled students can only be unpublished.</p><Button className="mt-3 w-full" variant="danger" icon={Trash2} onClick={() => setConfirmDel(true)}>Delete course</Button></Card></div>
              </div>
            )}
            {tab === 'quizzes' && <Quizzes courseId={c._id} />}
            {tab === 'students' && <DataTable loading={students.isLoading} error={students.error} rows={students.data || []} clientSearch={(r) => `${r.student?.name} ${r.student?.email}`} emptyTitle="No students yet" emptyMessage="Students appear here once they enroll."
              columns={[{ key: 's', header: 'Student', render: (r) => <div><p className="font-semibold">{r.student?.name}</p><p className="text-xs text-stone-500">{r.student?.email}</p></div> }, { key: 'e', header: 'Enrolled', render: (r) => date(r.enrolledAt) }, { key: 'p', header: 'Progress', className: 'w-56', render: (r) => <div><div className="mb-1 text-xs text-stone-500">{r.completedLessons}/{r.totalLessons} lessons · {r.percent}%</div><ProgressBar value={r.percent} /></div> }, { key: 'st', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'l', header: 'Last active', render: (r) => date(r.lastAccessedAt) }]} />}
          </div>
          <ConfirmModal open={confirmDel} danger loading={deleting} onClose={() => setConfirmDel(false)} title="Delete this course?" confirmLabel="Delete course" message="This permanently deletes the course, its modules, lessons, videos and quizzes." onConfirm={async () => { try { await del(c._id).unwrap(); dispatch(addToast('Course deleted')); navigate('/instructor/courses'); } catch (e) { dispatch(addToast(errMsg(e), 'error')); setConfirmDel(false); } }} />
        </>
      )}
    </Async>
  );
}
