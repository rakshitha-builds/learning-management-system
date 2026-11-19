module.exports = {
  ROLES: { STUDENT: 'student', INSTRUCTOR: 'instructor', ADMIN: 'admin' },
  APPROVAL: { DRAFT: 'draft', PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' },
  LEVELS: ['beginner', 'intermediate', 'advanced'],
  CATEGORIES: ['Web Development', 'Mobile Development', 'Data Science', 'Cloud & DevOps', 'Cybersecurity', 'Design', 'Business', 'Computer Science'],
  VIDEO_STATUS: { UPLOADED: 'uploaded', QUEUED: 'queued', PROCESSING: 'processing', READY: 'ready', FAILED: 'failed' },
  PAYMENT_STATUS: { PENDING: 'pending', SUCCESS: 'success', FAILED: 'failed' },
  LIVE_STATUS: { SCHEDULED: 'scheduled', LIVE: 'live', ENDED: 'ended', CANCELLED: 'cancelled' },
  VIDEO_QUEUE: 'video-processing',
};
