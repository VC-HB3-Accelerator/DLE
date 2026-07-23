/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const crypto = require('crypto');
const db = require('../db');
const botManager = require('./botManager');
const encryptionUtils = require('../utils/encryptionUtils');

const encryptionKey = encryptionUtils.getEncryptionKey();

function maskIdentity(provider, value) {
  if (!value) return 'Пользователь';
  if (provider === 'wallet' && value.length > 10) {
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }
  if (provider === 'email' && value.includes('@')) {
    const [local, domain] = value.split('@');
    const masked = local.length > 2 ? `${local.slice(0, 2)}***` : `${local}***`;
    return `${masked}@${domain}`;
  }
  if (provider === 'telegram') {
    return value.startsWith('@') ? value : `@${value}`;
  }
  return String(value).slice(0, 20);
}

async function getUserDisplayName(userId) {
  const { rows } = await db.getQuery()(
    `SELECT
      (SELECT decrypt_text(provider_id_encrypted, $2)
       FROM user_identities
       WHERE user_id = $1 AND provider_encrypted = encrypt_text('telegram', $2)
       LIMIT 1) AS telegram,
      (SELECT decrypt_text(provider_id_encrypted, $2)
       FROM user_identities
       WHERE user_id = $1 AND provider_encrypted = encrypt_text('email', $2)
       LIMIT 1) AS email,
      (SELECT decrypt_text(provider_id_encrypted, $2)
       FROM user_identities
       WHERE user_id = $1 AND provider_encrypted = encrypt_text('wallet', $2)
       LIMIT 1) AS wallet`,
    [userId, encryptionKey]
  );

  const row = rows[0] || {};
  if (row.telegram) return maskIdentity('telegram', row.telegram);
  if (row.email) return maskIdentity('email', row.email);
  if (row.wallet) return maskIdentity('wallet', row.wallet);
  return `User #${userId}`;
}

async function pageExists(pageId) {
  const { rows } = await db.getQuery()(
    `SELECT id FROM admin_pages_simple
     WHERE id = $1 AND visibility = 'public' AND status = 'published' AND show_in_blog = TRUE
     LIMIT 1`,
    [pageId]
  );
  return rows.length > 0;
}

async function getReactionStats(pageId, currentUserId = null) {
  const {
    BLOG_REACTION_TYPES,
    emptyReactionCounts,
    normalizeReactionType,
  } = require('../utils/blogReactions');

  const counts = emptyReactionCounts();
  const { rows: countRows } = await db.getQuery()(
    `SELECT type, COUNT(*)::int AS cnt
     FROM blog_reactions
     WHERE page_id = $1
     GROUP BY type`,
    [pageId]
  );

  for (const row of countRows) {
    const key = normalizeReactionType(row.type);
    if (key) counts[key] += row.cnt;
  }

  let myReaction = null;
  if (currentUserId) {
    const { rows: myRows } = await db.getQuery()(
      `SELECT type FROM blog_reactions
       WHERE page_id = $1 AND user_id = $2
       LIMIT 1`,
      [pageId, currentUserId]
    );
    myReaction = normalizeReactionType(myRows[0]?.type) || null;
  }

  const { rows: viewRows } = await db.getQuery()(
    `SELECT COALESCE(views_count, 0)::int AS views
     FROM admin_pages_simple
     WHERE id = $1
     LIMIT 1`,
    [pageId]
  );

  return {
    reactions: counts,
    // совместимость со старым фронтом
    likesCount: counts.heart || 0,
    dislikesCount: 0,
    viewsCount: viewRows[0]?.views || 0,
    myReaction,
    myLiked: myReaction === 'heart',
    myDisliked: false,
    reactionTypes: BLOG_REACTION_TYPES,
  };
}

