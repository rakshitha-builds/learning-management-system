const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { enrollStudent } = require('../services/enrollmentService');
const { computeCourseProgress } = require('../services/progressService');

exports.enroll = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.body.courseId);
  if (!course || !course.isLive) throw ApiError.notFound('Course not found or not available');
  if (course.price > 0) throw ApiError.paymentRequired('This is a paid course. Complete checkout to enroll.');
  const { enrollment, created } = await enrollStudent({ studentId: req.user._id, courseId: course._id });
  if (!created) throw ApiError.conflict('You are already enrolled in this course');
  respond(res, enrollment, { status: 201 });
});

exports.mine = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user._id })
    .populate({ path: 'course', select: 'title slug thumbnailUrl category level price instructor lessonsCount totalDuration', populate: { path: 'instructor', select: 'name' } })
    .sort({ lastAccessedAt: -1, createdAt: -1 });
  const data = await Promise.all(enrollments.filter((e) => e.course).map(async (e) => ({
    _id: e._id, course: e.course, status: e.status, enrolledAt: e.createdAt, lastAccessedAt: e.lastAccessedAt, completedAt: e.completedAt,
    progress: await computeCourseProgress(e),
  })));
  respond(res, data);
});

exports.check = asyncHandler(async (req, res) => {
  respond(res, { enrolled: !!(await Enrollment.exists({ student: req.user._id, course: req.params.courseId })) });
});
