/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Чистые правила TZ_CHAT_SYSTEM.ru.md — без БД/HTTP.
 */

function normalizeNumericUserId(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Тип сообщения без forcePrivate.
 * Приват НЕ выводится из recipientId===1 (чат на карточке редактора = public).
 */
function determineMessageType(recipientId, userId) {
  const recipientNum = normalizeNumericUserId(recipientId);
  const senderNum = normalizeNumericUserId(userId);

  if (!recipientNum || (senderNum && recipientNum === senderNum)) {
    return 'user_chat';
  }
  return 'public';
}

/**
 * Итоговый тип: приват только при явном forcePrivate (кнопка / Ответить → private/send).
 */
function resolveChatMessageType({ recipientId, userId, forcePrivate = false } = {}) {
  if (forcePrivate) return 'admin_chat';
  return determineMessageType(recipientId, userId);
}

function determineConversationType(messageType) {
  switch (messageType) {
    case 'user_chat':
      return 'user_chat';
    case 'admin_chat':
      return 'private';
    case 'public':
      return 'public_chat';
    default:
      return 'user_chat';
  }
}

/** Sync: ИИ на своей карточке. Public→editor — отдельно (async isEditor). */
function shouldGenerateAiReply(messageType) {
  return messageType === 'user_chat';
}

/** Public к редактору: ИИ-агент (§3.4). */
function shouldGenerateAiForPublicToEditor(messageType, recipientIsEditor) {
  if (messageType === 'user_chat') return true;
  if (messageType === 'public' && recipientIsEditor) return true;
  return false;
}

/** §2.2 / §2.3 кнопки на /contacts-list */
function canStartPrivateMessage(registeredSelectedCount) {
  return Number(registeredSelectedCount) === 1;
}

function canStartPublicBroadcast(registeredSelectedCount) {
  return Number(registeredSelectedCount) >= 2;
}

/** Ссылка «Ответить» на public → приват (§3.3) */
function publicReplyPath(senderId) {
  const id = normalizeNumericUserId(senderId);
  if (!id) return '';
  return `/admin-chat/${id}`;
}

/**
 * Фильтр ленты карточки (§3.1–3.2).
 * Своя: ИИ (user_chat) + public на этой карточке (стена посетителей, §3.4 ИИ-ответ).
 * Чужая: только public между мной и владельцем карточки.
 */
function contactCardMessageIncludes({ sameCard }) {
  return {
    includePublicPeer: !sameCard,
    includePublicOnCard: sameCard,
    includeTargetUserChat: sameCard
  };
}

module.exports = {
  normalizeNumericUserId,
  determineMessageType,
  resolveChatMessageType,
  determineConversationType,
  shouldGenerateAiReply,
  shouldGenerateAiForPublicToEditor,
  canStartPrivateMessage,
  canStartPublicBroadcast,
  publicReplyPath,
  contactCardMessageIncludes
};
