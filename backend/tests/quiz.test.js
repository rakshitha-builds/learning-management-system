const { setup, teardown, makeUser, makePublishedCourse } = require('./helpers');
const { gradeAnswers } = require('../src/services/quizService');

let app; let admin; let instructor; let student; let outsider; let course; let quizId;
const quizBody = {
  title: 'Node fundamentals quiz', description: 'Basics', durationMinutes: 10, passingMarks: 3,
  questions: [
    { text: 'Which runtime executes JS on the server?', options: ['Node.js', 'Rust', 'Go'], correctIndex: 0, marks: 2, explanation: 'Node.js is a JS runtime.' },
    { text: 'Which keyword declares a constant?', options: ['var', 'const', 'let', 'def'], correctIndex: 1, marks: 2 },
    { text: 'npm stands for?', options: ['Node Package Manager', 'New Program Maker'], correctIndex: 0, marks: 1 },
  ],
};

beforeAll(async () => {
  app = await setup();
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor'); student = await makeUser(app, 'student'); outsider = await makeUser(app, 'student');
  course = await makePublishedCourse(app, instructor, admin);
  await student.api.post('/api/enrollments', { courseId: course.courseId });
});
afterAll(teardown);

describe('gradeAnswers (unit)', () => {
  const qs = [{ _id: 'a', correctIndex: 1, marks: 2 }, { _id: 'b', correctIndex: 0, marks: 3 }];
  test('awards marks only for correct answers and computes pass/fail', () => {
    const r = gradeAnswers(qs, [{ questionId: 'a', selectedIndex: 1 }, { questionId: 'b', selectedIndex: 2 }], 2);
    expect(r).toMatchObject({ score: 2, totalMarks: 5, percentage: 40, passed: true });
    expect(gradeAnswers(qs, [], 1)).toMatchObject({ score: 0, passed: false });
    expect(gradeAnswers(qs, [{ questionId: 'a', selectedIndex: 1 }, { questionId: 'b', selectedIndex: 0 }], 5).passed).toBe(true);
  });
});

describe('Quiz creation (instructor)', () => {
  test('validates structure: needs questions, valid correct index, passing marks <= total', async () => {
    expect((await instructor.api.post(`/api/courses/${course.courseId}/quizzes`, { ...quizBody, questions: [] })).status).toBe(400);
    const badIdx = { ...quizBody, questions: [{ text: 'Q?', options: ['a', 'b'], correctIndex: 5, marks: 1 }] };
    expect((await instructor.api.post(`/api/courses/${course.courseId}/quizzes`, badIdx)).status).toBe(400);
    expect((await instructor.api.post(`/api/courses/${course.courseId}/quizzes`, { ...quizBody, passingMarks: 99 })).status).toBe(400);
  });
  test('creates a quiz and caches totals', async () => {
    const res = await instructor.api.post(`/api/courses/${course.courseId}/quizzes`, quizBody);
    expect(res.status).toBe(201);
    quizId = res.body.data._id;
    expect(res.body.data).toMatchObject({ totalMarks: 5, questionCount: 3, passingMarks: 3 });
  });
  test('instructor can read the answer key; it contains correct answers', async () => {
    const res = await instructor.api.get(`/api/quizzes/${quizId}/manage`);
    expect(res.body.data.questions[0].correctIndex).toBe(0);
  });
});

