const fs = require('fs/promises');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const env = require('../config/env');
const logger = require('../config/logger');
const { getStorage } = require('./storage');
const VideoAsset = require('../models/VideoAsset');
const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const { VIDEO_STATUS } = require('../config/constants');

if (env.ffmpegPath) ffmpeg.setFfmpegPath(env.ffmpegPath);
if (env.ffprobePath) ffmpeg.setFfprobePath(env.ffprobePath);

// Adaptive-bitrate ladder. Renditions taller than the source are skipped.
const LADDER = [
  { name: '360p', height: 360, videoBitrate: 800 },
  { name: '720p', height: 720, videoBitrate: 2500 },
  { name: '1080p', height: 1080, videoBitrate: 5000 },
];

const probe = (file) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(file, (err, data) => {
      if (err) return reject(new Error(`ffprobe failed: ${err.message}`));
      const v = data.streams.find((s) => s.codec_type === 'video');
      const a = data.streams.find((s) => s.codec_type === 'audio');
      if (!v) return reject(new Error('File contains no video stream'));
      const [n, d] = (v.avg_frame_rate || '0/1').split('/').map(Number);
      resolve({
        duration: Math.round((Number(data.format.duration) || 0) * 100) / 100,
        width: v.width, height: v.height, videoCodec: v.codec_name, audioCodec: a?.codec_name || null,
        bitrate: Number(data.format.bit_rate) || null, fps: d ? Math.round((n / d) * 100) / 100 : null,
        format: data.format.format_name, hasAudio: !!a,
      });
    });
  });

function encodeRendition(input, outDir, rung, meta, onPercent) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(input)
      .videoCodec('libx264')
      .size(`?x${rung.height}`)
      .outputOptions([
        '-preset veryfast', '-profile:v main', '-crf 23', `-maxrate ${rung.videoBitrate}k`, `-bufsize ${rung.videoBitrate * 2}k`,
        '-sc_threshold 0', '-g 48', '-keyint_min 48', '-pix_fmt yuv420p',
        '-hls_time 6', '-hls_playlist_type vod', '-hls_segment_filename', path.join(outDir, 'seg_%03d.ts'), '-f hls',
      ]);
    if (meta.hasAudio) cmd.audioCodec('aac').audioBitrate('128k').audioChannels(2); else cmd.noAudio();
    cmd
      .on('progress', (p) => onPercent && onPercent(Math.min(p.percent || 0, 100)))
      .on('error', (err) => reject(new Error(`ffmpeg ${rung.name} failed: ${err.message}`)))
      .on('end', resolve)
      .save(path.join(outDir, 'index.m3u8'));
  });
}

function makeThumbnail(input, outFile, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .seekInput(Math.min(1, duration / 2))
      .frames(1).size('640x?')
      .on('error', reject).on('end', resolve)
      .save(outFile);
  });
}

/**
 * Convert the uploaded source file of a VideoAsset into HLS renditions + thumbnail,
 * upload them through the storage adapter and mark the asset ready.
 */
async function processVideoAsset(assetId, { onProgress } = {}) {
  const asset = await VideoAsset.findById(assetId);
  if (!asset) throw new Error(`VideoAsset ${assetId} not found`);
  const storage = getStorage();
  const work = path.join(env.storage.tmpDir, `work-${assetId}`);
  const outRoot = path.join(work, 'out');

  asset.status = VIDEO_STATUS.PROCESSING; asset.progress = 1; asset.error = undefined; asset.attempts += 1;
  await asset.save();

  const setProgress = async (p) => {
    const value = Math.round(p);
    if (value > asset.progress) {
      asset.progress = value;
      await VideoAsset.updateOne({ _id: asset._id }, { progress: value });
      if (onProgress) await onProgress(value);
    }
  };

  try {
    await fs.rm(work, { recursive: true, force: true });
    await fs.mkdir(outRoot, { recursive: true });
    const source = path.join(work, `source${path.extname(asset.originalKey) || '.mp4'}`);
    if (!(await storage.stat(asset.originalKey))) throw new Error(`Source file missing in storage: ${asset.originalKey}`);
    await storage.downloadToFile(asset.originalKey, source);
    await setProgress(5);

    const meta = await probe(source);
    let rungs = LADDER.filter((r) => r.height <= meta.height + 8);
    if (!rungs.length) rungs = [{ name: `${meta.height}p`, height: meta.height, videoBitrate: 600 }];

    const renditions = [];
    for (let i = 0; i < rungs.length; i += 1) {
      const rung = rungs[i];
      const dir = path.join(outRoot, rung.name);
      await fs.mkdir(dir, { recursive: true });
      const base = 5 + (85 * i) / rungs.length;
      await encodeRendition(source, dir, rung, meta, (pct) => setProgress(base + (85 / rungs.length) * (pct / 100)));
      const width = Math.round((meta.width / meta.height) * rung.height / 2) * 2;
      renditions.push({ name: rung.name, width, height: rung.height, videoBitrate: rung.videoBitrate });
    }

    const master = ['#EXTM3U', '#EXT-X-VERSION:3'];
    for (const r of renditions) {
      master.push(`#EXT-X-STREAM-INF:BANDWIDTH=${(r.videoBitrate + 128) * 1000},RESOLUTION=${r.width}x${r.height}`, `${r.name}/index.m3u8`);
    }
    await fs.writeFile(path.join(outRoot, 'master.m3u8'), master.join('\n') + '\n');
    await makeThumbnail(source, path.join(outRoot, 'thumb.jpg'), meta.duration).catch((e) => logger.warn('Thumbnail failed', { error: e.message }));
    await setProgress(93);

    const prefix = `videos/${asset._id}`;
    await storage.putDir(outRoot, prefix);

    asset.status = VIDEO_STATUS.READY; asset.progress = 100; asset.processedAt = new Date();
    asset.hlsKey = `${prefix}/master.m3u8`;
    asset.thumbnailKey = (await fs.stat(path.join(outRoot, 'thumb.jpg')).then(() => true, () => false)) ? `${prefix}/thumb.jpg` : undefined;
    asset.renditions = renditions;
    asset.storageDriver = storage.driver;
    asset.metadata = { duration: meta.duration, width: meta.width, height: meta.height, videoCodec: meta.videoCodec, audioCodec: meta.audioCodec, bitrate: meta.bitrate, fps: meta.fps, format: meta.format };
    await asset.save();

    await Lesson.updateOne({ _id: asset.lesson }, { videoAsset: asset._id, duration: Math.round(meta.duration) });
    await recalcCourseTotals(asset.course);
    logger.info('Video processed', { assetId: String(asset._id), renditions: renditions.map((r) => r.name) });
    return asset;
  } finally {
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

async function recalcCourseTotals(courseId) {
  const lessons = await Lesson.find({ course: courseId }).select('duration');
  await Course.updateOne({ _id: courseId }, { lessonsCount: lessons.length, totalDuration: lessons.reduce((s, l) => s + (l.duration || 0), 0) });
}

module.exports = { processVideoAsset, probe, recalcCourseTotals, LADDER };
