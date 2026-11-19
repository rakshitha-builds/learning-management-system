const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000 },
    order: { type: Number, default: 0 },
    isPreview: { type: Boolean, default: false }, // free preview for non-enrolled visitors
    duration: { type: Number, default: 0 }, // seconds, filled from video metadata
    videoAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoAsset' },
  },
  { timestamps: true }
);
lessonSchema.index({ module: 1, order: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);
