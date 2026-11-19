/* End-to-end API smoke test against a RUNNING, SEEDED backend (default http://localhost:5000).
   Usage: node tests/e2e-smoke.js            (Node 18+, no dependencies) */
const API = process.env.API_URL || 'http://localhost:5000';
let passed = 0; let failed = 0;
const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(`${API}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch { /* not json */ }
  return { status: res.status, body: json };
};
const check = (name, cond, extra = '') => { if (cond) { passed += 1; console.log(`  ✓ ${name}`); } else { failed += 1; console.log(`  ✗ ${name} ${extra}`); } };
const login = async (email, password) => (await call('POST', '/api/auth/login', { body: { email, password } })).body.data;

(async () => {
  console.log(`E2E smoke test → ${API}`);
  const health = await call('GET', '/api/health'); check('API is healthy', health.status === 200);
  const admin = await login('admin@learnsphere.dev', 'Admin@123'); const inst = await login('priya@learnsphere.dev', 'Instructor@123'); const stu = await login('rakshitha@learnsphere.dev', 'Student@123');
  check('seeded accounts can log in', !!(admin?.token && inst?.token && stu?.token), '(run `npm run seed` first)');
  if (!admin || !inst || !stu) process.exit(1);

  const courses = await call('GET', '/api/courses?limit=20'); check('public catalogue lists published courses', courses.body.data.length >= 8);
  check('catalogue never exposes drafts/pending', courses.body.data.every((c) => c.approvalStatus === undefined || c.approvalStatus === 'approved'));
  check('student cannot create a course (403)', (await call('POST', '/api/courses', { token: stu.token, body: {} })).status === 403);
  check('student cannot open admin stats (403)', (await call('GET', '/api/admin/stats', { token: stu.token })).status === 403);
  check('anonymous request is rejected (401)', (await call('GET', '/api/enrollments/mine')).status === 401);

  const mine = await call('GET', '/api/enrollments/mine', { token: stu.token }); check('student has seeded enrollments', mine.body.data.length > 0);
  const first = mine.body.data[0].course._id; const detail = await call('GET', `/api/courses/${first}`, { token: stu.token });
  const lesson = detail.body.data.curriculum[0].lessons.find((l) => l.hasVideo); check('course detail exposes curriculum with a video lesson', !!lesson);
  const pb = await call('GET', `/api/lessons/${lesson._id}/playback`, { token: stu.token });
  check('enrolled student receives a signed HLS playback URL', pb.status === 200 && /master\.m3u8$/.test(pb.body.data?.url || ''));
  const m3u8 = await fetch(pb.body.data.url); check('HLS master playlist is streamed', m3u8.status === 200 && (await m3u8.text()).includes('#EXTM3U'));
  const unauth = await fetch(pb.body.data.url.replace(/\/media\/[^/]+\//, '/media/bad-token/')); check('forged media token is refused', unauth.status === 401);

  const quizzes = await call('GET', `/api/courses/${first}/quizzes`, { token: stu.token }); const quiz = quizzes.body.data[0];
  const qv = await call('GET', `/api/quizzes/${quiz._id}`, { token: stu.token }); check('quiz questions hide correct answers', !JSON.stringify(qv.body).includes('correctIndex'));
  const att = await call('POST', `/api/quizzes/${quiz._id}/attempts`, { token: stu.token });
  const answers = att.body.data.quiz.questions.map((q) => ({ questionId: q._id, selectedIndex: 0 }));
  const res = await call('POST', `/api/attempts/${att.body.data.attemptId}/submit`, { token: stu.token, body: { answers } });
  check('quiz is auto-graded and returns a review', res.status === 200 && typeof res.body.data.score === 'number' && res.body.data.review.length === answers.length);

  const certs = await call('GET', '/api/certificates/mine', { token: stu.token }); check('student has seeded certificate(s)', certs.body.data.length > 0);
  if (certs.body.data[0]) {
    const pdf = await fetch(`${API}/api/certificates/${certs.body.data[0].certificateId}/download`, { headers: { Authorization: `Bearer ${stu.token}` } });
    check('certificate downloads as a PDF', pdf.status === 200 && Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString() === '%PDF-');
    check('certificate verifies publicly', (await call('GET', `/api/certificates/verify/${certs.body.data[0].certificateId}`)).body.data.valid === true);
  }
  const rev = await call('GET', '/api/revenue/summary', { token: inst.token }); check('instructor revenue dashboard has totals', rev.body.data.totals.netRevenue > 0);
  const tx = await call('GET', '/api/admin/transactions?limit=50', { token: admin.token }); check('transactions include success, pending and failed', ['success', 'pending', 'failed'].every((s) => tx.body.data.some((t) => t.status === s)));
  const pending = await call('GET', '/api/admin/courses?status=pending', { token: admin.token }); check('admin sees a course pending review', pending.body.data.length > 0);
  const live = await call('GET', '/api/live', { token: stu.token }); check('student sees upcoming live classes', live.body.data.length > 0);
  const lc = live.body.data.find((l) => l.status === 'scheduled'); if (lc) check('students cannot join a class that has not started (409)', (await call('POST', `/api/live/${lc._id}/token`, { token: stu.token })).status === 409);

  console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
})();
