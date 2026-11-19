const request = require('supertest');
const { setup, teardown, makeUser } = require('./helpers');
const User = require('../src/models/User');

let app;
beforeAll(async () => { app = await setup(); });
afterAll(teardown);

describe('Registration', () => {
  const body = { name: 'Asha Rao', email: 'asha@test.dev', password: 'Secret123', role: 'student' };

  test('registers a student and returns a JWT without leaking the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.user.email).toBe('asha@test.dev');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    const stored = await User.findOne({ email: body.email }).select('+passwordHash');
    expect(stored.passwordHash).not.toBe(body.password);          // hashed
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);            // bcrypt
  });

  test('rejects duplicate email with 409', async () => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
  });

  test('validates input (weak password, bad email, missing name)', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: '', email: 'nope', password: 'short' });
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  test('cannot self-register as admin', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...body, email: 'evil@test.dev', role: 'admin' });
    expect(res.status).toBe(400);
    expect(await User.exists({ email: 'evil@test.dev' })).toBeNull();
  });
});

describe('Login & authentication', () => {
  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'asha@test.dev', password: 'Secret123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });
  test('rejects wrong password and unknown email with the same 401 message', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: 'asha@test.dev', password: 'Wrong123' });
    const b = await request(app).post('/api/auth/login').send({ email: 'ghost@test.dev', password: 'Wrong123' });
    expect(a.status).toBe(401); expect(b.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });
  test('GET /auth/me requires a valid token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer garbage')).status).toBe(401);
    const s = await makeUser(app, 'student');
    const res = await s.api.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(s.email);
  });
  test('suspended accounts cannot log in or use an existing token', async () => {
    const s = await makeUser(app, 'student');
    await User.updateOne({ _id: s.user._id }, { status: 'suspended' });
    expect((await request(app).post('/api/auth/login').send({ email: s.email, password: s.password })).status).toBe(403);
    expect((await s.api.get('/api/auth/me')).status).toBe(403);
  });
  test('password change requires the current password', async () => {
    const s = await makeUser(app, 'student');
    const bad = await s.api.patch('/api/auth/me', { currentPassword: 'nope', newPassword: 'NewPass123' });
    expect(bad.status).toBe(400);
    const ok = await s.api.patch('/api/auth/me', { currentPassword: s.password, newPassword: 'NewPass123' });
    expect(ok.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: s.email, password: 'NewPass123' })).status).toBe(200);
  });
});
