// LiveKit server calls are mocked here (no LiveKit server in CI); token generation uses the real SDK.
process.env.LIVEKIT_URL = 'ws://localhost:7880';
process.env.LIVEKIT_API_KEY = 'devkey';
process.env.LIVEKIT_API_SECRET = 'secret-secret-secret-secret-secret-1234';

jest.mock('../src/services/livekitService', () => {
  const actual = jest.requireActual('../src/services/livekitService');
  return { ...actual, createRoom: jest.fn(async () => {}), deleteRoom: jest.fn(async () => {}) };
});

const http = require('http');
const jwt = require('jsonwebtoken');
const { io: connect } = require('socket.io-client');
const { setup, teardown, makeUser, makePublishedCourse } = require('./helpers');
const { attachSocket } = require('../src/socket');
const ChatMessage = require('../src/models/ChatMessage');

let app; let server; let port; let admin; let instructor; let student; let outsider; let course; let classId;
const future = () => new Date(Date.now() + 3600 * 1000).toISOString();
const wait = (socket, ev) => new Promise((resolve) => socket.once(ev, resolve));
const emit = (socket, ev, payload) => new Promise((resolve) => socket.emit(ev, payload, resolve));
const client = (token) => connect(`http://localhost:${port}`, { auth: { token }, transports: ['websocket'], forceNew: true });

beforeAll(async () => {
  app = await setup();
  server = http.createServer(app); attachSocket(server, app);
  await new Promise((r) => server.listen(0, r)); port = server.address().port;
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor'); student = await makeUser(app, 'student'); outsider = await makeUser(app, 'student');
  course = await makePublishedCourse(app, instructor, admin);
  await student.api.post('/api/enrollments', { courseId: course.courseId });
});
afterAll(async () => { app.get('io').close(); await teardown(); });

describe('Live class scheduling', () => {
  test('instructor schedules a class for own course (validated); enrolled students are notified', async () => {
    expect((await instructor.api.post('/api/live', { courseId: course.courseId, title: 'x', scheduledAt: future() })).status).toBe(400);
    expect((await instructor.api.post('/api/live', { courseId: course.courseId, title: 'Past class', scheduledAt: '2020-01-01T10:00:00Z' })).status).toBe(400);
    const res = await instructor.api.post('/api/live', { courseId: course.courseId, title: 'Live Q&A session', scheduledAt: future(), durationMinutes: 45 });
    expect(res.status).toBe(201);
    classId = res.body.data._id;
    expect(res.body.data.status).toBe('scheduled');
    expect((await student.api.get('/api/notifications')).body.data.some((n) => n.type === 'live_class')).toBe(true);
  });
  test('students see upcoming classes of enrolled courses only', async () => {
    expect((await student.api.get('/api/live')).body.data.map((c) => c._id)).toContain(classId);
    expect((await outsider.api.get('/api/live')).body.data).toHaveLength(0);
    expect((await outsider.api.get(`/api/live/${classId}`)).status).toBe(403);
    expect((await student.api.post('/api/live', {})).status).toBe(403);
  });
  test('students cannot join before the instructor starts the class', async () => {
    const res = await student.api.post(`/api/live/${classId}/token`);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/not started/);
  });
  test('only the owning instructor can start; start creates the LiveKit room', async () => {
    const other = await makeUser(app, 'instructor');
    expect((await other.api.post(`/api/live/${classId}/start`)).status).toBe(403);
    expect((await student.api.post(`/api/live/${classId}/start`)).status).toBe(403);
    const res = await instructor.api.post(`/api/live/${classId}/start`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'live', roomName: `lms-${classId}` });
    expect(require('../src/services/livekitService').createRoom).toHaveBeenCalledWith(`lms-${classId}`);
  });
});

describe('Joining (LiveKit access tokens)', () => {
  test('student gets a signed LiveKit token scoped to the class room', async () => {
    const res = await student.api.post(`/api/live/${classId}/token`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ url: 'ws://localhost:7880', roomName: `lms-${classId}`, isHost: false });
    const claims = jwt.verify(res.body.data.token, process.env.LIVEKIT_API_SECRET);
    expect(claims.iss).toBe('devkey');
    expect(claims.sub).toBe(String(student.user._id));
    expect(claims.video).toMatchObject({ room: `lms-${classId}`, roomJoin: true, canPublish: true, canSubscribe: true });
    expect(claims.video.roomAdmin).toBeFalsy();
  });
  test('instructor token is a room admin', async () => {
    const res = await instructor.api.post(`/api/live/${classId}/token`);
    expect(res.body.data.isHost).toBe(true);
    expect(jwt.verify(res.body.data.token, process.env.LIVEKIT_API_SECRET).video.roomAdmin).toBe(true);
  });
  test('non-enrolled users cannot obtain tokens; attendance is recorded', async () => {
    expect((await outsider.api.post(`/api/live/${classId}/token`)).status).toBe(403);
    const lc = await instructor.api.get(`/api/live/${classId}`);
    expect(lc.body.data.attendees).toHaveLength(2);
  });
});

describe('Real-time chat (Socket.IO)', () => {
  let s1; let s2; let s3;
  beforeAll(async () => { s1 = client(instructor.token); s2 = client(student.token); s3 = client(outsider.token); await Promise.all([wait(s1, 'connect'), wait(s2, 'connect'), wait(s3, 'connect')]); });
  afterAll(() => { s1.close(); s2.close(); s3.close(); });

  test('unauthenticated sockets are rejected', async () => {
    const bad = client('garbage');
    const err = await wait(bad, 'connect_error');
    expect(err.message).toBe('Unauthorized'); bad.close();
  });
  test('non-enrolled users cannot join the class chat', async () => {
    expect((await emit(s3, 'chat:join', { liveClassId: classId })).ok).toBe(false);
    expect((await emit(s3, 'chat:message', { liveClassId: classId, message: 'hi' })).ok).toBe(false);
  });
  test('messages are broadcast to everyone in the class and persisted', async () => {
    expect((await emit(s1, 'chat:join', { liveClassId: classId })).ok).toBe(true);
    expect((await emit(s2, 'chat:join', { liveClassId: classId })).ok).toBe(true);
    const received = wait(s1, 'chat:message');
    expect((await emit(s2, 'chat:message', { liveClassId: classId, message: '  Hello teacher!  ' })).ok).toBe(true);
    const msg = await received;
    expect(msg).toMatchObject({ message: 'Hello teacher!', senderName: student.user.name, senderRole: 'student' });
    expect(await ChatMessage.countDocuments({ liveClass: classId })).toBe(1);
    const hist = await student.api.get(`/api/live/${classId}/messages`);
    expect(hist.body.data).toHaveLength(1);
    expect((await outsider.api.get(`/api/live/${classId}/messages`)).status).toBe(403);
  });
  test('empty messages are refused', async () => {
    expect((await emit(s2, 'chat:message', { liveClassId: classId, message: '   ' })).ok).toBe(false);
  });
  test('ending the class notifies the room and closes chat + tokens', async () => {
    const ended = wait(s2, 'live:ended');
    expect((await instructor.api.post(`/api/live/${classId}/end`)).status).toBe(200);
    await ended;
    expect((await emit(s2, 'chat:message', { liveClassId: classId, message: 'late' })).ok).toBe(false);
    expect((await student.api.post(`/api/live/${classId}/token`)).status).toBe(409);
    expect(require('../src/services/livekitService').deleteRoom).toHaveBeenCalled();
  });
});