async function getEngagement(pageId, currentUserId = null) {
  const reactionStats = await getReactionStats(pageId, currentUserId);

  const { rows: commentCountRows } = await db.getQuery()(
    `SELECT COUNT(*)::int AS cnt FROM blog_comments
     WHERE page_id = $1 AND is_hidden = FALSE`,
    [pageId]
  );

  const { rows: commentRows } = await db.getQuery()(
    `SELECT c.id, c.page_id, c.user_id, c.parent_id, c.body, c.created_at, c.updated_at
     FROM blog_comments c
     WHERE c.page_id = $1 AND c.is_hidden = FALSE
     ORDER BY c.created_at ASC`,
    [pageId]
  );

  const authorNames = {};
  const userIds = [...new Set(commentRows.map((c) => c.user_id))];
  for (const uid of userIds) {
    authorNames[uid] = await getUserDisplayName(uid);
  }

  const comments = commentRows
    .filter((c) => !c.parent_id)
    .map((c) => ({
      id: c.id,
      page_id: c.page_id,
      user_id: c.user_id,
      parent_id: c.parent_id,
      body: c.body,
      created_at: c.created_at,
      updated_at: c.updated_at,
      author_name: authorNames[c.user_id] || `User #${c.user_id}`,
      replies: commentRows
        .filter((r) => r.parent_id === c.id)
        .map((r) => ({
          id: r.id,
          page_id: r.page_id,
          user_id: r.user_id,
          parent_id: r.parent_id,
          body: r.body,
          created_at: r.created_at,
          updated_at: r.updated_at,
          author_name: authorNames[r.user_id] || `User #${r.user_id}`,
        })),
    }));

  return {
    ...reactionStats,
    commentsCount: commentCountRows[0]?.cnt || 0,
    comments,
  };
}

/**
 * Эмодзи-реакция: одна на пользователя.
 * Повторный клик по той же снимает её.
 */
async function toggleReaction(pageId, userId, type) {
  const { normalizeReactionType } = require('../utils/blogReactions');
  const normalized = normalizeReactionType(type);
  if (!normalized) {
    throw new Error('Некорректный тип реакции');
  }

  const exists = await pageExists(pageId);
  if (!exists) {
    throw new Error('Страница не найдена');
  }

  const { rows } = await db.getQuery()(
    `SELECT id, type FROM blog_reactions
     WHERE page_id = $1 AND user_id = $2
     LIMIT 1`,
    [pageId, userId]
  );

  const current = rows[0] ? normalizeReactionType(rows[0].type) : null;

  if (rows.length > 0 && current === normalized) {
    await db.getQuery()(`DELETE FROM blog_reactions WHERE id = $1`, [rows[0].id]);
  } else if (rows.length > 0) {
    await db.getQuery()(
      `UPDATE blog_reactions SET type = $2, created_at = NOW() WHERE id = $1`,
      [rows[0].id, normalized]
    );
  } else {
    await db.getQuery()(
      `INSERT INTO blog_reactions (page_id, user_id, type) VALUES ($1, $2, $3)`,
      [pageId, userId, normalized]
    );
  }

  return getReactionStats(pageId, userId);
}

async function toggleLike(pageId, userId) {
  return toggleReaction(pageId, userId, 'heart');
}

async function recordView(pageId) {
  const exists = await pageExists(pageId);
  if (!exists) {
    throw new Error('Страница не найдена');
  }

  const { rows } = await db.getQuery()(
    `UPDATE admin_pages_simple
     SET views_count = COALESCE(views_count, 0) + 1
     WHERE id = $1
     RETURNING views_count::int AS views`,
    [pageId]
  );
  return { viewsCount: rows[0]?.views || 0 };
}

