const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAuthToken } = require('../utils/token');

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  let payload;
  try { payload = verifyAuthToken(token); } catch { throw ApiError.unauthorized('Invalid or expired token'); }
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status !== 'active') throw ApiError.forbidden('This account has been suspended');
  return user;
}

const authenticate = asyncHandler(async (req, res, next) => {
  const user = await resolveUser(req);
  if (!user) throw ApiError.unauthorized();
  req.user = user;
  next();
});

// Attaches req.user when a valid token is present but never blocks the request.
const optionalAuth = asyncHandler(async (req, res, next) => {
  req.user = (await resolveUser(req)) || null;
  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
  next();
};

module.exports = { authenticate, optionalAuth, authorize };
