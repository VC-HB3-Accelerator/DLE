/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Deep-link Telegram login: pending token ↔ browser session (TZ_TELEGRAM_DEEPLINK_AUTH).
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const botsSettings = require('./botsSettings');
const authService = require('./auth-service');
const sessionService = require('./session-service');
const { getLinkedWallet } = require('./wallet-service');
const { ROLES } = require('/app/shared/permissions');
const encryptionUtils = require('../utils/encryptionUtils');

const TTL_MS = 10 * 60 * 1000;

function generateStartToken() {
  // Telegram start payload: ≤64 chars, A-Z a-z 0-9 _ -
  return crypto.randomBytes(32).toString('base64url').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}

function normalizeGuestId(guestId) {
  if (!guestId) return null;
  const raw = String(guestId);
  return raw.includes(':') ? raw.split(':').pop() : raw;
}

async function createPending({ session, sessionId, privacyAccepted = false }) {
  if (!sessionId) {
    throw new Error('Session ID required');
  }
  if (!privacyAccepted) {
    const err = new Error('Privacy consent required');
    err.status = 400;
    throw err;
  }

  if (session?.authenticated && session.userId) {
    const identityService = require('./identity-service');
    const tg = await identityService.findIdentity(session.userId, 'telegram');
    if (tg) {
      const err = new Error('Telegram уже привязан к этому аккаунту');
      err.status = 400;
      throw err;
    }
  }

  const bot = await botsSettings.getBotSettings('telegram');
  const username = bot?.bot_username || bot?.botUsername;
  if (!username || !bot?.bot_token) {
    const err = new Error('Telegram bot is not configured');
    err.status = 500;
    throw err;
  }

  const token = generateStartToken();
  const expiresAt = new Date(Date.now() + TTL_MS);
  const guestId = normalizeGuestId(session?.guestId) || null;
  const userId = session?.authenticated && session.userId ? Number(session.userId) : null;

  await db.getQuery()(
    `INSERT INTO telegram_login_pendings
      (token, session_sid, user_id, guest_id, privacy_accepted, expires_at, created_at)
     VALUES ($1, $2, $3, $4, true, $5, NOW())`,
    [token, sessionId, userId, guestId, expiresAt]
  );

  const botLink = `https://t.me/${String(username).replace(/^@/, '')}?start=${token}`;
  return {
    botLink,
    expiresIn: Math.floor(TTL_MS / 1000),
    expiresAt: expiresAt.toISOString(),
  };
}

async function findPending(token) {
  const { rows } = await db.getQuery()(
    `SELECT * FROM telegram_login_pendings WHERE token = $1`,
    [token]
  );
  return rows[0] || null;
}

async function markUsed(token) {
  await db.getQuery()(
    `UPDATE telegram_login_pendings SET used_at = NOW() WHERE token = $1 AND used_at IS NULL`,
    [token]
  );
}

async function resolveUserForTelegram({ telegramId, pending, sessionData }) {
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const linkUserId = pending.user_id || (sessionData?.authenticated && sessionData.userId
    ? Number(sessionData.userId)
    : null);

  if (linkUserId) {
    const linkResult = await authService.linkIdentity(linkUserId, 'telegram', telegramId);
    if (!linkResult?.success && linkResult?.message !== 'Identity already exists') {
      // linkIdentity throws on conflict with another user
      return { userId: linkUserId, isNewUser: false, linked: true };
    }
    return { userId: linkUserId, isNewUser: false, linked: true };
  }

  const existing = await db.getQuery()(
    `SELECT u.id
     FROM users u
     JOIN user_identities ui ON u.id = ui.user_id
     WHERE ui.provider_encrypted = encrypt_text('telegram', $2)
       AND ui.provider_id_encrypted = encrypt_text($1, $2)
     LIMIT 1`,
    [String(telegramId), encryptionKey]
  );

  if (existing.rows.length) {
    return { userId: existing.rows[0].id, isNewUser: false, linked: false };
  }

  const inserted = await db.getQuery()(
    `INSERT INTO users (role) VALUES ($1) RETURNING id`,
    [ROLES.USER]
  );
  const userId = inserted.rows[0].id;
  const encryptedDb = require('./encryptedDatabaseService');
  await encryptedDb.saveData('user_identities', {
    user_id: userId,
    provider: 'telegram',
    provider_id: String(telegramId),
  });
  return { userId, isNewUser: true, linked: false };
}

