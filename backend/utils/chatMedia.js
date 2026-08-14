/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Подготовка вложений чата: один файл, BYTEA, kind в metadata.
 */

const { fixUtf8Filename, fixMulterFile } = require('./utf8Filename');

function loadMediaLimits() {
  try {
    return require('/app/shared/mediaLimits');
  } catch (_) {
    return require('../../shared/mediaLimits');
  }
}

const {
  MEDIA_MAX_BYTES,
  ATTACHMENT_KINDS,
  detectAttachmentKind,
  sniffMimeFromBuffer,
  mediaPlaceholder,
  isMediaTooLarge
} = loadMediaLimits();

const MEDIA_UPLOAD_WINDOW_MS = 60 * 1000;
const MEDIA_UPLOAD_MAX = 30;
const mediaUploadBuckets = new Map();

function mediaTooLargePayload(filename, size) {
  return {
    success: false,
    error: `Файл "${filename || 'attachment'}" превышает ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} МБ`,
    code: 'MEDIA_TOO_LARGE',
    maxBytes: MEDIA_MAX_BYTES,
    size: Number(size) || 0
  };
}

/** Phase C: лимит только реальных медиа (после multer). Text-only FormData не считает. */
function chatMediaRateLimit(req, res, next) {
  const files = req.files;
  const count = Array.isArray(files) ? files.length : (files ? 1 : 0);
  if (!count) return next();

  const key = String(
    (req.session && (req.session.id || req.session.userId))
    || req.ip
    || 'anon'
  );
  const now = Date.now();
  let bucket = mediaUploadBuckets.get(key);
  if (!bucket || now - bucket.start >= MEDIA_UPLOAD_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    mediaUploadBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > MEDIA_UPLOAD_MAX) {
    return res.status(429).json({
      success: false,
      error: 'Слишком много загрузок медиа. Подождите минуту.',
      code: 'MEDIA_RATE_LIMIT',
      retryAfter: Math.ceil((MEDIA_UPLOAD_WINDOW_MS - (now - bucket.start)) / 1000)
    });
  }
  return next();
}

function chatUploadMiddleware(multerUpload) {
  return (req, res, next) => {
    multerUpload(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json(mediaTooLargePayload(err.field || 'attachment', MEDIA_MAX_BYTES + 1));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          success: false,
          error: 'Одно вложение на сообщение',
          code: 'MEDIA_ONE_ATTACHMENT'
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'Ошибка загрузки файла',
        code: 'MEDIA_UPLOAD_ERROR'
      });
    });
  };
}

function prepareChatAttachment(file, kindHint) {
  if (!file) return null;
  fixMulterFile(file);
  const size = Number(file.size || file.buffer?.length || 0);
  const name = fixUtf8Filename(file.originalname || file.filename || '');
  if (isMediaTooLarge(size)) {
    const err = new Error('MEDIA_TOO_LARGE');
    err.code = 'MEDIA_TOO_LARGE';
    err.payload = mediaTooLargePayload(name, size);
    throw err;
  }
  const sniffed = sniffMimeFromBuffer(file.buffer);
  const clientMime = String(file.mimetype || '').toLowerCase();
  // EBML/WebM magic общий для audio/webm и video/webm — не затирать client audio/*
  let mimetype = sniffed || file.mimetype || 'application/octet-stream';
  if (sniffed === 'video/webm' && clientMime.startsWith('audio/')) {
    mimetype = clientMime;
  }
  const kind = detectAttachmentKind({
    filename: name || file.filename,
    mimetype,
    hint: kindHint
  });
  return {
    filename: name || file.filename || `${kind}.bin`,
    mimetype,
    size,
    data: file.buffer,
    kind,
    placeholder: mediaPlaceholder(kind),
    mimeSniffed: Boolean(sniffed) && !(sniffed === 'video/webm' && clientMime.startsWith('audio/'))
  };
}

function attachmentMetaFromRow(row, { guest = false } = {}) {
  if (!row) return null;
  const hasFile = row.attachment_filename || row.attachment_mimetype || Number(row.attachment_size) > 0;
  if (!hasFile) return null;
  let kind = null;
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  if (typeof row.metadata === 'string') {
    try {
      Object.assign(meta, JSON.parse(row.metadata));
    } catch (_) { /* ignore */ }
  }
  kind = meta.attachment_kind || detectAttachmentKind({
    filename: row.attachment_filename,
    mimetype: row.attachment_mimetype
  });
  const id = row.id;
  const url = guest
    ? `/api/chat/guest-attachment/${id}`
    : `/api/chat/attachment/${id}`;
  return {
    originalname: row.attachment_filename,
    mimetype: row.attachment_mimetype,
    size: row.attachment_size,
    kind,
    url
  };
}

function byteaToBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
    if (/^[0-9a-fA-F]+$/.test(value) && value.length % 2 === 0) {
      return Buffer.from(value, 'hex');
    }
    return Buffer.from(value, 'binary');
  }
  return Buffer.from(value);
}

function contentTypeForKind(kind) {
  if (kind === ATTACHMENT_KINDS.VIDEO_NOTE || kind === ATTACHMENT_KINDS.VIDEO) return 'video';
  if (kind === ATTACHMENT_KINDS.AUDIO) return 'audio';
  if (kind === ATTACHMENT_KINDS.IMAGE) return 'image';
  if (kind === ATTACHMENT_KINDS.DOCUMENT) return 'document';
  return 'text';
}

module.exports = {
  MEDIA_MAX_BYTES,
  ATTACHMENT_KINDS,
  mediaTooLargePayload,
  chatMediaRateLimit,
  chatUploadMiddleware,
  prepareChatAttachment,
  attachmentMetaFromRow,
  byteaToBuffer,
  contentTypeForKind,
  detectAttachmentKind,
  sniffMimeFromBuffer,
  mediaPlaceholder
};
