const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { notify } = require('./notificationService');
const { logActivity } = require('./activityService');

/** Course progress for one enrollment: lesson completion + required quizzes. */
async function computeCourseProgress(enrollment) {
  const [lessons, quizzes] = await Promise.all([
    Lesson.find({ course: enrollment.course }).select('_id duration').lean(),
    Quiz.find({ course: enrollment.course, isPublished: true }).select('_id').lean(),
  ]);
  const lessonIds = new Set(lessons.map((l) => String(l._id)));
  const completedLessons = enrollment.lessonProgress.filter((p) => p.completed && lessonIds.has(String(p.lesson))).length;
  const passedQuizIds = await QuizAttempt.distinct('quiz', {
    student: enrollment.student, course: enrollment.course, status: 'submitted', passed: true, quiz: { $in: quizzes.map((q) => q._id) },
  });
  const totalLessons = lessons.length;
  const percent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  return {
    totalLessons, completedLessons, percent,
    totalQuizzes: quizzes.length, passedQuizzes: passedQuizIds.length,
    eligibleForCertificate: totalLessons > 0 && completedLessons === totalLessons && passedQuizIds.length === quizzes.length,
  };
}

/** Marks the enrollment as completed once everything required is done. */
async function syncCompletion(enrollment) {
  const progress = await computeCourseProgress(enrollment);
  if (progress.eligibleForCertificate && enrollment.status !== 'completed') {
    enrollment.status = 'completed'; enrollment.completedAt = new Date();
    await enrollment.save();
    const course = await Course.findById(enrollment.course).select('title');
    await notify(enrollment.student, { type: 'course_completed', title: 'Course completed 🎉', message: `You finished ${course.title}. Your certificate is ready.`, link: '/student/certificates' });
    await logActivity({ actor: enrollment.student, action: 'course_completed', entityType: 'Course', entityId: enrollment.course, summary: `Completed ${course.title}` });
  }
  return progress;
}

async function updateLessonProgress(enrollment, lessonId, { watchedSeconds = 0, duration = 0, completed = false }) {
  const COMPLETE_RATIO = 0.9;
  let entry = enrollment.lessonProgress.find((p) => String(p.lesson) === String(lessonId));
  if (!entry) { enrollment.lessonProgress.push({ lesson: lessonId }); entry = enrollment.lessonProgress[enrollment.lessonProgress.length - 1]; }
  const wasCompleted = entry.completed;
  entry.watchedSeconds = Math.max(entry.watchedSeconds || 0, watchedSeconds);
  if (duration) entry.duration = duration;
  entry.updatedAt = new Date();
  if (completed || (entry.duration > 0 && entry.watchedSeconds / entry.duration >= COMPLETE_RATIO)) {
    entry.completed = true; entry.completedAt = entry.completedAt || new Date();
  }
  enrollment.lastAccessedAt = new Date();
  await enrollment.save();
  if (entry.completed && !wasCompleted) {
    const lesson = await Lesson.findById(lessonId).select('title');
    await logActivity({ actor: enrollment.student, action: 'lesson_completed', entityType: 'Lesson', entityId: lessonId, summary: `Completed lesson “${lesson?.title}”` });
  }
  return syncCompletion(enrollment);
}

async function syncCompletionFor(studentId, courseId) {
  const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
  return enrollment ? syncCompletion(enrollment) : null;
}

module.exports = { computeCourseProgress, syncCompletion, syncCompletionFor, updateLessonProgress };
