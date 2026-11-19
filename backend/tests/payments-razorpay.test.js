// Razorpay TEST-mode integration: signature verification + webhook. The Razorpay HTTP API itself is mocked
// (no real keys in CI) but the signature logic is the real production code path.
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummykey';
process.env.RAZORPAY_KEY_SECRET = 'dummy_secret_value';
process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec_dummy';

let mockOrderCounter = 0;
jest.mock('razorpay', () => jest.fn().mockImplementation(() => ({
  orders: { create: jest.fn(async ({ amount, currency }) => ({ id: `order_TEST${++mockOrderCounter}`, amount, currency })) },
})));

const crypto = require('crypto');
const request = require('supertest');
const { setup, teardown, makeUser, makePublishedCourse } = require('./helpers');
const Payment = require('../src/models/Payment');

const sign = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
let app; let admin; let instructor; let student; let course;

beforeAll(async () => {
  app = await setup();
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor'); student = await makeUser(app, 'student');
  course = await makePublishedCourse(app, instructor, admin, { price: 250 });
});
afterAll(teardown);

describe('Razorpay test mode', () => {
  test('config reports razorpay mode with the PUBLIC key id only', async () => {
    const res = await student.api.get('/api/payments/config');
    expect(res.body.data).toMatchObject({ mode: 'razorpay', keyId: 'rzp_test_dummykey' });
    expect(JSON.stringify(res.body)).not.toContain('dummy_secret_value');
  });
  test('simulate endpoint is disabled when real keys are configured', async () => {
    const co = await student.api.post('/api/payments/checkout', { courseId: course.courseId });
    expect(co.body.data.payment.gateway).toBe('razorpay');
    expect(co.body.data.gateway.orderId).toMatch(/^order_TEST/);
    expect((await student.api.post(`/api/payments/${co.body.data.payment._id}/simulate`, { outcome: 'success' })).status).toBe(403);
  });
  test('verify rejects a forged signature and records the payment as failed', async () => {
    const co = await student.api.post('/api/payments/checkout', { courseId: course.courseId });
    const { payment, gateway } = co.body.data;
    const res = await student.api.post('/api/payments/verify', { paymentId: payment._id, razorpay_order_id: gateway.orderId, razorpay_payment_id: 'pay_x', razorpay_signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect((await Payment.findById(payment._id)).status).toBe('failed');
    expect((await student.api.get('/api/enrollments/mine')).body.data).toHaveLength(0);
  });
  test('verify accepts a correct HMAC signature, enrolls the student and is idempotent', async () => {
    const co = await student.api.post('/api/payments/checkout', { courseId: course.courseId });
    const { payment, gateway } = co.body.data;
    const body = { paymentId: payment._id, razorpay_order_id: gateway.orderId, razorpay_payment_id: 'pay_OK123', razorpay_signature: sign('dummy_secret_value', `${gateway.orderId}|pay_OK123`) };
    const res = await student.api.post('/api/payments/verify', body);
    expect(res.status).toBe(200);
    expect(res.body.data.payment).toMatchObject({ status: 'success', gatewayPaymentId: 'pay_OK123' });
    expect((await student.api.get('/api/enrollments/mine')).body.data).toHaveLength(1);
    expect((await student.api.post('/api/payments/verify', body)).status).toBe(200);
  });
  test('user-reported cancel marks a pending payment failed', async () => {
    const other = await makeUser(app, 'student');
    const co = await other.api.post('/api/payments/checkout', { courseId: course.courseId });
    const res = await other.api.post(`/api/payments/${co.body.data.payment._id}/fail`, { reason: 'Checkout closed' });
    expect(res.body.data.payment).toMatchObject({ status: 'failed', failureReason: 'Checkout closed' });
  });
  test('webhook: invalid signature rejected; valid payment.captured completes the order', async () => {
    const buyer = await makeUser(app, 'student');
    const co = await buyer.api.post('/api/payments/checkout', { courseId: course.courseId });
    const event = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_WH1', order_id: co.body.data.gateway.orderId } } } });
    const bad = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'bad').send(event);
    expect(bad.status).toBe(400);
    const ok = await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', sign('whsec_dummy', event)).send(event);
    expect(ok.status).toBe(200);
    expect((await Payment.findById(co.body.data.payment._id)).status).toBe('success');
    expect((await buyer.api.get('/api/enrollments/mine')).body.data).toHaveLength(1);
  });
});
