import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Check, ExternalLink, X } from 'lucide-react';
import { useAdminCoursesQuery, useAdminReviewMutation } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Button, DataTable, Modal, PageHeader, SearchBox, StatusBadge, Tabs, Textarea, useDebounced } from '../../components/ui';
import { date, errMsg, price } from '../../lib/format';

export default function Courses() {
  const dispatch = useDispatch(); const [status, setStatus] = useState('pending'); const [q, setQ] = useState(''); const [page, setPage] = useState(1); const dq = useDebounced(q);
  const res = useAdminCoursesQuery({ status, q: dq, page, limit: 10 }); const [review, { isLoading }] = useAdminReviewMutation();
  const [rej, setRej] = useState(null); const [reason, setReason] = useState('');
  const act = async (id, decision, why) => { try { await review({ id, decision, reason: why }).unwrap(); dispatch(addToast(decision === 'approve' ? 'Course approved and published' : 'Course rejected')); setRej(null); setReason(''); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } };
  return (
    <>
      <PageHeader title="Course moderation" subtitle="Approve or reject courses submitted by instructors." />
      <Tabs value={status} onChange={(s) => { setStatus(s); setPage(1); }} tabs={[{ id: 'pending', label: 'Pending review' }, { id: 'approved', label: 'Approved' }, { id: 'rejected', label: 'Rejected' }, { id: 'draft', label: 'Drafts' }, { id: '', label: 'All' }]} />
      <div className="mt-5"><DataTable dense loading={res.isLoading} error={res.error} rows={res.data?.items || []} meta={res.data?.meta} onPage={setPage} emptyTitle={status === 'pending' ? 'No courses awaiting review 🎉' : 'No courses found'}
        toolbar={<SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search by title" className="w-full sm:w-64" />}
        columns={[{ key: 't', header: 'Course', render: (r) => <div><Link to={`/courses/${r._id}`} target="_blank" className="inline-flex items-center gap-1 font-semibold hover:text-accent">{r.title}<ExternalLink className="h-3 w-3" /></Link><p className="text-xs text-stone-500">{r.category} · {r.level}</p></div> }, { key: 'i', header: 'Instructor', render: (r) => r.instructor?.name }, { key: 'p', header: 'Price', render: (r) => price(r.price) }, { key: 'l', header: 'Lessons', render: (r) => r.lessonsCount },
          { key: 's', header: 'Status', render: (r) => <div><StatusBadge status={r.isPublished ? 'live' : r.approvalStatus} />{r.rejectionReason && <p className="mt-1 max-w-[200px] text-xs text-rose-600">{r.rejectionReason}</p>}</div> }, { key: 'u', header: 'Updated', render: (r) => date(r.updatedAt) },
          { key: 'a', header: '', render: (r) => r.approvalStatus === 'pending' && <div className="flex gap-2"><Button size="sm" icon={Check} loading={isLoading} onClick={() => act(r._id, 'approve')}>Approve</Button><Button size="sm" variant="danger" icon={X} onClick={() => setRej(r)}>Reject</Button></div> }]} /></div>
      <Modal open={!!rej} onClose={() => setRej(null)} title={`Reject “${rej?.title}”`} footer={<><Button variant="secondary" onClick={() => setRej(null)}>Cancel</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={isLoading} onClick={() => act(rej._id, 'reject', reason.trim())}>Reject course</Button></>}><Textarea label="Reason for the instructor" value={reason} onChange={(e) => setReason(e.target.value)} hint="The instructor is notified and can resubmit after fixing the issues." /></Modal>
    </>
  );
}
