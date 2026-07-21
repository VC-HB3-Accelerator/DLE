/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');

const UPLOAD_SUBDIR = 'contact-files';

function uploadsRoot() {
  return path.join(__dirname, '..', 'uploads', UPLOAD_SUBDIR);
}

function userUploadDir(userId) {
  return path.join(uploadsRoot(), String(userId));
}

function normalizeLink(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  return trimmed || null;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function inferMediaKind(mimeType = '') {
  const mime = String(mimeType).toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

async function getFilesMapForUserIds(userIds) {
  const ids = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  const map = {};
  if (!ids.length) return map;

  const result = await db.getQuery()(
    `SELECT id, user_id, stored_name, original_name, mime_type, media_kind, file_size, created_at
     FROM user_contact_files
     WHERE user_id = ANY($1::int[])
     ORDER BY created_at DESC, id DESC`,
    [ids]
  );

  for (const id of ids) {
    map[id] = [];
  }
  for (const row of result.rows) {
    map[row.user_id].push({
      id: row.id,
      originalName: row.original_name,
      mimeType: row.mime_type,
      mediaKind: row.media_kind,
      fileSize: Number(row.file_size) || 0,
      url: `/uploads/${UPLOAD_SUBDIR}/${row.user_id}/${row.stored_name}`,
      createdAt: row.created_at
    });
  }
  return map;
}

async function getContactExtrasMapForUserIds(userIds, encryptionKey) {
  const ids = [...new Set(userIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  const map = {};
  if (!ids.length) return map;

  const extrasResult = await db.getQuery()(
    `SELECT id,
      CASE WHEN comment_encrypted IS NULL OR comment_encrypted = '' THEN NULL
           ELSE decrypt_text(comment_encrypted, $2) END AS comment,
      CASE WHEN link_encrypted IS NULL OR link_encrypted = '' THEN NULL
           ELSE decrypt_text(link_encrypted, $2) END AS link
     FROM users
     WHERE id = ANY($1::int[])`,
    [ids, encryptionKey]
  );

  const filesMap = await getFilesMapForUserIds(ids);

  for (const id of ids) {
    map[id] = {
      comment: null,
      link: null,
      files: filesMap[id] || []
    };
  }

  for (const row of extrasResult.rows) {
    if (!map[row.id]) continue;
    map[row.id].comment = row.comment;
    map[row.id].link = row.link;
  }

  return map;
}

async function updateContactExtras(userId, payload, encryptionKey) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new Error('Invalid user ID');
  }

  const sets = [];
  const params = [];
  let idx = 1;

  if (Object.prototype.hasOwnProperty.call(payload, 'comment')) {
    const comment = payload.comment == null ? null : (String(payload.comment).trim() || null);
    sets.push(`comment_encrypted = CASE WHEN $${idx}::text IS NULL THEN NULL ELSE encrypt_text($${idx}, $${idx + 1}) END`);
    params.push(comment, encryptionKey);
    idx += 2;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'link')) {
    const link = normalizeLink(payload.link);
    if (link && !isValidHttpUrl(link)) {
      throw new Error('Invalid link URL');
    }
    sets.push(`link_encrypted = CASE WHEN $${idx}::text IS NULL THEN NULL ELSE encrypt_text($${idx}, $${idx + 1}) END`);
    params.push(link, encryptionKey);
    idx += 2;
  }

  if (!sets.length) {
    throw new Error('Нет данных для обновления');
  }

  params.push(uid);
  await db.getQuery()(`UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx}`, params);

  try {
    const userContextService = require('./userContextService');
    userContextService.invalidateUserCache(uid);
  } catch (_) {
    // ignore
  }
}

async function addFile(userId, file) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    throw new Error('Invalid user ID');
  }
  if (!file?.filename) {
    throw new Error('File missing');
  }

  const mediaKind = inferMediaKind(file.mimetype);
  const result = await db.getQuery()(
    `INSERT INTO user_contact_files (user_id, stored_name, original_name, mime_type, media_kind, file_size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, user_id, stored_name, original_name, mime_type, media_kind, file_size, created_at`,
    [
      uid,
      file.filename,
      file.originalname || file.filename,
      file.mimetype || null,
      mediaKind,
      file.size || 0
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    mediaKind: row.media_kind,
    fileSize: Number(row.file_size) || 0,
    url: `/uploads/${UPLOAD_SUBDIR}/${row.user_id}/${row.stored_name}`,
    createdAt: row.created_at
  };
}

async function deleteFile(userId, fileId) {
  const uid = Number(userId);
  const fid = Number(fileId);
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(fid) || fid <= 0) {
    throw new Error('Invalid id');
  }

  const row = (
    await db.getQuery()(
      'SELECT id, user_id, stored_name FROM user_contact_files WHERE id = $1 AND user_id = $2',
      [fid, uid]
    )
  ).rows[0];

  if (!row) return false;

  await db.getQuery()('DELETE FROM user_contact_files WHERE id = $1', [fid]);

  const diskPath = path.join(userUploadDir(uid), row.stored_name);
  try {
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  } catch {
    // ignore
  }
  return true;
}

async function deleteAllFilesForUser(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) return;

  const files = (
    await db.getQuery()('SELECT stored_name FROM user_contact_files WHERE user_id = $1', [uid])
  ).rows;

  await db.getQuery()('DELETE FROM user_contact_files WHERE user_id = $1', [uid]);

  const dir = userUploadDir(uid);
  for (const f of files) {
    try {
      const p = path.join(dir, f.stored_name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // ignore
    }
  }
  try {
    if (fs.existsSync(dir)) fs.rmdirSync(dir);
  } catch {
    // ignore
  }
}

module.exports = {
  UPLOAD_SUBDIR,
  uploadsRoot,
  userUploadDir,
  normalizeLink,
  isValidHttpUrl,
  getContactExtrasMapForUserIds,
  updateContactExtras,
  getFilesMapForUserIds,
  addFile,
  deleteFile,
  deleteAllFilesForUser
};
