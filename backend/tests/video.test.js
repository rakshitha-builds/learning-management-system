const path = require('path');
const fs = require('fs');
const os = require('os');
const request = require('supertest');
const { setup, teardown, makeUser, makePublishedCourse, waitFor } = require('./helpers');
const { makeSampleVideo } = require('../scripts/makeSampleVideo');
const { startVideoWorker } = require('../src/workers/videoWorker');
const { closeQueue } = require('../src/services/videoQueue');
const VideoAsset = require('../src/models/VideoAsset');
const Lesson = require('../src/models/Lesson');
const env = require('../src/config/env');
const { enqueueVideo } = require('../src/services/videoQueue');

let app; let admin; let instructor; let other; let student; let outsider; let course; let worker; let sample; let tiny;

beforeAll(async () => {
  app = await setup();
  admin = await makeUser(app, 'admin'); instructor = await makeUser(app, 'instructor'); other = await makeUser(app, 'instructor');
  student = await makeUser(app, 'student'); outsider = await makeUser(app, 'student');
  course = await makePublishedCourse(app, instructor, admin, { lessons: 3 });
  await student.api.post('/api/enrollments', { courseId: course.courseId });
  tiny = path.join(os.tmpdir(), `lms-tiny-${process.pid}.mp4`); fs.writeFileSync(tiny, 'x');
  sample = path.join(os.tmpdir(), `lms-sample-${process.pid}.mp4`);
  await makeSampleVideo(sample, { seconds: 5, size: '1280x720' });
  worker = startVideoWorker();
});
afterAll(async () => {
  await worker.close(); await closeQueue(); await teardown();
  fs.rmSync(sample, { force: true });
});

const upload = (who, lessonId, file = sample, contentType = 'video/mp4', filename = 'lesson.mp4') =>
  request(app).post('/api/videos/upload').set('Authorization', `Bearer ${who.token}`).field('lessonId', lessonId).attach('video', file, { filename, contentType });

describe('Video upload validation', () => {
  test('rejects non-video files (wrong extension/mimetype)', async () => {
    const txt = path.join(os.tmpdir(), `x-${process.pid}.txt`); fs.writeFileSync(txt, 'hello');
    const res = await upload(instructor, course.lessonIds[0], txt, 'text/plain', 'notes.txt');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid file type/i);
  });
  test('rejects a fake .mp4 whose content is not a real video (server-side probe)', async () => {
    const fake = path.join(os.tmpdir(), `fake-${process.pid}.mp4`); fs.writeFileSync(fake, 'this is definitely not a video');
    const res = await upload(instructor, course.lessonIds[0], fake);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not a valid, readable video/i);
    expect(await VideoAsset.countDocuments()).toBe(0);
  });
  test('students and other instructors cannot upload to someone else’s lesson', async () => {
    expect((await student.api.post('/api/videos/upload', { lessonId: course.lessonIds[0] })).status).toBe(403); // role check happens before the body is read
    expect((await upload(other, course.lessonIds[0])).status).toBe(403);
  });
  test('validates lessonId', async () => {
    expect((await upload(instructor, 'nope')).status).toBe(400);
  });
});

