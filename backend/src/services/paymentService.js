const crypto = require('crypto');
const Razorpay = require('razorpay');
const env = require('../config/env');
const Payment = require('../models/Payment');
const Course = require('../models/Course');
const InstructorRevenue = require('../models/InstructorRevenue');
const ApiError = require('../utils/ApiError');
const { enrollStudent } = require('./enrollmentService');
const { notify } = require('./notificationService');
const { logActivity } = require('./activityService');
const { PAYMENT_STATUS } = require('../config/constants');

/**
 * Gateway modes:
 *  - "razorpay":  real Razorpay TEST-mode orders (needs RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET with rzp_test_ keys)
 *  - "simulated": no keys configured. A clearly-labelled local test gateway; NO card data is ever collected.
 */
const gatewayMode = () => (env.features.razorpay ? 'razorpay' : 'simulated');

let rzp;
const razorpayClient = () => {
  if (!rzp) rzp = new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
  return rzp;
};

async function createOrder(payment, course) {
  if (gatewayMode() === 'razorpay') {
    const order = await razorpayClient().orders.create({
      amount: payment.amount, currency: payment.currency, receipt: String(payment._id).slice(-20),
      notes: { paymentId: String(payment._id), courseId: String(course._id) },
    });
    return order.id;
  }
  if (!env.allowSimulatedPayments) {
    throw ApiError.unavailable('Payment gateway is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  return `sim_order_${crypto.randomBytes(8).toString('hex')}`;
}

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Razorpay checkout signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret) */
const verifyCheckoutSignature = ({ orderId, paymentId, signature }) =>
  !!env.razorpay.keySecret && safeEqual(hmac(env.razorpay.keySecret, `${orderId}|${paymentId}`), signature);

/** Webhook signature: HMAC_SHA256(raw_body, webhook_secret) */
const verifyWebhookSignature = (rawBody, signature) =>
  !!env.razorpay.webhookSecret && !!signature && safeEqual(hmac(env.razorpay.webhookSecret, rawBody), signature);

/** Idempotent: only the first pending -> success transition creates enrollment + revenue. */
async function markPaymentSuccess(paymentId, gatewayPaymentId) {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: PAYMENT_STATUS.PENDING },
    { status: PAYMENT_STATUS.SUCCESS, gatewayPaymentId, paidAt: new Date(), failureReason: undefined },
    { new: true }
  );
  if (!payment) return { payment: await Payment.findById(paymentId), changed: false };

  const gross = payment.amount;
  const platformFee = Math.round((gross * env.platformFeePercent) / 100);
  const now = payment.paidAt;
  await InstructorRevenue.create({
    instructor: payment.instructor, course: payment.course, payment: payment._id,
    grossAmount: gross, platformFee, netAmount: gross - platformFee,
    month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
  }).catch((e) => { if (e.code !== 11000) throw e; });

  const { enrollment } = await enrollStudent({ studentId: payment.student, courseId: payment.course, paymentId: payment._id });
  const course = await Course.findById(payment.course).select('title');
  await notify(payment.instructor, { type: 'payment', title: 'Payment received', message: `₹${(gross / 100).toFixed(2)} received for ${course.title}.`, link: '/instructor/revenue' });
  await logActivity({ actor: payment.student, action: 'payment_success', entityType: 'Payment', entityId: payment._id, summary: `Paid ₹${(gross / 100).toFixed(2)} for ${course.title}` });
  return { payment, enrollment, changed: true };
}

async function markPaymentFailed(paymentId, reason = 'Payment failed') {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: PAYMENT_STATUS.PENDING },
    { status: PAYMENT_STATUS.FAILED, failureReason: reason },
    { new: true }
  );
  if (payment) await logActivity({ actor: payment.student, action: 'payment_failed', entityType: 'Payment', entityId: payment._id, summary: reason });
  return payment || (await Payment.findById(paymentId));
}

module.exports = { gatewayMode, createOrder, verifyCheckoutSignature, verifyWebhookSignature, markPaymentSuccess, markPaymentFailed, hmac };
