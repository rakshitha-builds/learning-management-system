const IORedis = require('ioredis');
const env = require('./env');

// BullMQ requires maxRetriesPerRequest: null on its connections.
function createRedisConnection() {
  return new IORedis(env.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false });
}

module.exports = { createRedisConnection };
