const fs = require('fs/promises');
const path = require('path');
const Course = require('../models/Course');
const Module = require('../models/Module');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const User = require('../models/User');
const Enrollment = require('../models/Enrollment');
const VideoAsset = require('../models/VideoAsset');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex, pageMeta } = require('../utils/pagination');
const { isOwner, loadCourseOr404, assertCourseManager, assertCourseOwner } = require('../utils/access');
const { getStorage } = require('../services/storage');
const { notifyMany, notify } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');
const { APPROVAL, CATEGORIES } = require('../config/constants');

const publicCard = 'title slug description thumbnailUrl category level price currency instructor lessonsCount totalDuration enrollmentCount createdAt';

exports.categories = (req, res) => respond(res, CATEGORIES);

exports.listPublic = asyncHandler(async (req, res) => {
  const { q, category, level, price, sort, page, limit } = req.query;
  const filter = { isPublished: true, approvalStatus: APPROVAL.APPROVED };
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ title: rx }, { description: rx }, { tags: rx }]; }
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (price === 'free') filter.price = 0;
  if (price === 'paid') filter.price = { $gt: 0 };
  const sorts = { newest: { createdAt: -1 }, popular: { enrollmentCount: -1, createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 } };
  const [items, total] = await Promise.all([
    Course.find(filter).select(publicCard).populate('instructor', 'name headline').sort(sorts[sort]).skip((page - 1) * limit).limit(limit).lean(),
    Course.countDocuments(filter),
  ]);
  respond(res, items, { meta: pageMeta(total, page, limit) });
});

exports.getCourse = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const course = await Course.findOne(/^[a-f\d]{24}$/i.test(id) ? { _id: id } : { slug: id }).populate('instructor', 'name headline bio');
  if (!course) throw ApiError.notFound('Course not found');
  const user = req.user;
  const owner = !!user && isOwner(course, user);
  const admin = user?.role === 'admin';
  if (!course.isLive && !owner && !admin) throw ApiError.notFound('Course not found');

  const enrolled = !!user && user.role === 'student' && !!(await Enrollment.exists({ student: user._id, course: course._id }));
  const [modules, lessons] = await Promise.all([
    Module.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).lean(),
    Lesson.find({ course: course._id }).sort({ order: 1, createdAt: 1 }).populate('videoAsset', 'status progress error metadata.duration').lean(),
  ]);
  const curriculum = modules.map((m) => ({
    ...m,
    lessons: lessons.filter((l) => String(l.module) === String(m._id)).map((l) => ({
      _id: l._id, title: l.title, description: l.description, order: l.order, duration: l.duration, isPreview: l.isPreview,
      hasVideo: !!l.videoAsset, ...(owner || admin ? { video: l.videoAsset || null } : { videoStatus: l.videoAsset?.status }),
    })),
  }));
  const quizzes = enrolled || owner || admin
    ? await Quiz.find({ course: course._id, isPublished: true }).select('title description durationMinutes passingMarks totalMarks questionCount').lean()
    : [];
  respond(res, { ...course.toObject({ virtuals: true }), curriculum, quizzes, isEnrolled: enrolled, isOwner: owner });
});

exports.listMine = asyncHandler(async (req, res) => {
  const courses = await Course.find({ instructor: req.user._id }).sort({ updatedAt: -1 }).lean();
  respond(res, courses);
});

exports.create = asyncHandler(async (req, res) => {
  const course = await Course.create({ ...req.body, instructor: req.user._id });
  await logActivity({ actor: req.user, action: 'course_created', entityType: 'Course', entityId: course._id, summary: `Created course ${course.title}` });
  respond(res, course, { status: 201 });
});

exports.update = asyncHandler(async (req, res) => {
  const course = await loadCourseOr404(req.params.id);
  assertCourseOwner(course, req.user);
  Object.assign(course, req.body);
  await course.save();
  respond(res, course);
});

