const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Payment = require('../models/Payment');
const InstructorRevenue = require('../models/InstructorRevenue');
const ActivityLog = require('../models/ActivityLog');
const LiveClass = require('../models/LiveClass');
const VideoAsset = require('../models/VideoAsset');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { escapeRegex, pageMeta } = require('../utils/pagination');
const { lastMonths } = require('../services/revenueService');
const { notify } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');
const { APPROVAL } = require('../config/constants');

const countBy = async (Model, field, match = {}) => {
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: `$${field}`, count: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
};

exports.stats = asyncHandler(async (req, res) => {
  const months = lastMonths(6);
  const from = new Date(Date.UTC(+months[0].slice(0, 4), +months[0].slice(5) - 1, 1));
  const monthKey = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
  const [users, courses, published, enrollments, totals, payments, signups, enrolMonthly, revMonthly, topCourses, recent, live, videos] = await Promise.all([
    countBy(User, 'role'), countBy(Course, 'approvalStatus'), Course.countDocuments({ isPublished: true }), Enrollment.countDocuments(),
    InstructorRevenue.aggregate([{ $group: { _id: null, gross: { $sum: '$grossAmount' }, fee: { $sum: '$platformFee' }, net: { $sum: '$netAmount' } } }]),
    countBy(Payment, 'status'),
    User.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: monthKey, count: { $sum: 1 } } }]),
    Enrollment.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: monthKey, count: { $sum: 1 } } }]),
    InstructorRevenue.aggregate([{ $match: { month: { $in: months } } }, { $group: { _id: '$month', gross: { $sum: '$grossAmount' }, fee: { $sum: '$platformFee' } } }]),
    Course.find({ isPublished: true }).sort({ enrollmentCount: -1 }).limit(5).select('title enrollmentCount').lean(),
    ActivityLog.find().sort({ createdAt: -1 }).limit(8).lean(),
    countBy(LiveClass, 'status'), countBy(VideoAsset, 'status'),
  ]);
  const m = (rows) => new Map(rows.map((r) => [r._id, r]));
  const sm = m(signups); const em = m(enrolMonthly); const rm = m(revMonthly);
  const t = totals[0] || { gross: 0, fee: 0, net: 0 };
  respond(res, {
    users: { total: Object.values(users).reduce((a, b) => a + b, 0), ...users },
    courses: { byStatus: courses, published }, enrollments, liveClasses: live, videos,
    revenue: { gross: t.gross, platformFees: t.fee, instructorPayouts: t.net }, payments,
    monthly: months.map((k) => ({ month: k, signups: sm.get(k)?.count || 0, enrollments: em.get(k)?.count || 0, revenue: rm.get(k)?.gross || 0, platformFees: rm.get(k)?.fee || 0 })),
    topCourses: topCourses.map((c) => ({ title: c.title, enrollments: c.enrollmentCount })), recentActivity: recent,
  });
});

exports.listUsers = asyncHandler(async (req, res) => {
  const { q, role, status, page, limit } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) { const rx = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: rx }, { email: rx }]; }
  const [items, total] = await Promise.all([User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(filter)]);
  const ids = items.map((u) => u._id);
  const [enr, crs] = await Promise.all([
    Enrollment.aggregate([{ $match: { student: { $in: ids } } }, { $group: { _id: '$student', n: { $sum: 1 } } }]),
    Course.aggregate([{ $match: { instructor: { $in: ids } } }, { $group: { _id: '$instructor', n: { $sum: 1 } } }]),
  ]);
  const eM = new Map(enr.map((x) => [String(x._id), x.n])); const cM = new Map(crs.map((x) => [String(x._id), x.n]));
  respond(res, items.map(({ passwordHash, ...u }) => ({ ...u, enrollments: eM.get(String(u._id)) || 0, courses: cM.get(String(u._id)) || 0 })), { meta: pageMeta(total, page, limit) });
});

exports.createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({ name, email, role, passwordHash: await User.hashPassword(password) });
  await logActivity({ actor: req.user, action: 'user_created', entityType: 'User', entityId: user._id, summary: `Created ${role} ${name}` });
  respond(res, user, { status: 201 });
});

exports.setUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  if (String(user._id) === String(req.user._id)) throw ApiError.badRequest('You cannot change your own status');
  if (user.role === 'admin') throw ApiError.forbidden('Admin accounts cannot be suspended here');
  user.status = req.body.status; await user.save();
  await logActivity({ actor: req.user, action: `user_${user.status}`, entityType: 'User', entityId: user._id, summary: `${user.status === 'suspended' ? 'Suspended' : 'Reactivated'} ${user.name}` });
  respond(res, user);
});

exports.listCourses = asyncHandler(async (req, res) => {
  const { q, status, page, limit } = req.query;
  const filter = {};
  if (status) filter.approvalStatus = status;
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');
  const [items, total] = await Promise.all([
    Course.find(filter).populate('instructor', 'name email').sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Course.countDocuments(filter),
  ]);
  respond(res, items, { meta: pageMeta(total, page, limit) });
});

exports.reviewCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound('Course not found');
  if (course.approvalStatus !== APPROVAL.PENDING) throw ApiError.conflict(`Only pending courses can be reviewed (current: ${course.approvalStatus})`);
  if (req.body.decision === 'approve') { course.approvalStatus = APPROVAL.APPROVED; course.isPublished = true; course.rejectionReason = undefined; }
  else { course.approvalStatus = APPROVAL.REJECTED; course.isPublished = false; course.rejectionReason = req.body.reason; }
  await course.save();
  await notify(course.instructor, {
    type: 'course_review_result', title: req.body.decision === 'approve' ? 'Course approved' : 'Course needs changes',
    message: req.body.decision === 'approve' ? `“${course.title}” is approved and published.` : `“${course.title}” was rejected: ${req.body.reason}`, link: `/instructor/courses/${course._id}`,
  });
  await logActivity({ actor: req.user, action: `course_${req.body.decision}d`, entityType: 'Course', entityId: course._id, summary: `${req.body.decision === 'approve' ? 'Approved' : 'Rejected'} ${course.title}` });
  respond(res, course);
});

exports.listEnrollments = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const [items, total] = await Promise.all([
    Enrollment.find().populate('student', 'name email').populate('course', 'title price').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select('-lessonProgress').lean(), Enrollment.countDocuments(),
  ]);
  respond(res, items, { meta: pageMeta(total, page, limit) });
});

exports.listTransactions = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const filter = ['success', 'pending', 'failed'].includes(status) ? { status } : {};
  const [items, total] = await Promise.all([
    Payment.find(filter).populate('student', 'name email').populate('course', 'title').populate('instructor', 'name').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), Payment.countDocuments(filter),
  ]);
  respond(res, items, { meta: pageMeta(total, page, limit) });
});

exports.listActivity = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const [items, total] = await Promise.all([ActivityLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), ActivityLog.countDocuments()]);
  respond(res, items, { meta: pageMeta(total, page, limit) });
});
