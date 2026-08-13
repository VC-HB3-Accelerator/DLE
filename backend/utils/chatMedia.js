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
  mediaPlaceholder,
  isMediaTooLarge
} = loadMediaLimits();

function mediaTooLargePayload(filename, size) {
  return {
    success: false,
    error: `Файл "${filename || 'attachment'}" превышает ${Math.round(MEDIA_MAX_BYTES / (1024 * 1024))} МБ`,
    code: 'MEDIA_TOO_LARGE',
    maxBytes: MEDIA_MAX_BYTES,
    size: Number(size) || 0
  };
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
  const kind = detectAttachmentKind({
    filename: name || file.filename,
    mimetype: file.mimetype,
    hint: kindHint
  });
  return {
    filename: name || file.filename || `${kind}.bin`,
    mimetype: file.mimetype || 'application/octet-stream',
    size,
    data: file.buffer,
    kind,
    placeholder: mediaPlaceholder(kind)
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
  chatUploadMiddleware,
  prepareChatAttachment,
  attachmentMetaFromRow,
  byteaToBuffer,
  contentTypeForKind,
  detectAttachmentKind,
  mediaPlaceholder
};
