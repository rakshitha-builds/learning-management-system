const path = require('path');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyMediaToken } = require('../utils/token');
const { getStorage } = require('../services/storage');
const contentType = require('../services/storage/mime');

async function streamKey(req, res, key, { cache }) {
  const storage = getStorage();
  const stat = await storage.stat(key);
  if (!stat) throw ApiError.notFound('File not found');
  res.setHeader('Content-Type', contentType(key));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', cache);
  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  let opts;
  if (range && (range[1] || range[2])) {
    const start = range[1] ? parseInt(range[1], 10) : Math.max(stat.size - parseInt(range[2], 10), 0);
    const end = range[1] && range[2] ? Math.min(parseInt(range[2], 10), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) { res.status(416).setHeader('Content-Range', `bytes */${stat.size}`); return res.end(); }
    res.status(206).setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`).setHeader('Content-Length', end - start + 1);
    opts = { start, end };
  } else {
    res.setHeader('Content-Length', stat.size);
  }
  const stream = await storage.createReadStream(key, opts);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

const safeRest = (rest) => {
  const clean = path.posix.normalize(String(rest || '')).replace(/^\/+/, '');
  if (!clean || clean.startsWith('..') || clean.includes('\0')) throw ApiError.badRequest('Invalid path');
  return clean;
};

// GET /media/:token/*  — HLS playlists + segments, authorised by a short-lived token scoped to one asset.
exports.streamVideo = asyncHandler(async (req, res) => {
  let payload;
  try { payload = verifyMediaToken(req.params.token); } catch { throw ApiError.unauthorized('Media token is invalid or expired'); }
  await streamKey(req, res, `videos/${payload.aid}/${safeRest(req.params[0])}`, { cache: 'private, max-age=300' });
});

// GET /files/*  — public assets only (course thumbnails) when using local storage.
exports.publicFile = asyncHandler(async (req, res) => {
  const key = safeRest(req.params[0]);
  if (!key.startsWith('public/')) throw ApiError.forbidden('Not a public file');
  await streamKey(req, res, key, { cache: 'public, max-age=86400' });
});
