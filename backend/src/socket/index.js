const { Server } = require('socket.io');
const env = require('../config/env');
const logger = require('../config/logger');
const User = require('../models/User');
const ChatMessage = require('../models/ChatMessage');
const { verifyAuthToken } = require('../utils/token');
const { loadClass, assertAccess } = require('../controllers/liveController');

/** Real-time chat + presence for live classes (video/audio itself goes through LiveKit). */
function attachSocket(httpServer, app) {
  const io = new Server(httpServer, { cors: { origin: env.clientUrl.split(',').map((s) => s.trim()), credentials: true } });
  app.set('io', io);

  io.use(async (socket, next) => {
    try {
      const payload = verifyAuthToken(socket.handshake.auth?.token || '');
      const user = await User.findById(payload.sub);
      if (!user || user.status !== 'active') return next(new Error('Unauthorized'));
      socket.data.user = user;
      next();
    } catch { next(new Error('Unauthorized')); }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    socket.on('chat:join', async ({ liveClassId } = {}, ack) => {
      try {
        const lc = await loadClass(liveClassId);
        await assertAccess(lc, user);
        socket.join(`live:${liveClassId}`);
        socket.data.liveClassId = liveClassId;
        io.to(`live:${liveClassId}`).emit('chat:presence', { count: io.sockets.adapter.rooms.get(`live:${liveClassId}`)?.size || 0 });
        ack?.({ ok: true });
      } catch (err) { ack?.({ ok: false, error: err.message }); }
    });

    socket.on('chat:message', async ({ liveClassId, message } = {}, ack) => {
      try {
        const text = String(message || '').trim().slice(0, 1000);
        if (!text) return ack?.({ ok: false, error: 'Empty message' });
        if (!socket.rooms.has(`live:${liveClassId}`)) return ack?.({ ok: false, error: 'Join the class chat first' });
        const lc = await loadClass(liveClassId);
        if (lc.status !== 'live') return ack?.({ ok: false, error: 'Chat is only open while the class is live' });
        const doc = await ChatMessage.create({ liveClass: liveClassId, sender: user._id, senderName: user.name, senderRole: user.role, message: text });
        io.to(`live:${liveClassId}`).emit('chat:message', doc.toObject());
        ack?.({ ok: true });
      } catch (err) { logger.warn('chat:message failed', { error: err.message }); ack?.({ ok: false, error: 'Could not send message' }); }
    });

    socket.on('disconnect', () => {
      const id = socket.data.liveClassId;
      if (id) io.to(`live:${id}`).emit('chat:presence', { count: io.sockets.adapter.rooms.get(`live:${id}`)?.size || 0 });
    });
  });
  return io;
}

module.exports = { attachSocket };
