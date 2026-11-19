const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const VideoAsset = require('../models/VideoAsset');
const Enrollment = require('../models/Enrollment');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { loadCourseOr404, assertCourseOwner, isOwner } = require('../utils/access');
const { getStorage } = require('../services/storage');
const { recalcCourseTotals } = require('../services/videoProcessing');

async function loadModule(id, user) {
  const mod = await Module.findById(id);
  if (!mod) throw ApiError.notFound('Module not found');
  assertCourseOwner(await loadCourseOr404(mod.course), user);
  return mod;
}
async function loadLessonForOwner(id, user) {
  const lesson = await Lesson.findById(id);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  assertCourseOwner(await loadCourseOr404(lesson.course), user);
  return lesson;
}

exports.createModule = asyncHandler(async (req, res) => {
  assertCourseOwner(await loadCourseOr404(req.params.courseId), req.user);
  const order = req.body.order ?? (await Module.countDocuments({ course: req.params.courseId }));
  respond(res, await Module.create({ ...req.body, order, course: req.params.courseId }), { status: 201 });
});
exports.updateModule = asyncHandler(async (req, res) => {
  const mod = await loadModule(req.params.id, req.user);
  Object.assign(mod, req.body); await mod.save(); respond(res, mod);
});
exports.deleteModule = asyncHandler(async (req, res) => {
  const mod = await loadModule(req.params.id, req.user);
  if (await Enrollment.exists({ course: mod.course })) throw ApiError.conflict('Cannot delete modules of a course that has enrolled students');
  const lessons = await Lesson.find({ module: mod._id });
  for (const l of lessons) await removeLessonAssets(l);
  await Lesson.deleteMany({ module: mod._id }); await mod.deleteOne();
  await recalcCourseTotals(mod.course);
  respond(res, { deleted: true });
});

async function removeLessonAssets(lesson) {
  const assets = await VideoAsset.find({ lesson: lesson._id });
  const storage = getStorage();
  for (const a of assets) { await storage.removePrefix(`videos/${a._id}`).catch(() => {}); await storage.removePrefix(`uploads/${a._id}`).catch(() => {}); }
  await VideoAsset.deleteMany({ lesson: lesson._id });
}

exports.createLesson = asyncHandler(async (req, res) => {
  const mod = await loadModule(req.params.moduleId, req.user);
  const order = req.body.order ?? (await Lesson.countDocuments({ module: mod._id }));
  const lesson = await Lesson.create({ ...req.body, order, module: mod._id, course: mod.course });
  await recalcCourseTotals(mod.course);
  respond(res, lesson, { status: 201 });
});
exports.updateLesson = asyncHandler(async (req, res) => {
  const lesson = await loadLessonForOwner(req.params.id, req.user);
  Object.assign(lesson, req.body); await lesson.save(); respond(res, lesson);
});
exports.deleteLesson = asyncHandler(async (req, res) => {
  const lesson = await loadLessonForOwner(req.params.id, req.user);
  if (await Enrollment.exists({ course: lesson.course })) throw ApiError.conflict('Cannot delete lessons of a course that has enrolled students');
  await removeLessonAssets(lesson); await lesson.deleteOne(); await recalcCourseTotals(lesson.course);
  respond(res, { deleted: true });
});

// Lesson detail: enrolled students, the owner, admins, or anyone for free-preview lessons of live courses.
exports.getLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id).populate('videoAsset', 'status progress metadata.duration renditions').lean();
  if (!lesson) throw ApiError.notFound('Lesson not found');
  const course = await loadCourseOr404(lesson.course);
  const user = req.user;
  const privileged = user && (user.role === 'admin' || isOwner(course, user));
  const enrollment = user?.role === 'student' ? await Enrollment.findOne({ student: user._id, course: course._id }) : null;
  const preview = lesson.isPreview && course.isLive;
  if (!privileged && !enrollment && !preview) throw ApiError.forbidden('Enroll in this course to access this lesson');
  const progress = enrollment?.lessonProgress.find((p) => String(p.lesson) === String(lesson._id)) || null;
  respond(res, { ...lesson, progress });
});
