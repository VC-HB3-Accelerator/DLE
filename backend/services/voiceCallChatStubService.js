/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Запись о звонке в чат/CRM: гость появляется в /contacts-list.
 */

const logger = require('../utils/logger');
const { normalizeWebGuestId } = require('./voiceCallOwner');

function formatCallStubText(row = {}) {
  const used = Math.max(0, Number(row.seconds_used || 0));
  const pack = Number(row.minutes || 0);
  const mm = Math.floor(used / 60);
  const ss = used % 60;
  if (!row.started_at) {
    return 'Попытка голосового звонка ИИ (соединение не состоялось).';
  }
  const time = mm > 0 ? `${mm} мин ${ss} сек` : `${ss} сек`;
  const packPart = pack ? `, пакет ${pack} мин` : '';
  return `Был голосовой звонок ИИ, ${time}${packPart}.`;
}

async function writeGuestStub(identifier, text, row) {
  const universalGuestService = require('./UniversalGuestService');
  await universalGuestService.saveAiResponse({
    identifier,
    content: text,
    channel: 'web',
    metadata: {
      kind: 'voice_call_stub',
      call_session_id: row.id,
      package_id: row.package_id || null,
      minutes: row.minutes,
      seconds_used: row.seconds_used,
      custom_name: 'Гость · звонок ИИ'
    }
  });
}

async function writeUserStub(userId, text, row) {
  const db = require('../db');
  const encryptionUtils = require('../utils/encryptionUtils');
  const conversationService = require('./conversationService');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const conversation = await conversationService.getOrCreateConversation(userId, 'Беседа');
  await db.getQuery()(
    `INSERT INTO messages (
      conversation_id, sender_id,
      sender_type_encrypted, content_encrypted, channel_encrypted,
      role_encrypted, direction_encrypted, message_type, user_id, role, direction, metadata, created_at
    ) VALUES (
      $1, $2,
      encrypt_text($3, $8), encrypt_text($4, $8), encrypt_text($5, $8),
      encrypt_text($6, $8), encrypt_text($7, $8),
      'system', $2, 'assistant', 'outgoing', $9::jsonb, NOW()
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
      JSON.stringify({ kind: 'voice_call_stub', call_session_id: row.id })
    ]
  );
}

async function writeCallStub(row) {
  if (!row || !row.id) return;
  const text = formatCallStubText(row);
  if (row.owner_type === 'user' && row.owner_user_id) {
    const settingsService = require('./voiceCallSettingsService');
    const settings = await settingsService.getSettings();
    if (!settings.write_call_stub_to_chat) return;
    await writeUserStub(Number(row.owner_user_id), text, row);
  } else {
    const guestId = normalizeWebGuestId(row.owner_guest_id);
    if (!guestId) return;
    await writeGuestStub(`web:${guestId}`, text, row);
  }
  try {
    const { broadcastContactsUpdate, broadcastMessagesUpdate } = require('../wsHub');
    broadcastContactsUpdate();
    broadcastMessagesUpdate();
  } catch (_) { /* ignore */ }
}

async function writeCallStubSafe(row) {
  try {
    await writeCallStub(row);
  } catch (error) {
    logger.warn('[voiceCall] chat stub:', error.message);
  }
}

module.exports = {
  formatCallStubText,
  writeCallStub,
  writeCallStubSafe
};
