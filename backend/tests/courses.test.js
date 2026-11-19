const { setup, teardown, makeUser, courseBody, makePublishedCourse } = require('./helpers');

let app; let admin; let instructor; let student; let student2;
beforeAll(async () => {
  app = await setup();
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor'); student = await makeUser(app, 'student'); student2 = await makeUser(app, 'student');
});
afterAll(teardown);

describe('Course management', () => {
  let courseId; let moduleId; let lessonId;

  test('instructor creates a course (draft, unpublished) with validation', async () => {
    const bad = await instructor.api.post('/api/courses', { title: 'x', description: 'short' });
    expect(bad.status).toBe(400);
    const res = await instructor.api.post('/api/courses', courseBody({ price: 499 }));
    expect(res.status).toBe(201);
    courseId = res.body.data._id;
    expect(res.body.data).toMatchObject({ approvalStatus: 'draft', isPublished: false, price: 499 });
    expect(res.body.data.slug).toMatch(/^node-js-masterclass-/);
  });

  test('instructor adds modules and lessons; course totals update', async () => {
    const m = await instructor.api.post(`/api/courses/${courseId}/modules`, { title: 'Basics' });
    expect(m.status).toBe(201); moduleId = m.body.data._id;
    const l = await instructor.api.post(`/api/modules/${moduleId}/lessons`, { title: 'Intro lesson', isPreview: true });
    expect(l.status).toBe(201); lessonId = l.body.data._id;
    const detail = await instructor.api.get(`/api/courses/${courseId}`);
    expect(detail.body.data.curriculum[0].lessons).toHaveLength(1);
    expect(detail.body.data.lessonsCount).toBe(1);
  });

  test('draft courses are hidden from the public catalogue and from students', async () => {
    expect((await student.api.get(`/api/courses/${courseId}`)).status).toBe(404);
    const list = await student.api.get('/api/courses');
    expect(list.body.data.find((c) => c._id === courseId)).toBeUndefined();
  });

  test('cannot publish before admin approval; empty courses cannot be submitted', async () => {
    expect((await instructor.api.patch(`/api/courses/${courseId}/publish`, { publish: true })).status).toBe(409);
    const empty = await instructor.api.post('/api/courses', courseBody({ title: 'Empty course title' }));
    expect((await instructor.api.post(`/api/courses/${empty.body.data._id}/submit`)).status).toBe(400);
  });

  test('admin rejection requires a reason; approval publishes the course', async () => {
    expect((await instructor.api.post(`/api/courses/${courseId}/submit`)).status).toBe(200);
    expect((await admin.api.patch(`/api/admin/courses/${courseId}/review`, { decision: 'reject' })).status).toBe(400);
    const rej = await admin.api.patch(`/api/admin/courses/${courseId}/review`, { decision: 'reject', reason: 'Needs more lessons' });
    expect(rej.body.data.approvalStatus).toBe('rejected');
    expect((await instructor.api.post(`/api/courses/${courseId}/submit`)).status).toBe(200); // resubmit
    const ok = await admin.api.patch(`/api/admin/courses/${courseId}/review`, { decision: 'approve' });
    expect(ok.body.data).toMatchObject({ approvalStatus: 'approved', isPublished: true });
  });

  test('unpublish / publish toggle hides and shows the course', async () => {
    await instructor.api.patch(`/api/courses/${courseId}/publish`, { publish: false });
    expect((await student.api.get(`/api/courses/${courseId}`)).status).toBe(404);
    await instructor.api.patch(`/api/courses/${courseId}/publish`, { publish: true });
    expect((await student.api.get(`/api/courses/${courseId}`)).status).toBe(200);
  });

  test('public catalogue supports search, filters, sorting and pagination', async () => {
    await makePublishedCourse(app, instructor, admin, { price: 0 });
    const all = await student.api.get('/api/courses?limit=1&page=1');
    expect(all.body.meta).toMatchObject({ limit: 1, page: 1 });
    expect(all.body.meta.total).toBeGreaterThanOrEqual(2);
    expect((await student.api.get('/api/courses?price=free')).body.data.every((c) => c.price === 0)).toBe(true);
    expect((await student.api.get('/api/courses?q=masterclass')).body.data.length).toBeGreaterThan(0);
    expect((await student.api.get('/api/courses?q=zzzznothing')).body.data).toHaveLength(0);
    expect((await student.api.get('/api/courses?level=expert')).status).toBe(400);
  });

  describe('Enrollment', () => {
    let freeCourse;
    beforeAll(async () => { freeCourse = await makePublishedCourse(app, instructor, admin, { price: 0, lessons: 2 }); });

    test('paid courses cannot be enrolled without payment (402)', async () => {
      expect((await student.api.post('/api/enrollments', { courseId })).status).toBe(402);
    });
    test('student enrolls in a free course; duplicate enrollment gives 409', async () => {
      const res = await student.api.post('/api/enrollments', { courseId: freeCourse.courseId });
      expect(res.status).toBe(201);
      expect((await student.api.post('/api/enrollments', { courseId: freeCourse.courseId })).status).toBe(409);
      const mine = await student.api.get('/api/enrollments/mine');
      expect(mine.body.data).toHaveLength(1);
      expect(mine.body.data[0].progress).toMatchObject({ totalLessons: 2, completedLessons: 0, percent: 0 });
    });
    test('enrollment increments the course counter and notifies the instructor', async () => {
      const c = await instructor.api.get(`/api/courses/${freeCourse.courseId}`);
      expect(c.body.data.enrollmentCount).toBe(1);
      const n = await instructor.api.get('/api/notifications');
      expect(n.body.data.some((x) => x.type === 'new_student')).toBe(true);
    });
    test('instructor sees enrolled students with progress', async () => {
      const res = await instructor.api.get(`/api/courses/${freeCourse.courseId}/students`);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({ totalLessons: 2, percent: 0 });
    });
    test('lesson access: enrolled OK, free preview OK for others, locked lessons forbidden', async () => {
      const [previewLesson, lockedLesson] = freeCourse.lessonIds;
      expect((await student.api.get(`/api/lessons/${lockedLesson}`)).status).toBe(200);
      expect((await student2.api.get(`/api/lessons/${previewLesson}`)).status).toBe(200);
      expect((await student2.api.get(`/api/lessons/${lockedLesson}`)).status).toBe(403);
    });
    test('a course with enrolled students cannot be deleted', async () => {
      expect((await instructor.api.delete(`/api/courses/${freeCourse.courseId}`)).status).toBe(409);
    });
    test('a course without enrollments can be deleted with its content', async () => {
      const tmp = await instructor.api.post('/api/courses', courseBody({ title: 'Disposable course' }));
      const id = tmp.body.data._id;
      const m = await instructor.api.post(`/api/courses/${id}/modules`, { title: 'Module' });
      await instructor.api.post(`/api/modules/${m.body.data._id}/lessons`, { title: 'Lesson one' });
      expect((await instructor.api.delete(`/api/courses/${id}`)).status).toBe(200);
      expect((await instructor.api.get(`/api/courses/${id}`)).status).toBe(404);
    });
  });
});
