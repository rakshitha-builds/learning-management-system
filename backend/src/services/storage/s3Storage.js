const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { pipeline } = require('stream/promises');
const env = require('../../config/env');
const contentType = require('./mime');

// AWS S3 implementation. Requires real credentials - never used unless STORAGE_DRIVER=s3.
class S3Storage {
  constructor() {
    this.driver = 's3';
    this.bucket = env.s3.bucket;
    this.client = new S3Client({
      region: env.s3.region,
      credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
    });
  }
  async putFile(localPath, key) {
    const upload = new Upload({
      client: this.client,
      params: { Bucket: this.bucket, Key: key, Body: fs.createReadStream(localPath), ContentType: contentType(key) },
    });
    await upload.done();
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
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    await pipeline(res.Body, fs.createWriteStream(destPath));
  }
  async stat(key) {
    try {
      const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: r.ContentLength };
    } catch { return null; }
  }
  // Returns a Promise<stream>; callers of createReadStream on S3 must await it (see mediaController).
  async createReadStream(key, range) {
    const Range = range ? `bytes=${range.start}-${range.end}` : undefined;
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range }));
    return res.Body;
  }
  async removePrefix(prefix) {
    let token;
    do {
      const list = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      if (list.Contents?.length) {
        await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: list.Contents.map((o) => ({ Key: o.Key })) } }));
      }
      token = list.NextContinuationToken;
    } while (token);
  }
  publicUrl(key) {
    if (env.cloudfront.domain) return `https://${env.cloudfront.domain}/${key}`;
    return `https://${this.bucket}.s3.${env.s3.region}.amazonaws.com/${key}`;
  }
}
module.exports = S3Storage;
