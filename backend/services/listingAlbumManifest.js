'use strict';

const fs = require('fs');
const path = require('path');

function nowIso() {
  return new Date().toISOString();
}

function buildAlbumManifest({
  job,
  target,
  critic,
  acceptor,
  video,
} = {}) {
  const files = Array.isArray(target?.gen_files) ? target.gen_files : [];
  const verdicts = Array.isArray(critic?.results) ? critic.results : [];
  const slots = files.map((file, index) => {
    const name = typeof file === 'string' ? file : file.file;
    const verdict = verdicts.find((item) => item.file === name) || {};
    return {
      slot: index + 1,
      angle: verdict.angle || (typeof file === 'object' ? file.angle : null),
      file: name,
      source_kind: 'generated',
      critic: {
        pass: verdict.pass === true,
        score: verdict.score ?? null,
        reasons: verdict.reasons || [],
      },
    };
  });
  const photosOk = slots.filter((slot) => slot.critic.pass).length;
  const videoFile = video?.file || video?.data?.file || null;
  let status = 'partial_generated';
  if (acceptor?.accepted === true && photosOk >= 8 && videoFile) status = 'ready_generated';
  else if (acceptor?.accepted === true && photosOk >= 8) status = 'photos_ready';
  else if (target?.status === 'failed' || acceptor?.accepted === false) status = 'failed';
  else if (target?.status === 'blocked_ask' || target?.status === 'waiting_video') {
    status = 'blocked_ask';
  }

  return {
    album_slug: target?.album_slug || null,
    brand: target?.brand || null,
    model: target?.model || null,
    target_owner_user_id: job?.target_owner_user_id || null,
    package: {
      photos_wanted: 8,
      photos_ok: photosOk,
      video: Boolean(videoFile),
    },
    status,
    slots,
    video: videoFile
      ? {
        file: videoFile,
        source_kind: video?.source_kind || 'generated',
        source_url: video?.url || video?.data?.url || null,
      }
      : null,
    publish_allowed: false,
    updated_at: nowIso(),
  };
}

function writeAlbumManifest(albumAbs, manifest) {
  if (!albumAbs) return null;
  fs.mkdirSync(albumAbs, { recursive: true });
  const dest = path.join(albumAbs, 'manifest.json');
  fs.writeFileSync(dest, JSON.stringify(manifest, null, 2));
  return dest;
}

module.exports = {
  buildAlbumManifest,
  writeAlbumManifest,
};
