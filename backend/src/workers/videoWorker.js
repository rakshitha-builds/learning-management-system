const { Worker } = require('bullmq');
const env = require('../config/env');
const logger = require('../config/logger');
const { createRedisConnection } = require('../config/redis');
const { VIDEO_QUEUE, VIDEO_STATUS } = require('../config/constants');
const VideoAsset = require('../models/VideoAsset');
const { processVideoAsset } = require('../services/videoProcessing');
const { notify } = require('../services/notificationService');

/**
 * BullMQ worker: runs FFmpeg jobs. BullMQ handles retries (attempts + exponential backoff).
 * After the final failed attempt the asset is marked "failed" so the instructor can retry manually.
 */
function startVideoWorker() {
  const worker = new Worker(
    VIDEO_QUEUE,
    async (job) => processVideoAsset(job.data.assetId, { onProgress: (p) => job.updateProgress(p) }),
    { connection: createRedisConnection(), concurrency: env.videoWorkerConcurrency }
  );

  worker.on('completed', (job) => logger.info('Video job completed', { jobId: job.id }));
  worker.on('failed', async (job, err) => {
    if (!job) return;
    const finalAttempt = job.attemptsMade >= (job.opts.attempts || 1);
    logger.error('Video job failed', { jobId: job.id, attempt: job.attemptsMade, finalAttempt, error: err.message });
    const asset = await VideoAsset.findById(job.data.assetId);
    if (!asset) return;
    asset.error = err.message;
    asset.status = finalAttempt ? VIDEO_STATUS.FAILED : VIDEO_STATUS.QUEUED; // queued = waiting for BullMQ retry
    await asset.save();
    if (finalAttempt) {
      await notify(asset.uploadedBy, {
        type: 'video_failed', title: 'Video processing failed',
        message: `${asset.originalName || 'Your video'} could not be processed. You can retry from the course editor.`,
        link: `/instructor/courses/${asset.course}`,
      });
    }
  });
  worker.on('error', (err) => logger.error('Worker error', { error: err.message }));
  return worker;
}

if (require.main === module) {
  const { connectDb } = require('../config/db');
  connectDb().then(() => {
    startVideoWorker();
    logger.info('Video worker started', { concurrency: env.videoWorkerConcurrency });
  }).catch((err) => { logger.error(err.message); process.exit(1); });
}

module.exports = { startVideoWorker };
