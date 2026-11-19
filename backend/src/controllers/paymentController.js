const Payment = require('../models/Payment');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const logger = require('../config/logger');
const svc = require('../services/paymentService');
const { PAYMENT_STATUS } = require('../config/constants');

exports.config = (req, res) => respond(res, {
  mode: svc.gatewayMode(), keyId: svc.gatewayMode() === 'razorpay' ? env.razorpay.keyId : null, currency: 'INR',
  note: svc.gatewayMode() === 'simulated' ? 'Razorpay keys are not configured: using the built-in simulated TEST gateway. No real payment is made.' : 'Razorpay TEST mode',
});

exports.checkout = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.body.courseId);
  if (!course || !course.isLive) throw ApiError.notFound('Course not found or not available');
  if (course.price <= 0) throw ApiError.badRequest('This course is free. Use enrollment instead.');
  if (await Enrollment.exists({ student: req.user._id, course: course._id })) throw ApiError.conflict('You are already enrolled in this course');

  const payment = new Payment({
    student: req.user._id, course: course._id, instructor: course.instructor,
    amount: Math.round(course.price * 100), currency: course.currency, gateway: svc.gatewayMode(),
  });
  payment.orderId = await svc.createOrder(payment, course);
  await payment.save();
  respond(res, {
    payment, gateway: { mode: payment.gateway, keyId: payment.gateway === 'razorpay' ? env.razorpay.keyId : null, orderId: payment.orderId, amount: payment.amount, currency: payment.currency, courseTitle: course.title },
  }, { status: 201 });
});

async function ownPayment(id, user) {
  const payment = await Payment.findById(id);
  if (!payment || String(payment.student) !== String(user._id)) throw ApiError.notFound('Payment not found');
  return payment;
}

// Razorpay Checkout success handler -> verify signature server-side.
exports.verify = asyncHandler(async (req, res) => {
  const payment = await ownPayment(req.body.paymentId, req.user);
  if (payment.gateway !== 'razorpay') throw ApiError.badRequest('This payment was not created with Razorpay');
  if (payment.status !== PAYMENT_STATUS.PENDING) return respond(res, { payment });
  const ok = payment.orderId === req.body.razorpay_order_id && svc.verifyCheckoutSignature({ orderId: req.body.razorpay_order_id, paymentId: req.body.razorpay_payment_id, signature: req.body.razorpay_signature });
  if (!ok) { await svc.markPaymentFailed(payment._id, 'Signature verification failed'); throw ApiError.badRequest('Payment signature verification failed'); }
  const result = await svc.markPaymentSuccess(payment._id, req.body.razorpay_payment_id);
  respond(res, { payment: result.payment });
});

exports.fail = asyncHandler(async (req, res) => {
  const payment = await ownPayment(req.params.id, req.user);
  respond(res, { payment: await svc.markPaymentFailed(payment._id, req.body.reason || 'Payment cancelled by user') });
});

// Only available when no Razorpay keys are configured (local demo / tests).
exports.simulate = asyncHandler(async (req, res) => {
  if (svc.gatewayMode() !== 'simulated' || !env.allowSimulatedPayments) throw ApiError.forbidden('Simulated payments are disabled');
  const payment = await ownPayment(req.params.id, req.user);
  if (payment.gateway !== 'simulated') throw ApiError.badRequest('Not a simulated payment');
  if (payment.status !== PAYMENT_STATUS.PENDING) throw ApiError.conflict(`Payment is already ${payment.status}`);
  const result = req.body.outcome === 'success'
    ? await svc.markPaymentSuccess(payment._id, `sim_pay_${Date.now().toString(36)}`)
    : { payment: await svc.markPaymentFailed(payment._id, 'Simulated failure') };
  respond(res, { payment: result.payment });
});

// Razorpay webhook (raw body, signature verified).
exports.webhook = asyncHandler(async (req, res) => {
  const raw = req.body instanceof Buffer ? req.body.toString('utf8') : '';
  if (!svc.verifyWebhookSignature(raw, req.headers['x-razorpay-signature'])) throw ApiError.badRequest('Invalid webhook signature');
  const event = JSON.parse(raw);
  const entity = event.payload?.payment?.entity;
  if (entity?.order_id) {
    const payment = await Payment.findOne({ orderId: entity.order_id });
    if (payment) {
      if (event.event === 'payment.captured' || event.event === 'order.paid') await svc.markPaymentSuccess(payment._id, entity.id);
      else if (event.event === 'payment.failed') await svc.markPaymentFailed(payment._id, entity.error_description || 'Payment failed');
    } else logger.warn('Webhook for unknown order', { orderId: entity.order_id });
  }
  res.json({ received: true });
});

exports.mine = asyncHandler(async (req, res) => {
  respond(res, await Payment.find({ student: req.user._id }).populate('course', 'title').sort({ createdAt: -1 }).limit(100).lean());
});
