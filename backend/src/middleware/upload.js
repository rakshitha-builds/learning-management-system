const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

fs.mkdirSync(env.storage.tmpDir, { recursive: true });

const VIDEO_EXT = ['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v'];
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.storage.tmpDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

const makeUploader = ({ extensions, mimePrefix, maxMb }) =>
  multer({
    storage: diskStorage,
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!extensions.includes(ext) || !file.mimetype.startsWith(mimePrefix)) {
        return cb(ApiError.badRequest(`Invalid file type. Allowed: ${extensions.join(', ')}`));
      }
      cb(null, true);
    },
  });

module.exports = {
  uploadVideo: makeUploader({ extensions: VIDEO_EXT, mimePrefix: 'video/', maxMb: env.storage.maxVideoSizeMb }).single('video'),
  uploadImage: makeUploader({ extensions: IMAGE_EXT, mimePrefix: 'image/', maxMb: 5 }).single('image'),
};
