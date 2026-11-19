const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

function requireLivekit() {
  if (!env.features.livekit) {
    throw ApiError.unavailable('LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET (see docs/SETUP.md).');
  }
}
const roomClient = () => new RoomServiceClient(env.livekit.apiUrl, env.livekit.apiKey, env.livekit.apiSecret);

async function createRoom(roomName, maxParticipants = 200) {
  requireLivekit();
  try {
    await roomClient().createRoom({ name: roomName, emptyTimeout: 10 * 60, maxParticipants });
  } catch (err) {
    throw ApiError.unavailable(`Could not reach the LiveKit server at ${env.livekit.apiUrl}: ${err.message}`);
  }
}

async function deleteRoom(roomName) {
  if (!env.features.livekit) return;
  try { await roomClient().deleteRoom(roomName); } catch (err) { logger.warn('LiveKit deleteRoom failed', { error: err.message }); }
}

/** Issues a join token. Instructors are room admins; students can publish mic/camera unless disabled. */
async function createJoinToken({ roomName, user, isHost }) {
  requireLivekit();
  const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity: String(user._id), name: user.name, ttl: '3h', metadata: JSON.stringify({ role: user.role }),
  });
  at.addGrant({
    room: roomName, roomJoin: true, roomAdmin: isHost,
    canPublish: isHost || env.livekit.studentsCanPublish, canSubscribe: true, canPublishData: true,
  });
  return at.toJwt();
}

module.exports = { createRoom, deleteRoom, createJoinToken, requireLivekit };
