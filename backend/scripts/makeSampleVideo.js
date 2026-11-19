// Generates a small synthetic test video (colour bars + tone) with FFmpeg. No downloads needed.
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

function makeSampleVideo(outFile, { seconds = 6, size = '1280x720' } = {}) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`testsrc=size=${size}:rate=24`).inputFormat('lavfi')
      .input('sine=frequency=440:sample_rate=44100').inputFormat('lavfi')
      .duration(seconds)
      .videoCodec('libx264').audioCodec('aac')
      .outputOptions(['-pix_fmt yuv420p', '-preset ultrafast', '-shortest'])
      .on('error', reject).on('end', () => resolve(outFile))
      .save(outFile);
  });
}

module.exports = { makeSampleVideo };

if (require.main === module) {
  const out = process.argv[2] || path.join(__dirname, '../tmp/sample.mp4');
  makeSampleVideo(out).then((f) => console.log('Created', f)).catch((e) => { console.error(e.message); process.exit(1); });
}