async function buildAccessLevel(userId) {
  const address = await getLinkedWallet(userId);
  const accessResolver = require('./accessResolverService');
  const access = await accessResolver.recompute(userId);
  if (!address) {
    return { level: access.role, tokenCount: 0, hasAccess: false, address: null };
  }
  const level = await authService.getUserAccessLevel(address);
  return { ...level, level: access.role, address };
}

async function completeFromStart(token, telegramId) {
  if (!token || !telegramId) {
    return { ok: false, message: 'Некорректная ссылка. Откройте бота со сайта.' };
  }

  const pending = await findPending(token);
  if (!pending) {
    return { ok: false, message: 'Ссылка недействительна. Начните вход заново на сайте.' };
  }
  if (pending.used_at) {
    return { ok: false, message: 'Ссылка уже использована. Начните вход заново на сайте.' };
  }
  if (new Date(pending.expires_at) < new Date()) {
    return { ok: false, message: 'Срок ссылки истёк. Начните вход заново на сайте.' };
  }

  const sessionData = await sessionService.getSessionData(pending.session_sid);
  if (!sessionData) {
    return { ok: false, message: 'Сессия сайта не найдена. Обновите страницу и попробуйте снова.' };
  }

  // Conflict: linking to account A, telegram already on account B
  if (pending.user_id || (sessionData.authenticated && sessionData.userId)) {
    const targetUserId = pending.user_id || Number(sessionData.userId);
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const other = await db.getQuery()(
      `SELECT user_id FROM user_identities
       WHERE provider_encrypted = encrypt_text('telegram', $2)
         AND provider_id_encrypted = encrypt_text($1, $2)
       LIMIT 1`,
      [String(telegramId), encryptionKey]
    );
    if (other.rows.length && Number(other.rows[0].user_id) !== Number(targetUserId)) {
      return { ok: false, message: 'Этот Telegram уже привязан к другому аккаунту.' };
    }
  }

  let resolved;
  try {
    resolved = await resolveUserForTelegram({
      telegramId: String(telegramId),
      pending,
      sessionData,
    });
  } catch (error) {
    const msg = error.message || '';
    if (/already belongs|другим контактом|уже используется/i.test(msg)) {
      return { ok: false, message: 'Этот Telegram уже привязан к другому аккаунту.' };
    }
    logger.error('[telegramLogin] resolveUser error:', error);
    return { ok: false, message: 'Не удалось привязать Telegram. Попробуйте позже.' };
  }

  const access = await buildAccessLevel(resolved.userId);

  const guestId = pending.guest_id || normalizeGuestId(sessionData.guestId);
  if (guestId) {
    try {
      const universalGuestService = require('./UniversalGuestService');
      await universalGuestService.migrateToUser(`web:${guestId}`, resolved.userId);
    } catch (migrateError) {
      logger.warn(`[telegramLogin] guest migrate: ${migrateError.message}`);
    }
  }

  await sessionService.updateSessionDataBySid(pending.session_sid, (sess) => {
    sess.authenticated = true;
    sess.userId = resolved.userId;
    sess.authType = 'telegram';
    sess.telegramId = String(telegramId);
    sess.userAccessLevel = {
      level: access.level || ROLES.USER,
      tokenCount: access.tokenCount || 0,
      hasAccess: Boolean(access.hasAccess),
    };
    if (access.address) sess.address = String(access.address).toLowerCase();
    if (guestId && !sess.guestId) sess.guestId = guestId;
    return sess;
  });

  await markUsed(token);

  try {
    const { broadcastContactsUpdate } = require('../wsHub');
    broadcastContactsUpdate();
  } catch (_) {
    /* optional */
  }

  logger.info(
    `[telegramLogin] completed tg=${String(telegramId).slice(0, 4)}… user=${resolved.userId} sid=${pending.session_sid.slice(0, 8)}…`
  );

  return { ok: true, message: 'Готово. Можно вернуться на сайт.' };
}

module.exports = {
  createPending,
  completeFromStart,
  TTL_MS,
};
