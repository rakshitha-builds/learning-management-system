import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BadgeCheck, ShieldX } from 'lucide-react';
import { useVerifyCertificateQuery } from '../../app/api';
import { Button, Card, Input, Spinner } from '../../components/ui';
import { date } from '../../lib/format';

export default function Verify() {
  const { certId } = useParams(); const navigate = useNavigate(); const [val, setVal] = useState(certId || '');
  const q = useVerifyCertificateQuery(certId, { skip: !certId });
  return (
    <div className="mx-auto max-w-xl px-4 py-14">
      <h1 className="font-display text-3xl font-semibold">Verify a certificate</h1><p className="mt-1 text-stone-500">Enter the certificate ID printed on the PDF (e.g. LS-2026-1A2B3C4D).</p>
      <form className="mt-6 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (val.trim()) navigate(`/verify/${val.trim().toUpperCase()}`); }}><Input className="flex-1" placeholder="Certificate ID" value={val} onChange={(e) => setVal(e.target.value)} aria-label="Certificate ID" /><Button type="submit" className="self-end">Verify</Button></form>
      {certId && (
        <Card className="mt-6 p-6">
          {q.isLoading ? <Spinner /> : q.data?.valid ? (
            <div className="flex gap-4"><BadgeCheck className="h-10 w-10 shrink-0 text-emerald-600" /><div><p className="font-display text-xl font-semibold text-emerald-700">Valid certificate</p><dl className="mt-3 space-y-1 text-sm"><div><dt className="inline text-stone-500">Awarded to: </dt><dd className="inline font-semibold">{q.data.studentName}</dd></div><div><dt className="inline text-stone-500">Course: </dt><dd className="inline font-semibold">{q.data.courseTitle}</dd></div><div><dt className="inline text-stone-500">Instructor: </dt><dd className="inline font-semibold">{q.data.instructorName}</dd></div><div><dt className="inline text-stone-500">Issued: </dt><dd className="inline font-semibold">{date(q.data.issuedAt)}</dd></div><div><dt className="inline text-stone-500">ID: </dt><dd className="inline font-mono">{q.data.certificateId}</dd></div></dl></div></div>
          ) : <div className="flex gap-4"><ShieldX className="h-10 w-10 shrink-0 text-rose-500" /><div><p className="font-display text-xl font-semibold text-rose-700">Certificate not found</p><p className="mt-1 text-sm text-stone-500">No certificate matches “{certId}”. Check the ID and try again.</p></div></div>}
        </Card>
      )}
    </div>
  );
}
