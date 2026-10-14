/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Личный контур оркестратора: собеседник = session.userId.
 * Чужой id не отличаем от «нет» (404), чтобы не светить чужие задачи.
 */

function notFound(message = 'Задача не найдена') {
  const error = new Error(message);
  error.status = 404;
  error.code = 'NOT_FOUND';
  return error;
}

function ownerIdOf(record) {
  if (!record) return null;
  const raw = record.owner_user_id ?? record.ownerUserId;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function sessionIdOf(sessionUserId) {
  const n = Number(sessionUserId);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isOwnedBy(record, sessionUserId) {
  const owner = ownerIdOf(record);
  const me = sessionIdOf(sessionUserId);
  return owner != null && me != null && owner === me;
}

function canTouchSession(row, sessionUserId) {
  return isOwnedBy(row, sessionUserId);
}

function assertOwned(record, sessionUserId, message) {
  if (!record || !isOwnedBy(record, sessionUserId)) {
    throw notFound(message);
  }
  return record;
}

/**
 * Кому писать медиа/карточку.
 * Клиентский target принимаем только если это сам собеседник
 * или явно разрешили чужой профиль (отдельное право, не чат).
 */
function canOpenPersonalOrchChat({ sessionUserId, contactId, hasOrchPermission }) {
  if (!hasOrchPermission) return false;
  const me = sessionIdOf(sessionUserId);
  const card = sessionIdOf(contactId);
  return me != null && card != null && me === card;
}

function resolveTargetOwnerUserId({
  sessionUserId,
  requestedTarget,
  canWriteForeign = false,
} = {}) {
  const me = sessionIdOf(sessionUserId);
  if (me == null) return null;
  const requested = Number(requestedTarget);
  if (Number.isInteger(requested) && requested === me) return me;
  if (canWriteForeign && Number.isInteger(requested) && requested > 0) return requested;
  return me;
}

module.exports = {
  notFound,
  ownerIdOf,
  sessionIdOf,
  isOwnedBy,
  canTouchSession,
  assertOwned,
  resolveTargetOwnerUserId,
  canOpenPersonalOrchChat,
};
