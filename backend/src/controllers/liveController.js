const LiveClass = require('../models/LiveClass');
const ChatMessage = require('../models/ChatMessage');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const { loadCourseOr404, assertCourseOwner, isOwner } = require('../utils/access');
const { createRoom, deleteRoom, createJoinToken } = require('../services/livekitService');
const { notifyMany } = require('../services/notificationService');
const { logActivity } = require('../services/activityService');
const { LIVE_STATUS } = require('../config/constants');

async function loadClass(id) {
  const lc = await LiveClass.findById(id).populate('course', 'title instructor').populate('instructor', 'name');
  if (!lc) throw ApiError.notFound('Live class not found');
  return lc;
}
const hostOf = (lc, user) => user.role === 'instructor' && String(lc.instructor._id || lc.instructor) === String(user._id);

async function assertAccess(lc, user) {
  if (user.role === 'admin' || hostOf(lc, user)) return;
  if (user.role === 'student' && (await Enrollment.exists({ student: user._id, course: lc.course._id || lc.course }))) return;
  throw ApiError.forbidden('You do not have access to this live class');
}
exports.assertAccess = assertAccess;
exports.loadClass = loadClass;

exports.create = asyncHandler(async (req, res) => {
  const course = await loadCourseOr404(req.body.courseId);
  assertCourseOwner(course, req.user);
  const lc = await LiveClass.create({ ...req.body, course: course._id, instructor: req.user._id });
  const students = await Enrollment.find({ course: course._id }).select('student');
  await notifyMany(students.map((s) => s.student), {
    type: 'live_class', title: 'New live class scheduled', message: `${lc.title} — ${lc.scheduledAt.toUTCString()}`, link: '/student/live',
  });
  await logActivity({ actor: req.user, action: 'live_scheduled', entityType: 'LiveClass', entityId: lc._id, summary: `Scheduled “${lc.title}”` });
  respond(res, lc, { status: 201 });
});

exports.list = asyncHandler(async (req, res) => {
  const { scope = 'upcoming' } = req.query;
  const filter = {};
  if (req.user.role === 'instructor') filter.instructor = req.user._id;
  else if (req.user.role === 'student') {
    const ids = (await Enrollment.find({ student: req.user._id }).select('course')).map((e) => e.course);
    filter.course = { $in: ids };
  }
  if (scope === 'upcoming') { filter.status = { $in: [LIVE_STATUS.SCHEDULED, LIVE_STATUS.LIVE] }; }
  else if (scope === 'past') filter.status = { $in: [LIVE_STATUS.ENDED, LIVE_STATUS.CANCELLED] };
  const items = await LiveClass.find(filter).populate('course', 'title').populate('instructor', 'name').sort(scope === 'past' ? { scheduledAt: -1 } : { scheduledAt: 1 }).limit(100).lean();
  respond(res, items);
});

exports.get = asyncHandler(async (req, res) => {
  const lc = await loadClass(req.params.id);
  await assertAccess(lc, req.user);
  respond(res, { ...lc.toObject(), isHost: hostOf(lc, req.user) });
});

exports.start = asyncHandler(async (req, res) => {
  const lc = await loadClass(req.params.id);
  if (!hostOf(lc, req.user)) throw ApiError.forbidden('Only the class instructor can start it');
  if (lc.status === LIVE_STATUS.LIVE) return respond(res, lc);
  if (lc.status !== LIVE_STATUS.SCHEDULED) throw ApiError.conflict(`A ${lc.status} class cannot be started`);
  const roomName = `lms-${lc._id}`;
  await createRoom(roomName); // throws 503 with a clear message if LiveKit is not configured / unreachable
  lc.roomName = roomName; lc.status = LIVE_STATUS.LIVE; lc.startedAt = new Date();
  await lc.save();
  const students = await Enrollment.find({ course: lc.course._id }).select('student');
  await notifyMany(students.map((s) => s.student), { type: 'live_started', title: 'Class is live', message: `${lc.title} has started. Join now.`, link: `/student/live/${lc._id}` });
  req.app.get('io')?.to(`live:${lc._id}`).emit('live:started', { liveClassId: String(lc._id) });
  respond(res, lc);
});

exports.end = asyncHandler(async (req, res) => {
  const lc = await loadClass(req.params.id);
  if (!hostOf(lc, req.user)) throw ApiError.forbidden('Only the class instructor can end it');
  if (lc.status !== LIVE_STATUS.LIVE) throw ApiError.conflict('Class is not live');
  lc.status = LIVE_STATUS.ENDED; lc.endedAt = new Date(); await lc.save();
  await deleteRoom(lc.roomName);
  req.app.get('io')?.to(`live:${lc._id}`).emit('live:ended', { liveClassId: String(lc._id) });
  respond(res, lc);
});

exports.cancel = asyncHandler(async (req, res) => {
  const lc = await loadClass(req.params.id);
  if (!hostOf(lc, req.user) && req.user.role !== 'admin') throw ApiError.forbidden();
  if (lc.status !== LIVE_STATUS.SCHEDULED) throw ApiError.conflict('Only scheduled classes can be cancelled');
  lc.status = LIVE_STATUS.CANCELLED; await lc.save();
  respond(res, lc);
});

exports.token = asyncHandler(async (req, res) => {
  const lc = await loadClass(req.params.id);
  await assertAccess(lc, req.user);
  if (lc.status !== LIVE_STATUS.LIVE) throw ApiError.conflict(lc.status === LIVE_STATUS.SCHEDULED ? 'The instructor has not started this class yet' : `This class is ${lc.status}`);
  const isHost = hostOf(lc, req.user);
  const token = await createJoinToken({ roomName: lc.roomName, user: req.user, isHost });
  if (!lc.attendees.some((a) => String(a.user) === String(req.user._id))) { lc.attendees.push({ user: req.user._id, joinedAt: new Date() }); await lc.save(); }
  respond(res, { token, url: env.livekit.url, roomName: lc.roomName, isHost, identity: String(req.user._id) });
});

exports.messages = asyncHandler(async (req, res) => {
  const lc = await loadClass(req.params.id);
  await assertAccess(lc, req.user);
  respond(res, await ChatMessage.find({ liveClass: lc._id }).sort({ createdAt: 1 }).limit(300).lean());
});
