const Certificate = require('../models/Certificate');
const ApiError = require('../utils/ApiError');
const respond = require('../utils/respond');
const asyncHandler = require('../utils/asyncHandler');
const { issueCertificate, renderCertificatePdf } = require('../services/certificateService');

exports.issue = asyncHandler(async (req, res) => {
  const { certificate, created } = await issueCertificate(req.user._id, req.params.courseId);
  respond(res, certificate, { status: created ? 201 : 200 });
});

exports.mine = asyncHandler(async (req, res) => respond(res, await Certificate.find({ student: req.user._id }).sort({ issuedAt: -1 }).lean()));

exports.download = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const cert = await Certificate.findOne(/^[a-f\d]{24}$/i.test(id) ? { _id: id } : { certificateId: id });
  if (!cert) throw ApiError.notFound('Certificate not found');
  if (String(cert.student) !== String(req.user._id) && req.user.role !== 'admin') throw ApiError.forbidden('This certificate belongs to another student');
  const pdf = await renderCertificatePdf(cert);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${cert.certificateId}.pdf"`, 'Content-Length': pdf.length });
  res.send(pdf);
});

// Public verification by certificate ID.
exports.verify = asyncHandler(async (req, res) => {
  const cert = await Certificate.findOne({ certificateId: req.params.certificateId.toUpperCase() }).lean();
  if (!cert) return respond(res, { valid: false }, { status: 404 });
  respond(res, { valid: true, certificateId: cert.certificateId, studentName: cert.studentName, courseTitle: cert.courseTitle, instructorName: cert.instructorName, issuedAt: cert.issuedAt });
});
