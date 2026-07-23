/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Magic link для входа участника в ИИ-конференцию (one-time, hash в БД).
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const conferenceService = require('./conferenceService');

const DEFAULT_TTL_HOURS = 48;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function resolveFrontendBaseUrl() {
  const raw =
    process.env.FRONTEND_URL ||
    process.env.BASE_URL ||
    process.env.PUBLIC_URL ||
    'http://localhost:9000';
  return String(raw).replace(/\/$/, '');
}

function buildJoinUrl(rawToken) {
  return `${resolveFrontendBaseUrl()}/conference/join?token=${encodeURIComponent(rawToken)}`;
}

async function createMagicLink(conferenceId, { ttlHours = DEFAULT_TTL_HOURS, userId = null } = {}) {
  const session = await conferenceService.getSession(conferenceId);
  if (!session?.session) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }

  const conf = session.session;
  let targetUserId = userId ? Number(userId) : conf.contact_user_id;
  if (!targetUserId) {
    const err = new Error('У конференции нет участника');
    err.status = 400;
    throw err;
  }

  targetUserId = await conferenceService.assertRegisteredUser(targetUserId);

  // Участник должен быть в conference_participants (или primary contact)
  const { rows: partRows } = await db.getQuery()(
    `SELECT user_id FROM conference_participants
     WHERE conference_id = $1 AND user_id = $2 AND role = 'participant'`,
    [conf.id, targetUserId]
  );
  if (!partRows.length && targetUserId !== conf.contact_user_id) {
    const err = new Error('Сначала добавьте пользователя в участники конференции');
    err.status = 400;
    err.code = 'NOT_PARTICIPANT';
    throw err;
  }

  if (targetUserId === conf.contact_user_id) {
    await db.getQuery()(
      `INSERT INTO conference_participants (conference_id, user_id, role)
       VALUES ($1, $2, 'participant')
       ON CONFLICT (conference_id, user_id) DO NOTHING`,
      [conf.id, targetUserId]
    );
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + Math.min(Math.max(Number(ttlHours) || DEFAULT_TTL_HOURS, 1), 72));

  const { rows } = await db.getQuery()(
    `INSERT INTO conference_magic_links (token_hash, user_id, conference_id, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, expires_at, created_at`,
    [tokenHash, targetUserId, conf.id, expiresAt]
  );

  const linkUrl = buildJoinUrl(rawToken);
  logger.info(`[conferenceMagicLink] created id=${rows[0].id} conference=${conf.id} user=${targetUserId}`);

  return {
    id: rows[0].id,
    linkUrl,
    expiresAt: rows[0].expires_at,
    conferenceId: conf.id,
    userId: targetUserId,
    hostId: conf.created_by || null,
    isPrimary: targetUserId === conf.contact_user_id,
    _rawToken: rawToken
  };
}

async function sendMagicLinkEmail(conferenceId, { ttlHours } = {}) {
  return sendMagicLinkNotifications(conferenceId, {
    ttlHours,
    channels: { email: true, telegram: false }
  });
}

/**
 * Отправка magic link по выбранным каналам (email / telegram).
 */
