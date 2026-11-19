const Enrollment = require('../models/Enrollment');
const Lesson = require('../models/Lesson');
const Module = require('../models/Module');
const Course = require('../models/Course');
const QuizAttempt = require('../models/QuizAttempt');
const ActivityLog = require('../models/ActivityLog');
const Quiz = require('../models/Quiz');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { updateLessonProgress, computeCourseProgress } = require('../services/progressService');
const { pageMeta } = require('../utils/pagination');

exports.updateLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  const enrollment = await Enrollment.findOne({ student: req.user._id, course: lesson.course });
  if (!enrollment) throw ApiError.forbidden('You are not enrolled in this course');
  const progress = await updateLessonProgress(enrollment, lesson._id, req.body);
  const entry = enrollment.lessonProgress.find((p) => String(p.lesson) === String(lesson._id));
  respond(res, { lessonProgress: entry, course: progress, enrollmentStatus: enrollment.status });
});

exports.course = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({ student: req.user._id, course: req.params.courseId });
  if (!enrollment) throw ApiError.forbidden('You are not enrolled in this course');
  const [progress, lessons, quizzes, attempts] = await Promise.all([
    computeCourseProgress(enrollment),
    Lesson.find({ course: enrollment.course }).select('_id').lean(),
    Quiz.find({ course: enrollment.course, isPublished: true }).select('title totalMarks passingMarks').lean(),
    QuizAttempt.find({ student: req.user._id, course: enrollment.course, status: 'submitted' }).select('quiz percentage passed').lean(),
  ]);
  respond(res, {
    ...progress, status: enrollment.status, completedAt: enrollment.completedAt,
    lessons: lessons.map((l) => {
      const p = enrollment.lessonProgress.find((x) => String(x.lesson) === String(l._id));
      return { lessonId: l._id, completed: !!p?.completed, watchedSeconds: p?.watchedSeconds || 0, duration: p?.duration || 0 };
    }),
    quizzes: quizzes.map((q) => {
      const mine = attempts.filter((a) => String(a.quiz) === String(q._id));
      return { quizId: q._id, title: q.title, attempts: mine.length, bestPercentage: mine.length ? Math.max(...mine.map((a) => a.percentage)) : null, passed: mine.some((a) => a.passed) };
    }),
  });
});

// Student dashboard: cards + chart data.
exports.summary = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user._id }).populate('course', 'title thumbnailUrl category').lean({ virtuals: false });
  const docs = await Enrollment.find({ student: req.user._id });
  const courses = await Promise.all(docs.map(async (e, i) => ({
    courseId: e.course, title: enrollments[i].course?.title, thumbnailUrl: enrollments[i].course?.thumbnailUrl, status: e.status,
    lastAccessedAt: e.lastAccessedAt, ...(await computeCourseProgress(e)),
  })));
  const attempts = await QuizAttempt.find({ student: req.user._id, status: 'submitted' }).populate('quiz', 'title').sort({ submittedAt: 1 }).select('percentage passed submittedAt quiz').lean();
  const watchedSeconds = docs.reduce((s, e) => s + e.lessonProgress.reduce((x, p) => x + (p.watchedSeconds || 0), 0), 0);
  const since = new Date(Date.now() - 13 * 86400000); since.setUTCHours(0, 0, 0, 0);
  const daily = await ActivityLog.aggregate([
    { $match: { actor: req.user._id, action: 'lesson_completed', createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, lessons: { $sum: 1 } } },
  ]);
  const dMap = new Map(daily.map((d) => [d._id, d.lessons]));
  const activity = Array.from({ length: 14 }, (_, i) => { const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10); return { date: d, lessons: dMap.get(d) || 0 }; });
  respond(res, {
    cards: {
      enrolledCourses: docs.length, completedCourses: docs.filter((e) => e.status === 'completed').length,
      lessonsCompleted: courses.reduce((s, c) => s + c.completedLessons, 0), watchTimeMinutes: Math.round(watchedSeconds / 60),
      quizzesTaken: attempts.length, averageQuizScore: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length) : 0,
    },
    courses,
    quizScores: attempts.slice(-10).map((a) => ({ title: a.quiz?.title, percentage: a.percentage, passed: a.passed, date: a.submittedAt })),
    activity,
  });
});

exports.history = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1); const limit = 20;
  const filter = { actor: req.user._id, action: { $in: ['enrolled', 'lesson_completed', 'quiz_passed', 'quiz_failed', 'course_completed', 'certificate_issued', 'payment_success'] } };
  const [items, total] = await Promise.all([ActivityLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), ActivityLog.countDocuments(filter)]);
  respond(res, items, { meta: pageMeta(total, page, limit) });
});
