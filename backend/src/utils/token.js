const jwt = require('jsonwebtoken');
const env = require('../config/env');

const signAuthToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
const verifyAuthToken = (token) => jwt.verify(token, env.jwtSecret);

// Short-lived token that only grants access to the media files of ONE video asset.
const signMediaToken = (assetId, userId) =>
  jwt.sign({ typ: 'media', aid: String(assetId), sub: String(userId) }, env.jwtSecret, { expiresIn: env.mediaTokenTtlSec });
const verifyMediaToken = (token) => {
  const p = jwt.verify(token, env.jwtSecret);
  if (p.typ !== 'media') throw new Error('Invalid media token');
  return p;
};

module.exports = { signAuthToken, verifyAuthToken, signMediaToken, verifyMediaToken };
