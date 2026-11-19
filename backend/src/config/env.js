const path = require('path');
require('dotenv').config({ path: process.env.ENV_FILE || path.join(__dirname, '../../.env'), quiet: true });

const bool = (v, d = false) => (v === undefined ? d : String(v).toLowerCase() === 'true');
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),
  apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${num(process.env.PORT, 5000)}`,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/learnsphere',
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mediaTokenTtlSec: num(process.env.MEDIA_TOKEN_TTL_SEC, 4 * 60 * 60),
  platformFeePercent: num(process.env.PLATFORM_FEE_PERCENT, 20),

  storage: {
    driver: (process.env.STORAGE_DRIVER || 'local').toLowerCase(), // local | s3
    localDir: path.resolve(process.env.LOCAL_STORAGE_DIR || path.join(__dirname, '../../storage')),
    tmpDir: path.resolve(process.env.TMP_DIR || path.join(__dirname, '../../tmp')),
    maxVideoSizeMb: num(process.env.MAX_VIDEO_SIZE_MB, 500),
  },
  s3: {
    bucket: process.env.AWS_S3_BUCKET || '',
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  cloudfront: {
    domain: (process.env.CLOUDFRONT_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID || '',
    privateKey: (process.env.CLOUDFRONT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    urlTtlSec: num(process.env.CLOUDFRONT_URL_TTL_SEC, 4 * 60 * 60),
  },
  livekit: {
    url: process.env.LIVEKIT_URL || '', // ws(s):// URL used by browsers
    apiUrl: process.env.LIVEKIT_API_URL || '', // http(s):// URL used by the backend (defaults to LIVEKIT_URL)
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
    studentsCanPublish: bool(process.env.LIVEKIT_STUDENTS_CAN_PUBLISH, true),
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  allowSimulatedPayments: bool(process.env.ALLOW_SIMULATED_PAYMENTS, process.env.NODE_ENV !== 'production'),
  videoJobAttempts: num(process.env.VIDEO_JOB_ATTEMPTS, 3),
  videoJobBackoffMs: num(process.env.VIDEO_JOB_BACKOFF_MS, 5000),
  videoWorkerConcurrency: num(process.env.VIDEO_WORKER_CONCURRENCY, 1),
  ffmpegPath: process.env.FFMPEG_PATH || '',
  ffprobePath: process.env.FFPROBE_PATH || '',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info'),
};

// Capability flags: the app reports honestly what is configured.
env.features = {
  s3: env.storage.driver === 's3' && !!(env.s3.bucket && env.s3.accessKeyId && env.s3.secretAccessKey),
  cloudfront: !!(env.cloudfront.domain && env.cloudfront.keyPairId && env.cloudfront.privateKey),
  livekit: !!(env.livekit.url && env.livekit.apiKey && env.livekit.apiSecret),
  razorpay: !!(env.razorpay.keyId && env.razorpay.keySecret),
};

if (env.storage.driver === 's3' && !env.features.s3) {
  throw new Error('STORAGE_DRIVER=s3 requires AWS_S3_BUCKET, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
}
if (env.nodeEnv === 'production' && env.jwtSecret.startsWith('dev-only')) {
  throw new Error('JWT_SECRET must be set in production');
}

env.livekit.apiUrl = (env.livekit.apiUrl || env.livekit.url).replace(/^ws/, 'http');

module.exports = env;
