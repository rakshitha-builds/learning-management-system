const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const VideoAsset = require('../models/VideoAsset');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const logger = require('../config/logger');
const { loadCourseOr404, assertCourseOwner, isOwner } = require('../utils/access');
const { getStorage } = require('../services/storage');
const { probe, recalcCourseTotals } = require('../services/videoProcessing');
const { enqueueVideo } = require('../services/videoQueue');
const { buildPlayback } = require('../services/videoAccess');
const { VIDEO_STATUS } = require('../config/constants');

const MAX_DURATION_SEC = 4 * 3600;

async function loadAssetForOwner(id, user) {
  const asset = await VideoAsset.findById(id);
  if (!asset) throw ApiError.notFound('Video not found');
  const course = await loadCourseOr404(asset.course);
  if (user.role !== 'admin') assertCourseOwner(course, user);
  return asset;
}

async function removeAssetFiles(asset) {
  const storage = getStorage();
  await storage.removePrefix(`videos/${asset._id}`).catch(() => {});
  await storage.removePrefix(`uploads/${asset._id}`).catch(() => {});
}

/** POST /api/videos/upload  (multipart: video file + lessonId) */
exports.upload = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw ApiError.badRequest('Video file is required (field name: video)');
  try {
    const { lessonId } = req.body;
    if (!lessonId || !mongoose.isValidObjectId(lessonId)) throw ApiError.badRequest('lessonId is required');
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) throw ApiError.notFound('Lesson not found');
    assertCourseOwner(await loadCourseOr404(lesson.course), req.user);

    // Server-side validation of the real file content (not just the extension/mimetype).
    let meta;
    try { meta = await probe(file.path); } catch { throw ApiError.badRequest('The uploaded file is not a valid, readable video'); }
    if (!(meta.duration > 0)) throw ApiError.badRequest('Video has no duration');
    if (meta.duration > MAX_DURATION_SEC) throw ApiError.badRequest('Video is longer than the 4 hour limit');

    const existing = await VideoAsset.findOne({ lesson: lesson._id });
    if (existing) {
      if ([VIDEO_STATUS.QUEUED, VIDEO_STATUS.PROCESSING].includes(existing.status)) throw ApiError.conflict('This lesson’s video is still being processed');
      await removeAssetFiles(existing); await existing.deleteOne();
    }

    const asset = new VideoAsset({
      lesson: lesson._id, course: lesson.course, uploadedBy: req.user._id,
      originalName: file.originalname, mimeType: file.mimetype, size: file.size, storageDriver: getStorage().driver,
    });
    asset.originalKey = `uploads/${asset._id}/original${path.extname(file.filename)}`;
    await getStorage().putFile(file.path, asset.originalKey);
    await asset.save();
    lesson.videoAsset = asset._id; await lesson.save();

    try { await enqueueVideo(asset); }
    catch (err) {
      logger.error('Could not enqueue video job', { error: err.message });
      asset.status = VIDEO_STATUS.FAILED; asset.error = 'Processing queue unavailable (is Redis running?)'; await asset.save();
      throw ApiError.unavailable('Video was uploaded but the processing queue is unavailable. Start Redis and use Retry.');
    }
    respond(res, asset, { status: 202, message: 'Upload accepted. Processing started.' });
  } finally {
    await fs.rm(file.path, { force: true });
  }
});

exports.getStatus = asyncHandler(async (req, res) => respond(res, await loadAssetForOwner(req.params.id, req.user)));

exports.retry = asyncHandler(async (req, res) => {
  const asset = await loadAssetForOwner(req.params.id, req.user);
  if (asset.status !== VIDEO_STATUS.FAILED) throw ApiError.conflict('Only failed videos can be retried');
  asset.attempts = 0;
  try { await enqueueVideo(asset); } catch { throw ApiError.unavailable('Processing queue unavailable (is Redis running?)'); }
  respond(res, asset, { status: 202, message: 'Retry queued' });
});

exports.remove = asyncHandler(async (req, res) => {
  const asset = await loadAssetForOwner(req.params.id, req.user);
  if (asset.status === VIDEO_STATUS.PROCESSING) throw ApiError.conflict('Wait for processing to finish');
  await removeAssetFiles(asset);
  await Lesson.updateOne({ _id: asset.lesson }, { $unset: { videoAsset: 1 }, duration: 0 });
  await asset.deleteOne(); await recalcCourseTotals(asset.course);
  respond(res, { deleted: true });
});

/** GET /api/lessons/:id/playback : returns a signed playback descriptor after an access check. */
exports.playback = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  const course = await loadCourseOr404(lesson.course);
  const user = req.user;
  const privileged = user.role === 'admin' || isOwner(course, user);
  const enrolled = !privileged && user.role === 'student' && !!(await Enrollment.exists({ student: user._id, course: course._id }));
  if (!privileged && !enrolled && !(lesson.isPreview && course.isLive)) throw ApiError.forbidden('Enroll in this course to watch this lesson');
  const asset = lesson.videoAsset ? await VideoAsset.findById(lesson.videoAsset) : null;
  if (!asset) throw ApiError.notFound('This lesson has no video yet');
  if (asset.status !== VIDEO_STATUS.READY) throw ApiError.conflict(`Video is ${asset.status}${asset.status === 'failed' ? ': ' + asset.error : ''}`);
  respond(res, { ...buildPlayback(asset, user), duration: asset.metadata?.duration, renditions: asset.renditions });
});
