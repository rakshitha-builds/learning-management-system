const ApiError = require('./ApiError');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');

const isOwner = (course, user) => String(course.instructor?._id || course.instructor) === String(user._id);

async function loadCourseOr404(id) {
  const course = await Course.findById(id);
  if (!course) throw ApiError.notFound('Course not found');
  return course;
}
// Instructor who owns the course, or an admin.
function assertCourseManager(course, user) {
  if (user.role === 'admin' || (user.role === 'instructor' && isOwner(course, user))) return;
  throw ApiError.forbidden('You can only manage your own courses');
}
const assertCourseOwner = (course, user) => {
  if (!(user.role === 'instructor' && isOwner(course, user))) throw ApiError.forbidden('Only the course instructor can do this');
};
async function userCanAccessCourseContent(user, course) {
  if (!user) return false;
  if (user.role === 'admin' || isOwner(course, user)) return true;
  return !!(await Enrollment.exists({ student: user._id, course: course._id }));
}

module.exports = { isOwner, loadCourseOr404, assertCourseManager, assertCourseOwner, userCanAccessCourseContent };
