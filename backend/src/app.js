const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const env = require('./config/env');
const logger = require('./config/logger');
const routes = require('./routes');
const media = require('./controllers/mediaController');
const payment = require('./controllers/paymentController');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientUrl.split(',').map((s) => s.trim()), credentials: true }));
  app.use(compression());
  if (env.nodeEnv !== 'test') app.use(morgan('tiny', { stream: { write: (m) => logger.info(m.trim()) } }));

  // Raw body is required to verify the payment webhook signature.
  app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), payment.webhook);

  app.use(express.json({ limit: '1mb' }));
  app.get('/media/:token/*', media.streamVideo);   // token-authorised HLS streaming
  app.get('/files/*', media.publicFile);           // public thumbnails (local storage)
  app.use('/api', apiLimiter, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
