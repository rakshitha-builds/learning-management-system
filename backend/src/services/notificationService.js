const Notification = require('../models/Notification');
const logger = require('../config/logger');

async function notify(user, { type, title, message, link }) {
  try { return await Notification.create({ user: user._id || user, type, title, message, link }); }
  catch (err) { logger.warn('Failed to create notification', { error: err.message }); }
}
async function notifyMany(userIds, payload) {
  if (!userIds.length) return;
  try { await Notification.insertMany(userIds.map((u) => ({ user: u, ...payload }))); }
  catch (err) { logger.warn('Failed to create notifications', { error: err.message }); }
}
module.exports = { notify, notifyMany };
