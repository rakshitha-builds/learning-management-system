// Runs against a REAL LiveKit server. Skipped unless LIVEKIT_INTEGRATION=1, e.g.:
//   docker run --rm -p 7880:7880 livekit/livekit-server --dev      (keys: devkey / secret)
//   LIVEKIT_INTEGRATION=1 LIVEKIT_URL=ws://localhost:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret npm test -- livekit-integration
const run = process.env.LIVEKIT_INTEGRATION === '1' ? describe : describe.skip;

run('LiveKit server integration', () => {
  const { RoomServiceClient } = require('livekit-server-sdk');
  const jwt = require('jsonwebtoken');
  const env = require('../src/config/env');
  const lk = require('../src/services/livekitService');
  const client = () => new RoomServiceClient(env.livekit.apiUrl, env.livekit.apiKey, env.livekit.apiSecret);

  test('createRoom really creates a room on the LiveKit server and deleteRoom removes it', async () => {
    await lk.createRoom('lms-integration-test');
    expect((await client().listRooms(['lms-integration-test'])).map((r) => r.name)).toContain('lms-integration-test');
    await lk.deleteRoom('lms-integration-test');
    expect(await client().listRooms(['lms-integration-test'])).toHaveLength(0);
  });
  test('join tokens are signed with the server key and carry the right grants', async () => {
    const token = await lk.createJoinToken({ roomName: 'room-x', user: { _id: 'u1', name: 'Tester', role: 'student' }, isHost: false });
    const claims = jwt.verify(token, env.livekit.apiSecret);
    expect(claims.video).toMatchObject({ room: 'room-x', roomJoin: true, canSubscribe: true });
  });
  test('an unreachable LiveKit server produces a clear 503, not a crash', async () => {
    const bad = require('../src/config/env'); const prev = bad.livekit.apiUrl; bad.livekit.apiUrl = 'http://127.0.0.1:1';
    await expect(lk.createRoom('x')).rejects.toMatchObject({ status: 503 });
    bad.livekit.apiUrl = prev;
  });
});
