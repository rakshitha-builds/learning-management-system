const { setup, teardown, makeUser, courseBody, makePublishedCourse, api } = require('./helpers');

let app; let admin; let instructor; let other; let student; let course;
beforeAll(async () => {
  app = await setup();
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor'); other = await makeUser(app, 'instructor'); student = await makeUser(app, 'student');
  course = await makePublishedCourse(app, instructor, admin);
});
afterAll(teardown);

describe('Role-based access control', () => {
  test('unauthenticated users get 401 on protected routes', async () => {
    for (const [m, u] of [['get', '/api/enrollments/mine'], ['get', '/api/revenue/summary'], ['get', '/api/admin/stats'], ['post', '/api/courses']]) {
      expect((await api(app).raw(m, u)).status).toBe(401);
    }
  });
  test('students cannot create courses, view revenue or reach admin APIs', async () => {
    expect((await student.api.post('/api/courses', courseBody())).status).toBe(403);
    expect((await student.api.get('/api/revenue/summary')).status).toBe(403);
    expect((await student.api.get('/api/admin/stats')).status).toBe(403);
    expect((await student.api.post('/api/live', {})).status).toBe(403);
  });
  test('instructors cannot use student or admin features', async () => {
    expect((await instructor.api.get('/api/admin/users')).status).toBe(403);
    expect((await instructor.api.post('/api/enrollments', { courseId: course.courseId })).status).toBe(403);
    expect((await instructor.api.get('/api/progress/summary')).status).toBe(403);
  });
  test('admins cannot act as instructors/students', async () => {
    expect((await admin.api.post('/api/courses', courseBody())).status).toBe(403);
    expect((await admin.api.post('/api/enrollments', { courseId: course.courseId })).status).toBe(403);
  });
  test('an instructor cannot modify or delete another instructor’s course', async () => {
    expect((await other.api.put(`/api/courses/${course.courseId}`, { title: 'Hijacked title here' })).status).toBe(403);
    expect((await other.api.delete(`/api/courses/${course.courseId}`)).status).toBe(403);
    expect((await other.api.post(`/api/courses/${course.courseId}/modules`, { title: 'Sneaky module' })).status).toBe(403);
    expect((await other.api.get(`/api/courses/${course.courseId}/students`)).status).toBe(403);
    expect((await other.api.post(`/api/courses/${course.courseId}/quizzes`, { title: 'Sneaky quiz', durationMinutes: 5, passingMarks: 1, questions: [{ text: 'Q1?', options: ['a', 'b'], correctIndex: 0, marks: 1 }] })).status).toBe(403);
  });
  test('invalid ObjectIds are rejected with 400, not 500', async () => {
    expect((await admin.api.patch('/api/admin/users/not-an-id/status', { status: 'active' })).status).toBe(400);
  });
});
