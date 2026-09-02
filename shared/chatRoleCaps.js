/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Права ролей на типы сообщений чата.
 * SoT: docs.ru/back-docs/archive/TZ_USER_ROLES_CHAT_PERMISSIONS.ru.md
 */

function loadMediaLimits() {
  try {
    return require('/app/shared/mediaLimits');
  } catch (_) {
    return require('./mediaLimits');
  }
}

const { ATTACHMENT_KINDS, detectAttachmentKind } = loadMediaLimits();

const CHAT_CAP_KEYS = Object.freeze([
  'send_text',
  'send_file',
  'send_video',
  'send_audio',
  'send_call'
]);

const CHAT_CAP_ROLES = Object.freeze(['guest', 'user', 'readonly', 'editor']);

const DEFAULT_CHAT_CAPS = Object.freeze({
  send_text: true,
  send_file: true,
  send_video: true,
  send_audio: true,
  send_call: true
});

function cloneDefaultCaps() {
  return { ...DEFAULT_CHAT_CAPS };
}

function roleKeyForChatCaps(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'user') return 'user';
  if (r === 'readonly') return 'readonly';
  if (r === 'editor') return 'editor';
  return 'guest';
}

function requiredChatCap({ text = '', mimetype = '', filename = '', hint = '' } = {}) {
  const hasFile = Boolean(mimetype || filename);
  if (!hasFile) {
    return String(text || '').trim() ? 'send_text' : null;
  }
  const kind = detectAttachmentKind({ mimetype, filename, hint });
  if (kind === ATTACHMENT_KINDS.AUDIO) return 'send_audio';
  if (kind === ATTACHMENT_KINDS.VIDEO_NOTE) return 'send_video';
  return 'send_file';
}

function payloadFromUpload(req, textKeys = ['message', 'content']) {
  const file = (req.files && req.files[0]) || req.file || null;
  const body = req.body || {};
  let text = '';
  for (const key of textKeys) {
    if (body[key] != null && String(body[key]).length) {
      text = body[key];
      break;
    }
  }
  return {
    text,
    mimetype: file?.mimetype || '',
    filename: file?.originalname || file?.filename || '',
    hint: body.attachment_kind || ''
  };
}

function assertChatCap(caps, payload) {
  const cap = requiredChatCap(payload);
  if (!cap) return { ok: true, cap: null };
  if (caps && caps[cap] === false) return { ok: false, cap };
  return { ok: true, cap };
}

function normalizeCapRow(row) {
  const out = cloneDefaultCaps();
  if (!row || typeof row !== 'object') return out;
  for (const key of CHAT_CAP_KEYS) {
    if (row[key] === false) out[key] = false;
    else if (row[key] === true) out[key] = true;
  }
  return out;
}

function validateCapsMatrix(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'INVALID_CHAT_CAPS' };
  }
  const data = {};
  for (const role of CHAT_CAP_ROLES) {
    const block = body[role];
    if (!block || typeof block !== 'object') {
      return { ok: false, error: 'INVALID_CHAT_CAPS' };
    }
    const normalized = {};
    for (const key of CHAT_CAP_KEYS) {
      if (typeof block[key] !== 'boolean') {
        return { ok: false, error: 'INVALID_CHAT_CAPS' };
      }
      normalized[key] = block[key];
    }
    data[role] = normalized;
  }
  return { ok: true, data };
}

module.exports = {
  CHAT_CAP_KEYS,
  CHAT_CAP_ROLES,
  DEFAULT_CHAT_CAPS,
  cloneDefaultCaps,
  roleKeyForChatCaps,
  requiredChatCap,
  payloadFromUpload,
  assertChatCap,
  normalizeCapRow,
  validateCapsMatrix
};
