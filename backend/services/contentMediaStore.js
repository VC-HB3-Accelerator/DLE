/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Склад CMS media: диск, чанки, DELETE, dual-read, короткий URL.
 * SoT: archive/TZ_CONTENT_MEDIA_CHUNKED_UPLOAD + archive/TZ_CONTENT_MEDIA_LIBRARY
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const limits = require('./contentMediaLimits');
const db = require('../db');

const META_COLUMNS = [
  'id', 'page_id', 'file_name', 'mime_type', 'file_size', 'file_hash',
  'media_type', 'alt_text', 'title', 'description', 'author_address',
  'created_at', 'updated_at', 'public_id', 'storage', 'file_path',
  'upload_id', 'status', 'expires_at'
].join(', ');

function backendRoot() {
  return path.join(__dirname, '..');
}

function uploadsContentRoot() {
  return path.join(backendRoot(), 'uploads', 'content');
}

function generatePublicId() {
  const bytes = crypto.randomBytes(limits.PUBLIC_ID_LENGTH);
  let id = '';
  for (let i = 0; i < limits.PUBLIC_ID_LENGTH; i++) {
    id += limits.PUBLIC_ID_ALPHABET[bytes[i] % limits.PUBLIC_ID_ALPHABET.length];
  }
  return id;
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
  return '';
}

function relMediaPath(uuid, ext) {
  const aa = uuid.slice(0, 2);
  const bb = uuid.slice(2, 4);
  return path.posix.join('uploads', 'content', 'media', aa, bb, `${uuid}${ext || ''}`);
}

function absFromRel(rel) {
  return path.resolve(backendRoot(), rel);
}

function assertSafeMediaAbs(abs) {
  const mediaRoot = path.resolve(uploadsContentRoot(), 'media');
  if (abs !== mediaRoot && !abs.startsWith(mediaRoot + path.sep)) {
    const err = new Error('unsafe media path');
    err.status = 404;
    throw err;
  }
  return abs;
}

function publicFileUrl(row) {
  if (row && row.public_id) return `/v/${row.public_id}`;
  if (row && row.id) return `/api/uploads/media/${row.id}/file`;
  return null;
}

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.payload = { success: false, code, message };
  return err;
}

async function uniquePublicId() {
  for (let i = 0; i < 8; i++) {
    const id = generatePublicId();
    const { rows } = await db.getQuery()(
      'SELECT 1 FROM content_media WHERE public_id = $1 LIMIT 1',
      [id]
    );
    if (!rows.length) return id;
  }
  throw httpError(500, 'PUBLIC_ID', 'Не удалось выдать public_id');
}

async function hashFile(absPath) {
  const hash = crypto.createHash('sha256');
  const rs = fs.createReadStream(absPath);
  for await (const chunk of rs) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function moveToFinal(tmpAbs, ext) {
  const uuid = crypto.randomUUID();
  const rel = relMediaPath(uuid, ext);
  const abs = absFromRel(rel);
  await ensureDir(path.dirname(abs));
  try {
    await fsp.rename(tmpAbs, abs);
  } catch (e) {
    if (e.code === 'EXDEV') {
      await fsp.copyFile(tmpAbs, abs);
      await fsp.unlink(tmpAbs).catch(() => {});
    } else {
      throw e;
    }
  }
  return { rel, abs };
}

async function unlinkQuiet(abs) {
  if (!abs) return;
  try {
    await fsp.unlink(abs);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[content-media] unlink:', e.message);
  }
}

async function rmDirQuiet(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('[content-media] rm:', e.message);
  }
}

async function findReadyByHash(fileHash) {
  if (!fileHash) return null;
  const { rows } = await db.getQuery()(
    `SELECT ${META_COLUMNS}
     FROM content_media
     WHERE file_hash = $1 AND (status IS NULL OR status = 'ready')
     ORDER BY id ASC
     LIMIT 1`,
    [fileHash]
  );
  return rows[0] || null;
}

function diskFileAlive(row) {
  if (!row || row.storage !== 'disk' || !row.file_path) return false;
  try {
    const abs = assertSafeMediaAbs(absFromRel(row.file_path));
    return fs.existsSync(abs);
  } catch {
    return false;
  }
}

