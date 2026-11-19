/* eslint-disable no-console */
/**
 * Seeds realistic demo data: users, courses, curriculum, HLS demo videos, quizzes, enrollments,
 * progress, payments (success / pending / failed), instructor revenue, certificates, live classes and chat.
 * Usage: npm run seed            (wipes the configured database first!)
 */
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const { connectDb, disconnectDb } = require('../src/config/db');
const models = {
  User: require('../src/models/User'), Course: require('../src/models/Course'), Module: require('../src/models/Module'), Lesson: require('../src/models/Lesson'),
  Enrollment: require('../src/models/Enrollment'), VideoAsset: require('../src/models/VideoAsset'), Quiz: require('../src/models/Quiz'), Question: require('../src/models/Question'),
  QuizAttempt: require('../src/models/QuizAttempt'), LiveClass: require('../src/models/LiveClass'), ChatMessage: require('../src/models/ChatMessage'),
  Certificate: require('../src/models/Certificate'), Payment: require('../src/models/Payment'), InstructorRevenue: require('../src/models/InstructorRevenue'),
  Notification: require('../src/models/Notification'), ActivityLog: require('../src/models/ActivityLog'),
};
const { processVideoAsset } = require('../src/services/videoProcessing');
const { makeSampleVideo } = require('./makeSampleVideo');
const { gradeAnswers } = require('../src/services/quizService');

const PASSWORDS = { admin: 'Admin@123', instructor: 'Instructor@123', student: 'Student@123' };
const DAY = 86400000;
const daysAgo = (n, hour = 10) => { const d = new Date(Date.now() - n * DAY); d.setUTCHours(hour, 0, 0, 0); return d; };
const pick = (arr, i) => arr[i % arr.length];

const CATALOG = [
  { t: 'Full-Stack Web Development with MERN', c: 'Web Development', l: 'intermediate', p: 2499, i: 0, d: 'Build and deploy production-grade web apps with MongoDB, Express, React and Node.js, from REST APIs to Redux Toolkit state management.', tags: ['react', 'node', 'mongodb'], hue: 168 },
  { t: 'React & TypeScript: From Zero to Production', c: 'Web Development', l: 'beginner', p: 1499, i: 0, d: 'Learn modern React with hooks, routing and TypeScript by building real interfaces with clean, testable components.', tags: ['react', 'typescript'], hue: 200 },
  { t: 'Flutter App Development Bootcamp', c: 'Mobile Development', l: 'beginner', p: 1999, i: 1, d: 'Create beautiful cross-platform Android and iOS apps with Flutter and Dart, including state management and REST integration.', tags: ['flutter', 'dart'], hue: 215 },
  { t: 'Python for Data Science and Machine Learning', c: 'Data Science', l: 'intermediate', p: 2999, i: 2, d: 'Master NumPy, pandas, scikit-learn and model evaluation with hands-on projects on real-world datasets.', tags: ['python', 'ml'], hue: 35 },
  { t: 'Docker & Kubernetes for Developers', c: 'Cloud & DevOps', l: 'advanced', p: 3499, i: 1, d: 'Containerise services, orchestrate with Kubernetes and ship reliable pipelines with CI/CD and observability.', tags: ['docker', 'k8s'], hue: 250 },
  { t: 'Ethical Hacking & Web Security Essentials', c: 'Cybersecurity', l: 'intermediate', p: 1799, i: 2, d: 'Understand the OWASP Top 10, practise safe penetration testing techniques and learn how to harden real applications.', tags: ['security', 'owasp'], hue: 350 },
  { t: 'UI/UX Design Fundamentals', c: 'Design', l: 'beginner', p: 0, i: 0, d: 'Design thinking, wireframing and prototyping essentials for developers and aspiring product designers. Free course.', tags: ['design', 'figma'], hue: 300 },
  { t: 'Data Structures & Algorithms in JavaScript', c: 'Computer Science', l: 'intermediate', p: 0, i: 1, d: 'Prepare for coding interviews with arrays, trees, graphs and dynamic programming, with step-by-step JavaScript solutions.', tags: ['dsa', 'javascript'], hue: 140 },
];
const MODULES = [
  ['Getting started', ['Course overview and setup', 'Tooling and project structure', 'Your first working example']],
  ['Core concepts', ['Understanding the fundamentals', 'Building blocks in depth', 'Patterns and best practices']],
  ['Project and deployment', ['Planning the capstone project', 'Implementation walkthrough', 'Testing and shipping to production']],
];
const QUESTIONS = [
  ['Which statement best describes the main goal of this course?', ['Build practical, production-ready skills', 'Memorise syntax only', 'Avoid writing code'], 0],
  ['What is the recommended way to organise a growing project?', ['One giant file', 'Separate modules with clear responsibilities', 'Copy and paste everywhere'], 1],
  ['Why do we write automated tests?', ['To catch regressions early', 'To slow down delivery', 'Tests are optional decoration'], 0],
  ['Which practice keeps secrets safe?', ['Commit them to Git', 'Use environment variables', 'Hard-code in the UI'], 1],
];
const STUDENTS = ['Aarav Sharma', 'Diya Patel', 'Rohan Mehta', 'Ananya Iyer', 'Vihaan Reddy', 'Isha Nair', 'Kabir Singh', 'Meera Joshi', 'Arnav Gupta', 'Saanvi Rao', 'Rakshitha R', 'Aditya Kulkarni'];
const INSTRUCTORS = [
  { name: 'Dr. Priya Raman', email: 'priya@learnsphere.dev', headline: 'Senior Full-Stack Engineer · 12 years teaching', bio: 'Ex-staff engineer who has trained 20,000+ developers in modern web engineering.' },
  { name: 'Arjun Menon', email: 'arjun@learnsphere.dev', headline: 'Cloud architect & mobile developer', bio: 'Builds cross-platform apps and cloud infrastructure for fintech startups.' },
  { name: 'Neha Kapoor', email: 'neha@learnsphere.dev', headline: 'Data scientist & security researcher', bio: 'Applied ML practitioner and certified ethical hacker.' },
];

