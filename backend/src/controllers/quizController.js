const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const Enrollment = require('../models/Enrollment');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { loadCourseOr404, assertCourseOwner, isOwner } = require('../utils/access');
const { refreshQuizTotals, gradeAnswers } = require('../services/quizService');
const { syncCompletionFor } = require('../services/progressService');
const { logActivity } = require('../services/activityService');
const { notify } = require('../services/notificationService');

const GRACE_MS = 60 * 1000;

// Strips answers: students must never receive correctIndex/explanation before submitting.
const studentQuestion = (q) => ({ _id: q._id, text: q.text, marks: q.marks, order: q.order, options: q.options.map((o) => ({ _id: o._id, text: o.text })) });

async function assertQuizManager(quizId, user) {
  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw ApiError.notFound('Quiz not found');
  const course = await loadCourseOr404(quiz.course);
  if (user.role !== 'admin') assertCourseOwner(course, user);
  return { quiz, course };
}
async function assertEnrolled(studentId, courseId) {
  if (!(await Enrollment.exists({ student: studentId, course: courseId }))) throw ApiError.forbidden('Enroll in this course to take its quizzes');
}

async function writeQuestions(quizId, questions) {
  await Question.deleteMany({ quiz: quizId });
  await Question.insertMany(questions.map((q, i) => ({
    quiz: quizId, text: q.text, options: q.options.map((text) => ({ text })), correctIndex: q.correctIndex, marks: q.marks, explanation: q.explanation, order: i,
  })));
  await refreshQuizTotals(quizId);
}

exports.create = asyncHandler(async (req, res) => {
  const course = await loadCourseOr404(req.params.courseId);
  assertCourseOwner(course, req.user);
  const { questions, ...fields } = req.body;
  const quiz = await Quiz.create({ ...fields, course: course._id, createdBy: req.user._id });
  await writeQuestions(quiz._id, questions);
  respond(res, await Quiz.findById(quiz._id), { status: 201 });
});

exports.update = asyncHandler(async (req, res) => {
  const { quiz } = await assertQuizManager(req.params.id, req.user);
  const { questions, ...fields } = req.body;
  Object.assign(quiz, fields); await quiz.save();
  await writeQuestions(quiz._id, questions);
  respond(res, await Quiz.findById(quiz._id));
});

exports.remove = asyncHandler(async (req, res) => {
  const { quiz } = await assertQuizManager(req.params.id, req.user);
  await Promise.all([Question.deleteMany({ quiz: quiz._id }), QuizAttempt.deleteMany({ quiz: quiz._id }), quiz.deleteOne()]);
  respond(res, { deleted: true });
});

exports.listForCourse = asyncHandler(async (req, res) => {
  const course = await loadCourseOr404(req.params.courseId);
  const manager = req.user.role === 'admin' || isOwner(course, req.user);
  if (!manager) await assertEnrolled(req.user._id, course._id);
  const quizzes = await Quiz.find({ course: course._id, ...(manager ? {} : { isPublished: true }) }).sort({ createdAt: 1 }).lean();
  if (manager) return respond(res, quizzes);
  const attempts = await QuizAttempt.find({ student: req.user._id, course: course._id, status: 'submitted' }).select('quiz percentage passed score').lean();
  respond(res, quizzes.map((q) => {
    const mine = attempts.filter((a) => String(a.quiz) === String(q._id));
    return { ...q, attemptsCount: mine.length, bestPercentage: mine.length ? Math.max(...mine.map((a) => a.percentage)) : null, passed: mine.some((a) => a.passed) };
  }));
});

// Instructor view with the answer key.
exports.manage = asyncHandler(async (req, res) => {
  const { quiz } = await assertQuizManager(req.params.id, req.user);
  respond(res, { ...quiz.toObject(), questions: await Question.find({ quiz: quiz._id }).sort({ order: 1 }).lean() });
});

exports.attemptsForInstructor = asyncHandler(async (req, res) => {
  const { quiz } = await assertQuizManager(req.params.id, req.user);
  const attempts = await QuizAttempt.find({ quiz: quiz._id, status: 'submitted' }).populate('student', 'name email').sort({ submittedAt: -1 }).limit(200).lean();
  respond(res, attempts.map(({ answers, ...a }) => a));
});

// Student view: questions WITHOUT answers.
exports.getForStudent = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).lean();
  if (!quiz) throw ApiError.notFound('Quiz not found');
  const course = await loadCourseOr404(quiz.course);
  if (req.user.role === 'student') await assertEnrolled(req.user._id, course._id);
  else if (!(req.user.role === 'admin' || isOwner(course, req.user))) throw ApiError.forbidden();
  const questions = await Question.find({ quiz: quiz._id }).sort({ order: 1 }).lean();
  respond(res, { ...quiz, questions: questions.map(studentQuestion) });
});

