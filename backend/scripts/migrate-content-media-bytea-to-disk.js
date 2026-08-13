/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * M4: content_media BYTEA → диск (батч, не в HTTP request).
 * Старые URL /api/uploads/media/:id/file остаются (dual-read).
 *
 * Запуск внутри backend-контейнера:
 *   node scripts/migrate-content-media-bytea-to-disk.js
 *   node scripts/migrate-content-media-bytea-to-disk.js --dry-run
 *   node scripts/migrate-content-media-bytea-to-disk.js --limit=2
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const limits = require('../shared/contentMediaLimits');

const CHUNK = 1024 * 1024; // 1 MiB hex-export chunks
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? Math.max(1, parseInt(limitArg.split('=')[1], 10) || 0) : 0;

function backendRoot() {
  return path.join(__dirname, '..');
}

function generatePublicId() {
  const bytes = crypto.randomBytes(limits.PUBLIC_ID_LENGTH);
  let id = '';
  for (let i = 0; i < limits.PUBLIC_ID_LENGTH; i++) {
    id += limits.PUBLIC_ID_ALPHABET[bytes[i] % limits.PUBLIC_ID_ALPHABET.length];
  }
  return id;
}

async function uniquePublicId() {
  for (let i = 0; i < 20; i++) {
    const id = generatePublicId();
    const { rows } = await db.getQuery()(
      'SELECT 1 FROM content_media WHERE public_id = $1 LIMIT 1',
      [id]
    );
    if (!rows.length) return id;
  }
  throw new Error('cannot allocate public_id');
}

function extFromName(fileName, mimeType) {
  const fromName = path.extname(String(fileName || '')).toLowerCase();
  if (fromName && fromName.length <= 8 && /^\.[a-z0-9.]+$/i.test(fromName)) return fromName;
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('png')) return '.png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('svg')) return '.svg';
  if (mime.includes('webm')) return '.webm';
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('quicktime')) return '.mov';
  if (mime.includes('ogg')) return '.ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
  if (mime.includes('wav')) return '.wav';
  if (mime.includes('aac') || mime.includes('m4a')) return '.m4a';
  return '.bin';
}

function relMediaPath(uuid, ext) {
  const aa = uuid.slice(0, 2);
  const bb = uuid.slice(2, 4);
  return path.posix.join('uploads', 'content', 'media', aa, bb, `${uuid}${ext || ''}`);
}

function absFromRel(rel) {
  return path.resolve(backendRoot(), rel);
}

async function exportByteaToFile(mediaId, absPath, expectedSize) {
  await fsp.mkdir(path.dirname(absPath), { recursive: true });
  const tmp = `${absPath}.migrating`;
  const out = fs.createWriteStream(tmp);
  const hash = crypto.createHash('sha256');
  let written = 0;
  let offset = 1; // Postgres substring 1-based

  try {
    for (;;) {
      const { rows } = await db.getQuery()(
        `SELECT encode(substring(file_data FROM $1 FOR $2), 'hex') AS chunk_hex
         FROM content_media WHERE id = $3 AND file_data IS NOT NULL`,
        [offset, CHUNK, mediaId]
      );
      const hex = rows[0] && rows[0].chunk_hex;
      if (!hex) break;
      const buf = Buffer.from(hex, 'hex');
      if (!buf.length) break;
      hash.update(buf);
      await new Promise((resolve, reject) => {
        out.write(buf, (err) => (err ? reject(err) : resolve()));
      });
      written += buf.length;
      offset += buf.length;
      if (expectedSize && written >= Number(expectedSize)) break;
    }
    await new Promise((resolve, reject) => {
      out.end((err) => (err ? reject(err) : resolve()));
    });
  } catch (e) {
    out.destroy();
    try { await fsp.unlink(tmp); } catch (_) { /* ignore */ }
    throw e;
  }

  if (expectedSize && Number(expectedSize) > 0 && written !== Number(expectedSize)) {
    try { await fsp.unlink(tmp); } catch (_) { /* ignore */ }
    throw new Error(`size mismatch id=${mediaId}: wrote ${written}, expected ${expectedSize}`);
  }
  await fsp.rename(tmp, absPath);
  return { written, fileHash: hash.digest('hex') };
}

async function migrateOne(row) {
  const id = row.id;
  const publicId = row.public_id || await uniquePublicId();
  const ext = extFromName(row.file_name, row.mime_type);
  const uuid = crypto.randomUUID();
  const rel = relMediaPath(uuid, ext);
  const abs = absFromRel(rel);

  console.log(`[M4] id=${id} ${(Number(row.file_size) / 1024 / 1024).toFixed(1)} MiB → ${rel}`);

  if (DRY) {
    console.log(`[M4] dry-run skip write id=${id}`);
    return { id, dry: true };
  }

  const { written, fileHash } = await exportByteaToFile(id, abs, row.file_size);
  const st = await fsp.stat(abs);
  if (st.size !== written) {
    try { await fsp.unlink(abs); } catch (_) { /* ignore */ }
    throw new Error(`stat mismatch id=${id}`);
  }

  await db.getQuery()(
    `UPDATE content_media SET
       storage = 'disk',
       file_path = $1,
       public_id = COALESCE(NULLIF(public_id, ''), $2),
       file_hash = COALESCE(NULLIF(file_hash, ''), $3),
       file_size = $4,
       file_data = NULL,
       status = COALESCE(status, 'ready'),
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $5 AND file_data IS NOT NULL`,
    [rel, publicId, fileHash, written, id]
  );

  const check = await db.getQuery()(
    `SELECT storage, file_path, public_id, (file_data IS NOT NULL) AS has_bytea, file_size
     FROM content_media WHERE id = $1`,
    [id]
  );
  const after = check.rows[0];
  if (!after || after.has_bytea || after.storage !== 'disk' || !after.file_path) {
    throw new Error(`update verify failed id=${id}`);
  }
  console.log(`[M4] OK id=${id} public_id=${after.public_id} bytes=${written}`);
  return { id, publicId: after.public_id, written };
}

(async () => {
  console.log(`[M4] start dry=${DRY} limit=${LIMIT || 'all'}`);
  let sql = `
    SELECT id, file_name, mime_type, file_size, file_hash, public_id, storage
    FROM content_media
    WHERE file_data IS NOT NULL
    ORDER BY id ASC`;
  if (LIMIT) sql += ` LIMIT ${LIMIT}`;

  const { rows } = await db.getQuery()(sql);
  console.log(`[M4] candidates=${rows.length}`);
  if (!rows.length) {
    console.log('[M4] nothing to migrate');
    process.exit(0);
  }

  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    try {
      await migrateOne(row);
      ok += 1;
    } catch (e) {
      fail += 1;
      console.error(`[M4] FAIL id=${row.id}:`, e.message || e);
    }
  }

  const summary = await db.getQuery()(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE file_data IS NOT NULL)::int AS with_bytea,
      COUNT(*) FILTER (WHERE storage = 'disk')::int AS disk
    FROM content_media
  `);
  console.log('[M4] summary', summary.rows[0], { ok, fail });
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('[M4] fatal', e);
  process.exit(1);
});
