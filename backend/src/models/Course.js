const mongoose = require('mongoose');
const { LEVELS, APPROVAL } = require('../config/constants');

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 5, maxlength: 140 },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: [true, 'Description is required'], trim: true, minlength: 20, maxlength: 5000 },
    thumbnailUrl: String,
    category: { type: String, required: true, trim: true, index: true },
    level: { type: String, enum: LEVELS, default: 'beginner', index: true },
    price: { type: Number, default: 0, min: 0 }, // major currency units (INR)
    currency: { type: String, default: 'INR' },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    approvalStatus: { type: String, enum: Object.values(APPROVAL), default: APPROVAL.DRAFT, index: true },
    rejectionReason: String,
    isPublished: { type: Boolean, default: false, index: true },
    tags: [String],
    lessonsCount: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 }, // seconds
    enrollmentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

courseSchema.index({ title: 'text', description: 'text', tags: 'text' });
courseSchema.index({ isPublished: 1, approvalStatus: 1, createdAt: -1 });

courseSchema.pre('validate', function (next) {
  if (!this.slug || this.isModified('title')) {
    const base = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
    this.slug = `${base}-${this._id.toString().slice(-6)}`;
  }
  next();
});

courseSchema.virtual('isLive').get(function () { return this.isPublished && this.approvalStatus === APPROVAL.APPROVED; });

module.exports = mongoose.model('Course', courseSchema);
