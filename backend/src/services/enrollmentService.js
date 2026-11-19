const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const User = require('../models/User');
const { notify } = require('./notificationService');
const { logActivity } = require('./activityService');

async function isEnrolled(studentId, courseId) {
  return !!(await Enrollment.exists({ student: studentId, course: courseId }));
}

async function enrollStudent({ studentId, courseId, paymentId }) {
  let enrollment;
  try {
    enrollment = await Enrollment.create({ student: studentId, course: courseId, payment: paymentId, lastAccessedAt: new Date() });
  } catch (err) {
    if (err.code === 11000) return { enrollment: await Enrollment.findOne({ student: studentId, course: courseId }), created: false };
    throw err;
  }
  const course = await Course.findByIdAndUpdate(courseId, { $inc: { enrollmentCount: 1 } }, { new: true });
  const student = await User.findById(studentId);
  await notify(studentId, { type: 'enrolled', title: 'Enrollment confirmed', message: `You are now enrolled in ${course.title}.`, link: `/student/learn/${course._id}` });
  await notify(course.instructor, { type: 'new_student', title: 'New student enrolled', message: `${student?.name || 'A student'} enrolled in ${course.title}.`, link: `/instructor/courses/${course._id}` });
  await logActivity({ actor: student, action: 'enrolled', entityType: 'Course', entityId: course._id, summary: `Enrolled in ${course.title}` });
  return { enrollment, created: true };
}

module.exports = { enrollStudent, isEnrolled };
