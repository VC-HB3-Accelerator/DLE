/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Запись о звонке в чат/CRM: гость появляется в /contacts-list.
 * Опционально: ссылка на аудио в медиатеке (recording.url).
 */

const logger = require('../utils/logger');
const { normalizeWebGuestId } = require('./voiceCallOwner');

function formatCallStubText(row = {}, recording = null) {
  const used = Math.max(0, Number(row.seconds_used || 0));
  const pack = Number(row.minutes || 0);
  const mm = Math.floor(used / 60);
  const ss = used % 60;
  let base;
  if (!row.started_at) {
    base = 'Попытка голосового звонка ИИ (соединение не состоялось).';
  } else {
    const time = mm > 0 ? `${mm} мин ${ss} сек` : `${ss} сек`;
    const packPart = pack ? `, пакет ${pack} мин` : '';
    base = `Был голосовой звонок ИИ, ${time}${packPart}.`;
  }
  if (recording?.url) {
    base += ' Запись сохранена в историю и медиатеку.';
  }
  const transcript = String(row.transcript_text || '').trim();
  if (transcript) {
    const short = transcript.length > 600 ? `${transcript.slice(0, 600)}…` : transcript;
    base += `\n\nКраткий текст разговора:\n${short}`;
  }
  return base;
}

function recordingMeta(recording, row) {
  if (!recording?.url) return {};
  return {
    recording_url: recording.url,
    recording_media_id: recording.media_id || null,
    recording_public_id: recording.public_id || null,
    recording_mime: recording.mime || 'audio/webm',
    recording_filename: recording.filename || `voice-call-${row.id}.webm`,
    recording_size: Number(recording.size) || 0,
    attachment_kind: 'audio'
  };
}

function recordingFromMeta(meta = {}, filename, mimetype, size) {
  if (!meta.recording_url && !meta.recording_public_id) return null;
  const url = meta.recording_url || (meta.recording_public_id ? `/v/${meta.recording_public_id}` : null);
  if (!url) return null;
  return {
    url,
    media_id: meta.recording_media_id || null,
    public_id: meta.recording_public_id || null,
    mime: meta.recording_mime || mimetype || 'audio/webm',
    filename: meta.recording_filename || filename,
    size: Number(meta.recording_size || size) || 0
  };
}

async function loadRecordingFromSessionRow(row) {
  if (!row?.recording_media_id) return null;
  const contentMediaStore = require('./contentMediaStore');
  const existing = await contentMediaStore.loadReadyMetaById(row.recording_media_id);
  if (!existing) return null;
  return {
    media_id: existing.id,
    public_id: existing.public_id,
    url: contentMediaStore.publicFileUrl(existing),
    mime: existing.mime_type || 'audio/webm',
    filename: existing.file_name,
    size: Number(existing.file_size) || 0
  };
}

function parseStubMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw) || {}; } catch (_) { return {}; }
}

async function findExistingUserStub(userId, sessionId) {
  const db = require('../db');
  const { rows } = await db.getQuery()(
    `SELECT id FROM messages
     WHERE user_id = $1
       AND metadata->>'kind' = 'voice_call_stub'
       AND metadata->>'call_session_id' = $2
     ORDER BY id DESC LIMIT 1`,
    [userId, String(sessionId)]
  );
  return rows[0] || null;
}

