const mongoose = require('mongoose');
const { VIDEO_STATUS } = require('../config/constants');

const videoAssetSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: String,
    mimeType: String,
    size: Number,
    originalKey: String, // storage key of the uploaded source file
    status: { type: String, enum: Object.values(VIDEO_STATUS), default: VIDEO_STATUS.UPLOADED, index: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    error: String,
    attempts: { type: Number, default: 0 },
    jobId: String,
    hlsKey: String, // master playlist storage key
    thumbnailKey: String,
    renditions: [{ _id: false, name: String, width: Number, height: Number, videoBitrate: Number }],
    metadata: {
      duration: Number, width: Number, height: Number, videoCodec: String, audioCodec: String,
      bitrate: Number, fps: Number, format: String,
    },
    storageDriver: { type: String, default: 'local' },
    processedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('VideoAsset', videoAssetSchema);
