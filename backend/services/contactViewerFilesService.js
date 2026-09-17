/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Личные файлы зрителя к контакту (TZ_CRM_MULTI_LIST).
 */

const fs = require('fs');
const path = require('path');
const db = require('../db');
const logger = require('../utils/logger');

const UPLOAD_SUBDIR = 'contact-viewer-files';

let tablesReady = false;

function uploadsRoot() {
  return path.join(__dirname, '..', 'uploads', UPLOAD_SUBDIR);
}

function viewerContactDir(viewerUserId, contactUserId) {
  return path.join(uploadsRoot(), String(viewerUserId), String(contactUserId));
}

function inferMediaKind(mimeType = '') {
  const mime = String(mimeType).toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

async function ensureTables() {
  if (tablesReady) return;
  await db.getQuery()(`
    CREATE TABLE IF NOT EXISTS contact_viewer_files (
      id SERIAL PRIMARY KEY,
      viewer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      contact_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      stored_name TEXT NOT NULL,
      original_name TEXT,
      mime_type TEXT,
      media_kind TEXT,
      file_size BIGINT DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.getQuery()(`
    CREATE INDEX IF NOT EXISTS idx_contact_viewer_files_viewer_contact
      ON contact_viewer_files (viewer_user_id, contact_user_id)
  `);
  tablesReady = true;
}

function mapRow(row) {
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    mediaKind: row.media_kind,
    fileSize: Number(row.file_size) || 0,
    url: `/uploads/${UPLOAD_SUBDIR}/${row.viewer_user_id}/${row.contact_user_id}/${row.stored_name}`,
    createdAt: row.created_at,
  };
}

/**
 * @returns {Promise<Record<number, object[]>>}
 */
async function getFilesMapForViewer(viewerUserId, contactUserIds) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const ids = [...new Set((contactUserIds || []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const map = {};
  for (const id of ids) map[id] = [];
  if (!Number.isInteger(vid) || vid <= 0 || !ids.length) return map;

  const { rows } = await db.getQuery()(
    `SELECT id, viewer_user_id, contact_user_id, stored_name, original_name, mime_type, media_kind, file_size, created_at
     FROM contact_viewer_files
     WHERE viewer_user_id = $1 AND contact_user_id = ANY($2::int[])
     ORDER BY created_at DESC, id DESC`,
    [vid, ids]
  );
  for (const row of rows) {
    if (!map[row.contact_user_id]) map[row.contact_user_id] = [];
    map[row.contact_user_id].push(mapRow(row));
  }
  return map;
}

async function addFile(viewerUserId, contactUserId, file) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const cid = Number(contactUserId);
  if (!Number.isInteger(vid) || !Number.isInteger(cid) || !file?.filename) {
    throw new Error('Invalid file upload');
  }

  const mediaKind = inferMediaKind(file.mimetype);
  const result = await db.getQuery()(
    `INSERT INTO contact_viewer_files
       (viewer_user_id, contact_user_id, stored_name, original_name, mime_type, media_kind, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, viewer_user_id, contact_user_id, stored_name, original_name, mime_type, media_kind, file_size, created_at`,
    [
      vid,
      cid,
      file.filename,
      file.originalname || file.filename,
      file.mimetype || null,
      mediaKind,
      file.size || 0,
    ]
  );
  return mapRow(result.rows[0]);
}

async function deleteFile(viewerUserId, contactUserId, fileId) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const cid = Number(contactUserId);
  const fid = Number(fileId);
  const { rows } = await db.getQuery()(
    `SELECT id, stored_name FROM contact_viewer_files
     WHERE id = $1 AND viewer_user_id = $2 AND contact_user_id = $3`,
    [fid, vid, cid]
  );
  const row = rows[0];
  if (!row) return false;

  await db.getQuery()('DELETE FROM contact_viewer_files WHERE id = $1', [fid]);
  try {
    const p = path.join(viewerContactDir(vid, cid), row.stored_name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch (_) { /* */ }
  return true;
}

async function deleteAllForViewerContact(viewerUserId, contactUserId) {
  await ensureTables();
  const vid = Number(viewerUserId);
  const cid = Number(contactUserId);
  const { rows } = await db.getQuery()(
    `SELECT stored_name FROM contact_viewer_files
     WHERE viewer_user_id = $1 AND contact_user_id = $2`,
    [vid, cid]
  );
  await db.getQuery()(
    `DELETE FROM contact_viewer_files WHERE viewer_user_id = $1 AND contact_user_id = $2`,
    [vid, cid]
  );
  const dir = viewerContactDir(vid, cid);
  for (const r of rows) {
    try {
      const p = path.join(dir, r.stored_name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) { /* */ }
  }
  try {
    if (fs.existsSync(dir)) fs.rmdirSync(dir);
  } catch (_) { /* */ }
}

function initialize() {
  ensureTables().catch((e) => logger.warn('[contactViewerFiles] ensureTables:', e.message));
}

module.exports = {
  UPLOAD_SUBDIR,
  uploadsRoot,
  viewerContactDir,
  ensureTables,
  getFilesMapForViewer,
  addFile,
  deleteFile,
  deleteAllForViewerContact,
  initialize,
};
