const request = require('supertest');
const { setup, teardown, makeUser, makePublishedCourse } = require('./helpers');

let app; let admin; let instructor; let student; let other; let course; let quiz;

beforeAll(async () => {
  app = await setup();
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor', { name: 'Dr. Meera Iyer' });
  student = await makeUser(app, 'student', { name: 'Ravi Kumar' }); other = await makeUser(app, 'student');
  course = await makePublishedCourse(app, instructor, admin, { lessons: 3 });
  await student.api.post('/api/enrollments', { courseId: course.courseId });
  await other.api.post('/api/enrollments', { courseId: course.courseId });
  const q = await instructor.api.post(`/api/courses/${course.courseId}/quizzes`, {
    title: 'Final quiz', durationMinutes: 5, passingMarks: 1, questions: [{ text: 'Is 2+2 equal to 4?', options: ['Yes', 'No'], correctIndex: 0, marks: 1 }],
  });
  quiz = q.body.data;
});
afterAll(teardown);

describe('Progress tracking', () => {
  test('only enrolled students can report progress', async () => {
    const outsider = await makeUser(app, 'student');
    expect((await outsider.api.post(`/api/progress/lessons/${course.lessonIds[0]}`, { completed: true })).status).toBe(403);
  });
  test('watch progress is stored; >=90% watched auto-completes the lesson', async () => {
    const a = await student.api.post(`/api/progress/lessons/${course.lessonIds[0]}`, { watchedSeconds: 30, duration: 100 });
    expect(a.body.data.lessonProgress.completed).toBe(false);
    expect(a.body.data.course).toMatchObject({ completedLessons: 0, percent: 0 });
    const b = await student.api.post(`/api/progress/lessons/${course.lessonIds[0]}`, { watchedSeconds: 95, duration: 100 });
    expect(b.body.data.lessonProgress.completed).toBe(true);
    expect(b.body.data.course).toMatchObject({ completedLessons: 1, totalLessons: 3, percent: 33 });
  });
  test('watched seconds never move backwards', async () => {
    const r = await student.api.post(`/api/progress/lessons/${course.lessonIds[0]}`, { watchedSeconds: 10, duration: 100 });
    expect(r.body.data.lessonProgress.watchedSeconds).toBe(95);
  });
  test('completion percentage follows completed lessons', async () => {
    await student.api.post(`/api/progress/lessons/${course.lessonIds[1]}`, { completed: true });
    const p = await student.api.get(`/api/progress/courses/${course.courseId}`);
    expect(p.body.data).toMatchObject({ completedLessons: 2, percent: 67, passedQuizzes: 0, totalQuizzes: 1, eligibleForCertificate: false });
    expect(p.body.data.lessons.filter((l) => l.completed)).toHaveLength(2);
  });
  test('dashboard summary exposes cards, per-course progress and chart series', async () => {
    const s = await student.api.get('/api/progress/summary');
    expect(s.body.data.cards).toMatchObject({ enrolledCourses: 1, completedCourses: 0, lessonsCompleted: 2 });
    expect(s.body.data.activity).toHaveLength(14);
    expect(s.body.data.activity.reduce((n, d) => n + d.lessons, 0)).toBe(2);
    const h = await student.api.get('/api/progress/history');
    expect(h.body.data.some((x) => x.action === 'lesson_completed')).toBe(true);
  });
});

describe('Certificates', () => {
  test('certificate is refused until all lessons are done AND quizzes passed', async () => {
    await student.api.post(`/api/progress/lessons/${course.lessonIds[2]}`, { completed: true });
    const early = await student.api.post(`/api/certificates/course/${course.courseId}`);
    expect(early.status).toBe(409);
    expect(early.body.message).toMatch(/pass all quizzes \(0\/1\)/);
  });
  test('passing the final quiz completes the course', async () => {
    const start = await student.api.post(`/api/quizzes/${quiz._id}/attempts`);
    const q = start.body.data.quiz.questions[0];
    await student.api.post(`/api/attempts/${start.body.data.attemptId}/submit`, { answers: [{ questionId: q._id, selectedIndex: 0 }] });
    const p = await student.api.get(`/api/progress/courses/${course.courseId}`);
    expect(p.body.data).toMatchObject({ percent: 100, eligibleForCertificate: true, status: 'completed' });
  });
  let cert;
  test('certificate is issued with a unique ID and is idempotent', async () => {
    const res = await student.api.post(`/api/certificates/course/${course.courseId}`);
    expect(res.status).toBe(201);
    cert = res.body.data;
    expect(cert.certificateId).toMatch(/^LS-\d{4}-[0-9A-F]{8}$/);
    expect(cert).toMatchObject({ studentName: 'Ravi Kumar', courseTitle: 'Node.js Masterclass', instructorName: 'Dr. Meera Iyer' });
    const again = await student.api.post(`/api/certificates/course/${course.courseId}`);
    expect(again.status).toBe(200);
    expect(again.body.data.certificateId).toBe(cert.certificateId);
    expect((await student.api.get('/api/certificates/mine')).body.data).toHaveLength(1);
  });
  test('student without completion cannot get a certificate', async () => {
    expect((await other.api.post(`/api/certificates/course/${course.courseId}`)).status).toBe(409);
  });
  test('PDF download is a real PDF; other students are forbidden', async () => {
    const res = await request(app).get(`/api/certificates/${cert.certificateId}/download`).set('Authorization', `Bearer ${student.token}`).buffer(true).parse((r, cb) => { const d = []; r.on('data', (c) => d.push(c)); r.on('end', () => cb(null, Buffer.concat(d))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain(cert.certificateId);
    expect(res.body.slice(0, 5).toString()).toBe('%PDF-');
    expect(res.body.length).toBeGreaterThan(3000);
    expect((await other.api.get(`/api/certificates/${cert.certificateId}/download`)).status).toBe(403);
  });
  test('public verification by certificate ID (case-insensitive) and invalid IDs', async () => {
    const ok = await request(app).get(`/api/certificates/verify/${cert.certificateId.toLowerCase()}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ valid: true, studentName: 'Ravi Kumar', courseTitle: 'Node.js Masterclass' });
    const bad = await request(app).get('/api/certificates/verify/LS-2026-DEADBEEF');
    expect(bad.status).toBe(404);
    expect(bad.body.data.valid).toBe(false);
  });
});
