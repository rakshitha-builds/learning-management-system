const ActivityLog = require('../models/ActivityLog');
const logger = require('../config/logger');

async function logActivity({ actor, actorName, action, entityType, entityId, summary, meta }) {
  try {
    await ActivityLog.create({ actor: actor?._id || actor, actorName: actorName || actor?.name, action, entityType, entityId, summary, meta });
  } catch (err) {
    logger.warn('Failed to write activity log', { error: err.message });
  }
}
module.exports = { logActivity };