async function addComment(pageId, userId, body, parentId = null) {
  const exists = await pageExists(pageId);
  if (!exists) {
    throw new Error('Страница не найдена');
  }

  const trimmed = String(body || '').trim();
  if (!trimmed || trimmed.length > 5000) {
    throw new Error('Некорректный текст комментария');
  }

  if (parentId) {
    const { rows: parentRows } = await db.getQuery()(
      `SELECT id, parent_id FROM blog_comments
       WHERE id = $1 AND page_id = $2 AND is_hidden = FALSE LIMIT 1`,
      [parentId, pageId]
    );
    if (!parentRows.length) {
      throw new Error('Родительский комментарий не найден');
    }
    if (parentRows[0].parent_id) {
      throw new Error('Ответ возможен только на комментарий первого уровня');
    }
  }

  const { rows } = await db.getQuery()(
    `INSERT INTO blog_comments (page_id, user_id, parent_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, page_id, user_id, parent_id, body, created_at, updated_at`,
    [pageId, userId, parentId || null, trimmed]
  );

  const comment = rows[0];
  comment.author_name = await getUserDisplayName(userId);
  return comment;
}

async function hideComment(commentId, userId, isEditor = false) {
  const { rows } = await db.getQuery()(
    `SELECT id, user_id FROM blog_comments WHERE id = $1 LIMIT 1`,
    [commentId]
  );
  if (!rows.length) {
    throw new Error('Комментарий не найден');
  }
  if (!isEditor && rows[0].user_id !== userId) {
    throw new Error('Нет прав на удаление комментария');
  }

  await db.getQuery()(
    `UPDATE blog_comments SET is_hidden = TRUE, updated_at = NOW() WHERE id = $1`,
    [commentId]
  );
  return { success: true };
}

