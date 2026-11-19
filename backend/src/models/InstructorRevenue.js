const mongoose = require('mongoose');

const instructorRevenueSchema = new mongoose.Schema(
  {
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    grossAmount: { type: Number, required: true }, // paise
    platformFee: { type: Number, required: true },
    netAmount: { type: Number, required: true },
    month: { type: String, required: true, index: true }, // YYYY-MM
  },
  { timestamps: true }
);
instructorRevenueSchema.index({ instructor: 1, month: 1 });

module.exports = mongoose.model('InstructorRevenue', instructorRevenueSchema);
