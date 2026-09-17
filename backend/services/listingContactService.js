/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Связь с объявлением через редактора book-call (без раскрытия контактов автора).
 */

const db = require('../db');
const logger = require('../utils/logger');
const settingsService = require('./voiceCallSettingsService');
const unifiedMessageProcessor = require('./unifiedMessageProcessor');
const { resolveSenderIdentifier } = require('../utils/senderIdentifier');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://auto-lends.com').replace(/\/$/, '');

function normalizeContact(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.includes('@')) {
    const email = value.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return { type: 'email', value: email };
  }
  const digits = value.replace(/[^\d+]/g, '');
  if (digits.replace(/\D/g, '').length < 10) return null;
  return { type: 'phone', value: digits };
}

async function getBookingEditorId() {
  const settings = await settingsService.getSettings();
  const id = settings.booking_editor_user_id ? Number(settings.booking_editor_user_id) : null;
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function resolvePageMeta(pageId) {
  const id = Number(pageId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT id, slug, owner_user_id,
            CASE WHEN title_encrypted IS NULL OR title_encrypted = '' THEN NULL
                 ELSE decrypt_text(title_encrypted, $2) END AS title
     FROM admin_pages_simple
     WHERE id = $1 AND status = 'published' AND show_in_blog = TRUE
     LIMIT 1`,
    [id, encryptionKey]
  );
  const row = rows[0];
  if (!row) return null;
  const slug = row.slug || String(row.id);
  return {
    id: row.id,
    slug,
    title: row.title || slug,
    owner_user_id: row.owner_user_id ? Number(row.owner_user_id) : null,
    url: `${FRONTEND_URL}/blog/${encodeURIComponent(slug)}`,
  };
}

async function ensureLeadTable() {
  await db.getQuery()(`
    CREATE TABLE IF NOT EXISTS listing_contact_leads (
      id BIGSERIAL PRIMARY KEY,
      page_id INTEGER NOT NULL,
      action TEXT NOT NULL DEFAULT 'write',
      contact_type TEXT NOT NULL,
      contact_value_encrypted TEXT NOT NULL,
      privacy_consent BOOLEAN NOT NULL DEFAULT FALSE,
      guest_session TEXT,
      user_id INTEGER,
      editor_user_id INTEGER,
      notified BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.getQuery()(`
    CREATE INDEX IF NOT EXISTS listing_contact_leads_page_idx
      ON listing_contact_leads (page_id, created_at DESC)
  `);
}

function buildEditorMessage({ pageMeta, action, contact, fromUserId }) {
  const lines = [
    action === 'call' ? 'Запрос звонка по объявлению' : 'Сообщение по объявлению',
    `Объявление: ${pageMeta.title}`,
    `Ссылка: ${pageMeta.url}`,
  ];
  if (pageMeta.owner_user_id) {
    lines.push(`ID автора: ${pageMeta.owner_user_id}`);
  }
  if (fromUserId) {
    lines.push(`ID отправителя: ${fromUserId}`);
  }
  if (contact?.value) {
    lines.push(`Контакт гостя (${contact.type}): ${contact.value}`);
  }
  return lines.join('\n');
}

async function notifyEditor({ editorId, pageMeta, action, contact = null, fromUserId = null }) {
  if (!editorId) {
    const err = new Error('Редактор book-call не настроен');
    err.status = 503;
    err.code = 'EDITOR_NOT_SET';
    throw err;
  }

  const content = buildEditorMessage({ pageMeta, action, contact, fromUserId });
  let identifier = null;
  if (fromUserId) {
    identifier = await resolveSenderIdentifier(fromUserId);
    if (!identifier) {
      const err = new Error('Не найден способ связи аккаунта (email, telegram или кошелёк)');
      err.status = 403;
      err.code = 'NO_IDENTIFIER';
      throw err;
    }
  }
  if (!identifier && contact?.type === 'email') {
    identifier = `email:${contact.value}`;
  } else if (!identifier && contact?.type === 'phone') {
    identifier = `web:listing_lead_${pageMeta.id}_${Date.now()}`;
  } else if (!identifier) {
    identifier = `web:listing_${pageMeta.id}_${Date.now()}`;
  }

  await unifiedMessageProcessor.processMessage({
    identifier,
    content,
    channel: 'web',
    attachments: [],
    conversationId: null,
    recipientId: editorId,
    forcePrivate: false,
    userId: fromUserId || undefined,
    metadata: {
      messageType: 'public',
      listing_page_id: pageMeta.id,
      listing_slug: pageMeta.slug,
      listing_owner_user_id: pageMeta.owner_user_id,
      listing_action: action,
      listing_url: pageMeta.url,
    },
  });
}

/**
 * Автосохранение / финальная отправка лида гостя.
 * @param {{ finalize?: boolean }} opts — finalize=true требует consent и шлёт редактору
 */
async function upsertGuestLead({
  pageId,
  action = 'write',
  contactRaw,
  privacyConsent = false,
  guestSession = null,
  finalize = false,
} = {}) {
  const pageMeta = await resolvePageMeta(pageId);
  if (!pageMeta) {
    const err = new Error('Объявление не найдено');
    err.status = 404;
    throw err;
  }
  const contact = normalizeContact(contactRaw);
  if (!contact) {
    const err = new Error('Укажите корректный email или телефон');
    err.status = 400;
    throw err;
  }
  if (finalize && !privacyConsent) {
    const err = new Error('Нужно согласие с политикой и соглашениями');
    err.status = 400;
    throw err;
  }

  const editorId = await getBookingEditorId();
  await ensureLeadTable();
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const actionNorm = action === 'call' ? 'call' : 'write';
  const sessionKey = guestSession ? String(guestSession).slice(0, 200) : null;

  let leadId = null;
  if (sessionKey) {
    const existing = await db.getQuery()(
      `SELECT id, notified FROM listing_contact_leads
       WHERE page_id = $1 AND guest_session = $2 AND action = $3
       ORDER BY id DESC LIMIT 1`,
      [pageMeta.id, sessionKey, actionNorm]
    );
    if (existing.rows[0]) {
      leadId = existing.rows[0].id;
      await db.getQuery()(
        `UPDATE listing_contact_leads SET
           contact_type = $2,
           contact_value_encrypted = encrypt_text($3, $4),
           privacy_consent = $5,
           editor_user_id = $6,
           updated_at = NOW()
         WHERE id = $1`,
        [
          leadId,
          contact.type,
          contact.value,
          encryptionKey,
          Boolean(privacyConsent),
          editorId,
        ]
      );
      if (existing.rows[0].notified && finalize) {
        return {
          success: true,
          lead_id: leadId,
          notified: true,
          editor_configured: Boolean(editorId),
          page: pageMeta,
        };
      }
    }
  }

  if (!leadId) {
    const { rows } = await db.getQuery()(
      `INSERT INTO listing_contact_leads (
         page_id, action, contact_type, contact_value_encrypted,
         privacy_consent, guest_session, editor_user_id, notified
       ) VALUES (
         $1, $2, $3, encrypt_text($4, $5),
         $6, $7, $8, FALSE
       )
       RETURNING id`,
      [
        pageMeta.id,
        actionNorm,
        contact.type,
        contact.value,
        encryptionKey,
        Boolean(privacyConsent),
        sessionKey,
        editorId,
      ]
    );
    leadId = rows[0]?.id;
  }

  if (finalize && privacyConsent) {
    await notifyEditor({
      editorId,
      pageMeta,
      action: actionNorm,
      contact,
    });
    await db.getQuery()(
      `UPDATE listing_contact_leads SET notified = TRUE, updated_at = NOW() WHERE id = $1`,
      [leadId]
    );
  }

  return {
    success: true,
    lead_id: leadId,
    notified: Boolean(finalize && privacyConsent),
    editor_configured: Boolean(editorId),
    page: pageMeta,
  };
}

async function writeAsUser({ pageId, action = 'write', userId }) {
  const pageMeta = await resolvePageMeta(pageId);
  if (!pageMeta) {
    const err = new Error('Объявление не найдено');
    err.status = 404;
    throw err;
  }
  if (pageMeta.owner_user_id && Number(pageMeta.owner_user_id) === Number(userId)) {
    const err = new Error('Нельзя писать по своему объявлению');
    err.status = 400;
    throw err;
  }
  const editorId = await getBookingEditorId();
  await notifyEditor({
    editorId,
    pageMeta,
    action: action === 'call' ? 'call' : 'write',
    fromUserId: userId,
  });
  return {
    success: true,
    editor_user_id: editorId,
    page: pageMeta,
    book_call_url: `/book-call?page=${pageMeta.id}`,
  };
}

async function getPublicStatus() {
  const editorId = await getBookingEditorId();
  return {
    editor_configured: Boolean(editorId),
    booking_editor_user_id: editorId,
  };
}

module.exports = {
  getBookingEditorId,
  resolvePageMeta,
  upsertGuestLead,
  writeAsUser,
  getPublicStatus,
  normalizeContact,
};