exports.remove = asyncHandler(async (req, res) => {
  const course = await loadCourseOr404(req.params.id);
  assertCourseManager(course, req.user);
  if (await Enrollment.exists({ course: course._id })) throw ApiError.conflict('Students are enrolled in this course. Unpublish it instead of deleting.');
  const assets = await VideoAsset.find({ course: course._id });
  const storage = getStorage();
  for (const a of assets) { await storage.removePrefix(`videos/${a._id}`).catch(() => {}); await storage.removePrefix(`uploads/${a._id}`).catch(() => {}); }
  const quizzes = await Quiz.find({ course: course._id }).select('_id');
  await Promise.all([
    Question.deleteMany({ quiz: { $in: quizzes.map((q) => q._id) } }), Quiz.deleteMany({ course: course._id }),
    VideoAsset.deleteMany({ course: course._id }), Lesson.deleteMany({ course: course._id }), Module.deleteMany({ course: course._id }),
  ]);
  await course.deleteOne();
  await logActivity({ actor: req.user, action: 'course_deleted', entityType: 'Course', entityId: course._id, summary: `Deleted course ${course.title}` });
  respond(res, { deleted: true });
});

exports.submitForReview = asyncHandler(async (req, res) => {
  const course = await loadCourseOr404(req.params.id);
  assertCourseOwner(course, req.user);
  if (course.approvalStatus === APPROVAL.PENDING) throw ApiError.conflict('Course is already awaiting review');
  if (course.approvalStatus === APPROVAL.APPROVED) throw ApiError.conflict('Course is already approved');
  if (!(await Lesson.exists({ course: course._id }))) throw ApiError.badRequest('Add at least one lesson before submitting for review');
  course.approvalStatus = APPROVAL.PENDING; course.rejectionReason = undefined;
  await course.save();
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
  await notifyMany(admins.map((a) => a._id), { type: 'course_review', title: 'Course awaiting review', message: `${req.user.name} submitted “${course.title}”.`, link: '/admin/courses' });
  await logActivity({ actor: req.user, action: 'course_submitted', entityType: 'Course', entityId: course._id, summary: `Submitted ${course.title} for review` });
  respond(res, course);
});

exports.setPublish = asyncHandler(async (req, res) => {
  const course = await loadCourseOr404(req.params.id);
  assertCourseOwner(course, req.user);
  if (req.body.publish && course.approvalStatus !== APPROVAL.APPROVED) throw ApiError.conflict('Only admin-approved courses can be published');
  course.isPublished = req.body.publish;
  await course.save();
  await logActivity({ actor: req.user, action: req.body.publish ? 'course_published' : 'course_unpublished', entityType: 'Course', entityId: course._id, summary: `${req.body.publish ? 'Published' : 'Unpublished'} ${course.title}` });
  respond(res, course);
});

exports.uploadThumbnail = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('Image file is required (field name: image)');
  try {
    const course = await loadCourseOr404(req.params.id);
    assertCourseOwner(course, req.user);
    const key = `public/thumbnails/${course._id}-${Date.now()}${path.extname(req.file.filename)}`;
    const storage = getStorage();
    await storage.putFile(req.file.path, key);
    course.thumbnailUrl = storage.publicUrl(key);
    await course.save();
    respond(res, course);
  } finally { await fs.rm(req.file.path, { force: true }); }
});

exports.students = asyncHandler(async (req, res) => {
  const course = await loadCourseOr404(req.params.id);
  assertCourseManager(course, req.user);
  const total = await Lesson.countDocuments({ course: course._id });
  const enrollments = await Enrollment.find({ course: course._id }).populate('student', 'name email').sort({ createdAt: -1 }).lean();
  respond(res, enrollments.map((e) => {
    const done = e.lessonProgress.filter((p) => p.completed).length;
    return { enrollmentId: e._id, student: e.student, enrolledAt: e.createdAt, status: e.status, lastAccessedAt: e.lastAccessedAt, completedLessons: done, totalLessons: total, percent: total ? Math.round((done / total) * 100) : 0 };
  }));
});
