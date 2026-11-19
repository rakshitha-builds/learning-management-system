const http = require('http');
const env = require('./config/env');
const logger = require('./config/logger');
const { connectDb } = require('./config/db');
const { createApp } = require('./app');
const { attachSocket } = require('./socket');

async function main() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  attachSocket(server, app);
  server.listen(env.port, () => {
    logger.info(`LearnSphere API listening on :${env.port}`, { env: env.nodeEnv });
    logger.info('Integrations', { storage: env.storage.driver, cloudfront: env.features.cloudfront, livekit: env.features.livekit, payments: env.features.razorpay ? 'razorpay-test' : 'simulated' });
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}

main().catch((err) => { logger.error(err.stack || err.message); process.exit(1); });
