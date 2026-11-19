const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const User = require('../models/User');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const Enrollment = require('../models/Enrollment');
const { computeCourseProgress } = require('./progressService');
const { notify } = require('./notificationService');
const { logActivity } = require('./activityService');

const newCertificateId = () => `LS-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

async function issueCertificate(studentId, courseId) {
  const existing = await Certificate.findOne({ student: studentId, course: courseId });
  if (existing) return { certificate: existing, created: false };

  const enrollment = await Enrollment.findOne({ student: studentId, course: courseId });
  if (!enrollment) throw ApiError.forbidden('You are not enrolled in this course');
  const progress = await computeCourseProgress(enrollment);
  if (!progress.eligibleForCertificate) {
    throw ApiError.conflict(`Complete all lessons (${progress.completedLessons}/${progress.totalLessons}) and pass all quizzes (${progress.passedQuizzes}/${progress.totalQuizzes}) to earn a certificate`);
  }
  const [student, course] = await Promise.all([User.findById(studentId), Course.findById(courseId).populate('instructor', 'name')]);
  const certificate = await Certificate.create({
    certificateId: newCertificateId(), student: studentId, course: courseId, instructor: course.instructor._id,
    studentName: student.name, courseTitle: course.title, instructorName: course.instructor.name, issuedAt: new Date(),
  });
  await notify(studentId, { type: 'certificate', title: 'Certificate issued', message: `Your certificate for ${course.title} is ready to download.`, link: '/student/certificates' });
  await logActivity({ actor: student, action: 'certificate_issued', entityType: 'Certificate', entityId: certificate._id, summary: `Certificate ${certificate.certificateId} for ${course.title}` });
  return { certificate, created: true };
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

/** Renders the certificate to a PDF buffer (A4 landscape). */
async function renderCertificatePdf(cert) {
  const verifyUrl = `${env.clientUrl}/verify/${cert.certificateId}`;
  const qr = await QRCode.toBuffer(verifyUrl, { margin: 1, width: 220 });
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, info: { Title: `Certificate ${cert.certificateId}`, Author: 'LearnSphere' } });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width; const H = doc.page.height;
  const ink = '#1b2a41'; const accent = '#0f766e'; const gold = '#b7791f';

  doc.rect(0, 0, W, H).fill('#fbfaf6');
  doc.lineWidth(3).strokeColor(accent).rect(24, 24, W - 48, H - 48).stroke();
  doc.lineWidth(0.8).strokeColor(gold).rect(34, 34, W - 68, H - 68).stroke();

  doc.fillColor(accent).font('Helvetica-Bold').fontSize(18).text('LearnSphere', 0, 62, { align: 'center', characterSpacing: 4 });
  doc.fillColor('#64748b').font('Helvetica').fontSize(10).text('Smart Learning Management System', 0, 86, { align: 'center' });

  doc.fillColor(ink).font('Times-Roman').fontSize(40).text('Certificate of Completion', 0, 122, { align: 'center' });
  doc.fillColor('#475569').font('Helvetica').fontSize(13).text('This is to certify that', 0, 186, { align: 'center' });
  doc.fillColor(ink).font('Times-BoldItalic').fontSize(40).text(cert.studentName, 60, 212, { align: 'center', width: W - 120 });
  doc.moveTo(W / 2 - 170, 266).lineTo(W / 2 + 170, 266).lineWidth(0.8).strokeColor(gold).stroke();
  doc.fillColor('#475569').font('Helvetica').fontSize(13).text('has successfully completed the course', 0, 282, { align: 'center' });
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(24).text(cert.courseTitle, 70, 308, { align: 'center', width: W - 140 });

  const baseY = H - 150;
  doc.fillColor(ink).font('Helvetica-Bold').fontSize(13).text(cert.instructorName, 80, baseY, { width: 220, align: 'center' });
  doc.moveTo(80, baseY + 20).lineTo(300, baseY + 20).lineWidth(0.6).strokeColor('#94a3b8').stroke();
  doc.fillColor('#64748b').font('Helvetica').fontSize(10).text('Course Instructor', 80, baseY + 26, { width: 220, align: 'center' });

  doc.fillColor(ink).font('Helvetica-Bold').fontSize(13).text(fmtDate(cert.issuedAt), W - 300, baseY, { width: 220, align: 'center' });
  doc.moveTo(W - 300, baseY + 20).lineTo(W - 80, baseY + 20).lineWidth(0.6).strokeColor('#94a3b8').stroke();
  doc.fillColor('#64748b').font('Helvetica').fontSize(10).text('Date of Completion', W - 300, baseY + 26, { width: 220, align: 'center' });

  doc.image(qr, W / 2 - 38, baseY - 24, { width: 76 });
  doc.fillColor('#64748b').font('Helvetica').fontSize(9).text(`Certificate ID: ${cert.certificateId}`, 0, H - 66, { align: 'center' });
  doc.fontSize(8).text(`Verify at ${verifyUrl}`, 0, H - 53, { align: 'center' });
  doc.end();
  return done;
}

module.exports = { issueCertificate, renderCertificatePdf, newCertificateId };
