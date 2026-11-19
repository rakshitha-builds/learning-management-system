const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

// Only gateway identifiers are stored. Card data never touches this server.
const paymentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true, min: 0 }, // minor units (paise)
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: Object.values(PAYMENT_STATUS), default: PAYMENT_STATUS.PENDING, index: true },
    gateway: { type: String, enum: ['razorpay', 'simulated'], required: true },
    orderId: { type: String, index: true },
    gatewayPaymentId: String,
    failureReason: String,
    paidAt: Date,
  },
  { timestamps: true }
);
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
