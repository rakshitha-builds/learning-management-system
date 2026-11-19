const express = require('express');
const { authenticate, optionalAuth, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { uploadVideo, uploadImage } = require('../middleware/upload');
const v = require('../validators');
const env = require('../config/env');
const respond = require('../utils/respond');

const auth = require('../controllers/authController');
const course = require('../controllers/courseController');
const cur = require('../controllers/curriculumController');
const enrollment = require('../controllers/enrollmentController');
const video = require('../controllers/videoController');
const quiz = require('../controllers/quizController');
const progress = require('../controllers/progressController');
const cert = require('../controllers/certificateController');
const live = require('../controllers/liveController');
const payment = require('../controllers/paymentController');
const revenue = require('../controllers/revenueController');
const notif = require('../controllers/notificationController');
const admin = require('../controllers/adminController');

const r = express.Router();
const { STUDENT, INSTRUCTOR, ADMIN } = { STUDENT: 'student', INSTRUCTOR: 'instructor', ADMIN: 'admin' };
const id = validate({ params: v.idParam('id') });

// ---- Platform ----
r.get('/health', (req, res) => respond(res, { status: 'ok', time: new Date().toISOString() }));
r.get('/config', (req, res) => respond(res, {
  storage: env.storage.driver, cloudfront: env.features.cloudfront, livekit: env.features.livekit,
  payments: env.features.razorpay ? 'razorpay-test' : 'simulated', platformFeePercent: env.platformFeePercent,
}));

// ---- Auth ----
r.post('/auth/register', authLimiter, validate({ body: v.auth.register }), auth.register);
r.post('/auth/login', authLimiter, validate({ body: v.auth.login }), auth.login);
r.get('/auth/me', authenticate, auth.me);
r.patch('/auth/me', authenticate, validate({ body: v.auth.updateProfile }), auth.updateProfile);

// ---- Courses ----
r.get('/categories', course.categories);
r.get('/courses', validate({ query: v.course.list }), course.listPublic);
r.get('/courses/mine', authenticate, authorize(INSTRUCTOR), course.listMine);
r.post('/courses', authenticate, authorize(INSTRUCTOR), validate({ body: v.course.create }), course.create);
r.get('/courses/:id', optionalAuth, course.getCourse);
r.put('/courses/:id', authenticate, authorize(INSTRUCTOR), id, validate({ body: v.course.update }), course.update);
r.delete('/courses/:id', authenticate, authorize(INSTRUCTOR, ADMIN), id, course.remove);
r.post('/courses/:id/submit', authenticate, authorize(INSTRUCTOR), id, course.submitForReview);
r.patch('/courses/:id/publish', authenticate, authorize(INSTRUCTOR), id, validate({ body: v.course.publish }), course.setPublish);
r.post('/courses/:id/thumbnail', authenticate, authorize(INSTRUCTOR), id, uploadImage, course.uploadThumbnail);
r.get('/courses/:id/students', authenticate, authorize(INSTRUCTOR, ADMIN), id, course.students);

// ---- Modules & lessons ----
r.post('/courses/:courseId/modules', authenticate, authorize(INSTRUCTOR), validate({ params: v.idParam('courseId'), body: v.curriculum.module }), cur.createModule);
r.put('/modules/:id', authenticate, authorize(INSTRUCTOR), id, validate({ body: v.curriculum.moduleUpdate }), cur.updateModule);
r.delete('/modules/:id', authenticate, authorize(INSTRUCTOR), id, cur.deleteModule);
r.post('/modules/:moduleId/lessons', authenticate, authorize(INSTRUCTOR), validate({ params: v.idParam('moduleId'), body: v.curriculum.lesson }), cur.createLesson);
r.put('/lessons/:id', authenticate, authorize(INSTRUCTOR), id, validate({ body: v.curriculum.lessonUpdate }), cur.updateLesson);
r.delete('/lessons/:id', authenticate, authorize(INSTRUCTOR), id, cur.deleteLesson);
r.get('/lessons/:id', optionalAuth, id, cur.getLesson);
r.get('/lessons/:id/playback', authenticate, id, video.playback);

// ---- Enrollment ----
r.post('/enrollments', authenticate, authorize(STUDENT), validate({ body: v.payment.checkout }), enrollment.enroll);
r.get('/enrollments/mine', authenticate, authorize(STUDENT), enrollment.mine);
r.get('/enrollments/check/:courseId', authenticate, authorize(STUDENT), validate({ params: v.idParam('courseId') }), enrollment.check);

// ---- Videos ----
r.post('/videos/upload', authenticate, authorize(INSTRUCTOR), uploadVideo, video.upload);
r.get('/videos/:id', authenticate, authorize(INSTRUCTOR, ADMIN), id, video.getStatus);
r.post('/videos/:id/retry', authenticate, authorize(INSTRUCTOR, ADMIN), id, video.retry);
r.delete('/videos/:id', authenticate, authorize(INSTRUCTOR, ADMIN), id, video.remove);

// ---- Quizzes ----
r.post('/courses/:courseId/quizzes', authenticate, authorize(INSTRUCTOR), validate({ params: v.idParam('courseId'), body: v.quiz.create }), quiz.create);
r.get('/courses/:courseId/quizzes', authenticate, validate({ params: v.idParam('courseId') }), quiz.listForCourse);
r.get('/attempts/mine', authenticate, authorize(STUDENT), quiz.myHistory);
r.get('/attempts/:attemptId', authenticate, validate({ params: v.idParam('attemptId') }), quiz.result);
r.post('/attempts/:attemptId/submit', authenticate, authorize(STUDENT), validate({ params: v.idParam('attemptId'), body: v.quiz.submit }), quiz.submit);
r.get('/quizzes/:id', authenticate, id, quiz.getForStudent);
r.get('/quizzes/:id/manage', authenticate, authorize(INSTRUCTOR, ADMIN), id, quiz.manage);
r.put('/quizzes/:id', authenticate, authorize(INSTRUCTOR), id, validate({ body: v.quiz.create }), quiz.update);
r.delete('/quizzes/:id', authenticate, authorize(INSTRUCTOR, ADMIN), id, quiz.remove);
r.post('/quizzes/:id/attempts', authenticate, authorize(STUDENT), id, quiz.startAttempt);
r.get('/quizzes/:id/attempts/mine', authenticate, authorize(STUDENT), id, quiz.myAttemptsForQuiz);
r.get('/quizzes/:id/attempts', authenticate, authorize(INSTRUCTOR, ADMIN), id, quiz.attemptsForInstructor);

// ---- Progress ----
r.post('/progress/lessons/:lessonId', authenticate, authorize(STUDENT), validate({ params: v.idParam('lessonId'), body: v.progress.lesson }), progress.updateLesson);
r.get('/progress/summary', authenticate, authorize(STUDENT), progress.summary);
r.get('/progress/history', authenticate, authorize(STUDENT), progress.history);
r.get('/progress/courses/:courseId', authenticate, authorize(STUDENT), validate({ params: v.idParam('courseId') }), progress.course);

// ---- Certificates ----
r.get('/certificates/verify/:certificateId', cert.verify);
r.get('/certificates/mine', authenticate, authorize(STUDENT), cert.mine);
r.post('/certificates/course/:courseId', authenticate, authorize(STUDENT), validate({ params: v.idParam('courseId') }), cert.issue);
r.get('/certificates/:id/download', authenticate, cert.download);

// ---- Live classes ----
r.post('/live', authenticate, authorize(INSTRUCTOR), validate({ body: v.live.create }), live.create);
r.get('/live', authenticate, live.list);
r.get('/live/:id', authenticate, id, live.get);
r.post('/live/:id/start', authenticate, authorize(INSTRUCTOR), id, live.start);
r.post('/live/:id/end', authenticate, authorize(INSTRUCTOR), id, live.end);
r.post('/live/:id/cancel', authenticate, authorize(INSTRUCTOR, ADMIN), id, live.cancel);
r.post('/live/:id/token', authenticate, id, live.token);
r.get('/live/:id/messages', authenticate, id, live.messages);

// ---- Payments (webhook is mounted in app.js with a raw body parser) ----
r.get('/payments/config', authenticate, payment.config);
r.post('/payments/checkout', authenticate, authorize(STUDENT), validate({ body: v.payment.checkout }), payment.checkout);
r.post('/payments/verify', authenticate, authorize(STUDENT), validate({ body: v.payment.verify }), payment.verify);
r.post('/payments/:id/fail', authenticate, authorize(STUDENT), id, validate({ body: v.payment.fail }), payment.fail);
r.post('/payments/:id/simulate', authenticate, authorize(STUDENT), id, validate({ body: v.payment.simulate }), payment.simulate);
r.get('/payments/mine', authenticate, authorize(STUDENT), payment.mine);

// ---- Instructor revenue ----
r.get('/revenue/summary', authenticate, authorize(INSTRUCTOR), revenue.summary);
r.get('/revenue/transactions', authenticate, authorize(INSTRUCTOR), revenue.transactions);

// ---- Notifications ----
r.get('/notifications', authenticate, notif.list);
r.patch('/notifications/read-all', authenticate, notif.markAllRead);
r.patch('/notifications/:id/read', authenticate, id, notif.markRead);

// ---- Admin ----
const adminOnly = [authenticate, authorize(ADMIN)];
r.get('/admin/stats', ...adminOnly, admin.stats);
r.get('/admin/users', ...adminOnly, validate({ query: v.listQuery }), admin.listUsers);
r.post('/admin/users', ...adminOnly, validate({ body: v.admin.createUser }), admin.createUser);
r.patch('/admin/users/:id/status', ...adminOnly, id, validate({ body: v.admin.userStatus }), admin.setUserStatus);
r.get('/admin/courses', ...adminOnly, validate({ query: v.listQuery }), admin.listCourses);
r.patch('/admin/courses/:id/review', ...adminOnly, id, validate({ body: v.admin.review }), admin.reviewCourse);
r.get('/admin/enrollments', ...adminOnly, validate({ query: v.listQuery }), admin.listEnrollments);
r.get('/admin/transactions', ...adminOnly, validate({ query: v.listQuery }), admin.listTransactions);
r.get('/admin/activity', ...adminOnly, validate({ query: v.listQuery }), admin.listActivity);

module.exports = r;
