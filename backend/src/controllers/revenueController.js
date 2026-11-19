const Payment = require('../models/Payment');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { instructorSummary } = require('../services/revenueService');
const { parsePagination, pageMeta } = require('../utils/pagination');

exports.summary = asyncHandler(async (req, res) => respond(res, await instructorSummary(req.user._id)));

exports.transactions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 10 });
  const filter = { instructor: req.user._id };
  if (['success', 'pending', 'failed'].includes(req.query.status)) filter.status = req.query.status;
  const [items, total] = await Promise.all([
    Payment.find(filter).populate('student', 'name email').populate('course', 'title').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments(filter),
  ]);
  respond(res, items, { meta: pageMeta(total, page, limit) });
});
