'use strict';

/**
 * Leaf worker: ingest — write ORIGINAL gen files into content_media for target owner.
 */
const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function mimeFromName(name) {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.jpeg') || n.endsWith('.jpg')) return 'image/jpeg';
  if (n.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

async function run(brief, { parentJob, assertLease, heartbeat, idempotencyKey }) {
  const inputs = brief.inputs || {};
  const genDir = String(inputs.gen_dir || '').trim();
  const files = Array.isArray(inputs.files) ? inputs.files : [];
  const ownerUserId = Number(
    inputs.ownerUserId || parentJob?.target_owner_user_id || parentJob?.owner_user_id || 0
  );
  const albumSlug = String(inputs.album_slug || 'listing').replace(/[^a-z0-9а-я_-]+/gi, '-');

  if (parentJob?.id) {
    await require('../orchJobStore').assertJobActive(parentJob.id);
  }
  if (!genDir || !files.length || !ownerUserId) {
    return {
      status: 'failed',
      summary: 'ingest: need gen_dir, files[], ownerUserId',
      agent_id: 'ingest',
    };
  }

  let contentMediaStore;
  try {
    contentMediaStore = require('../contentMediaStore');
  } catch (e) {
    return { status: 'failed', summary: `ingest store: ${e.message}`, agent_id: 'ingest' };
  }

  // Mirror copies under listings album (human-friendly folder)
  const albumRel = path.join(
    'uploads',
    'content',
    'media',
    'owners',
    String(ownerUserId),
    'listings',
    albumSlug
  );
  const albumAbs = path.join(__dirname, '../..', albumRel);
  await fsp.mkdir(albumAbs, { recursive: true });

  const ingested = [];
  const errors = [];

  for (const item of files) {
    if (typeof heartbeat === 'function') await heartbeat();
    const fileName = typeof item === 'string' ? item : item.file;
    if (!fileName) continue;
    const abs = path.isAbsolute(fileName) ? fileName : path.join(genDir, fileName);
    if (!fs.existsSync(abs)) {
      errors.push({ file: fileName, error: 'missing' });
      continue;
    }
    try {
      const mirror = path.join(albumAbs, path.basename(fileName));
      await fsp.copyFile(abs, mirror);

      const tmp = path.join(
        os.tmpdir(),
        `listing-ingest-${crypto.randomUUID()}${path.extname(fileName)}`
      );
      await fsp.copyFile(abs, tmp);
      const st = await fsp.stat(tmp);
      const originalName = `${albumSlug}-${path.basename(fileName)}`;
      if (typeof assertLease === 'function') await assertLease();
      const { row, isDuplicate } = await contentMediaStore.ingestOneShotFromPath({
        tmpPath: tmp,
        originalName,
        mimeType: mimeFromName(fileName),
        size: st.size,
        authorAddress: 'listing-batch',
        pageId: null,
        ownerUserId,
        purpose: 'listing',
        forceOneShot: true,
        idempotencyKey: idempotencyKey
          ? `${idempotencyKey}:${path.basename(fileName)}`
          : null,
      });
      ingested.push({
        file: path.basename(fileName),
        media_id: row.id,
        public_id: row.public_id,
        url: contentMediaStore.publicFileUrl(row),
        isDuplicate: Boolean(isDuplicate),
        album_path: path.join(albumRel, path.basename(fileName)),
      });
      try {
        require('../orchFileRegistry').register({
          job_id: parentJob?.id || null,
          step_id: idempotencyKey || null,
          path: path.join(albumRel, path.basename(fileName)),
          kind: mimeFromName(fileName).startsWith('video/') ? 'video' : 'image',
          owner_user_id: ownerUserId,
          album_slug: albumSlug,
          media_id: row.id,
        });
      } catch {
        /* registry is diagnostic only */
      }
    } catch (e) {
      if (e?.code === 'STEP_LEASE_LOST' || e?.code === 'JOB_CANCELLED') throw e;
      errors.push({ file: fileName, error: e.message || String(e) });
    }
  }

  const ok = ingested.length > 0;
  return {
    status: ok ? (errors.length ? 'partial' : 'ok') : 'failed',
    summary: `ingest ${ingested.length}/${files.length} → owner ${ownerUserId}/${albumSlug}`,
    agent_id: 'ingest',
    data: {
      owner_user_id: ownerUserId,
      album_slug: albumSlug,
      album_dir: albumRel,
      items: ingested,
      errors,
    },
  };
}

module.exports = { run };
