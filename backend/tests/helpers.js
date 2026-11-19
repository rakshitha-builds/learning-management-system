const request = require('supertest');
const mongoose = require('mongoose');
const { createApp } = require('../src/app');
const { connectDb, disconnectDb } = require('../src/config/db');
const User = require('../src/models/User');

async function setup() {
  await connectDb(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  return createApp();
}
async function teardown() {
  await mongoose.connection.dropDatabase();
  await disconnectDb();
}

// Thin wrapper: api(app, token).post('/api/..', body)
const api = (app, token) => {
  const wrap = (method) => (url, body) => {
    let r = request(app)[method](url);
    if (token) r = r.set('Authorization', `Bearer ${token}`);
    return body !== undefined ? r.send(body) : r;
  };
  return { get: wrap('get'), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete'), raw: (m, u) => { let r = request(app)[m](u); if (token) r = r.set('Authorization', `Bearer ${token}`); return r; } };
};

let counter = 0;
async function makeUser(app, role = 'student', overrides = {}) {
  counter += 1;
  const email = overrides.email || `${role}${counter}.${Date.now()}@test.dev`;
  const password = 'Passw0rd!x';
  const name = overrides.name || `${role[0].toUpperCase()}${role.slice(1)} ${counter}`;
  if (role === 'admin') {
    const user = await User.create({ name, email, role, passwordHash: await User.hashPassword(password) });
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return { user, token: res.body.data.token, email, password, api: api(app, res.body.data.token) };
  }
  const res = await request(app).post('/api/auth/register').send({ name, email, password, role });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { user: res.body.data.user, token: res.body.data.token, email, password, api: api(app, res.body.data.token) };
}

const courseBody = (o = {}) => ({ title: 'Node.js Masterclass', description: 'A complete practical course on building production Node.js services.', category: 'Web Development', level: 'intermediate', price: 0, ...o });

// Instructor builds a course with 1 module and `lessons` lessons; admin approves it (auto-published).
async function makePublishedCourse(app, instructor, admin, { price = 0, lessons = 2 } = {}) {
  const c = await instructor.api.post('/api/courses', courseBody({ price }));
  const courseId = c.body.data._id;
  const m = await instructor.api.post(`/api/courses/${courseId}/modules`, { title: 'Getting started' });
  const lessonIds = [];
  for (let i = 0; i < lessons; i += 1) {
    const l = await instructor.api.post(`/api/modules/${m.body.data._id}/lessons`, { title: `Lesson ${i + 1}`, isPreview: i === 0 });
    lessonIds.push(l.body.data._id);
  }
  await instructor.api.post(`/api/courses/${courseId}/submit`);
  await admin.api.patch(`/api/admin/courses/${courseId}/review`, { decision: 'approve' });
  return { courseId, moduleId: m.body.data._id, lessonIds };
}

const waitFor = async (fn, { timeout = 60000, interval = 300 } = {}) => {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, interval));
  }
};

module.exports = { setup, teardown, api, makeUser, courseBody, makePublishedCourse, waitFor };
