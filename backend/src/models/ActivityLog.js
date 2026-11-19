const mongoose = require('mongoose');

// Audit / learning-history trail: who did what, when.
const activityLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    actorName: String,
    action: { type: String, required: true, index: true },
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    summary: String,
    meta: mongoose.Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
activityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
