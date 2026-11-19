const { z } = require('zod');
const { LEVELS } = require('../config/constants');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const idParam = (name = 'id') => z.object({ [name]: objectId });
const emptyToUndef = (v) => (v === '' || v === null ? undefined : v);

const password = z.string().min(8, 'Password must be at least 8 characters').max(72)
  .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number');

const auth = {
  register: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password,
    role: z.enum(['student', 'instructor']).default('student'), // admin can never self-register
  }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }),
  updateProfile: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    headline: z.string().trim().max(120).optional(),
    bio: z.string().trim().max(1000).optional(),
    currentPassword: z.string().optional(),
    newPassword: password.optional(),
  }),
};

const course = {
  create: z.object({
    title: z.string().trim().min(5, 'Title must be at least 5 characters').max(140),
    description: z.string().trim().min(20, 'Description must be at least 20 characters').max(5000),
    category: z.string().trim().min(2),
    level: z.enum(LEVELS).default('beginner'),
    price: z.coerce.number().min(0).max(1000000).default(0),
    tags: z.array(z.string().trim().max(30)).max(10).optional(),
  }),
  update: z.object({
    title: z.string().trim().min(5).max(140).optional(),
    description: z.string().trim().min(20).max(5000).optional(),
    category: z.string().trim().min(2).optional(),
    level: z.enum(LEVELS).optional(),
    price: z.coerce.number().min(0).max(1000000).optional(),
    tags: z.array(z.string().trim().max(30)).max(10).optional(),
  }),
  list: z.object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().optional(),
    level: z.enum(LEVELS).optional(),
    price: z.enum(['free', 'paid']).optional(),
    sort: z.enum(['newest', 'popular', 'price_asc', 'price_desc']).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(12),
  }),
  publish: z.object({ publish: z.boolean() }),
};

const curriculum = {
  module: z.object({ title: z.string().trim().min(2).max(140), description: z.string().trim().max(500).optional(), order: z.number().int().min(0).optional() }),
  moduleUpdate: z.object({ title: z.string().trim().min(2).max(140).optional(), description: z.string().trim().max(500).optional(), order: z.number().int().min(0).optional() }),
  lesson: z.object({ title: z.string().trim().min(2).max(140), description: z.string().trim().max(2000).optional(), isPreview: z.boolean().optional(), order: z.number().int().min(0).optional() }),
  lessonUpdate: z.object({ title: z.string().trim().min(2).max(140).optional(), description: z.string().trim().max(2000).optional(), isPreview: z.boolean().optional(), order: z.number().int().min(0).optional() }),
};

const questionInput = z.object({
  text: z.string().trim().min(3).max(1000),
  options: z.array(z.string().trim().min(1).max(400)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  marks: z.number().int().min(1).max(100).default(1),
  explanation: z.string().trim().max(1000).optional(),
}).refine((q) => q.correctIndex < q.options.length, { message: 'correctIndex must point to an existing option', path: ['correctIndex'] });

const quiz = {
  create: z.object({
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().max(1000).optional(),
    durationMinutes: z.number().int().min(1).max(300),
    passingMarks: z.number().int().min(0),
    questions: z.array(questionInput).min(1, 'Add at least one question').max(100),
  }).superRefine((q, ctx) => {
    const total = q.questions.reduce((s, x) => s + x.marks, 0);
    if (q.passingMarks > total) ctx.addIssue({ code: 'custom', path: ['passingMarks'], message: `Passing marks cannot exceed total marks (${total})` });
  }),
  submit: z.object({ answers: z.array(z.object({ questionId: objectId, selectedIndex: z.number().int().min(0).nullable() })).max(200) }),
};

const progress = {
  lesson: z.object({ watchedSeconds: z.number().min(0).max(86400 * 2).optional(), duration: z.number().min(0).max(86400).optional(), completed: z.boolean().optional() }),
};

const live = {
  create: z.object({
    courseId: objectId,
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().max(1000).optional(),
    scheduledAt: z.coerce.date().refine((d) => d.getTime() > Date.now() - 5 * 60 * 1000, 'Scheduled time must be in the future'),
    durationMinutes: z.number().int().min(5).max(480).default(60),
  }),
};

const payment = {
  checkout: z.object({ courseId: objectId }),
  verify: z.object({ paymentId: objectId, razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() }),
  fail: z.object({ reason: z.string().trim().max(200).optional() }),
  simulate: z.object({ outcome: z.enum(['success', 'failed']) }),
};

const admin = {
  userStatus: z.object({ status: z.enum(['active', 'suspended']) }),
  review: z.object({ decision: z.enum(['approve', 'reject']), reason: z.string().trim().max(500).optional() })
    .refine((v) => v.decision !== 'reject' || !!v.reason, { message: 'A reason is required when rejecting a course', path: ['reason'] }),
  createUser: z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email(), password, role: z.enum(['student', 'instructor', 'admin']) }),
};

const listQuery = z.object({
  q: z.string().trim().max(100).optional(), role: z.enum(['student', 'instructor', 'admin']).optional(),
  status: z.string().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(10),
});

module.exports = { z, objectId, idParam, auth, course, curriculum, quiz, progress, live, payment, admin, listQuery, emptyToUndef };
