/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Сохранение аудиозаписи звонка ИИ в content_media + chat stub.
 * SoT: docs.ru/back-docs/TZ_CHAT_AI_VOICE_CALL_RECORDING.ru.md
 */

const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const db = require('../db');
const contentMediaStore = require('./contentMediaStore');
const settingsService = require('./voiceCallSettingsService');
const { writeCallStubSafe } = require('./voiceCallChatStubService');
const { normalizeWebGuestId, mediaAuthorAddress } = require('./voiceCallOwner');

function httpError(status, code, message) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function assertSessionOwner(row, owner) {
  if (!row || !owner) return false;
  if (owner.ownerType === 'user' && row.owner_type === 'user') {
    return Number(row.owner_user_id) === Number(owner.ownerUserId);
  }
  if (owner.ownerType === 'guest' && row.owner_type === 'guest') {
    return normalizeWebGuestId(row.owner_guest_id) === normalizeWebGuestId(owner.ownerGuestId);
  }
  return false;
}

async function saveSessionRecording({ sessionId, owner, file, transcript, authorAddress }) {
  if (!sessionId) throw httpError(400, 'SESSION_REQUIRED', 'Нет сессии');
  if (!owner) throw httpError(400, 'OWNER_REQUIRED', 'Нет владельца');
  if (!file?.buffer?.length && !file?.path) {
    throw httpError(400, 'FILE_REQUIRED', 'Нет файла записи');
  }

  const settings = await settingsService.getSettings();
  if (!settings.save_call_recording) {
    return { skipped: true, reason: 'disabled' };
  }

  const { rows } = await db.getQuery()(`SELECT * FROM ai_call_sessions WHERE id = $1`, [sessionId]);
  const row = rows[0];
  if (!row) throw httpError(404, 'SESSION_NOT_FOUND', 'Сессия не найдена');
  if (!assertSessionOwner(row, owner)) {
    throw httpError(403, 'FORBIDDEN', 'Чужая сессия');
  }
  if (row.recording_media_id) {
    const existing = await contentMediaStore.loadReadyMetaById(row.recording_media_id);
    return {
      media_id: row.recording_media_id,
      public_id: existing?.public_id || null,
      url: existing ? contentMediaStore.publicFileUrl(existing) : null,
      stub_written: false,
      duplicate: true
    };
  }

  const mimeType = String(file.mimetype || 'audio/webm').toLowerCase();
  const originalName = String(file.originalname || `voice-call-${sessionId}.webm`).slice(0, 180);
  let tmpPath = file.path || null;
  let createdTmp = false;
  if (!tmpPath) {
    tmpPath = path.join(os.tmpdir(), `voice-call-${sessionId}-${Date.now()}.webm`);
    await fsp.writeFile(tmpPath, file.buffer);
    createdTmp = true;
  }

  let mediaRow;
  try {
    const ingested = await contentMediaStore.ingestOneShotFromPath({
      tmpPath,
      originalName,
      mimeType,
      size: file.size || file.buffer?.length || 0,
      authorAddress: mediaAuthorAddress(owner, authorAddress),
      pageId: null
    });
    mediaRow = ingested.row;
  } finally {
    if (createdTmp) {
      try { await fsp.unlink(tmpPath); } catch (_) { /* ignore */ }
    }
  }

  const transcriptText = String(transcript || '').trim().slice(0, 20000) || null;
  await db.getQuery()(
    `UPDATE ai_call_sessions
     SET recording_media_id = $2,
         transcript_text = COALESCE($3, transcript_text),
         updated_at = NOW()
     WHERE id = $1`,
    [sessionId, mediaRow.id, transcriptText]
  );

  const refreshed = {
    ...row,
    recording_media_id: mediaRow.id,
    transcript_text: transcriptText || row.transcript_text || null
  };
  const url = contentMediaStore.publicFileUrl(mediaRow);
  await writeCallStubSafe(refreshed, {
    recording: {
      media_id: mediaRow.id,
      public_id: mediaRow.public_id,
      url,
      mime: mediaRow.mime_type || mimeType,
      filename: mediaRow.file_name || originalName,
      size: Number(mediaRow.file_size) || 0
    }
  });

  logger.info(`[voiceCall] recording saved session=${sessionId} media=${mediaRow.id}`);
  return {
    media_id: mediaRow.id,
    public_id: mediaRow.public_id,
    url,
    stub_written: true,
    duplicate: false
  };
}

module.exports = {
  saveSessionRecording,
  assertSessionOwner
};