async function findExistingGuestStub(identifier, sessionId) {
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT id FROM unified_guest_messages
     WHERE decrypt_text(identifier_encrypted, $1) = $2
       AND metadata->>'kind' = 'voice_call_stub'
       AND metadata->>'call_session_id' = $3
     ORDER BY id DESC LIMIT 1`,
    [encryptionKey, identifier, String(sessionId)]
  );
  return rows[0] || null;
}

async function writeGuestStub(identifier, text, row, recording) {
  const universalGuestService = require('./UniversalGuestService');
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const existing = await findExistingGuestStub(identifier, row.id);
  if (existing && !recording?.url) {
    const prev = await db.getQuery()(
      `SELECT metadata,
              decrypt_text(attachment_filename_encrypted, $2) AS attachment_filename,
              decrypt_text(attachment_mimetype_encrypted, $2) AS attachment_mimetype,
              attachment_size
       FROM unified_guest_messages WHERE id = $1`,
      [existing.id, encryptionKey]
    );
    recording = recordingFromMeta(
      parseStubMetadata(prev.rows[0]?.metadata),
      prev.rows[0]?.attachment_filename,
      prev.rows[0]?.attachment_mimetype,
      prev.rows[0]?.attachment_size
    ) || recording;
  }
  const meta = {
    kind: 'voice_call_stub',
    call_session_id: row.id,
    package_id: row.package_id || null,
    minutes: row.minutes,
    seconds_used: row.seconds_used,
    custom_name: 'Гость · звонок ИИ',
    ...recordingMeta(recording, row)
  };
  const filename = recording?.filename || null;
  const mimetype = recording?.mime || null;
  const size = recording?.size || null;

  if (existing) {
    await db.getQuery()(
      `UPDATE unified_guest_messages SET
         content_encrypted = encrypt_text($2, $6),
         metadata = $3::jsonb,
         attachment_filename_encrypted = encrypt_text($4, $6),
         attachment_mimetype_encrypted = encrypt_text($5, $6),
         attachment_size = $7,
         content_type = CASE WHEN $5 IS NOT NULL AND $5 <> '' THEN 'audio' ELSE content_type END
       WHERE id = $1`,
      [
        existing.id,
        text,
        JSON.stringify(meta),
        filename || '',
        mimetype || '',
        encryptionKey,
        size
      ]
    );
    return;
  }

  await universalGuestService.saveAiResponse({
    identifier,
    content: text,
    channel: 'web',
    metadata: meta,
    attachments: recording?.url
      ? [{
        filename: filename || `voice-call-${row.id}.webm`,
        mimetype: mimetype || 'audio/webm',
        size: size || 0,
        kind: 'audio'
      }]
      : []
  });
}

async function writeUserStub(userId, text, row, recording) {
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const conversationService = require('./conversationService');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const existing = await findExistingUserStub(userId, row.id);
  if (existing && !recording?.url) {
    const prev = await db.getQuery()(
      `SELECT metadata, attachment_filename, attachment_mimetype, attachment_size
       FROM messages WHERE id = $1`,
      [existing.id]
    );
    recording = recordingFromMeta(
      parseStubMetadata(prev.rows[0]?.metadata),
      prev.rows[0]?.attachment_filename,
      prev.rows[0]?.attachment_mimetype,
      prev.rows[0]?.attachment_size
    ) || recording;
  }
  const meta = {
    kind: 'voice_call_stub',
    call_session_id: row.id,
    ...recordingMeta(recording, row)
  };
  const filename = recording?.filename || null;
  const mimetype = recording?.mime || null;
  const size = recording?.size || null;

  if (existing) {
    await db.getQuery()(
      `UPDATE messages SET
         content_encrypted = encrypt_text($2, $6),
         metadata = $3::jsonb,
         attachment_filename = $4,
         attachment_mimetype = $5,
         attachment_size = $7
       WHERE id = $1`,
      [existing.id, text, JSON.stringify(meta), filename, mimetype, encryptionKey, size]
    );
    return;
  }

  const conversation = await conversationService.getOrCreateConversation(userId, 'Беседа');
  await db.getQuery()(
    `INSERT INTO messages (
      conversation_id, sender_id,
      sender_type_encrypted, content_encrypted, channel_encrypted,
      role_encrypted, direction_encrypted, message_type, user_id, role, direction,
      metadata, attachment_filename, attachment_mimetype, attachment_size, created_at
    ) VALUES (
      $1, $2,
      encrypt_text($3, $8), encrypt_text($4, $8), encrypt_text($5, $8),
      encrypt_text($6, $8), encrypt_text($7, $8),
      'system', $2, 'assistant', 'outgoing', $9::jsonb, $10, $11, $12, NOW()
    )`,
    [
      conversation.id,
      userId,
      'assistant',
      text,
      'web',
      'assistant',
      'outgoing',
      encryptionKey,
      JSON.stringify(meta),
      filename,
      mimetype,
      size
    ]
  );
}

async function writeCallStub(row, options = {}) {
  if (!row || !row.id) return;
  let recording = options.recording || null;
  if (!recording?.url) {
    recording = await loadRecordingFromSessionRow(row);
  }
  const text = formatCallStubText(row, recording);
  if (row.owner_type === 'user' && row.owner_user_id) {
    const settingsService = require('./voiceCallSettingsService');
    const settings = await settingsService.getSettings();
    // С записью всегда пишем в чат user; без записи — по галочке stub
    if (!recording && !settings.write_call_stub_to_chat) return;
    await writeUserStub(Number(row.owner_user_id), text, row, recording);
  } else {
    const guestId = normalizeWebGuestId(row.owner_guest_id);
    if (!guestId) return;
    await writeGuestStub(`web:${guestId}`, text, row, recording);
  }
  try {
    const { broadcastContactsUpdate, broadcastMessagesUpdate } = require('../wsHub');
    broadcastContactsUpdate();
    broadcastMessagesUpdate();
  } catch (_) { /* ignore */ }
}

async function writeCallStubSafe(row, options = {}) {
  try {
    await writeCallStub(row, options);
  } catch (error) {
    logger.warn('[voiceCall] chat stub:', error.message);
  }
}

module.exports = {
  formatCallStubText,
  writeCallStub,
  writeCallStubSafe
};