exports.startAttempt = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz || !quiz.isPublished) throw ApiError.notFound('Quiz not found');
  await assertEnrolled(req.user._id, quiz.course);
  const questions = await Question.find({ quiz: quiz._id }).sort({ order: 1 }).lean();
  if (!questions.length) throw ApiError.conflict('This quiz has no questions yet');

  let attempt = await QuizAttempt.findOne({ quiz: quiz._id, student: req.user._id, status: 'in_progress' });
  if (attempt && Date.now() > attempt.startedAt.getTime() + quiz.durationMinutes * 60000 + GRACE_MS) {
    await autoSubmitExpired(attempt, quiz); attempt = null; // stale attempt is graded as-is and a fresh one starts
  }
  if (!attempt) attempt = await QuizAttempt.create({ quiz: quiz._id, course: quiz.course, student: req.user._id, totalMarks: quiz.totalMarks });
  respond(res, {
    attemptId: attempt._id, startedAt: attempt.startedAt, expiresAt: new Date(attempt.startedAt.getTime() + quiz.durationMinutes * 60000),
    quiz: { _id: quiz._id, title: quiz.title, durationMinutes: quiz.durationMinutes, passingMarks: quiz.passingMarks, totalMarks: quiz.totalMarks, questions: questions.map(studentQuestion) },
  }, { status: 201 });
});

async function finalize(attempt, quiz, answers, { timedOut }) {
  const questions = await Question.find({ quiz: quiz._id }).sort({ order: 1 }).lean();
  const result = gradeAnswers(questions, answers, quiz.passingMarks);
  attempt.answers = result.graded; attempt.score = result.score; attempt.totalMarks = result.totalMarks;
  attempt.percentage = result.percentage;
  attempt.passed = timedOut ? false : result.passed; // answers submitted long after the deadline cannot pass
  attempt.timedOut = timedOut; attempt.status = 'submitted'; attempt.submittedAt = new Date();
  attempt.timeTakenSec = Math.round((attempt.submittedAt - attempt.startedAt) / 1000);
  await attempt.save();
  return attempt;
}
const autoSubmitExpired = (attempt, quiz) => finalize(attempt, quiz, [], { timedOut: true });

exports.submit = asyncHandler(async (req, res) => {
  const attempt = await QuizAttempt.findById(req.params.attemptId);
  if (!attempt || String(attempt.student) !== String(req.user._id)) throw ApiError.notFound('Attempt not found');
  if (attempt.status === 'submitted') throw ApiError.conflict('This attempt was already submitted');
  const quiz = await Quiz.findById(attempt.quiz);
  const deadline = attempt.startedAt.getTime() + quiz.durationMinutes * 60000 + GRACE_MS;
  await finalize(attempt, quiz, req.body.answers, { timedOut: Date.now() > deadline });
  await logActivity({ actor: req.user, action: attempt.passed ? 'quiz_passed' : 'quiz_failed', entityType: 'Quiz', entityId: quiz._id, summary: `${attempt.passed ? 'Passed' : 'Attempted'} quiz “${quiz.title}” (${attempt.percentage}%)`, meta: { score: attempt.score, total: attempt.totalMarks } });
  if (attempt.passed) await syncCompletionFor(req.user._id, quiz.course);
  res.status(200);
  return exports.result({ params: { attemptId: attempt._id }, user: req.user }, res);
});

// Result with the answer key — only for submitted attempts.
exports.result = asyncHandler(async (req, res) => {
  const attempt = await QuizAttempt.findById(req.params.attemptId).populate('quiz', 'title passingMarks totalMarks durationMinutes course').lean();
  if (!attempt) throw ApiError.notFound('Attempt not found');
  const course = await loadCourseOr404(attempt.course);
  const own = String(attempt.student) === String(req.user._id);
  if (!own && !(req.user.role === 'admin' || isOwner(course, req.user))) throw ApiError.forbidden();
  if (attempt.status !== 'submitted') return respond(res, { ...attempt, answers: undefined });
  const questions = await Question.find({ quiz: attempt.quiz._id }).sort({ order: 1 }).lean();
  const review = questions.map((q) => {
    const a = attempt.answers.find((x) => String(x.question) === String(q._id));
    return { questionId: q._id, text: q.text, options: q.options.map((o) => o.text), selectedIndex: a?.selectedIndex ?? null, correctIndex: q.correctIndex, isCorrect: !!a?.isCorrect, marks: q.marks, marksAwarded: a?.marksAwarded || 0, explanation: q.explanation };
  });
  const { answers, ...rest } = attempt;
  respond(res, { ...rest, review });
});

exports.myAttemptsForQuiz = asyncHandler(async (req, res) => {
  const attempts = await QuizAttempt.find({ quiz: req.params.id, student: req.user._id, status: 'submitted' }).select('-answers').sort({ submittedAt: -1 }).lean();
  respond(res, attempts);
});

exports.myHistory = asyncHandler(async (req, res) => {
  const attempts = await QuizAttempt.find({ student: req.user._id, status: 'submitted' })
    .populate('quiz', 'title passingMarks').populate('course', 'title').select('-answers').sort({ submittedAt: -1 }).limit(100).lean();
  respond(res, attempts);
});