async function sendSubscribeConfirmationEmail(email, confirmUrl) {
  const subject = 'Подтверждение подписки на блог';
  const text = `Подтвердите подписку на блог, перейдя по ссылке:\n${confirmUrl}`;
  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Подписка на блог</h2>
        <p>Нажмите кнопку ниже, чтобы подтвердить подписку:</p>
        <p><a href="${confirmUrl}" style="display:inline-block;padding:12px 24px;background:#4CAF50;color:#fff;text-decoration:none;border-radius:6px;">Подтвердить подписку</a></p>
        <p style="font-size:12px;color:#999;">Если вы не запрашивали подписку, проигнорируйте это письмо.</p>
      </div>`;

  const emailBot = botManager.getBot('email');
  if (emailBot && emailBot.isInitialized) {
    await emailBot.sendEmail(email, subject, text, [], { html });
    return;
  }

  const nodemailer = require('nodemailer');
  const { rows } = await db.getQuery()(
    'SELECT decrypt_text(smtp_host_encrypted, $1) as smtp_host, ' +
    'decrypt_text(smtp_user_encrypted, $1) as smtp_user, ' +
    'decrypt_text(smtp_password_encrypted, $1) as smtp_password, ' +
    'decrypt_text(from_email_encrypted, $1) as from_email ' +
    'FROM email_settings ORDER BY id LIMIT 1',
    [encryptionKey]
  );
  if (!rows.length) {
    throw new Error('Email settings not found');
  }
  const settings = rows[0];
  const transporter = nodemailer.createTransport({
    host: settings.smtp_host,
    port: 465,
    secure: true,
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_password,
    },
    tls: { rejectUnauthorized: false },
  });
  await transporter.sendMail({
    from: settings.from_email,
    to: email,
    subject,
    text,
    html,
  });
  transporter.close();
}

async function subscribe(email, sourcePageId = null, options = {}) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Некорректный email');
  }

  const privacyConsent = Boolean(options.privacyConsent ?? options.privacy_consent);
  if (!privacyConsent) {
    const err = new Error('Необходимо согласие с Политикой и согласиями');
    err.code = 'PRIVACY_CONSENT_REQUIRED';
    throw err;
  }

  const defaultConsentUrl = '/content/published?section=' + encodeURIComponent('политика и согласия');
  const rawUrl = String(options.privacyConsentUrl || options.privacy_consent_url || defaultConsentUrl).trim();
  const privacyConsentUrl = rawUrl || defaultConsentUrl;

  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await db.getQuery()(
    `INSERT INTO blog_subscribers (
       email,
       confirm_token,
       source_page_id,
       privacy_consent,
       privacy_consent_at,
       privacy_consent_url
     )
     VALUES ($1, $2, $3, TRUE, NOW(), $4)
     ON CONFLICT (email) DO UPDATE SET
       confirm_token = CASE
         WHEN blog_subscribers.confirmed_at IS NULL THEN EXCLUDED.confirm_token
         ELSE blog_subscribers.confirm_token
       END,
       source_page_id = COALESCE(EXCLUDED.source_page_id, blog_subscribers.source_page_id),
       privacy_consent = TRUE,
       privacy_consent_at = NOW(),
       privacy_consent_url = EXCLUDED.privacy_consent_url
     RETURNING id, email, confirm_token, confirmed_at, privacy_consent, privacy_consent_at, privacy_consent_url`,
    [normalized, token, sourcePageId, privacyConsentUrl]
  );

  if (rows[0].confirmed_at) {
    return { alreadyConfirmed: true, email: normalized };
  }

  const baseUrl = process.env.FRONTEND_URL || process.env.PRERENDER_BASE_URL || 'https://hb3-accelerator.com';
  const confirmUrl = `${baseUrl.replace(/\/$/, '')}/api/blog/subscribe/confirm?token=${encodeURIComponent(token)}`;

  await sendSubscribeConfirmationEmail(normalized, confirmUrl);

  return { pending: true, email: normalized };
}

async function confirmSubscribe(token) {
  const trimmed = String(token || '').trim();
  if (!trimmed) {
    throw new Error('Токен не указан');
  }

  const { rows } = await db.getQuery()(
    `UPDATE blog_subscribers
     SET confirmed_at = NOW(), confirm_token = NULL
     WHERE confirm_token = $1 AND confirmed_at IS NULL
     RETURNING id, email, confirmed_at`,
    [trimmed]
  );

  if (!rows.length) {
    throw new Error('Ссылка недействительна или подписка уже подтверждена');
  }

  return rows[0];
}

async function listConfirmedSubscribers() {
  const { rows } = await db.getQuery()(
    `SELECT id, email, confirmed_at, source_page_id, created_at,
            privacy_consent, privacy_consent_at, privacy_consent_url
     FROM blog_subscribers
     WHERE confirmed_at IS NOT NULL
     ORDER BY confirmed_at DESC`
  );
  return rows;
}

/**
 * Последние top-level комментарии для ленты блога (по page_id).
 */
async function getPreviewCommentsByPageIds(pageIds, limitPerPage = 2) {
  if (!pageIds?.length) return {};

  const { rows } = await db.getQuery()(
    `SELECT id, page_id, user_id, body, created_at
     FROM (
       SELECT c.id, c.page_id, c.user_id, c.body, c.created_at,
              ROW_NUMBER() OVER (PARTITION BY c.page_id ORDER BY c.created_at DESC) AS rn
       FROM blog_comments c
       WHERE c.page_id = ANY($1::int[])
         AND c.is_hidden = FALSE
         AND c.parent_id IS NULL
     ) ranked
     WHERE rn <= $2
     ORDER BY page_id, created_at DESC`,
    [pageIds, limitPerPage]
  );

  const authorCache = {};
  const byPage = {};

  for (const row of rows) {
    if (!authorCache[row.user_id]) {
      authorCache[row.user_id] = await getUserDisplayName(row.user_id);
    }
    if (!byPage[row.page_id]) byPage[row.page_id] = [];
    byPage[row.page_id].push({
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      author_name: authorCache[row.user_id],
    });
  }

  return byPage;
}

module.exports = {
  getEngagement,
  getReactionStats,
  toggleLike,
  toggleReaction,
  recordView,
  addComment,
  hideComment,
  subscribe,
  confirmSubscribe,
  listConfirmedSubscribers,
  getPreviewCommentsByPageIds,
  getUserDisplayName,
};
