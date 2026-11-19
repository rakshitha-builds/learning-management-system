const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const env = require('../../config/env');

// Local-disk implementation of the storage adapter interface (used for development; no AWS needed).
class LocalStorage {
  constructor(root = env.storage.localDir) { this.root = root; this.driver = 'local'; }

  resolve(key) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key');
    return full;
  }
  async putFile(localPath, key) {
    const dest = this.resolve(key);
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(localPath, dest);
    return key;
  }
  async putDir(localDir, prefix) {
    const walk = async (dir) => {
      for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) await walk(abs);
        else await this.putFile(abs, `${prefix}/${path.relative(localDir, abs).split(path.sep).join('/')}`);
      }
    };
    await walk(localDir);
  }
  async downloadToFile(key, destPath) {
    await fsp.mkdir(path.dirname(destPath), { recursive: true });
    await fsp.copyFile(this.resolve(key), destPath);
  }
  async stat(key) {
    try { const s = await fsp.stat(this.resolve(key)); return { size: s.size }; } catch { return null; }
  }
  createReadStream(key, range) { return fs.createReadStream(this.resolve(key), range); }
  async removePrefix(prefix) { await fsp.rm(this.resolve(prefix), { recursive: true, force: true }); }
  publicUrl(key) { return `${env.apiBaseUrl}/files/${key}`; }
}
module.exports = LocalStorage;
