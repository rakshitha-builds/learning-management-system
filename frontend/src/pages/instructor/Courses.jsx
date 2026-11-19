import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Library, Plus } from 'lucide-react';
import { useCreateCourseMutation, useGetCategoriesQuery, useMyCoursesQuery } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Badge, Button, DataTable, Input, Modal, PageHeader, Select, StatusBadge, Textarea } from '../../components/ui';
import { date, errMsg, price } from '../../lib/format';

export function CourseForm({ initial, onSubmit, loading, submitLabel = 'Save', cats = [] }) {
  const [f, setF] = useState(initial || { title: '', description: '', category: cats[0] || 'Web Development', level: 'beginner', price: 0 }); const [er, setEr] = useState({});
  const submit = (e) => {
    e.preventDefault(); const x = {};
    if (f.title.trim().length < 5) x.title = 'Title must be at least 5 characters'; if (f.description.trim().length < 20) x.description = 'Description must be at least 20 characters'; if (Number(f.price) < 0 || Number.isNaN(Number(f.price))) x.price = 'Enter a valid price';
    setEr(x); if (Object.keys(x).length) return; onSubmit({ ...f, price: Number(f.price) });
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate id="course-form">
      <Input label="Course title" value={f.title} error={er.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      <Textarea label="Description" value={f.description} error={er.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select label="Level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></Select>
        <Input label="Price (₹, 0 = free)" type="number" min="0" value={f.price} error={er.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      </div>
      <Button type="submit" loading={loading}>{submitLabel}</Button>
    </form>
  );
}

export default function Courses() {
  const q = useMyCoursesQuery(); const { data: cats = [] } = useGetCategoriesQuery(); const [open, setOpen] = useState(false);
  const [create, { isLoading }] = useCreateCourseMutation(); const dispatch = useDispatch(); const navigate = useNavigate();
  const onCreate = async (body) => { try { const c = await create(body).unwrap(); dispatch(addToast('Course created. Now add modules and lessons.')); navigate(`/instructor/courses/${c._id}`); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } };
  return (
    <>
      <PageHeader title="My courses" subtitle="Create, edit and publish your courses." actions={<Button icon={Plus} onClick={() => setOpen(true)}>New course</Button>} />
      <DataTable loading={q.isLoading} error={q.error} rows={q.data || []} clientSearch={(r) => `${r.title} ${r.category}`} emptyTitle="You haven’t created a course yet" emptyMessage="Click “New course” to start building your first course."
        columns={[
          { key: 'title', header: 'Course', render: (r) => <Link to={`/instructor/courses/${r._id}`} className="font-semibold hover:text-accent">{r.title}</Link> }, { key: 'category', header: 'Category', render: (r) => <Badge tone="accent">{r.category}</Badge> },
          { key: 'price', header: 'Price', render: (r) => price(r.price) }, { key: 'lessons', header: 'Lessons', render: (r) => r.lessonsCount }, { key: 'students', header: 'Students', render: (r) => r.enrollmentCount },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.isPublished ? 'live' : r.approvalStatus} /> }, { key: 'upd', header: 'Updated', render: (r) => date(r.updatedAt) },
        ]} />
      <Modal open={open} onClose={() => setOpen(false)} title="Create a new course" wide><CourseForm cats={cats} loading={isLoading} onSubmit={onCreate} submitLabel="Create course" /></Modal>
    </>
  );
}
