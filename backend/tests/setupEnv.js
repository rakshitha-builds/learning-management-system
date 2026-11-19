const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/learnsphere_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const base = path.join(os.tmpdir(), `lms-test-${process.pid}`);
process.env.TMP_DIR = path.join(base, 'tmp');
process.env.LOCAL_STORAGE_DIR = path.join(base, 'storage');
process.env.VIDEO_JOB_ATTEMPTS = '2';
process.env.VIDEO_JOB_BACKOFF_MS = '200';
process.env.API_BASE_URL = 'http://localhost:5000';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.JWT_SECRET = 'test-secret';
process.env.ENV_FILE = path.join(base, 'nonexistent.env');
