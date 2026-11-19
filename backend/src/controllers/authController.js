const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { signAuthToken } = require('../utils/token');
const { logActivity } = require('../services/activityService');
const { notify } = require('../services/notificationService');

exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists');
  const user = await User.create({ name, email, role, passwordHash: await User.hashPassword(password) });
  await logActivity({ actor: user, action: 'registered', entityType: 'User', entityId: user._id, summary: `${name} registered as ${role}` });
  await notify(user, { type: 'welcome', title: 'Welcome to LearnSphere', message: role === 'instructor' ? 'Create your first course to get started.' : 'Browse courses and start learning.', link: role === 'instructor' ? '/instructor/courses' : '/courses' });
  respond(res, { user, token: signAuthToken(user) }, { status: 201 });
});

exports.login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  if (!user || !(await user.comparePassword(req.body.password))) throw ApiError.unauthorized('Invalid email or password');
  if (user.status !== 'active') throw ApiError.forbidden('This account has been suspended. Contact support.');
  user.lastLoginAt = new Date();
  await user.save();
  respond(res, { user, token: signAuthToken(user) });
});

exports.me = asyncHandler(async (req, res) => respond(res, { user: req.user }));

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, headline, bio, currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (newPassword) {
    if (!currentPassword || !(await user.comparePassword(currentPassword))) throw ApiError.badRequest('Current password is incorrect');
    user.passwordHash = await User.hashPassword(newPassword);
  }
  if (name !== undefined) user.name = name;
  if (headline !== undefined) user.headline = headline;
  if (bio !== undefined) user.bio = bio;
  await user.save();
  respond(res, { user });
});
