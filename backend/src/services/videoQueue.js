const { Queue } = require('bullmq');
const env = require('../config/env');
const { createRedisConnection } = require('../config/redis');
const { VIDEO_QUEUE, VIDEO_STATUS } = require('../config/constants');
const VideoAsset = require('../models/VideoAsset');

let queue;
function getQueue() {
  if (!queue) {
    queue = new Queue(VIDEO_QUEUE, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: env.videoJobAttempts,
        backoff: { type: 'exponential', delay: env.videoJobBackoffMs },
        removeOnComplete: { age: 24 * 3600, count: 200 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }
  return queue;
}

async function enqueueVideo(asset) {
  const job = await getQueue().add('process', { assetId: String(asset._id) });
  asset.status = VIDEO_STATUS.QUEUED; asset.jobId = job.id; asset.progress = 0; asset.error = undefined;
  await asset.save();
  return job;
}

async function closeQueue() { if (queue) { await queue.close(); queue = null; } }

module.exports = { getQueue, enqueueVideo, closeQueue };