async function sendMagicLinkNotifications(conferenceId, { ttlHours, channels, userId = null } = {}) {
  const sessionData = await conferenceService.getSession(conferenceId);
  const conf = sessionData.session;
  const targetUserId = userId ? Number(userId) : conf.contact_user_id;
  const contact =
    targetUserId === conf.contact_user_id
      ? sessionData.contact || (await conferenceService.getContactIdentities(conf.contact_user_id))
      : await conferenceService.getContactIdentities(targetUserId);

  const wantEmail = channels?.email !== undefined ? Boolean(channels.email) : Boolean(conf.notify_email);
  const wantTelegram = channels?.telegram !== undefined
    ? Boolean(channels.telegram)
    : Boolean(conf.notify_telegram);

  if (!wantEmail && !wantTelegram) {
    const err = new Error('Не выбран канал уведомления (email / telegram)');
    err.status = 400;
    err.code = 'NO_CHANNEL';
    throw err;
  }
  if (wantEmail && !contact?.email) {
    const err = new Error('У участника нет email — нельзя отправить magic link');
    err.status = 400;
    err.code = 'MISSING_EMAIL';
    throw err;
  }
  if (wantTelegram && !contact?.telegram) {
    const err = new Error('У участника нет Telegram — нельзя отправить magic link');
    err.status = 400;
    err.code = 'MISSING_TELEGRAM';
    throw err;
  }

  const created = await createMagicLink(conferenceId, { ttlHours, userId: targetUserId });
  const title = conf.title || `Конференция #${conf.id}`;
  const plain =
    `Вас пригласили на ИИ-конференцию «${title}».\n\n` +
    `Откройте ссылку, чтобы войти и начать:\n${created.linkUrl}\n\n` +
    `Ссылка одноразовая.`;

  let emailed = false;
  let emailError = null;
  let telegramSent = false;
  let telegramError = null;
  let notifiedVia = 'none';

  if (wantEmail) {
    try {
      const botManager = require('./botManager');
      const emailBot = botManager.getBot('email');
      if (!emailBot?.sendEmail) {
        throw new Error('Email-бот не инициализирован');
      }
      const subject = `Приглашение на конференцию: ${title}`;
      const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Приглашение на конференцию</h2>
        <p style="font-size: 16px; color: #666;">Вас пригласили на «${escapeHtml(title)}».</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
          <a href="${created.linkUrl}" style="display: inline-block; background-color: #409eff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 16px;">
            Войти и открыть конференцию
          </a>
        </div>
        <p style="font-size: 14px; color: #999;">Ссылка одноразовая. Не пересылайте её третьим лицам.</p>
      </div>`;
      await emailBot.sendEmail(contact.email, subject, plain, [], { html });
      emailed = true;
      notifiedVia = 'email';
    } catch (e) {
      emailError = e.message || String(e);
      logger.error('[conferenceMagicLink] email send failed:', e);
    }
  }

  if (wantTelegram) {
    try {
      const botManager = require('./botManager');
      const telegramBot = botManager.getBot('telegram');
      if (!telegramBot?.isInitialized || !telegramBot.getBot) {
        throw new Error('Telegram-бот не инициализирован');
      }
      await telegramBot.getBot().telegram.sendMessage(contact.telegram, plain, {
        disable_web_page_preview: false
      });
      telegramSent = true;
      notifiedVia = notifiedVia === 'email' ? 'email' : 'telegram';
    } catch (e) {
      telegramError = e.message || String(e);
      logger.error('[conferenceMagicLink] telegram send failed:', e);
    }
  }

  if (notifiedVia !== 'none') {
    await db.getQuery()(
      `UPDATE conference_participants
       SET notified_via = $3
       WHERE conference_id = $1 AND user_id = $2`,
      [conf.id, targetUserId, notifiedVia]
    );
  }

  const delivered = emailed || telegramSent;
  return {
    success: true,
    emailed,
    emailError,
    telegramSent,
    telegramError,
    linkId: created.id,
    expiresAt: created.expiresAt,
    conferenceId: conf.id,
    userId: targetUserId,
    linkUrl: delivered ? null : created.linkUrl
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Потратить magic link: вернуть user/conference/host для установки сессии.
 */
async function consumeMagicLink(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token || token.length < 32) {
    const err = new Error('Некорректная ссылка');
    err.status = 400;
    err.code = 'INVALID_TOKEN';
    throw err;
  }

  const tokenHash = hashToken(token);
  const { rows } = await db.getQuery()(
    `SELECT id, user_id, conference_id, expires_at, used_at
     FROM conference_magic_links
     WHERE token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  const row = rows[0];
  if (!row) {
    const err = new Error('Ссылка недействительна');
    err.status = 404;
    err.code = 'TOKEN_NOT_FOUND';
    throw err;
  }
  if (row.used_at) {
    const err = new Error('Ссылка уже использована');
    err.status = 410;
    err.code = 'TOKEN_USED';
    throw err;
  }
  if (new Date(row.expires_at) < new Date()) {
    const err = new Error('Срок действия ссылки истёк');
    err.status = 410;
    err.code = 'TOKEN_EXPIRED';
    throw err;
  }

  const { rows: usedRows } = await db.getQuery()(
    `UPDATE conference_magic_links
     SET used_at = NOW()
     WHERE id = $1 AND used_at IS NULL
     RETURNING id`,
    [row.id]
  );
  if (!usedRows.length) {
    const err = new Error('Ссылка уже использована');
    err.status = 410;
    err.code = 'TOKEN_USED';
    throw err;
  }

  const sessionData = row.conference_id
    ? await conferenceService.getSession(row.conference_id)
    : null;
  const conf = sessionData?.session || null;
  const hostId = conf?.created_by || null;

  // email identity для сессии
  const contact = await conferenceService.getContactIdentities(row.user_id);
  const { rows: userRows } = await db.getQuery()(
    `SELECT id, role FROM users WHERE id = $1`,
    [row.user_id]
  );
  const user = userRows[0];
  if (!user) {
    const err = new Error('Пользователь не найден');
    err.status = 404;
    throw err;
  }

  logger.info(`[conferenceMagicLink] consumed id=${row.id} user=${row.user_id} conference=${row.conference_id}`);

  const isPrimary = conf ? conf.contact_user_id === row.user_id : true;
  const isMulti = Boolean(conf?.is_multi);
  // ТЗ §6.11: multi → сразу live; 1:1 primary → чат editor + Старт; extras → live
  let redirect;
  if (!conf) {
    redirect = { name: 'personal-messages' };
  } else if (isMulti) {
    // Сразу в эфир: поднимаем status=live при входе по magic
    try {
      await conferenceService.startSession(conf.id, row.user_id);
    } catch (e) {
      logger.warn(`[conferenceMagicLink] multi auto-start failed conf=${conf.id}: ${e.message}`);
    }
    redirect = {
      name: 'conference-participant-live',
      params: { sessionId: String(conf.id) }
    };
  } else if (isPrimary && hostId) {
    redirect = {
      name: 'admin-chat',
      params: { adminId: String(hostId) },
      query: { conference: String(conf.id) }
    };
  } else {
    redirect = {
      name: 'conference-participant-live',
      params: { sessionId: String(conf.id) }
    };
  }

  return {
    userId: row.user_id,
    email: contact.email || null,
    role: user.role || 'user',
    conferenceId: row.conference_id,
    hostId,
    session: conf,
    isPrimary,
    isMulti,
    redirect
  };
}

/**
 * При создании multi: magic + email/TG + сообщение в личку editor↔участник.
 */
async function notifyMultiParticipants(conferenceId) {
  const sessionData = await conferenceService.getSession(conferenceId);
  const conf = sessionData.session;
  if (!conf) {
    const err = new Error('Конференция не найдена');
    err.status = 404;
    throw err;
  }

  const hostId = conf.created_by;
  if (!hostId) {
    const err = new Error('У конференции нет host (created_by)');
    err.status = 400;
    throw err;
  }

  const { rows: parts } = await db.getQuery()(
    `SELECT user_id FROM conference_participants
     WHERE conference_id = $1 AND role = 'participant'
     ORDER BY created_at ASC`,
    [conf.id]
  );

  const conversationService = require('./conversationService');
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  let broadcastMessagesUpdate = null;
  try {
    ({ broadcastMessagesUpdate } = require('../wsHub'));
  } catch {
    /* optional */
  }

  const title = conf.title || `Конференция #${conf.id}`;
  const results = [];

  for (const row of parts) {
    const userId = row.user_id;
    const item = {
      userId,
      emailed: false,
      telegramSent: false,
      inbox: false,
      linkUrl: null,
      errors: []
    };

    try {
      const created = await createMagicLink(conf.id, { userId });
      item.linkUrl = created.linkUrl;
      const contact = await conferenceService.getContactIdentities(userId);

      const plain =
        `Вас пригласили на ИИ-конференцию «${title}».\n\n` +
        `Откройте ссылку, чтобы войти и начать:\n${created.linkUrl}\n\n` +
        `Ссылка одноразовая.`;

      if (conf.notify_email && contact.email) {
        try {
          const botManager = require('./botManager');
          const emailBot = botManager.getBot('email');
          if (!emailBot?.sendEmail) throw new Error('Email-бот не инициализирован');
          const subject = `Приглашение на конференцию: ${title}`;
          const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Приглашение на конференцию</h2>
            <p>Вас пригласили на «${escapeHtml(title)}».</p>
            <p style="text-align:center;margin:20px 0;">
              <a href="${created.linkUrl}" style="background:#409eff;color:#fff;padding:12px 24px;text-decoration:none;border-radius:5px;">
                Войти и открыть конференцию
              </a>
            </p>
            <p style="font-size:14px;color:#999;">Ссылка одноразовая.</p>
          </div>`;
          await emailBot.sendEmail(contact.email, subject, plain, [], { html });
          item.emailed = true;
        } catch (e) {
          item.errors.push(`email: ${e.message || e}`);
          logger.error('[conferenceMagicLink] multi email failed:', e);
        }
      }

      if (conf.notify_telegram && contact.telegram) {
        try {
          const botManager = require('./botManager');
          const telegramBot = botManager.getBot('telegram');
          if (!telegramBot?.isInitialized || !telegramBot.getBot) {
            throw new Error('Telegram-бот не инициализирован');
          }
          await telegramBot.getBot().telegram.sendMessage(contact.telegram, plain, {
            disable_web_page_preview: false
          });
          item.telegramSent = true;
        } catch (e) {
          item.errors.push(`telegram: ${e.message || e}`);
          logger.error('[conferenceMagicLink] multi telegram failed:', e);
        }
      }

      // Сообщение в личку участника с editor
      const conversation = await conversationService.getOrCreatePrivateConversation(hostId, userId);
      const inboxText =
        `Приглашение на конференцию «${title}».\n` +
        `Откройте ссылку или нажмите «Старт» в этом чате:\n${created.linkUrl}`;

      await db.getQuery()(
        `INSERT INTO messages (
           conversation_id, sender_id,
           sender_type_encrypted, content_encrypted, channel_encrypted,
           role_encrypted, direction_encrypted,
           message_type, user_id, role, direction, created_at
         ) VALUES (
           $1, $2,
           encrypt_text('editor', $5),
           encrypt_text($3, $5),
           encrypt_text('web', $5),
           encrypt_text('editor', $5),
           encrypt_text('outgoing', $5),
           'admin_chat', $4, 'editor', 'outgoing', NOW()
         )`,
        [conversation.id, hostId, inboxText, userId, encryptionKey]
      );
      await conversationService.touchConversation(conversation.id);
      await db.getQuery()(
        `UPDATE conference_participants
         SET notified_via = CASE
           WHEN $3 THEN 'email'
           WHEN $4 THEN 'telegram'
           ELSE 'none'
         END
         WHERE conference_id = $1 AND user_id = $2`,
        [conf.id, userId, item.emailed, item.telegramSent]
      );
      item.inbox = true;
    } catch (e) {
      item.errors.push(e.message || String(e));
      logger.error(`[conferenceMagicLink] multi notify user=${userId}:`, e);
    }

    results.push(item);
  }

  try {
    broadcastMessagesUpdate?.();
  } catch {
    /* ignore */
  }

  return {
    conferenceId: conf.id,
    notified: results.filter((r) => r.inbox || r.emailed || r.telegramSent).length,
    results
  };
}

module.exports = {
  DEFAULT_TTL_HOURS,
  createMagicLink,
  sendMagicLinkEmail,
  sendMagicLinkNotifications,
  notifyMultiParticipants,
  consumeMagicLink,
  hashToken,
  buildJoinUrl
};
