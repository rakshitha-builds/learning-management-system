const env = require('../../config/env');
const LocalStorage = require('./localStorage');

// Configurable storage adapter: STORAGE_DRIVER=local (default) | s3
let instance;
function getStorage() {
  if (!instance) {
    if (env.storage.driver === 's3') {
      const S3Storage = require('./s3Storage');
      instance = new S3Storage();
    } else {
      instance = new LocalStorage();
    }
  }
  return instance;
}
module.exports = { getStorage };
