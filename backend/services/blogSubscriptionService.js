/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Подписки на фильтры ленты + автоуведомления (TZ_BLOG_SUBSCRIBE_FILTERS).
 */

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');

let schemaReady = false;
const notifyQueue = [];
let notifyPumpRunning = false;
const NOTIFY_CONCURRENCY = 2;

function normalizeFilters(raw = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const section = String(input.section || '').trim() || null;
  const attrsSrc = (input.attrs && typeof input.attrs === 'object' && !Array.isArray(input.attrs))
    ? input.attrs
    : input;
  const attrs = {};
  for (const [key, value] of Object.entries(attrsSrc || {})) {
    if (key === 'section' || key === 'attrs') continue;
    const k = String(key || '').trim();
    const v = String(value || '').trim();
    if (!k || !v) continue;
    attrs[k] = v;
  }
  const sorted = {};
  for (const k of Object.keys(attrs).sort((a, b) => a.localeCompare(b, 'ru'))) {
    sorted[k] = attrs[k];
  }
  const filters = { section, attrs: sorted };
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(filters))
    .digest('hex')
    .slice(0, 40);
  return { filters, hash, label: formatFiltersLabel(filters) };
}

function formatFiltersLabel(filters) {
  const parts = [];
  if (filters.section) parts.push(String(filters.section));
  for (const [k, v] of Object.entries(filters.attrs || {})) {
    parts.push(String(v));
  }
  return parts.length ? parts.join(' · ') : 'Вся лента';
}

