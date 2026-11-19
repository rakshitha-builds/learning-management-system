const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const make = (windowMs, max, message) =>
  rateLimit({
    windowMs, max: env.nodeEnv === 'test' ? 100000 : max,
    standardHeaders: true, legacyHeaders: false,
    message: { success: false, message },
  });

module.exports = {
  apiLimiter: make(15 * 60 * 1000, 1000, 'Too many requests, please try again later.'),
  authLimiter: make(15 * 60 * 1000, 30, 'Too many authentication attempts, please try again later.'),
};
