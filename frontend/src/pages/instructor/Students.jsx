import { useEffect, useState } from 'react';
import { useCourseStudentsQuery, useMyCoursesQuery } from '../../app/api';
import { DataTable, PageHeader, ProgressBar, Select, StatusBadge } from '../../components/ui';
import { date } from '../../lib/format';

export default function Students() {
  const courses = useMyCoursesQuery(); const [cid, setCid] = useState('');
  useEffect(() => { if (!cid && courses.data?.length) setCid(courses.data[0]._id); }, [courses.data, cid]);
  const q = useCourseStudentsQuery(cid, { skip: !cid });
  return (
    <>
      <PageHeader title="Students" subtitle="Monitor enrollment and progress per course." />
      <DataTable loading={courses.isLoading || q.isLoading} error={q.error} rows={q.data || []} clientSearch={(r) => `${r.student?.name} ${r.student?.email}`} emptyTitle={cid ? 'No students enrolled yet' : 'Create a course first'}
        toolbar={<Select aria-label="Course" value={cid} onChange={(e) => setCid(e.target.value)} className="min-w-64">{(courses.data || []).map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}</Select>}
        columns={[{ key: 's', header: 'Student', render: (r) => <div><p className="font-semibold">{r.student?.name}</p><p className="text-xs text-stone-500">{r.student?.email}</p></div> }, { key: 'e', header: 'Enrolled', render: (r) => date(r.enrolledAt) },
          { key: 'p', header: 'Progress', className: 'w-56', render: (r) => <div><div className="mb-1 text-xs text-stone-500">{r.completedLessons}/{r.totalLessons} lessons · {r.percent}%</div><ProgressBar value={r.percent} /></div> }, { key: 'st', header: 'Status', render: (r) => <StatusBadge status={r.status} /> }, { key: 'l', header: 'Last active', render: (r) => date(r.lastAccessedAt) }]} />
    </>
  );
}
