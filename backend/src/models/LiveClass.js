const mongoose = require('mongoose');
const { LIVE_STATUS } = require('../config/constants');

const liveClassSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 1000 },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, default: 60, min: 5, max: 480 },
    status: { type: String, enum: Object.values(LIVE_STATUS), default: LIVE_STATUS.SCHEDULED, index: true },
    roomName: { type: String, unique: true, sparse: true },
    startedAt: Date,
    endedAt: Date,
    attendees: [{ _id: false, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, joinedAt: Date }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('LiveClass', liveClassSchema);
