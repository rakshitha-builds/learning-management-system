// Without LiveKit credentials the API must say so honestly instead of faking a class.
delete process.env.LIVEKIT_URL; delete process.env.LIVEKIT_API_KEY; delete process.env.LIVEKIT_API_SECRET;
const { setup, teardown, makeUser, makePublishedCourse } = require('./helpers');

let app;
afterAll(teardown);
test('starting a class returns 503 with setup guidance and leaves it scheduled', async () => {
  app = await setup();
  const admin = await makeUser(app, 'admin'); const instructor = await makeUser(app, 'instructor');
  const course = await makePublishedCourse(app, instructor, admin);
  const lc = await instructor.api.post('/api/live', { courseId: course.courseId, title: 'Unconfigured class', scheduledAt: new Date(Date.now() + 3600000).toISOString() });
  const res = await instructor.api.post(`/api/live/${lc.body.data._id}/start`);
  expect(res.status).toBe(503);
  expect(res.body.message).toMatch(/LiveKit is not configured/);
  expect((await instructor.api.get(`/api/live/${lc.body.data._id}`)).body.data.status).toBe('scheduled');
  expect((await instructor.api.get('/api/config')).body.data.livekit).toBe(false);
});
