import { Link } from 'react-router-dom';
import { useMyAttemptsQuery } from '../../app/api';
import { Button, DataTable, PageHeader, StatusBadge } from '../../components/ui';
import { dateTime } from '../../lib/format';

export default function QuizHistory() {
  const q = useMyAttemptsQuery();
  return (
    <>
      <PageHeader title="Quiz results" subtitle="Every quiz attempt you have made." />
      <DataTable loading={q.isLoading} error={q.error} rows={q.data || []} clientSearch={(r) => `${r.quiz?.title} ${r.course?.title}`} emptyTitle="No quiz attempts yet" emptyMessage="Open a course and take a quiz to see your results here."
        columns={[
          { key: 'quiz', header: 'Quiz', render: (r) => <span className="font-semibold">{r.quiz?.title}</span> }, { key: 'course', header: 'Course', render: (r) => r.course?.title },
          { key: 'score', header: 'Score', render: (r) => `${r.score}/${r.totalMarks} (${r.percentage}%)` }, { key: 'passed', header: 'Result', render: (r) => <StatusBadge status={r.passed ? 'success' : 'failed'} /> },
          { key: 'at', header: 'Submitted', render: (r) => dateTime(r.submittedAt) }, { key: 'act', header: '', render: (r) => <Link to={`/student/results/${r._id}`}><Button size="sm" variant="secondary">Review</Button></Link> },
        ]} />
    </>
  );
}
