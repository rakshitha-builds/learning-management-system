const request = require('supertest');
const { setup, teardown, makeUser, makePublishedCourse, courseBody } = require('./helpers');

let app; let admin; let instructor; let student;
beforeAll(async () => {
  app = await setup();
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor'); student = await makeUser(app, 'student', { name: 'Searchable Sam' });
  await makePublishedCourse(app, instructor, admin);
  const draft = await instructor.api.post('/api/courses', courseBody({ title: 'Pending course title' }));
  const m = await instructor.api.post(`/api/courses/${draft.body.data._id}/modules`, { title: 'Mod' });
  await instructor.api.post(`/api/modules/${m.body.data._id}/lessons`, { title: 'Les' });
  await instructor.api.post(`/api/courses/${draft.body.data._id}/submit`);
});
afterAll(teardown);

describe('Admin dashboard & management', () => {
  test('platform stats aggregate users, courses, enrollments and monthly series', async () => {
    const res = await admin.api.get('/api/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toMatchObject({ admin: 1, instructor: 1, student: 1, total: 3 });
    expect(res.body.data.courses.byStatus).toMatchObject({ approved: 1, pending: 1 });
    expect(res.body.data.monthly).toHaveLength(6);
    expect(res.body.data.recentActivity.length).toBeGreaterThan(0);
  });
  test('user management: search, role filter, pagination', async () => {
    const s = await admin.api.get('/api/admin/users?q=searchable');
    expect(s.body.data).toHaveLength(1); expect(s.body.data[0].passwordHash).toBeUndefined();
    expect((await admin.api.get('/api/admin/users?role=instructor')).body.data).toHaveLength(1);
    expect((await admin.api.get('/api/admin/users?limit=1&page=2')).body.meta).toMatchObject({ page: 2, limit: 1, total: 3 });
  });
  test('suspending a user blocks their access; reactivation restores it; admins are protected', async () => {
    const sus = await admin.api.patch(`/api/admin/users/${student.user._id}/status`, { status: 'suspended' });
    expect(sus.body.data.status).toBe('suspended');
    expect((await student.api.get('/api/auth/me')).status).toBe(403);
    await admin.api.patch(`/api/admin/users/${student.user._id}/status`, { status: 'active' });
    expect((await student.api.get('/api/auth/me')).status).toBe(200);
    expect((await admin.api.patch(`/api/admin/users/${admin.user._id}/status`, { status: 'suspended' })).status).toBe(400);
  });
  test('admin can create an instructor account', async () => {
    const res = await admin.api.post('/api/admin/users', { name: 'New Teacher', email: 'teacher@test.dev', password: 'Teach1234', role: 'instructor' });
    expect(res.status).toBe(201);
    expect((await request(app).post('/api/auth/login').send({ email: 'teacher@test.dev', password: 'Teach1234' })).status).toBe(200);
    expect((await admin.api.post('/api/admin/users', { name: 'Dup', email: 'teacher@test.dev', password: 'Teach1234', role: 'student' })).status).toBe(409);
  });
  test('course moderation list filters by status; only pending courses can be reviewed', async () => {
    const pending = await admin.api.get('/api/admin/courses?status=pending');
    expect(pending.body.data).toHaveLength(1);
    const id = pending.body.data[0]._id;
    expect((await admin.api.patch(`/api/admin/courses/${id}/review`, { decision: 'approve' })).status).toBe(200);
    expect((await admin.api.patch(`/api/admin/courses/${id}/review`, { decision: 'approve' })).status).toBe(409);
    const note = await instructor.api.get('/api/notifications');
    expect(note.body.data.some((n) => n.type === 'course_review_result')).toBe(true);
  });
  test('enrollment, transaction and activity monitors respond', async () => {
    for (const p of ['enrollments', 'transactions', 'activity']) {
      const res = await admin.api.get(`/api/admin/${p}`);
      expect(res.status).toBe(200);
      expect(res.body.meta).toBeDefined();
    }
  });
});
