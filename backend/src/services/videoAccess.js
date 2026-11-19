const { getSignedUrl } = require('@aws-sdk/cloudfront-signer');
const env = require('../config/env');
const { signMediaToken } = require('../utils/token');

/**
 * Builds a playback descriptor for the player.
 * - CloudFront (when configured): wildcard custom-policy signed URL covering all HLS files of the asset.
 *   The player appends `signedQuery` to every playlist/segment request.
 * - Otherwise: API-proxied streaming at /media/:token/* using a short-lived JWT scoped to ONE asset.
 */
function buildPlayback(asset, user) {
  if (env.features.cloudfront && asset.storageDriver === 's3') {
    const expires = Math.floor(Date.now() / 1000) + env.cloudfront.urlTtlSec;
    const resource = `https://${env.cloudfront.domain}/videos/${asset._id}/*`;
    const policy = JSON.stringify({ Statement: [{ Resource: resource, Condition: { DateLessThan: { 'AWS:EpochTime': expires } } }] });
    const signed = getSignedUrl({
      url: `https://${env.cloudfront.domain}/${asset.hlsKey}`,
      keyPairId: env.cloudfront.keyPairId, privateKey: env.cloudfront.privateKey, policy,
    });
    const [url, signedQuery] = signed.split('?');
    return { type: 'hls', provider: 'cloudfront', url: signed, baseUrl: url, signedQuery, expiresAt: new Date(expires * 1000).toISOString() };
  }
  const token = signMediaToken(asset._id, user._id);
  return {
    type: 'hls', provider: env.storage.driver === 's3' ? 's3-proxy' : 'local',
    url: `${env.apiBaseUrl}/media/${token}/master.m3u8`,
    expiresAt: new Date(Date.now() + env.mediaTokenTtlSec * 1000).toISOString(),
  };
}

module.exports = { buildPlayback };