async function ensureSchema() {
  if (schemaReady) return;
  await db.getQuery()(`
    CREATE TABLE IF NOT EXISTS blog_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email TEXT,
      filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      filters_hash TEXT NOT NULL,
      privacy_consent BOOLEAN NOT NULL DEFAULT TRUE,
      privacy_consent_at TIMESTAMPTZ,
      privacy_consent_url TEXT,
      source_page_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, filters_hash)
    )
  `);
  await db.getQuery()(`
    ALTER TABLE blog_subscriptions ALTER COLUMN email DROP NOT NULL
  `).catch(() => {});
  await db.getQuery()(`
    CREATE INDEX IF NOT EXISTS blog_subscriptions_user_id_idx
      ON blog_subscriptions (user_id)
  `);
  await db.getQuery()(`
    CREATE TABLE IF NOT EXISTS blog_subscription_sends (
      id SERIAL PRIMARY KEY,
      subscription_id INTEGER NOT NULL REFERENCES blog_subscriptions(id) ON DELETE CASCADE,
      page_id INTEGER NOT NULL,
      email_status TEXT,
      chat_status TEXT,
      telegram_status TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (subscription_id, page_id)
    )
  `);
  await db.getQuery()(`
    ALTER TABLE blog_subscription_sends
      ADD COLUMN IF NOT EXISTS telegram_status TEXT
  `).catch(() => {});
  await db.getQuery()(`
    CREATE TABLE IF NOT EXISTS blog_subscription_unsub_tokens (
      token TEXT PRIMARY KEY,
      subscription_id INTEGER NOT NULL REFERENCES blog_subscriptions(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Старый поток больше не используем
  try {
    await db.getQuery()(`TRUNCATE TABLE blog_subscribers`);
  } catch (_) { /* table may not exist */ }
  schemaReady = true;
}

function createUnsubToken(subscriptionId) {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  return { token, expiresAt, subscriptionId };
}

async function issueUnsubToken(subscriptionId) {
  await ensureSchema();
  const { token, expiresAt } = createUnsubToken(subscriptionId);
  await db.getQuery()(
    `INSERT INTO blog_subscription_unsub_tokens (token, subscription_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO NOTHING`,
    [token, subscriptionId, expiresAt.toISOString()]
  );
  return token;
}

async function createSubscription({
  userId,
  email,
  filters: rawFilters,
  privacyConsent = true,
  privacyConsentUrl = null,
  sourcePageId = null,
}) {
  await ensureSchema();
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) {
    const err = new Error('Требуется пользователь');
    err.status = 401;
    throw err;
  }

  // Email опционален: уведомления идут на все идентификаторы (чат / TG / email).
  let normalizedEmail = String(email || '').trim().toLowerCase() || null;
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const err = new Error('Некорректный email');
    err.status = 400;
    throw err;
  }
  if (!normalizedEmail) {
    try {
      const identityService = require('./identity-service');
      const fromId = await identityService.getPrimaryIdentityValue(uid, 'email');
      normalizedEmail = String(fromId || '').trim().toLowerCase() || null;
    } catch (_) { /* ignore */ }
  }

  if (!privacyConsent) {
    const err = new Error('Необходимо согласие с Политикой и согласиями');
    err.code = 'PRIVACY_CONSENT_REQUIRED';
    err.status = 400;
    throw err;
  }

  const { filters, hash, label } = normalizeFilters(rawFilters);
  const defaultConsentUrl = '/content/published?section=' + encodeURIComponent('политика и согласия');
  const consentUrl = String(privacyConsentUrl || defaultConsentUrl).trim() || defaultConsentUrl;

  const { rows } = await db.getQuery()(
    `INSERT INTO blog_subscriptions (
       user_id, email, filters_json, filters_hash,
       privacy_consent, privacy_consent_at, privacy_consent_url, source_page_id
     ) VALUES ($1, $2, $3::jsonb, $4, TRUE, NOW(), $5, $6)
     ON CONFLICT (user_id, filters_hash) DO UPDATE SET
       email = COALESCE(EXCLUDED.email, blog_subscriptions.email),
       privacy_consent = TRUE,
       privacy_consent_at = NOW(),
       privacy_consent_url = EXCLUDED.privacy_consent_url,
       updated_at = NOW()
     RETURNING *, (xmax = 0) AS inserted`,
    [
      uid,
      normalizedEmail,
      JSON.stringify(filters),
      hash,
      consentUrl,
      sourcePageId ? Number(sourcePageId) : null,
    ]
  );

  const row = rows[0];
  return {
    id: row.id,
    user_id: row.user_id,
    email: row.email,
    filters: row.filters_json,
    label: formatFiltersLabel(row.filters_json || filters),
    already: row.inserted === false || row.inserted === 'f',
    created_at: row.created_at,
  };
}

async function listForUser(userId) {
  await ensureSchema();
  const uid = Number(userId);
  const { rows } = await db.getQuery()(
    `SELECT id, user_id, email, filters_json, created_at, updated_at
     FROM blog_subscriptions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [uid]
  );
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    email: r.email,
    filters: r.filters_json,
    label: formatFiltersLabel(r.filters_json || {}),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

async function deleteForUser(userId, subscriptionId) {
  await ensureSchema();
  const { rowCount } = await db.getQuery()(
    `DELETE FROM blog_subscriptions WHERE id = $1 AND user_id = $2`,
    [Number(subscriptionId), Number(userId)]
  );
  return rowCount > 0;
}

async function deleteAllForUser(userId) {
  await ensureSchema();
  const { rowCount } = await db.getQuery()(
    `DELETE FROM blog_subscriptions WHERE user_id = $1`,
    [Number(userId)]
  );
  return rowCount;
}

async function unsubscribeByToken(token) {
  await ensureSchema();
  const trimmed = String(token || '').trim();
  if (!trimmed) {
    const err = new Error('Токен не указан');
    err.status = 400;
    throw err;
  }
  const { rows } = await db.getQuery()(
    `SELECT subscription_id FROM blog_subscription_unsub_tokens
     WHERE token = $1 AND expires_at > NOW()
     LIMIT 1`,
    [trimmed]
  );
  if (!rows[0]) {
    const err = new Error('Ссылка недействительна или устарела');
    err.status = 400;
    throw err;
  }
  const subId = rows[0].subscription_id;
  await db.getQuery()(`DELETE FROM blog_subscriptions WHERE id = $1`, [subId]);
  await db.getQuery()(`DELETE FROM blog_subscription_unsub_tokens WHERE token = $1`, [trimmed]);
  return { success: true };
}

function subscriptionMatchesPage(filters, pageSectionSlug, pageAttrsMap) {
  const f = filters && typeof filters === 'object' ? filters : {};
  const section = f.section ? String(f.section) : null;
  const attrs = f.attrs && typeof f.attrs === 'object' ? f.attrs : {};
  if (section && String(pageSectionSlug || '') !== section) return false;
  for (const [k, v] of Object.entries(attrs)) {
    if (String(pageAttrsMap[k] || '') !== String(v)) return false;
  }
  return true;
}

async function buildPageMatchContext(pageId) {
  const catalogFiltersService = require('./catalogFiltersService');
  const { rows } = await db.getQuery()(
    `SELECT id, slug, title, summary, owner_user_id, show_in_blog, status, settings, seo
     FROM admin_pages_simple WHERE id = $1 LIMIT 1`,
    [Number(pageId)]
  );
  const page = rows[0];
  if (!page) return null;
  const catalog = await catalogFiltersService.getPageCatalog(page.id).catch(() => ({
    catalog_section: null,
    catalog_attrs: [],
  }));
  const sectionSlug = catalog.catalog_section?.slug || null;
  const attrsMap = {};
  for (const a of catalog.catalog_attrs || []) {
    if (a?.key && a?.value != null) attrsMap[String(a.key)] = String(a.value);
  }
  let coverUrl = null;
  try {
    const { extractCoverFromPage, parsePageSeo } = require('../utils/blogCoverUtils');
    const cover = extractCoverFromPage(page);
    coverUrl = cover?.cover_url || null;
    if (!coverUrl) {
      const seo = parsePageSeo(page.seo);
      coverUrl = seo.og_image || seo.image || null;
    }
  } catch (_) { /* ignore */ }
  if (!coverUrl && page.settings) {
    try {
      const s = typeof page.settings === 'string' ? JSON.parse(page.settings) : page.settings;
      const photos = s?.listing_media?.photos;
      if (Array.isArray(photos) && photos[0]) coverUrl = String(photos[0]);
    } catch (_) { /* ignore */ }
  }
  return {
    page,
    sectionSlug,
    attrsMap,
    coverUrl,
  };
}

function publicBaseUrl() {
  return String(
    process.env.FRONTEND_URL
    || process.env.PRERENDER_BASE_URL
    || process.env.BASE_URL
    || 'http://localhost:9000'
  ).replace(/\/$/, '');
}

function absoluteUrl(pathOrUrl) {
  const s = String(pathOrUrl || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `${publicBaseUrl()}${s.startsWith('/') ? '' : '/'}${s}`;
}

async function sendEmailNotify({ toEmail, page, coverUrl, unsubToken }) {
  if (!toEmail) return { status: 'skipped' };
  const botManager = require('./botManager');
  const emailBot = botManager.getBot('email');
  if (!emailBot || !emailBot.isInitialized) {
    return { status: 'skipped', error: 'Email-бот не инициализирован' };
  }
  const articleUrl = absoluteUrl(`/blog/${page.slug}`);
  const unsubUrl = absoluteUrl(`/api/blog/subscriptions/unsubscribe?token=${encodeURIComponent(unsubToken)}`);
  const myUrl = absoluteUrl('/blog/my-subscriptions');
  const subject = `Новое объявление: ${page.title || 'без названия'}`;
  const text = [
    page.title || 'Новое объявление',
    page.summary || '',
    articleUrl,
    coverUrl ? absoluteUrl(coverUrl) : '',
    '',
    `Отписаться от этой подписки: ${unsubUrl}`,
    `Мои подписки: ${myUrl}`,
  ].filter(Boolean).join('\n');

  const img = coverUrl
    ? `<p><img src="${absoluteUrl(coverUrl)}" alt="" style="max-width:100%;height:auto;border-radius:8px;" /></p>`
    : '';
  const html = `
    <div style="font-family:sans-serif;line-height:1.45;color:#111">
      <h2 style="margin:0 0 8px">${escapeHtml(page.title || 'Новое объявление')}</h2>
      ${page.summary ? `<p>${escapeHtml(page.summary)}</p>` : ''}
      ${img}
      <p><a href="${articleUrl}">Открыть объявление</a></p>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0" />
      <p style="font-size:12px;color:#666">
        <a href="${unsubUrl}">Отписаться от этой подписки</a>
        · <a href="${myUrl}">Мои подписки</a>
      </p>
    </div>`;

  await emailBot.sendEmail(toEmail, subject, text, [], { html });
  return { status: 'sent' };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadUserIdentities(userId) {
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT decrypt_text(provider_encrypted, $2) as provider,
            decrypt_text(provider_id_encrypted, $2) as provider_id,
            COALESCE(is_primary, false) as is_primary
     FROM user_identities WHERE user_id = $1`,
    [Number(userId), encryptionKey]
  );
  return rows || [];
}

function pickEmail(identities, fallbackEmail) {
  const primary = identities.find((i) => i.provider === 'email' && i.is_primary)?.provider_id;
  const any = identities.find((i) => i.provider === 'email')?.provider_id;
  return String(primary || any || fallbackEmail || '').trim().toLowerCase() || null;
}

function pickTelegram(identities) {
  return String(identities.find((i) => i.provider === 'telegram')?.provider_id || '').trim() || null;
}

async function sendChatNotify({ subscription, page, coverUrl, authorId }) {
  const conversationService = require('./conversationService');
  const encryptionUtils = require('../utils/encryptionUtils');
  const { broadcastMessagesUpdate } = require('../wsHub');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const articleUrl = absoluteUrl(`/blog/${page.slug}`);
  const lines = [
    `Новое объявление: ${page.title || 'без названия'}`,
    articleUrl,
  ];
  if (coverUrl) lines.push(absoluteUrl(coverUrl));
  const content = lines.join('\n');

  const conversation = await conversationService.getOrCreatePublicConversation(
    authorId,
    subscription.user_id
  );

  await db.getQuery()(
    `INSERT INTO messages (
      conversation_id, sender_id,
      sender_type_encrypted, content_encrypted, channel_encrypted,
      role_encrypted, direction_encrypted,
      message_type, user_id, role, direction, metadata, created_at
    ) VALUES (
      $1, $2,
      encrypt_text($3, $9), encrypt_text($4, $9), encrypt_text($5, $9),
      encrypt_text($6, $9), encrypt_text($7, $9),
      'public', $8, 'user', 'incoming', $10::jsonb, NOW()
    )`,
    [
      conversation.id,
      authorId,
      'user',
      content,
      'web',
      'user',
      'incoming',
      subscription.user_id,
      encryptionKey,
      JSON.stringify({
        blog_subscription_notify: true,
        page_id: page.id,
        page_slug: page.slug,
        cover_url: coverUrl || null,
      }),
    ]
  );
  try {
    broadcastMessagesUpdate({ userId: subscription.user_id });
    broadcastMessagesUpdate({ userId: authorId });
  } catch (_) { /* ignore */ }
  return { status: 'sent' };
}

async function sendTelegramNotify({ telegramId, page, coverUrl }) {
  if (!telegramId) return { status: 'skipped' };
  const botManager = require('./botManager');
  const telegramBot = botManager.getBot('telegram');
  if (!telegramBot || !telegramBot.isInitialized) {
    return { status: 'skipped', error: 'Telegram-бот не инициализирован' };
  }
  const articleUrl = absoluteUrl(`/blog/${page.slug}`);
  const lines = [
    `Новое объявление: ${page.title || 'без названия'}`,
    articleUrl,
  ];
  if (coverUrl) lines.push(absoluteUrl(coverUrl));
  const bot = telegramBot.getBot();
  await bot.telegram.sendMessage(telegramId, lines.join('\n'));
  return { status: 'sent' };
}

async function deliverOne({ subscription, ctx }) {
  const page = ctx.page;
  const authorId = Number(page.owner_user_id);
  if (!Number.isInteger(authorId) || authorId <= 0) {
    return;
  }
  if (Number(subscription.user_id) === authorId) {
    return;
  }

  const insert = await db.getQuery()(
    `INSERT INTO blog_subscription_sends (subscription_id, page_id, email_status, chat_status, telegram_status)
     VALUES ($1, $2, 'pending', 'pending', 'pending')
     ON CONFLICT (subscription_id, page_id) DO NOTHING
     RETURNING id`,
    [subscription.id, page.id]
  );
  if (!insert.rows[0]) return;

  const unsubToken = await issueUnsubToken(subscription.id);
  const identities = await loadUserIdentities(subscription.user_id).catch(() => []);
  const toEmail = pickEmail(identities, subscription.email);
  const telegramId = pickTelegram(identities);

  let emailStatus = 'skipped';
  let chatStatus = 'error';
  let telegramStatus = 'skipped';

  try {
    const cr = await sendChatNotify({
      subscription,
      page,
      coverUrl: ctx.coverUrl,
      authorId,
    });
    chatStatus = cr.status || 'sent';
  } catch (e) {
    logger.warn(`[blogSubscription] chat failed sub=${subscription.id}: ${e.message}`);
    chatStatus = 'error';
  }

  try {
    const er = await sendEmailNotify({
      toEmail,
      page,
      coverUrl: ctx.coverUrl,
      unsubToken,
    });
    emailStatus = er.status || 'sent';
  } catch (e) {
    logger.warn(`[blogSubscription] email failed sub=${subscription.id}: ${e.message}`);
    emailStatus = 'error';
  }

  try {
    const tr = await sendTelegramNotify({
      telegramId,
      page,
      coverUrl: ctx.coverUrl,
    });
    telegramStatus = tr.status || 'sent';
  } catch (e) {
    logger.warn(`[blogSubscription] telegram failed sub=${subscription.id}: ${e.message}`);
    telegramStatus = 'error';
  }

  await db.getQuery()(
    `UPDATE blog_subscription_sends
     SET email_status = $2, chat_status = $3, telegram_status = $4
     WHERE subscription_id = $1 AND page_id = $5`,
    [subscription.id, emailStatus, chatStatus, telegramStatus, page.id]
  );
}

async function pumpNotifyQueue() {
  if (notifyPumpRunning) return;
  notifyPumpRunning = true;
  try {
    while (notifyQueue.length) {
      const batch = notifyQueue.splice(0, NOTIFY_CONCURRENCY);
      await Promise.all(batch.map((job) => job().catch((e) => {
        logger.warn(`[blogSubscription] notify job: ${e.message}`);
      })));
    }
  } finally {
    notifyPumpRunning = false;
    if (notifyQueue.length) pumpNotifyQueue();
  }
}

/**
 * После approve / прямого publish: поставить в очередь уведомления.
 */
async function enqueueNotifyForPage(pageId) {
  await ensureSchema();
  const ctx = await buildPageMatchContext(pageId);
  if (!ctx) return { queued: 0 };
  const { page, sectionSlug, attrsMap } = ctx;
  if (page.status !== 'published' || !page.show_in_blog) {
    return { queued: 0, skipped: 'not_public_blog' };
  }
  if (!page.owner_user_id) {
    return { queued: 0, skipped: 'no_owner' };
  }

  const { rows } = await db.getQuery()(
    `SELECT id, user_id, email, filters_json FROM blog_subscriptions`
  );
  let queued = 0;
  for (const row of rows) {
    const filters = row.filters_json || {};
    if (!subscriptionMatchesPage(filters, sectionSlug, attrsMap)) continue;
    if (Number(row.user_id) === Number(page.owner_user_id)) continue;
    const subscription = row;
    notifyQueue.push(() => deliverOne({ subscription, ctx }));
    queued += 1;
  }
  if (queued) pumpNotifyQueue();
  return { queued };
}

module.exports = {
  ensureSchema,
  normalizeFilters,
  formatFiltersLabel,
  createSubscription,
  listForUser,
  deleteForUser,
  deleteAllForUser,
  unsubscribeByToken,
  enqueueNotifyForPage,
  subscriptionMatchesPage,
};
