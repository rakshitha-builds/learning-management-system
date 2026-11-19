import mongoose from 'mongoose';

const DB_STATES = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

export const getHealth = (req, res) => {
  const dbState = DB_STATES[mongoose.connection.readyState];
  const ok = dbState === 'connected';
  res.status(ok ? 200 : 503).json({
    success: ok,
    data: {
      status: ok ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      database: dbState,
      timestamp: new Date().toISOString(),
    },
  });
};
