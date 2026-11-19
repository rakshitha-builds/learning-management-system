const { setup, teardown, makeUser, makePublishedCourse } = require('./helpers');
const InstructorRevenue = require('../src/models/InstructorRevenue');

let app; let admin; let instructor; let student; let student2; let paid; let free;

beforeAll(async () => {
  app = await setup();
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor'); student = await makeUser(app, 'student'); student2 = await makeUser(app, 'student');
  paid = await makePublishedCourse(app, instructor, admin, { price: 1000 });
  free = await makePublishedCourse(app, instructor, admin, { price: 0 });
});
afterAll(teardown);

describe('Payments (simulated TEST gateway: no Razorpay keys configured)', () => {
  test('gateway config honestly reports simulated mode', async () => {
    const res = await student.api.get('/api/payments/config');
    expect(res.body.data).toMatchObject({ mode: 'simulated', keyId: null });
    expect((await student.api.get('/api/config')).body.data.payments).toBe('simulated');
  });
  test('checkout creates a PENDING payment in minor units; free courses are refused', async () => {
    expect((await student.api.post('/api/payments/checkout', { courseId: free.courseId })).status).toBe(400);
    const res = await student.api.post('/api/payments/checkout', { courseId: paid.courseId });
    expect(res.status).toBe(201);
    expect(res.body.data.payment).toMatchObject({ status: 'pending', amount: 100000, currency: 'INR', gateway: 'simulated' });
    expect(res.body.data.gateway.orderId).toMatch(/^sim_order_/);
    expect(JSON.stringify(res.body)).not.toMatch(/card/i); // no card data anywhere
  });
  test('a pending payment does not grant access', async () => {
    const mine = await student.api.get('/api/payments/mine');
    expect(mine.body.data[0].status).toBe('pending');
    expect((await student.api.get('/api/enrollments/mine')).body.data).toHaveLength(0);
  });
  test('failed payment is recorded and does not enroll', async () => {
    const co = await student.api.post('/api/payments/checkout', { courseId: paid.courseId });
    const res = await student.api.post(`/api/payments/${co.body.data.payment._id}/simulate`, { outcome: 'failed' });
    expect(res.body.data.payment).toMatchObject({ status: 'failed', failureReason: 'Simulated failure' });
    expect((await student.api.get('/api/enrollments/mine')).body.data).toHaveLength(0);
    expect((await student.api.post(`/api/payments/${co.body.data.payment._id}/simulate`, { outcome: 'success' })).status).toBe(409); // final state
  });
  test('successful payment enrolls the student and creates instructor revenue (80/20 split)', async () => {
    const co = await student.api.post('/api/payments/checkout', { courseId: paid.courseId });
    const id = co.body.data.payment._id;
    const res = await student.api.post(`/api/payments/${id}/simulate`, { outcome: 'success' });
    expect(res.body.data.payment).toMatchObject({ status: 'success' });
    expect(res.body.data.payment.paidAt).toBeTruthy();
    expect((await student.api.get('/api/enrollments/mine')).body.data).toHaveLength(1);
    const rev = await InstructorRevenue.findOne({ payment: id });
    expect(rev).toMatchObject({ grossAmount: 100000, platformFee: 20000, netAmount: 80000 });
    expect((await student.api.post('/api/payments/checkout', { courseId: paid.courseId })).status).toBe(409); // already enrolled
  });
  test('webhook-style double success is idempotent (one revenue row, one enrollment)', async () => {
    const svc = require('../src/services/paymentService');
    const co = await student2.api.post('/api/payments/checkout', { courseId: paid.courseId });
    const id = co.body.data.payment._id;
    const [a, b] = await Promise.all([svc.markPaymentSuccess(id, 'p1'), svc.markPaymentSuccess(id, 'p2')]);
    expect([a.changed, b.changed].filter(Boolean)).toHaveLength(1);
    expect(await InstructorRevenue.countDocuments({ payment: id })).toBe(1);
  });
  test('students cannot simulate or view other students’ payments', async () => {
    const co = await student.api.post('/api/payments/checkout', { courseId: free.courseId }); // free -> 400 so use new paid course instead
    expect(co.status).toBe(400);
    const other = await makeUser(app, 'student');
    const mine = await student.api.get('/api/payments/mine');
    const foreign = mine.body.data[0]._id;
    expect((await other.api.post(`/api/payments/${foreign}/simulate`, { outcome: 'success' })).status).toBe(404);
    expect((await instructor.api.post(`/api/payments/${foreign}/simulate`, { outcome: 'success' })).status).toBe(403);
  });
});

describe('Instructor revenue dashboard', () => {
  test('summary: totals, monthly series, course earnings and success/pending/failed counts', async () => {
    const pending = await makeUser(app, 'student');
    await pending.api.post('/api/payments/checkout', { courseId: paid.courseId }); // leaves a pending payment
    const res = await instructor.api.get('/api/revenue/summary');
    const d = res.body.data;
    expect(d.totals).toMatchObject({ grossRevenue: 200000, platformFees: 40000, netRevenue: 160000, sales: 2 });
    expect(d.monthly).toHaveLength(12);
    expect(d.monthly[11]).toMatchObject({ net: 160000, sales: 2 });
    const row = d.courses.find((c) => c.courseId === paid.courseId);
    expect(row).toMatchObject({ net: 160000, sales: 2, enrollments: 2 });
    expect(d.transactionCounts.success.count).toBe(2);
    expect(d.transactionCounts.failed.count).toBe(1);
    expect(d.transactionCounts.pending.count).toBeGreaterThanOrEqual(1);
  });
  test('transactions list can be filtered by status and shows student/course', async () => {
    const all = await instructor.api.get('/api/revenue/transactions?limit=50');
    expect(new Set(all.body.data.map((p) => p.status))).toEqual(new Set(['success', 'failed', 'pending']));
    const ok = await instructor.api.get('/api/revenue/transactions?status=success');
    expect(ok.body.data.every((p) => p.status === 'success')).toBe(true);
    expect(ok.body.data[0].course.title).toBeTruthy();
    expect(ok.body.meta.total).toBe(2);
  });
  test('another instructor sees none of this revenue', async () => {
    const other = await makeUser(app, 'instructor');
    const res = await other.api.get('/api/revenue/summary');
    expect(res.body.data.totals).toMatchObject({ netRevenue: 0, sales: 0 });
  });
  test('admin transaction monitor and platform stats include the money', async () => {
    const t = await admin.api.get('/api/admin/transactions?status=success');
    expect(t.body.meta.total).toBe(2);
    const s = await admin.api.get('/api/admin/stats');
    expect(s.body.data.revenue).toMatchObject({ gross: 200000, platformFees: 40000, instructorPayouts: 160000 });
  });
});