const thumbSvg = (title, hue) => {
  const words = title.split(/\s+/).slice(0, 3).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},60%,26%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,42%)"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><circle cx="540" cy="70" r="120" fill="hsl(${hue},80%,70%)" opacity=".16"/><circle cx="90" cy="330" r="150" fill="#fff" opacity=".07"/><text x="40" y="300" font-family="Georgia,serif" font-size="40" font-weight="700" fill="#fff">${words.replace(/&/g, '&amp;')}</text></svg>`;
};

async function main() {
  await connectDb();
  console.log('Wiping database', mongoose.connection.name, '...');
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const storageDir = env.storage.localDir;
  const thumbsDir = path.join(storageDir, 'public', 'thumbnails');
  await fsp.mkdir(thumbsDir, { recursive: true });

  // ---- Users
  const mk = async (name, email, role, extra = {}, createdAt = daysAgo(120)) =>
    models.User.create({ name, email, role, passwordHash: await models.User.hashPassword(PASSWORDS[role]), createdAt, ...extra });
  const admin = await mk('Platform Admin', 'admin@learnsphere.dev', 'admin');
  const instructors = [];
  for (const [i, x] of INSTRUCTORS.entries()) instructors.push(await mk(x.name, x.email, 'instructor', { headline: x.headline, bio: x.bio }, daysAgo(150 - i * 10)));
  const students = [];
  for (const [i, name] of STUDENTS.entries()) {
    const email = name === 'Rakshitha R' ? 'rakshitha@learnsphere.dev' : `${name.split(' ')[0].toLowerCase()}@learnsphere.dev`;
    students.push(await mk(name, email, 'student', {}, daysAgo(130 - i * 9)));
  }

  // ---- Demo video (processed once, then copied per lesson)
  let template = null;
  if (env.storage.driver === 'local') {
    try {
      console.log('Generating + processing demo video with FFmpeg ...');
      const src = path.join(env.storage.tmpDir, 'seed-sample.mp4');
      await makeSampleVideo(src, { seconds: 12, size: '1280x720' });
      const key = `uploads/seed-template/original.mp4`;
      await fsp.mkdir(path.join(storageDir, 'uploads/seed-template'), { recursive: true });
      await fsp.copyFile(src, path.join(storageDir, key));
      const tplLesson = new mongoose.Types.ObjectId();
      const asset = await models.VideoAsset.create({ lesson: tplLesson, course: tplLesson, uploadedBy: admin._id, originalName: 'demo.mp4', originalKey: key, size: fs.statSync(src).size, mimeType: 'video/mp4' });
      await processVideoAsset(asset._id);
      template = await models.VideoAsset.findById(asset._id);
    } catch (err) { console.warn('! Skipping demo videos (FFmpeg unavailable?):', err.message); }
  }

  // ---- Courses, curriculum, videos, quizzes
  const courses = [];
  for (const [ci, def] of CATALOG.entries()) {
    const instructor = instructors[def.i];
    const course = new models.Course({ title: def.t, description: def.d, category: def.c, level: def.l, price: def.p, tags: def.tags, instructor: instructor._id, approvalStatus: 'approved', isPublished: true, createdAt: daysAgo(110 - ci * 7) });
    course.thumbnailUrl = `${env.apiBaseUrl}/files/public/thumbnails/${course._id}.svg`;
    await fsp.writeFile(path.join(thumbsDir, `${course._id}.svg`), thumbSvg(def.t, def.hue));
    await course.save();
    const lessons = [];
    for (const [mi, [mtitle, ltitles]] of MODULES.entries()) {
      const mod = await models.Module.create({ course: course._id, title: mtitle, order: mi });
      for (const [li, ltitle] of ltitles.entries()) {
        const lesson = await models.Lesson.create({ course: course._id, module: mod._id, title: ltitle, order: li, isPreview: mi === 0 && li === 0, description: `${ltitle} for “${def.t}”.` });
        lessons.push(lesson);
      }
    }
    if (template) {
      for (const lesson of lessons.slice(0, 4)) { // first 4 lessons per course have a playable demo video
        const a = new models.VideoAsset({ lesson: lesson._id, course: course._id, uploadedBy: instructor._id, originalName: 'demo.mp4', mimeType: 'video/mp4', size: template.size, status: 'ready', progress: 100, storageDriver: 'local', renditions: template.renditions, metadata: template.metadata, processedAt: new Date() });
        a.originalKey = `uploads/${a._id}/original.mp4`; a.hlsKey = `videos/${a._id}/master.m3u8`; a.thumbnailKey = `videos/${a._id}/thumb.jpg`;
        await fsp.cp(path.join(storageDir, 'videos', String(template._id)), path.join(storageDir, 'videos', String(a._id)), { recursive: true });
        await a.save();
        lesson.videoAsset = a._id; lesson.duration = Math.round(template.metadata.duration); await lesson.save();
      }
    }
    const dur = (await models.Lesson.find({ course: course._id })).reduce((s, l) => s + (l.duration || 0), 0);
    course.lessonsCount = lessons.length; course.totalDuration = dur;

    const quiz = await models.Quiz.create({ course: course._id, createdBy: instructor._id, title: `${def.t.split(' ').slice(0, 3).join(' ')} — knowledge check`, description: 'Check what you have learned.', durationMinutes: 10, passingMarks: 3, totalMarks: 4, questionCount: 4 });
    await models.Question.insertMany(QUESTIONS.map(([text, options, correctIndex], i) => ({ quiz: quiz._id, text, options: options.map((o) => ({ text: o })), correctIndex, marks: 1, order: i, explanation: 'Review the lesson notes for details.' })));
    courses.push({ doc: course, lessons, quiz, instructor, def });
  }
  // A course awaiting approval and one rejected, for the admin workflow demo.
  const pend = await models.Course.create({ title: 'Advanced System Design for Backend Engineers', description: 'Scalability, caching, queues and consistency trade-offs explained with real architecture case studies.', category: 'Computer Science', level: 'advanced', price: 3999, instructor: instructors[0]._id, approvalStatus: 'pending' });
  const pmod = await models.Module.create({ course: pend._id, title: 'Foundations' }); await models.Lesson.create({ course: pend._id, module: pmod._id, title: 'Scaling reads and writes' }); pend.lessonsCount = 1; await pend.save();
  await models.Course.create({ title: 'Quick Intro to Blockchain Basics', description: 'A very short overview of blockchain concepts for absolute beginners with no prior knowledge.', category: 'Computer Science', level: 'beginner', price: 499, instructor: instructors[2]._id, approvalStatus: 'rejected', rejectionReason: 'Please add at least three lessons with video content before resubmitting.' });

  // ---- Enrollments, progress, payments, revenue, quiz attempts, certificates
  let payCount = 0;
  const completed = [];
  for (const [si, student] of students.entries()) {
    const picks = [0, 1, 2].map((k) => courses[(si + k * 2) % courses.length]);
    for (const [k, c] of picks.entries()) {
      const when = daysAgo(Math.max(3, 100 - si * 6 - k * 14));
      let payment = null;
      if (c.doc.price > 0) {
        payment = await models.Payment.create({
          student: student._id, course: c.doc._id, instructor: c.instructor._id, amount: c.doc.price * 100, gateway: 'simulated', status: 'success',
          orderId: `sim_order_seed${payCount}`, gatewayPaymentId: `sim_pay_seed${payCount}`, paidAt: when, createdAt: when,
        });
        payCount += 1;
        const fee = Math.round(payment.amount * env.platformFeePercent / 100);
        await models.InstructorRevenue.create({ instructor: c.instructor._id, course: c.doc._id, payment: payment._id, grossAmount: payment.amount, platformFee: fee, netAmount: payment.amount - fee, month: `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`, createdAt: when });
      }
      const progressRatio = [1, 0.55, 0.2][(si + k) % 3];
      const done = c.lessons.slice(0, Math.round(c.lessons.length * progressRatio));
      const enrollment = await models.Enrollment.create({
        student: student._id, course: c.doc._id, payment: payment?._id, createdAt: when, lastAccessedAt: daysAgo(si % 6),
        lessonProgress: done.map((l, i) => ({ lesson: l._id, completed: true, watchedSeconds: l.duration || 12, duration: l.duration || 12, completedAt: new Date(when.getTime() + (i + 1) * DAY), updatedAt: new Date(when.getTime() + (i + 1) * DAY) })),
      });
      await models.Course.updateOne({ _id: c.doc._id }, { $inc: { enrollmentCount: 1 } });
      for (const [i, l] of done.entries()) await models.ActivityLog.create({ actor: student._id, actorName: student.name, action: 'lesson_completed', entityType: 'Lesson', entityId: l._id, summary: `Completed lesson “${l.title}”`, createdAt: daysAgo(Math.max(0, 12 - (i + si) % 13)) });
      await models.ActivityLog.create({ actor: student._id, actorName: student.name, action: 'enrolled', entityType: 'Course', entityId: c.doc._id, summary: `Enrolled in ${c.doc.title}`, createdAt: when });

      if (progressRatio >= 0.55) { // quiz attempt
        const qs = await models.Question.find({ quiz: c.quiz._id }).sort({ order: 1 }).lean();
        const answers = qs.map((q, i) => ({ questionId: q._id, selectedIndex: (si + i) % 5 === 0 ? (q.correctIndex + 1) % q.options.length : q.correctIndex }));
        const g = gradeAnswers(qs, answers, c.quiz.passingMarks);
        await models.QuizAttempt.create({ quiz: c.quiz._id, course: c.doc._id, student: student._id, status: 'submitted', startedAt: daysAgo(5), submittedAt: daysAgo(5), answers: g.graded, score: g.score, totalMarks: g.totalMarks, percentage: g.percentage, passed: g.passed, timeTakenSec: 240 + si * 15, createdAt: daysAgo(5 - (k % 2)) });
        if (progressRatio === 1 && g.passed) {
          enrollment.status = 'completed'; enrollment.completedAt = daysAgo(4); await enrollment.save(); completed.push({ student, c });
        }
      }
    }
  }
  // extra failed + pending payments for the transactions table
  const paid = courses.filter((c) => c.doc.price > 0);
  for (let i = 0; i < 5; i += 1) {
    const c = pick(paid, i); const when = daysAgo(2 + i * 3);
    await models.Payment.create({ student: students[(i + 3) % students.length]._id, course: c.doc._id, instructor: c.instructor._id, amount: c.doc.price * 100, gateway: 'simulated', status: i % 2 ? 'failed' : 'pending', orderId: `sim_order_extra${i}`, failureReason: i % 2 ? 'Simulated failure' : undefined, createdAt: when });
  }
  for (const [i, { student, c }] of completed.entries()) {
    await models.Certificate.create({
      certificateId: `LS-${new Date().getFullYear()}-SEED${String(i + 1).padStart(4, '0')}`.toUpperCase(), student: student._id, course: c.doc._id, instructor: c.instructor._id,
      studentName: student.name, courseTitle: c.doc.title, instructorName: c.instructor.name, issuedAt: daysAgo(4),
    });
  }

  // ---- Live classes (past with chat + upcoming)
  const lc1 = await models.LiveClass.create({ course: courses[0].doc._id, instructor: courses[0].instructor._id, title: 'Live Q&A: Redux Toolkit patterns', description: 'Bring your questions about state management.', scheduledAt: daysAgo(6, 11), durationMinutes: 60, status: 'ended', startedAt: daysAgo(6, 11), endedAt: daysAgo(6, 12), roomName: 'lms-seed-ended' });
  const enrolled0 = await models.Enrollment.find({ course: courses[0].doc._id }).populate('student', 'name');
  for (const [i, e] of enrolled0.slice(0, 3).entries()) await models.ChatMessage.create({ liveClass: lc1._id, sender: e.student._id, senderName: e.student.name, senderRole: 'student', message: ['Could you share the slides?', 'What about RTK Query vs thunks?', 'Great explanation, thanks!'][i], createdAt: new Date(daysAgo(6, 11).getTime() + (i + 1) * 120000) });
  const soon = (hours) => new Date(Date.now() + hours * 3600000);
  await models.LiveClass.create({ course: courses[0].doc._id, instructor: courses[0].instructor._id, title: 'Workshop: Deploying MERN apps with Docker', description: 'Hands-on deployment session.', scheduledAt: soon(26), durationMinutes: 90 });
  await models.LiveClass.create({ course: courses[2].doc._id, instructor: courses[2].instructor._id, title: 'Flutter state management deep-dive', scheduledAt: soon(52), durationMinutes: 60 });
  await models.LiveClass.create({ course: courses[3].doc._id, instructor: courses[3].instructor._id, title: 'Office hours: ML model evaluation', scheduledAt: soon(75), durationMinutes: 45 });

  // ---- Notifications for the demo student
  const demo = students.find((s) => s.name === 'Rakshitha R');
  await models.Notification.insertMany([
    { user: demo._id, type: 'live_class', title: 'New live class scheduled', message: 'Workshop: Deploying MERN apps with Docker', link: '/student/live' },
    { user: demo._id, type: 'welcome', title: 'Welcome to LearnSphere', message: 'Browse courses and start learning.', link: '/courses' },
  ]);
  await models.Notification.create({ user: instructors[0]._id, type: 'course_review', title: 'Course awaiting review', message: 'Advanced System Design is waiting for admin approval.', link: '/instructor/courses' });
  await models.ActivityLog.create({ actor: admin._id, actorName: admin.name, action: 'course_approved', summary: 'Approved Full-Stack Web Development with MERN', createdAt: daysAgo(100) });

  for (const c of courses) await models.Course.updateOne({ _id: c.doc._id }, { lessonsCount: c.lessons.length, totalDuration: c.lessons.length ? (await models.Lesson.find({ course: c.doc._id })).reduce((s, l) => s + l.duration, 0) : 0 });
  if (template) { await fsp.rm(path.join(storageDir, 'videos', String(template._id)), { recursive: true, force: true }); await fsp.rm(path.join(storageDir, 'uploads/seed-template'), { recursive: true, force: true }); await models.VideoAsset.deleteOne({ _id: template._id }); }

  const counts = {};
  for (const [k, M] of Object.entries(models)) counts[k] = await M.countDocuments();
  console.log('\nSeed complete:', counts);
  console.log('\nDemo logins');
  console.log('  Admin       admin@learnsphere.dev        /', PASSWORDS.admin);
  console.log('  Instructor  priya@learnsphere.dev        /', PASSWORDS.instructor, '(also arjun@, neha@)');
  console.log('  Student     rakshitha@learnsphere.dev    /', PASSWORDS.student, '(also aarav@, diya@, ... @learnsphere.dev)');
  await disconnectDb();
}

main().catch(async (err) => { console.error(err); await disconnectDb().catch(() => {}); process.exit(1); });
