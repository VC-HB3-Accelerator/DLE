/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Что ассистент кладёт в LLM из уже принятого сообщения.
 * SoT: docs.ru/back-docs/TZ_AI_ASSISTANT_INPUT_MODALITIES.ru.md
 */

function loadMediaLimits() {
  try {
    return require('/app/shared/mediaLimits');
  } catch (_) {
    return require('./mediaLimits');
  }
}

const { ATTACHMENT_KINDS, detectAttachmentKind } = loadMediaLimits();

const ACCEPT_INPUT_KEYS = Object.freeze(['text', 'file', 'video', 'audio']);

const DEFAULT_ACCEPT_INPUT = Object.freeze({
  text: true,
  file: true,
  video: true,
  audio: true
});

const FAIL_CLOSED_MEDIA = Object.freeze({
  text: true,
  file: false,
  video: false,
  audio: false
});

const PLACEHOLDER_RE = /^\[(audio|video|video_note|image|file)\]$/i;

function cloneDefaultAcceptInput() {
  return { ...DEFAULT_ACCEPT_INPUT };
}

function cloneFailClosedMedia() {
  return { ...FAIL_CLOSED_MEDIA };
}

function isUsableText(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return !PLACEHOLDER_RE.test(t);
}

function normalizeAcceptInput(raw) {
  const out = cloneDefaultAcceptInput();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const key of ACCEPT_INPUT_KEYS) {
    if (raw[key] === false) out[key] = false;
    else if (raw[key] === true) out[key] = true;
  }
  return out;
}

function parseAcceptInputForGenerate(raw) {
  if (raw == null) return cloneDefaultAcceptInput();
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch (_) {
      return cloneFailClosedMedia();
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return cloneFailClosedMedia();
  }
  return normalizeAcceptInput(value);
}

function validateAcceptInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'INVALID_ACCEPT_INPUT' };
  }
  const data = {};
  for (const key of ACCEPT_INPUT_KEYS) {
    if (typeof body[key] !== 'boolean') {
      return { ok: false, error: 'INVALID_ACCEPT_INPUT' };
    }
    data[key] = body[key];
  }
  return { ok: true, data };
}

function acceptKeyFromKind(kind) {
  const k = String(kind || '').trim().toLowerCase();
  if (!k) return 'text';
  if (k === ATTACHMENT_KINDS.AUDIO) return 'audio';
  if (k === ATTACHMENT_KINDS.VIDEO_NOTE) return 'video';
  return 'file';
}

function acceptKeyFromAttachment({ kind = '', mimetype = '', filename = '', hint = '' } = {}) {
  if (mimetype || filename) {
    return acceptKeyFromKind(detectAttachmentKind({ mimetype, filename, hint }));
  }
  if (kind) return acceptKeyFromKind(kind);
  return 'text';
}

function filterMediaForLlm({ accept, media, text } = {}) {
  const acc = normalizeAcceptInput(accept);
  const promptText = acc.text && isUsableText(text) ? String(text).trim() : '';

  let outMedia = null;
  let reason = null;
  if (media?.data) {
    const key = acceptKeyFromAttachment({
      kind: media.kind,
      mimetype: media.mimetype,
      filename: media.filename,
      hint: media.hint || media.attachment_kind || ''
    });
    if (acc[key] === false) {
      reason = 'operator_skip';
    } else {
      outMedia = media;
    }
  }

  const skipGenerate = !outMedia && (!acc.text || !promptText);
  if (skipGenerate && !reason) {
    reason = 'accept_input_skipped';
  }
  return { promptText, media: outMedia, skipGenerate, reason };
}

module.exports = {
  ACCEPT_INPUT_KEYS,
  DEFAULT_ACCEPT_INPUT,
  FAIL_CLOSED_MEDIA,
  cloneDefaultAcceptInput,
  cloneFailClosedMedia,
  normalizeAcceptInput,
  parseAcceptInputForGenerate,
  validateAcceptInput,
  acceptKeyFromKind,
  acceptKeyFromAttachment,
  filterMediaForLlm,
  isUsableText
};
