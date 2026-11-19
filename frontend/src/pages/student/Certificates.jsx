import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Award, Download, ExternalLink } from 'lucide-react';
import { useIssueCertificateMutation, useMyCertificatesQuery, useMyEnrollmentsQuery } from '../../app/api';
import { addToast } from '../../app/uiSlice';
import { Async, Button, Card, EmptyState, PageHeader } from '../../components/ui';
import { downloadCertificate } from '../../lib/upload';
import { date, errMsg } from '../../lib/format';

export default function Certificates() {
  const dispatch = useDispatch(); const token = useSelector((s) => s.auth.token);
  const certs = useMyCertificatesQuery(); const enr = useMyEnrollmentsQuery(); const [issue, { isLoading }] = useIssueCertificateMutation();
  const have = new Set((certs.data || []).map((c) => String(c.course)));
  const ready = (enr.data || []).filter((e) => e.progress.eligibleForCertificate && !have.has(String(e.course._id)));
  const dl = async (id) => { try { await downloadCertificate(id, token); } catch (e) { dispatch(addToast(errMsg(e), 'error')); } };
  return (
    <>
      <PageHeader title="Certificates" subtitle="Download or share verifiable proof of your achievements." />
      {ready.length > 0 && <Card className="mb-6 border-emerald-200 bg-emerald-50 p-5"><p className="font-semibold text-emerald-800">Ready to claim</p><div className="mt-3 space-y-2">{ready.map((e) => <div key={e._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3"><span className="font-medium">{e.course.title}</span><Button size="sm" loading={isLoading} onClick={async () => { try { const c = await issue(e.course._id).unwrap(); await dl(c.certificateId); } catch (er) { dispatch(addToast(errMsg(er), 'error')); } }}>Claim & download</Button></div>)}</div></Card>}
      <Async q={certs} empty={<EmptyState icon={Award} title="No certificates yet" message="Complete all lessons and pass every quiz in a course to earn your certificate." action={<Link to="/student/courses"><Button>Continue learning</Button></Link>} />}>
        {(items) => <div className="grid gap-5 md:grid-cols-2">{items.map((c) => (
          <Card key={c._id} className="relative overflow-hidden p-6"><div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-amber-100" /><Award className="relative h-9 w-9 text-amber-600" />
            <h3 className="relative mt-3 font-display text-xl font-semibold">{c.courseTitle}</h3><p className="relative text-sm text-stone-500">Instructor: {c.instructorName} · Issued {date(c.issuedAt)}</p><p className="relative mt-2 font-mono text-xs text-stone-500">{c.certificateId}</p>
            <div className="relative mt-4 flex gap-2"><Button size="sm" icon={Download} onClick={() => dl(c.certificateId)}>Download PDF</Button><Link to={`/verify/${c.certificateId}`} target="_blank"><Button size="sm" variant="secondary" icon={ExternalLink}>Verify</Button></Link></div>
          </Card>))}</div>}
      </Async>
    </>
  );
}