describe('Student attempts and automatic grading', () => {
  let attempt;
  test('students never receive correct answers before submission', async () => {
    const view = await student.api.get(`/api/quizzes/${quizId}`);
    expect(view.status).toBe(200);
    expect(JSON.stringify(view.body)).not.toMatch(/correctIndex|explanation/);
    const start = await student.api.post(`/api/quizzes/${quizId}/attempts`);
    expect(start.status).toBe(201);
    attempt = start.body.data;
    expect(JSON.stringify(start.body)).not.toMatch(/correctIndex|explanation/);
    const inProgress = await student.api.get(`/api/attempts/${attempt.attemptId}`);
    expect(JSON.stringify(inProgress.body)).not.toMatch(/correctIndex|review/);
    const list = await student.api.get(`/api/courses/${course.courseId}/quizzes`);
    expect(JSON.stringify(list.body)).not.toMatch(/correctIndex/);
  });
  test('starting again resumes the same in-progress attempt', async () => {
    const again = await student.api.post(`/api/quizzes/${quizId}/attempts`);
    expect(again.body.data.attemptId).toBe(attempt.attemptId);
  });
  test('non-enrolled students and other roles cannot attempt', async () => {
    expect((await outsider.api.post(`/api/quizzes/${quizId}/attempts`)).status).toBe(403);
    expect((await outsider.api.get(`/api/quizzes/${quizId}`)).status).toBe(403);
    expect((await instructor.api.post(`/api/quizzes/${quizId}/attempts`)).status).toBe(403);
  });
  test('submission is graded automatically and reveals the answer key', async () => {
    const q = attempt.quiz.questions;
    const res = await student.api.post(`/api/attempts/${attempt.attemptId}/submit`, {
      answers: [{ questionId: q[0]._id, selectedIndex: 0 }, { questionId: q[1]._id, selectedIndex: 0 }, { questionId: q[2]._id, selectedIndex: 0 }],
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ score: 3, totalMarks: 5, percentage: 60, passed: true, status: 'submitted' });
    expect(res.body.data.review.map((r) => r.isCorrect)).toEqual([true, false, true]);
    expect(res.body.data.review[1].correctIndex).toBe(1);
    expect(res.body.data.review[0].explanation).toBe('Node.js is a JS runtime.');
  });
  test('a submitted attempt cannot be resubmitted (409) and cannot be read by others', async () => {
    expect((await student.api.post(`/api/attempts/${attempt.attemptId}/submit`, { answers: [] })).status).toBe(409);
    expect((await outsider.api.get(`/api/attempts/${attempt.attemptId}`)).status).toBe(403);
  });
  test('quiz history and per-quiz attempts list the result', async () => {
    const hist = await student.api.get('/api/attempts/mine');
    expect(hist.body.data).toHaveLength(1);
    expect(hist.body.data[0]).toMatchObject({ percentage: 60, passed: true });
    expect((await student.api.get(`/api/quizzes/${quizId}/attempts/mine`)).body.data).toHaveLength(1);
    const inst = await instructor.api.get(`/api/quizzes/${quizId}/attempts`);
    expect(inst.body.data).toHaveLength(1);
  });
  test('failing attempt: below passing marks is recorded as failed', async () => {
    const start = await student.api.post(`/api/quizzes/${quizId}/attempts`);
    const res = await student.api.post(`/api/attempts/${start.body.data.attemptId}/submit`, { answers: [] });
    expect(res.body.data).toMatchObject({ score: 0, passed: false });
  });
  test('late submission (after duration + grace) is flagged timed out and cannot pass', async () => {
    const QuizAttempt = require('../src/models/QuizAttempt');
    const start = await student.api.post(`/api/quizzes/${quizId}/attempts`);
    const q = start.body.data.quiz.questions;
    await QuizAttempt.updateOne({ _id: start.body.data.attemptId }, { startedAt: new Date(Date.now() - 3 * 3600 * 1000) });
    const res = await student.api.post(`/api/attempts/${start.body.data.attemptId}/submit`, { answers: [{ questionId: q[0]._id, selectedIndex: 0 }, { questionId: q[1]._id, selectedIndex: 1 }, { questionId: q[2]._id, selectedIndex: 0 }] });
    expect(res.body.data).toMatchObject({ score: 5, timedOut: true, passed: false });
  });
  test('instructor can update (replace) questions', async () => {
    const res = await instructor.api.put(`/api/quizzes/${quizId}`, { ...quizBody, passingMarks: 1, questions: quizBody.questions.slice(0, 2) });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ totalMarks: 4, questionCount: 2 });
  });
});