function toListItem(row) {
  return {
    id: row.id,
    source: 'cms',
    page_id: row.page_id,
    file_name: row.file_name,
    mime_type: row.mime_type,
    file_size: row.file_size,
    file_hash: row.file_hash,
    media_type: row.media_type,
    alt_text: row.alt_text,
    title: row.title,
    description: row.description,
    author_address: row.author_address,
    created_at: row.created_at,
    updated_at: row.updated_at,
    public_id: row.public_id || null,
    storage: row.storage || 'bytea',
    status: row.status || 'ready',
    url: publicFileUrl(row),
  };
}

function mimeToMediaType(mimeType, contentType) {
  const mime = String(mimeType || '').toLowerCase();
  const ct = String(contentType || '').toLowerCase();
  if (mime.startsWith('image/') || ct === 'image') return 'image';
  if (mime.startsWith('video/') || ct === 'video') return 'video';
  if (mime.startsWith('audio/') || ct === 'audio') return 'audio';
  return 'file';
}

async function listMedia({ mediaType, pageId, q, limit, offset, scope = 'cms', source } = {}) {
  const take = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
  const skip = Math.max(parseInt(offset, 10) || 0, 0);
  const wantAll = String(scope) === 'all';
  const sourceFilter = source && ['cms', 'chat', 'guest'].includes(String(source))
    ? String(source)
    : null;

  // Пикер редактора / явный CMS: только content_media
  if (!wantAll || sourceFilter === 'cms') {
    const where = ['(status IS NULL OR status = \'ready\')'];
    const params = [];
    let i = 1;

    if (pageId) {
      where.push(`page_id = $${i++}`);
      params.push(parseInt(pageId, 10));
    }
    if (mediaType && ['image', 'video', 'audio', 'file'].includes(String(mediaType))) {
      if (mediaType === 'file') {
        where.push(`media_type NOT IN ('image','video','audio')`);
      } else {
        where.push(`media_type = $${i++}`);
        params.push(mediaType);
      }
    }
    if (q && String(q).trim()) {
      const needle = String(q).trim().slice(0, 100).replace(/[%_\\]/g, '\\$&');
      where.push(`file_name ILIKE $${i++} ESCAPE '\\'`);
      params.push(`%${needle}%`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    params.push(take, skip);
    const { rows } = await db.getQuery()(
      `SELECT ${META_COLUMNS}
       FROM content_media
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      params
    );
    const { rows: countRows } = await db.getQuery()(
      `SELECT COUNT(*)::int AS total FROM content_media ${whereSql}`,
      params.slice(0, -2)
    );
    return {
      data: rows.map(toListItem),
      total: countRows[0].total,
      limit: take,
      offset: skip,
    };
  }

  // Библиотека-очистка: CMS + чат + гости (без байтов в JSON)
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const params = [encryptionKey];
  let i = 2;
  const outerWhere = ['1=1'];

  if (sourceFilter) {
    outerWhere.push(`source = $${i++}`);
    params.push(sourceFilter);
  }
  if (mediaType && ['image', 'video', 'audio', 'file'].includes(String(mediaType))) {
    outerWhere.push(`media_type = $${i++}`);
    params.push(mediaType);
  }
  if (q && String(q).trim()) {
    const needle = String(q).trim().slice(0, 100).replace(/[%_\\]/g, '\\$&');
    outerWhere.push(`file_name ILIKE $${i++} ESCAPE '\\'`);
    params.push(`%${needle}%`);
  }

  const unionSql = `
    SELECT * FROM (
      SELECT
        id,
        'cms'::text AS source,
        file_name,
        mime_type,
        file_size::bigint AS file_size,
        media_type::text AS media_type,
        created_at,
        public_id,
        CASE
          WHEN public_id IS NOT NULL AND public_id <> '' THEN '/v/' || public_id
          ELSE '/api/uploads/media/' || id::text || '/file'
        END AS url
      FROM content_media
      WHERE (status IS NULL OR status = 'ready')

      UNION ALL

      SELECT
        id,
        'chat'::text AS source,
        COALESCE(NULLIF(attachment_filename, ''), 'attachment') AS file_name,
        COALESCE(attachment_mimetype, 'application/octet-stream') AS mime_type,
        COALESCE(attachment_size, 0)::bigint AS file_size,
        CASE
          WHEN COALESCE(attachment_mimetype, '') ILIKE 'image/%'
            OR COALESCE(attachment_filename, '') ~* '\\.(png|jpe?g|gif|webp|svg)$' THEN 'image'
          WHEN COALESCE(attachment_filename, '') ILIKE 'audio-%'
            OR COALESCE(attachment_mimetype, '') ILIKE 'audio/%' THEN 'audio'
          WHEN COALESCE(attachment_filename, '') ILIKE 'video-note%'
            OR COALESCE(attachment_mimetype, '') ILIKE 'video/%'
            OR COALESCE(attachment_filename, '') ~* '\\.(mp4|webm|ogg|mov|avi)$' THEN 'video'
          WHEN COALESCE(attachment_filename, '') ~* '\\.(mp3|wav|m4a|aac)$' THEN 'audio'
          ELSE 'file'
        END AS media_type,
        created_at,
        NULL::text AS public_id,
        '/api/uploads/media/chat/' || id::text || '/file' AS url
      FROM messages
      WHERE attachment_data IS NOT NULL
        AND COALESCE(attachment_size, 0) > 0

      UNION ALL

      SELECT
        id,
        'guest'::text AS source,
        COALESCE(NULLIF(decrypt_text(attachment_filename_encrypted, $1), ''), 'attachment') AS file_name,
        COALESCE(NULLIF(decrypt_text(attachment_mimetype_encrypted, $1), ''), 'application/octet-stream') AS mime_type,
        COALESCE(attachment_size, 0)::bigint AS file_size,
        CASE
          WHEN content_type IN ('image','video','audio') THEN content_type::text
          WHEN COALESCE(decrypt_text(attachment_mimetype_encrypted, $1), '') ILIKE 'image/%' THEN 'image'
          WHEN COALESCE(decrypt_text(attachment_filename_encrypted, $1), '') ILIKE 'audio-%'
            OR COALESCE(decrypt_text(attachment_mimetype_encrypted, $1), '') ILIKE 'audio/%' THEN 'audio'
          WHEN COALESCE(decrypt_text(attachment_filename_encrypted, $1), '') ILIKE 'video-note%'
            OR COALESCE(decrypt_text(attachment_mimetype_encrypted, $1), '') ILIKE 'video/%' THEN 'video'
          ELSE 'file'
        END AS media_type,
        created_at,
        NULL::text AS public_id,
        '/api/uploads/media/guest/' || id::text || '/file' AS url
      FROM unified_guest_messages
      WHERE attachment_data IS NOT NULL
        AND COALESCE(attachment_size, 0) > 0
    ) AS media_library
    WHERE ${outerWhere.join(' AND ')}
  `;

  const countParams = params.slice();
  const { rows: countRows } = await db.getQuery()(
    `SELECT COUNT(*)::int AS total FROM (${unionSql}) c`,
    countParams
  );

  params.push(take, skip);
  const { rows } = await db.getQuery()(
    `${unionSql}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    params
  );

  return {
    data: rows.map((row) => ({
      id: row.id,
      source: row.source,
      file_name: row.file_name,
      mime_type: row.mime_type,
      file_size: row.file_size,
      media_type: row.media_type,
      created_at: row.created_at,
      public_id: row.public_id || null,
      url: row.url,
    })),
    total: countRows[0].total,
    limit: take,
    offset: skip,
  };
}

async function unlinkIfOrphanHash(fileHash, filePath, storage) {
  if (!fileHash) {
    if (storage === 'disk' && filePath) {
      try { await unlinkQuiet(assertSafeMediaAbs(absFromRel(filePath))); } catch { /* ignore */ }
    }
    return;
  }
  const { rows } = await db.getQuery()(
    'SELECT COUNT(*)::int AS count FROM content_media WHERE file_hash = $1',
    [fileHash]
  );
  if (rows[0].count > 0) return;
  if (storage === 'disk' && filePath) {
    try { await unlinkQuiet(assertSafeMediaAbs(absFromRel(filePath))); } catch { /* ignore */ }
  }
}

async function deleteMediaById(mediaId) {
  const id = parseInt(mediaId, 10);
  if (!id) return { deleted: false };
  const { rows } = await db.getQuery()(
    `SELECT id, file_hash, storage, file_path, upload_id, status FROM content_media WHERE id = $1`,
    [id]
  );
  if (!rows.length) return { deleted: false };
  const row = rows[0];
  await db.getQuery()('DELETE FROM content_media WHERE id = $1', [id]);
  if (row.status === 'pending' && row.upload_id) {
    await rmDirQuiet(path.join(uploadsContentRoot(), 'tmp', String(row.upload_id)));
  }
  await unlinkIfOrphanHash(row.file_hash, row.file_path, row.storage);
  return { deleted: true };
}

/**
 * Удаление из медиатеки-очистки: CMS строка / байты вложения чата или гостя.
 * Сообщение не удаляется — только attachment_data (история с плейсхолдером остаётся).
 */
async function deleteLibraryItem(mediaId, source = 'cms') {
  const id = parseInt(mediaId, 10);
  if (!id) return { deleted: false };
  const src = String(source || 'cms');

  if (src === 'cms') {
    return deleteMediaById(id);
  }

  if (src === 'chat') {
    const { rowCount } = await db.getQuery()(
      `UPDATE messages
       SET attachment_data = NULL,
           attachment_filename = NULL,
           attachment_mimetype = NULL,
           attachment_size = NULL
       WHERE id = $1
         AND attachment_data IS NOT NULL`,
      [id]
    );
    return { deleted: rowCount > 0 };
  }

  if (src === 'guest') {
    const { rowCount } = await db.getQuery()(
      `UPDATE unified_guest_messages
       SET attachment_data = NULL,
           attachment_filename_encrypted = NULL,
           attachment_mimetype_encrypted = NULL,
           attachment_size = NULL
       WHERE id = $1
         AND attachment_data IS NOT NULL`,
      [id]
    );
    try {
      await db.getQuery()(
        `DELETE FROM media_files WHERE message_id = $1`,
        [id]
      );
    } catch (_) { /* таблица/строки опциональны */ }
    return { deleted: rowCount > 0 };
  }

  return { deleted: false };
}

async function streamChatAttachmentForEditor(req, res, { table, id }) {
  const encryptionUtils = require('../utils/encryptionUtils');
  const { byteaToBuffer } = require('../utils/chatMedia');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  let sql;
  let params;
  if (table === 'messages') {
    sql = `SELECT attachment_filename, attachment_mimetype, attachment_size, attachment_data
           FROM messages WHERE id = $1 AND attachment_data IS NOT NULL`;
    params = [id];
  } else {
    sql = `SELECT attachment_size, attachment_data,
                  decrypt_text(attachment_filename_encrypted, $2) AS attachment_filename,
                  decrypt_text(attachment_mimetype_encrypted, $2) AS attachment_mimetype
           FROM unified_guest_messages
           WHERE id = $1 AND attachment_data IS NOT NULL`;
    params = [id, encryptionKey];
  }
  const { rows } = await db.getQuery()(sql, params);
  const row = rows[0];
  if (!row || !row.attachment_data) {
    return res.status(404).json({ success: false, message: 'Вложение не найдено' });
  }
  const buf = byteaToBuffer(row.attachment_data);
  if (!buf || !buf.length) {
    return res.status(404).json({ success: false, message: 'Вложение не найдено' });
  }
  const filename = row.attachment_filename || 'attachment';
  const mime = row.attachment_mimetype || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.setHeader('Content-Length', String(buf.length));
  if (req.method === 'HEAD') return res.end();
  return res.end(buf);
}

function parseRange(rangeHeader, fileSize) {
  let start = 0;
  let end = fileSize - 1;
  let statusCode = 200;
  if (!rangeHeader || fileSize <= 0) {
    return { start, end, statusCode, contentLength: fileSize };
  }
  const parts = String(rangeHeader).replace(/bytes=/i, '').split('-');
  start = parseInt(parts[0], 10);
  end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  if (Number.isNaN(start) || start < 0 || start >= fileSize || end >= fileSize || end < start) {
    const err = new Error('range');
    err.status = 416;
    err.fileSize = fileSize;
    throw err;
  }
  statusCode = 206;
  return { start, end, statusCode, contentLength: end - start + 1 };
}

function setFileHeaders(res, { mimeType, fileName, fileSize, start, end, statusCode, contentLength }) {
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Length', contentLength);
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  const safeFileName = String(fileName || 'file')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '')
    .replace(/\r/g, '');
  const encodedFileName = encodeURIComponent(fileName || 'file');
  if (statusCode === 206) {
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`);
  }
}

function streamDiskToResponse(req, res, { filePath, mimeType, fileName, fileSize }) {
  let abs;
  try {
    abs = assertSafeMediaAbs(absFromRel(filePath));
  } catch {
    return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
  }
  if (!fs.existsSync(abs)) {
    return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
  }
  const statSize = Number(fileSize) || fs.statSync(abs).size;
  let range;
  try {
    range = parseRange(req.headers.range, statSize);
  } catch (e) {
    if (e.status === 416) {
      res.setHeader('Content-Range', `bytes */${statSize}`);
      return res.status(416).end();
    }
    throw e;
  }
  setFileHeaders(res, {
    mimeType,
    fileName,
    fileSize: statSize,
    start: range.start,
    end: range.end,
    statusCode: range.statusCode,
    contentLength: range.contentLength,
  });
  res.status(range.statusCode);
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(abs, { start: range.start, end: range.end });
  stream.on('error', (err) => {
    console.error('[content-media] stream:', err.message);
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });
  stream.pipe(res);
}

async function loadReadyMetaById(id) {
  const mediaId = parseInt(id, 10);
  if (!mediaId) return null;
  const { rows } = await db.getQuery()(
    `SELECT ${META_COLUMNS} FROM content_media WHERE id = $1`,
    [mediaId]
  );
  const row = rows[0];
  if (!row || (row.status && row.status !== 'ready')) return null;
  return row;
}

async function loadReadyMetaByPublicId(publicId) {
  const pid = String(publicId || '').trim();
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(pid)) return null;
  const { rows } = await db.getQuery()(
    `SELECT ${META_COLUMNS} FROM content_media WHERE public_id = $1`,
    [pid]
  );
  const row = rows[0];
  if (!row || (row.status && row.status !== 'ready')) return null;
  return row;
}

async function sendPublicFile(req, res) {
  try {
    const row = await loadReadyMetaByPublicId(req.params.publicId);
    if (!row) return res.status(404).json({ success: false, message: 'Медиа-файл не найден' });
    if (row.storage === 'disk' && row.file_path) {
      return streamDiskToResponse(req, res, {
        filePath: row.file_path,
        mimeType: row.mime_type,
        fileName: row.file_name,
        fileSize: parseInt(row.file_size, 10) || 0,
      });
    }
    return res.redirect(302, `/api/uploads/media/${row.id}/file`);
  } catch (e) {
    console.error('[content-media] /api/v:', e);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: e.message || 'Ошибка чтения файла' });
    }
  }
}

async function insertDiskRow({
  publicId,
  filePath,
  fileName,
  mimeType,
  fileSize,
  fileHash,
  mediaType,
  authorAddress,
  pageId,
  uploadId = null,
  status = 'ready',
  partsJson = null,
  expiresAt = null,
}) {
  const { rows } = await db.getQuery()(
    `INSERT INTO content_media (
       file_data, file_name, mime_type, file_size, file_hash, media_type,
       author_address, page_id, public_id, storage, file_path, upload_id,
       status, parts_json, expires_at
     ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, 'disk', $9, $10, $11, $12, $13)
     RETURNING ${META_COLUMNS}`,
    [
      fileName,
      mimeType,
      fileSize,
      fileHash,
      mediaType,
      authorAddress || null,
      pageId || null,
      publicId,
      filePath,
      uploadId,
      status,
      partsJson ? JSON.stringify(partsJson) : null,
      expiresAt,
    ]
  );
  return rows[0];
}

async function ingestOneShotFromPath({
  tmpPath,
  originalName,
  mimeType,
  size,
  authorAddress,
  pageId,
}) {
  const kind = limits.isAllowedCmsMime(mimeType, originalName);
  if (!kind) {
    await unlinkQuiet(tmpPath);
    throw httpError(400, 'UNSUPPORTED_TYPE', 'Разрешены изображения, видео и аудио указанных форматов');
  }
  const bytes = Number(size) || 0;
  const max = limits.maxBytesForKind(kind);
  if (bytes <= 0 || bytes > max) {
    await unlinkQuiet(tmpPath);
    throw httpError(413, 'MEDIA_TOO_LARGE', 'Файл слишком большой');
  }
  if (limits.shouldUseChunked(kind, bytes)) {
    await unlinkQuiet(tmpPath);
    throw httpError(413, 'USE_CHUNKED_UPLOAD', 'Для этого файла нужна загрузка частями');
  }

  const fileHash = await hashFile(tmpPath);
  const existing = await findReadyByHash(fileHash);
  if (existing) {
    await unlinkQuiet(tmpPath);
    return { row: existing, isDuplicate: true };
  }

  const ext = extFromName(originalName, mimeType);
  const moved = await moveToFinal(tmpPath, ext);
  const publicId = await uniquePublicId();
  try {
    const row = await insertDiskRow({
      publicId,
      filePath: moved.rel,
      fileName: originalName || 'unnamed',
      mimeType,
      fileSize: bytes,
      fileHash,
      mediaType: kind,
      authorAddress,
      pageId,
    });
    return { row, isDuplicate: false };
  } catch (e) {
    await unlinkQuiet(moved.abs);
    throw e;
  }
}

function tmpUploadDir(uploadId) {
  return path.join(uploadsContentRoot(), 'tmp', String(uploadId));
}

function partFileName(partNumber) {
  return `part-${String(partNumber).padStart(4, '0')}`;
}

async function initChunkedUpload({ fileName, mimeType, size, pageId, authorAddress }) {
  const kind = limits.isAllowedCmsMime(mimeType, fileName);
  if (!kind) {
    throw httpError(400, 'UNSUPPORTED_TYPE', 'Разрешены изображения, видео и аудио указанных форматов');
  }
  const bytes = Number(size) || 0;
  if (bytes <= 0) throw httpError(400, 'INVALID_SIZE', 'Некорректный размер файла');
  if (bytes > limits.maxBytesForKind(kind)) {
    throw httpError(413, 'MEDIA_TOO_LARGE', 'Файл слишком большой');
  }
  const totalParts = Math.ceil(bytes / limits.PART_SIZE);
  if (totalParts > limits.MAX_PARTS) {
    throw httpError(413, 'MEDIA_TOO_LARGE', 'Слишком много частей');
  }
  const uploadId = crypto.randomUUID();
  const publicId = await uniquePublicId();
  const expiresAt = new Date(Date.now() + limits.UPLOAD_TTL_MS);
  const partsJson = {
    totalParts,
    partSize: limits.PART_SIZE,
    size: bytes,
    mimeType,
    fileName: fileName || 'unnamed',
    received: {},
  };
  await ensureDir(tmpUploadDir(uploadId));
  const row = await insertDiskRow({
    publicId,
    filePath: path.posix.join('uploads', 'content', 'tmp', uploadId),
    fileName: fileName || 'unnamed',
    mimeType,
    fileSize: bytes,
    fileHash: null,
    mediaType: kind,
    authorAddress,
    pageId,
    uploadId,
    status: 'pending',
    partsJson,
    expiresAt,
  });
  return {
    uploadId,
    publicId,
    mediaId: row.id,
    partSize: limits.PART_SIZE,
    totalParts,
    status: 'pending',
  };
}

async function loadPendingByUploadId(uploadId) {
  const { rows } = await db.getQuery()(
    `SELECT ${META_COLUMNS}, parts_json FROM content_media WHERE upload_id = $1`,
    [String(uploadId || '')]
  );
  const row = rows[0];
  if (!row) throw httpError(404, 'UPLOAD_NOT_FOUND', 'Сессия загрузки не найдена');
  if (row.status !== 'pending') throw httpError(409, 'NOT_PENDING', 'Загрузка уже завершена или отменена');
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw httpError(409, 'EXPIRED', 'Сессия загрузки истекла');
  }
  return row;
}

async function putPart({ uploadId, partNumber, body }) {
  const row = await loadPendingByUploadId(uploadId);
  const meta = row.parts_json || {};
  const totalParts = Number(meta.totalParts) || 0;
  const n = parseInt(partNumber, 10);
  if (!n || n < 1 || n > totalParts) {
    throw httpError(400, 'BAD_PART', 'Некорректный номер части');
  }
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body || []);
  const expected = n === totalParts
    ? (Number(meta.size) - (totalParts - 1) * limits.PART_SIZE)
    : limits.PART_SIZE;
  if (buf.length > limits.PART_SIZE) {
    throw httpError(413, 'PART_TOO_LARGE', 'Часть больше 8 МиБ');
  }
  if (n === totalParts) {
    if (buf.length < 1 || buf.length > limits.PART_SIZE) {
      throw httpError(400, 'BAD_PART_SIZE', `Ожидался размер последней части 1…${limits.PART_SIZE}`);
    }
  } else if (buf.length !== expected) {
    throw httpError(400, 'BAD_PART_SIZE', `Ожидался размер части ${expected}`);
  }
  const dir = tmpUploadDir(uploadId);
  await ensureDir(dir);
  const partPath = path.join(dir, partFileName(n));
  await fsp.writeFile(partPath, buf);
  const etag = crypto.createHash('sha256').update(buf).digest('hex');
  const received = { ...(meta.received || {}) };
  received[String(n)] = { size: buf.length, etag };
  const next = { ...meta, received };
  await db.getQuery()(
    `UPDATE content_media SET parts_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [JSON.stringify(next), row.id]
  );
  return { partNumber: n, size: buf.length, etag };
}

function receivedList(meta, uploadId) {
  const diskReceived = [];
  const dir = tmpUploadDir(uploadId);
  const totalParts = Number(meta.totalParts) || 0;
  for (let i = 1; i <= totalParts; i++) {
    const p = path.join(dir, partFileName(i));
    if (fs.existsSync(p)) diskReceived.push(i);
  }
  return diskReceived;
}

async function getUploadStatus(uploadId) {
  const row = await loadPendingByUploadId(uploadId);
  const meta = row.parts_json || {};
  const received = receivedList(meta, uploadId);
  let bytesReceived = 0;
  for (const n of received) {
    const st = fs.statSync(path.join(tmpUploadDir(uploadId), partFileName(n)));
    bytesReceived += st.size;
  }
  return {
    status: row.status,
    received,
    bytesReceived,
    totalParts: Number(meta.totalParts) || 0,
    expiresAt: row.expires_at,
  };
}

async function concatParts(uploadId, totalParts, destAbs) {
  await ensureDir(path.dirname(destAbs));
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(destAbs);
  try {
    for (let i = 1; i <= totalParts; i++) {
      const partPath = path.join(tmpUploadDir(uploadId), partFileName(i));
      if (!fs.existsSync(partPath)) {
        throw httpError(409, 'MISSING_PART', `Нет части ${i}`);
      }
      await new Promise((resolve, reject) => {
        const rs = fs.createReadStream(partPath);
        rs.on('data', (chunk) => hash.update(chunk));
        rs.on('error', reject);
        rs.on('end', resolve);
        rs.pipe(out, { end: false });
      });
    }
    await new Promise((resolve, reject) => {
      out.end((err) => (err ? reject(err) : resolve()));
    });
  } catch (e) {
    out.destroy();
    await unlinkQuiet(destAbs);
    throw e;
  }
  return hash.digest('hex');
}

async function completeUpload(uploadId, clientParts) {
  const row = await loadPendingByUploadId(uploadId);
  const meta = row.parts_json || {};
  const totalParts = Number(meta.totalParts) || 0;
  const received = receivedList(meta, uploadId);
  if (received.length !== totalParts) {
    throw httpError(409, 'INCOMPLETE', 'Загружены не все части');
  }
  if (Array.isArray(clientParts) && clientParts.length) {
    for (const p of clientParts) {
      const rec = (meta.received || {})[String(p.partNumber)];
      if (p.etag && rec && rec.etag && p.etag !== rec.etag) {
        throw httpError(409, 'ETAG_MISMATCH', `Несовпадение etag части ${p.partNumber}`);
      }
    }
  }
  const ext = extFromName(meta.fileName || row.file_name, meta.mimeType || row.mime_type);
  const uuid = crypto.randomUUID();
  const rel = relMediaPath(uuid, ext);
  const abs = absFromRel(rel);
  const fileHash = await concatParts(uploadId, totalParts, abs);
  const stat = await fsp.stat(abs);
  if (Number(meta.size) && stat.size !== Number(meta.size)) {
    await unlinkQuiet(abs);
    throw httpError(409, 'SIZE_MISMATCH', 'Размер сборки не совпал');
  }

  const existing = await findReadyByHash(fileHash);
  if (existing && existing.id !== row.id) {
    await unlinkQuiet(abs);
    await rmDirQuiet(tmpUploadDir(uploadId));
    await db.getQuery()('DELETE FROM content_media WHERE id = $1', [row.id]);
    return { row: existing, isDuplicate: true };
  }

  await db.getQuery()(
    `UPDATE content_media SET
       file_hash = $1,
       file_size = $2,
       file_path = $3,
       storage = 'disk',
       file_data = NULL,
       status = 'ready',
       parts_json = NULL,
       expires_at = NULL,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [fileHash, stat.size, rel, row.id]
  );
  await rmDirQuiet(tmpUploadDir(uploadId));
  const { rows } = await db.getQuery()(
    `SELECT ${META_COLUMNS} FROM content_media WHERE id = $1`,
    [row.id]
  );
  return { row: rows[0], isDuplicate: false };
}

async function abortUpload(uploadId) {
  const { rows } = await db.getQuery()(
    `SELECT id, upload_id, status FROM content_media WHERE upload_id = $1`,
    [String(uploadId || '')]
  );
  if (!rows.length) return { aborted: false };
  const row = rows[0];
  await rmDirQuiet(tmpUploadDir(row.upload_id));
  await db.getQuery()('DELETE FROM content_media WHERE id = $1', [row.id]);
  return { aborted: true };
}

async function gcExpiredUploads() {
  let rows = [];
  try {
    const result = await db.getQuery()(
      `SELECT id, upload_id FROM content_media
       WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()`
    );
    rows = result.rows;
  } catch (e) {
    return { cleaned: 0 };
  }
  for (const row of rows) {
    try {
      await abortUpload(row.upload_id);
    } catch (e) {
      console.warn('[content-media] gc abort', row.upload_id, e.message);
    }
  }
  return { cleaned: rows.length };
}

function uploadResponse(row, extra = {}) {
  return {
    id: row.id,
    url: publicFileUrl(row),
    publicId: row.public_id || null,
    type: row.media_type,
    filename: row.file_name,
    originalName: row.file_name,
    mimeType: row.mime_type,
    size: row.file_size,
    hash: row.file_hash,
    ...extra,
  };
}

module.exports = {
  META_COLUMNS,
  generatePublicId,
  publicFileUrl,
  toListItem,
  listMedia,
  deleteMediaById,
  deleteLibraryItem,
  streamChatAttachmentForEditor,
  mimeToMediaType,
  streamDiskToResponse,
  loadReadyMetaById,
  loadReadyMetaByPublicId,
  sendPublicFile,
  ingestOneShotFromPath,
  initChunkedUpload,
  putPart,
  getUploadStatus,
  completeUpload,
  abortUpload,
  gcExpiredUploads,
  uploadResponse,
  httpError,
  parseRange,
};
