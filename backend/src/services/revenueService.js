const mongoose = require('mongoose');
const InstructorRevenue = require('../models/InstructorRevenue');
const Payment = require('../models/Payment');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');

const oid = (id) => new mongoose.Types.ObjectId(String(id));

function lastMonths(n) {
  const out = []; const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(`${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

async function instructorSummary(instructorId) {
  const id = oid(instructorId);
  const months = lastMonths(12);
  const [totals, monthly, perCourse, statusCounts, courses] = await Promise.all([
    InstructorRevenue.aggregate([{ $match: { instructor: id } }, { $group: { _id: null, gross: { $sum: '$grossAmount' }, fee: { $sum: '$platformFee' }, net: { $sum: '$netAmount' }, sales: { $sum: 1 } } }]),
    InstructorRevenue.aggregate([{ $match: { instructor: id, month: { $in: months } } }, { $group: { _id: '$month', net: { $sum: '$netAmount' }, gross: { $sum: '$grossAmount' }, sales: { $sum: 1 } } }]),
    InstructorRevenue.aggregate([{ $match: { instructor: id } }, { $group: { _id: '$course', net: { $sum: '$netAmount' }, gross: { $sum: '$grossAmount' }, sales: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { instructor: id } }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
    Course.find({ instructor: id }).select('title enrollmentCount price').lean(),
  ]);
  const mMap = new Map(monthly.map((m) => [m._id, m]));
  const cMap = new Map(perCourse.map((c) => [String(c._id), c]));
  const t = totals[0] || { gross: 0, fee: 0, net: 0, sales: 0 };
  return {
    totals: { grossRevenue: t.gross, platformFees: t.fee, netRevenue: t.net, sales: t.sales },
    monthly: months.map((m) => ({ month: m, net: mMap.get(m)?.net || 0, gross: mMap.get(m)?.gross || 0, sales: mMap.get(m)?.sales || 0 })),
    courses: courses.map((c) => ({ courseId: c._id, title: c.title, price: c.price, enrollments: c.enrollmentCount, net: cMap.get(String(c._id))?.net || 0, sales: cMap.get(String(c._id))?.sales || 0 })),
    transactionCounts: ['success', 'pending', 'failed'].reduce((acc, s) => {
      const f = statusCounts.find((x) => x._id === s); acc[s] = { count: f?.count || 0, amount: f?.amount || 0 }; return acc;
    }, {}),
    totalEnrollments: courses.reduce((s, c) => s + c.enrollmentCount, 0),
  };
}

module.exports = { instructorSummary, lastMonths, oid };