describe('Video processing pipeline (BullMQ + FFmpeg)', () => {
  let assetId;
  test('upload is accepted (202) and a BullMQ job is queued', async () => {
    const res = await upload(instructor, course.lessonIds[0]);
    expect(res.status).toBe(202);
    assetId = res.body.data._id;
    expect(['queued', 'processing', 'ready']).toContain(res.body.data.status);
    expect(res.body.data.jobId).toBeTruthy();
    expect(res.body.data.originalKey).toMatch(/^uploads\//);
  });

  test('worker converts it to HLS, stores metadata and marks it ready', async () => {
    const asset = await waitFor(async () => { const a = await VideoAsset.findById(assetId); return a.status === 'ready' || a.status === 'failed' ? a : null; });
    expect(asset.error).toBeUndefined();
    expect(asset.status).toBe('ready');
    expect(asset.progress).toBe(100);
    expect(asset.metadata).toMatchObject({ width: 1280, height: 720, videoCodec: 'h264', audioCodec: 'aac' });
    expect(asset.metadata.duration).toBeGreaterThan(4);
    expect(asset.renditions.map((r) => r.name)).toEqual(['360p', '720p']);
    const root = path.join(env.storage.localDir, 'videos', assetId);
    expect(fs.existsSync(path.join(root, 'master.m3u8'))).toBe(true);
    expect(fs.existsSync(path.join(root, '720p', 'index.m3u8'))).toBe(true);
    expect(fs.readdirSync(path.join(root, '360p')).some((f) => f.endsWith('.ts'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'thumb.jpg'))).toBe(true);
    const lesson = await Lesson.findById(course.lessonIds[0]);
    expect(lesson.duration).toBeGreaterThan(4);
    expect(String(lesson.videoAsset)).toBe(assetId);
  });

  test('status endpoint reports processing state to the owner only', async () => {
    expect((await instructor.api.get(`/api/videos/${assetId}`)).body.data.status).toBe('ready');
    expect((await other.api.get(`/api/videos/${assetId}`)).status).toBe(403);
    expect((await student.api.get(`/api/videos/${assetId}`)).status).toBe(403);
  });

  test('secure access: enrolled student gets a tokenised URL; outsiders are refused', async () => {
    expect((await outsider.api.get(`/api/lessons/${course.lessonIds[0]}/playback`)).status).toBe(200); // lesson 0 is a free preview
    // lesson 1 is NOT a preview -> attach same asset-less lesson: outsider must be forbidden before anything else
    expect((await outsider.api.get(`/api/lessons/${course.lessonIds[1]}/playback`)).status).toBe(403);
    const res = await student.api.get(`/api/lessons/${course.lessonIds[0]}/playback`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ type: 'hls', provider: 'local' });
    expect(res.body.data.url).toMatch(/\/media\/[\w-]+\.[\w-]+\.[\w-]+\/master\.m3u8$/);

    const url = new URL(res.body.data.url);
    const master = await request(app).get(url.pathname);
    expect(master.status).toBe(200);
    expect(master.headers['content-type']).toMatch(/mpegurl/);
    expect(master.text).toContain('#EXT-X-STREAM-INF');
    const seg = await request(app).get(url.pathname.replace('master.m3u8', '360p/seg_000.ts')).set('Range', 'bytes=0-99');
    expect(seg.status).toBe(206);
    expect(seg.headers['content-range']).toMatch(/^bytes 0-99\//);
  });

  test('media endpoint rejects bad tokens, other assets and path traversal', async () => {
    expect((await request(app).get('/media/not-a-token/master.m3u8')).status).toBe(401);
    const res = await student.api.get(`/api/lessons/${course.lessonIds[0]}/playback`);
    const p = new URL(res.body.data.url).pathname;
    expect((await request(app).get(p.replace('master.m3u8', '../../uploads/x/original.mp4'))).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get(p.replace('master.m3u8', 'nothere.ts'))).status).toBe(404);
  });

  test('re-uploading replaces the asset; deleting removes files', async () => {
    const res = await upload(instructor, course.lessonIds[0]);
    expect(res.status).toBe(202);
    const newId = res.body.data._id;
    expect(newId).not.toBe(assetId);
    expect(fs.existsSync(path.join(env.storage.localDir, 'videos', assetId))).toBe(false);
    await waitFor(async () => (await VideoAsset.findById(newId)).status === 'ready');
    expect((await instructor.api.delete(`/api/videos/${newId}`)).status).toBe(200);
    expect(fs.existsSync(path.join(env.storage.localDir, 'videos', newId))).toBe(false);
  });
});

describe('Failed jobs and retry', () => {
  let brokenId;
  test('a job that keeps failing is retried by BullMQ, then marked failed with the error', async () => {
    const asset = await VideoAsset.create({
      lesson: course.lessonIds[2], course: course.courseId, uploadedBy: instructor.user._id,
      originalName: 'broken.mp4', originalKey: 'uploads/does-not-exist/original.mp4', storageDriver: 'local',
    });
    brokenId = asset._id;
    await Lesson.updateOne({ _id: course.lessonIds[2] }, { videoAsset: asset._id });
    await enqueueVideo(asset);
    const failed = await waitFor(async () => { const a = await VideoAsset.findById(brokenId); return a.status === 'failed' ? a : null; });
    expect(failed.error).toMatch(/Source file missing/);
    expect(failed.attempts).toBe(2); // VIDEO_JOB_ATTEMPTS=2 in tests
    // the worker saves status=failed first and notifies right after, so wait for the notification
    await waitFor(async () => (await instructor.api.get('/api/notifications')).body.data.some((x) => x.type === 'video_failed'), { timeout: 5000 });
  });

  test('manual retry re-queues a failed asset (and is refused for non-failed ones)', async () => {
    const retry = await instructor.api.post(`/api/videos/${brokenId}/retry`);
    expect(retry.status).toBe(202);
    expect(retry.body.data.status).toBe('queued');
    await waitFor(async () => (await VideoAsset.findById(brokenId)).status === 'failed'); // fails again: source is still missing
    const ready = await VideoAsset.create({ lesson: course.lessonIds[1], course: course.courseId, uploadedBy: instructor.user._id, status: 'ready', originalKey: 'x' });
    expect((await instructor.api.post(`/api/videos/${ready._id}/retry`)).status).toBe(409);
  });
});
