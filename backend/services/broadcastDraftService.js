/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Черновики персонализации рассылки + проверка окна по дням/часам.
 */

const logger = require('../utils/logger');
const db = require('../db');
const broadcastAiAgentService = require('./broadcastAiAgentService');
const broadcastSendService = require('./broadcastSendService');

const WEEKDAY_TO_ISO = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7
};

function getEncryptionKey() {
  const encryptionUtils = require('../utils/encryptionUtils');
  return encryptionUtils.getEncryptionKey();
}

function normalizeScheduleDays(days) {
  const source = Array.isArray(days) ? days : [];
  const normalized = [...new Set(
    source
      .map((d) => Number(d))
      .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7)
  )].sort((a, b) => a - b);

  return normalized.length ? normalized : [1, 2, 3, 4, 5];
}

function normalizeHour(value, fallback) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0 || num > 23) {
    return fallback;
  }
  return num;
}

function getZonedParts(timeZone = 'Europe/Moscow', date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timeZone || 'Europe/Moscow',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit'
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const weekday = WEEKDAY_TO_ISO[map.weekday] || 1;
  const hour = Number(map.hour);
  const minute = Number(map.minute);

  return {
    weekday,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0
  };
}

function isWithinSchedule(campaign, date = new Date()) {
  const days = normalizeScheduleDays(campaign?.schedule_days);
  const hourStart = normalizeHour(campaign?.schedule_hour_start, 10);
  const hourEnd = normalizeHour(campaign?.schedule_hour_end, 18);
  const tz = String(campaign?.schedule_timezone || 'Europe/Moscow');
  const parts = getZonedParts(tz, date);

  if (!days.includes(parts.weekday)) {
    return false;
  }

  // Окно [start, end): если start === end — круглосуточно в выбранные дни
  if (hourStart === hourEnd) {
    return true;
  }

  if (hourStart < hourEnd) {
    return parts.hour >= hourStart && parts.hour < hourEnd;
  }

  // Через полночь: например 22–6
  return parts.hour >= hourStart || parts.hour < hourEnd;
}

async function upsertDraftDelivery({
  campaignId,
  recipientUserId,
  subject,
  body,
  conversationId = null
}) {
  const encryptionKey = getEncryptionKey();
  const safeSubject = String(subject || '').trim() || 'Новое сообщение';
  const safeBody = String(body || '').trim();
  if (!safeBody) {
    throw new Error('Пустой текст черновика');
  }

  const existing = await db.getQuery()(
    `SELECT id, status
     FROM broadcast_deliveries
     WHERE campaign_id = $1 AND recipient_user_id = $2`,
    [campaignId, recipientUserId]
  );

  if (existing.rows.length) {
    const row = existing.rows[0];
    if (['sent', 'bounced'].includes(row.status)) {
      return { id: row.id, status: row.status, skipped: true };
    }

    const { rows } = await db.getQuery()(
      `UPDATE broadcast_deliveries
       SET
         status = 'draft',
         subject_encrypted = encrypt_text($2, $4),
         body_encrypted = encrypt_text($3, $4),
         conversation_id = COALESCE($5, conversation_id),
         error_message = NULL,
         channel_results = '[]'::jsonb,
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, status, recipient_user_id, conversation_id, updated_at`,
      [row.id, safeSubject, safeBody, encryptionKey, conversationId]
    );
    return rows[0];
  }

  // sent_at NOT NULL DEFAULT now() — явно NOW(), никогда NULL
  const { rows } = await db.getQuery()(
    `INSERT INTO broadcast_deliveries (
       campaign_id,
       recipient_user_id,
       status,
       channel_results,
       subject_encrypted,
       body_encrypted,
       conversation_id,
       sent_at,
       updated_at
     ) VALUES (
       $1, $2, 'draft', '[]'::jsonb,
       encrypt_text($3, $5),
       encrypt_text($4, $5),
       $6,
       NOW(),
       NOW()
     )
     RETURNING id, status, recipient_user_id, conversation_id, updated_at`,
    [campaignId, recipientUserId, safeSubject, safeBody, encryptionKey, conversationId]
  );

  return rows[0];
}

async function updateDraftContent({
  campaignId,
  recipientUserId,
  subject,
  body
}) {
  const encryptionKey = getEncryptionKey();
  const safeSubject = subject !== undefined
    ? (String(subject || '').trim() || 'Новое сообщение')
    : null;
  const safeBody = body !== undefined ? String(body || '').trim() : null;

  if (safeBody !== null && !safeBody) {
    throw new Error('Пустой текст черновика');
  }

  const { rows } = await db.getQuery()(
    `UPDATE broadcast_deliveries
     SET
       subject_encrypted = CASE
         WHEN $3::text IS NULL THEN subject_encrypted
         ELSE encrypt_text($3, $5)
       END,
       body_encrypted = CASE
         WHEN $4::text IS NULL THEN body_encrypted
         ELSE encrypt_text($4, $5)
       END,
       updated_at = NOW()
     WHERE campaign_id = $1
       AND recipient_user_id = $2
       AND status = 'draft'
     RETURNING
       id,
       status,
       recipient_user_id,
       conversation_id,
       updated_at,
       CASE
         WHEN subject_encrypted IS NULL OR subject_encrypted = '' THEN NULL
         ELSE decrypt_text(subject_encrypted, $5)
       END AS subject,
       CASE
         WHEN body_encrypted IS NULL OR body_encrypted = '' THEN NULL
         ELSE decrypt_text(body_encrypted, $5)
       END AS body`,
    [campaignId, recipientUserId, safeSubject, safeBody, encryptionKey]
  );

  if (rows.length) {
    return rows[0];
  }

  // Превью/правка до массовой подготовки: создаём черновик, если строки ещё нет
  const conversation = await broadcastSendService.getOrCreateConversation(recipientUserId);
  const existingSubject = safeSubject || 'Новое сообщение';
  const existingBody = safeBody;
  if (!existingBody) {
    throw new Error('Черновик не найден или уже отправлен');
  }

  const upserted = await upsertDraftDelivery({
    campaignId,
    recipientUserId,
    subject: existingSubject,
    body: existingBody,
    conversationId: conversation.id
  });

  if (upserted?.skipped) {
    throw new Error('Черновик не найден или уже отправлен');
  }

  await refreshDraftCounters(campaignId).catch(() => {});

  return getDraft({ campaignId, recipientUserId });
}

async function getDraft({ campaignId, recipientUserId }) {
  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
       id,
       campaign_id,
       recipient_user_id,
       status,
       conversation_id,
       updated_at,
       sent_at,
       CASE
         WHEN subject_encrypted IS NULL OR subject_encrypted = '' THEN NULL
         ELSE decrypt_text(subject_encrypted, $3)
       END AS subject,
       CASE
         WHEN body_encrypted IS NULL OR body_encrypted = '' THEN NULL
         ELSE decrypt_text(body_encrypted, $3)
       END AS body
     FROM broadcast_deliveries
     WHERE campaign_id = $1 AND recipient_user_id = $2`,
    [campaignId, recipientUserId, encryptionKey]
  );

  return rows[0] || null;
}

async function listDrafts(campaignId) {
  const encryptionKey = getEncryptionKey();
  const { rows } = await db.getQuery()(
    `SELECT
       id,
       campaign_id,
       recipient_user_id,
       status,
       conversation_id,
       updated_at,
       sent_at,
       error_message,
       CASE
         WHEN subject_encrypted IS NULL OR subject_encrypted = '' THEN NULL
         ELSE decrypt_text(subject_encrypted, $2)
       END AS subject,
       CASE
         WHEN body_encrypted IS NULL OR body_encrypted = '' THEN NULL
         ELSE decrypt_text(body_encrypted, $2)
       END AS body
     FROM broadcast_deliveries
     WHERE campaign_id = $1
     ORDER BY recipient_user_id ASC`,
    [campaignId, encryptionKey]
  );

  return rows;
}

async function refreshDraftCounters(campaignId, { draft = null, promoteReady = true } = {}) {
  // drafts_total = planned_recipients (цель), а не только уже созданные строки:
  // иначе при частичных ошибках prepare кампания ложно становится ready.
  // promoteReady=false во время цикла prepare — иначе Start можно нажать до конца LLM.
  const { rows } = await db.getQuery()(
    `UPDATE broadcast_campaigns c
     SET
       drafts_total = GREATEST(COALESCE(c.planned_recipients, 0), sub.created),
       drafts_ready_count = sub.ready,
       status = CASE
         WHEN $2::boolean
           AND c.status IN ('preparing', 'ready')
           AND sub.ready >= GREATEST(COALESCE(c.planned_recipients, 0), sub.created)
           AND GREATEST(COALESCE(c.planned_recipients, 0), sub.created) > 0
           THEN 'ready'
         WHEN c.status = 'ready'
           AND sub.ready < GREATEST(COALESCE(c.planned_recipients, 0), sub.created)
           THEN 'preparing'
         ELSE c.status
       END
     FROM (
       SELECT
         COUNT(*)::int AS created,
         COUNT(*) FILTER (
           WHERE status = 'draft'
             AND body_encrypted IS NOT NULL
             AND body_encrypted <> ''
         )::int AS ready
       FROM broadcast_deliveries
       WHERE campaign_id = $1
     ) sub
     WHERE c.id = $1
     RETURNING *`,
    [campaignId, Boolean(promoteReady)]
  );

  const campaign = rows[0] || null;
  if (campaign) {
    const broadcastService = require('./broadcastService');
    await broadcastService.emitCampaignWsUpdate(campaignId, {
      draft,
      event: campaign.status === 'ready' ? 'drafts_ready' : 'draft_progress'
    }).catch(() => {});
  }
  return campaign;
}

function isPrepareInflight(campaignId) {
  return Boolean(prepareCampaignDrafts._inflight?.has(Number(campaignId)));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertDraftDeliveryWithRetry(args, { attempts = 2 } = {}) {
  let lastError = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await upsertDraftDelivery(args);
    } catch (error) {
      lastError = error;
      logger.warn(
        `[BroadcastDraft] upsert attempt ${i}/${attempts} failed `
        + `campaign=${args.campaignId} user=${args.recipientUserId}: ${error.message}`
      );
      if (i < attempts) {
        await sleep(250 * i);
      }
    }
  }
  throw lastError;
}

async function failPrepare(campaignId, reason) {
  const broadcastService = require('./broadcastService');
  try {
    await broadcastService.interruptCampaign({
      campaignId,
      reason: String(reason || 'Ошибка подготовки черновиков').slice(0, 500)
    });
  } catch (error) {
    logger.error(`[BroadcastDraft] failPrepare campaign ${campaignId}: ${error.message}`);
  }
}

/** Частичная подготовка: recoverable pause (не тупик interrupted). */
async function pausePreparePartial(campaignId, reason) {
  const broadcastService = require('./broadcastService');
  const pauseReason = String(reason || 'Подготовка черновиков не завершена').slice(0, 500);
  try {
    await db.getQuery()(
      `UPDATE broadcast_campaigns
       SET status = 'paused',
           pause_reason = $2,
           completed_at = NULL
       WHERE id = $1 AND status IN ('preparing', 'ready', 'paused')
       RETURNING id`,
      [campaignId, pauseReason]
    );
    await broadcastService.recordEvent({
      campaignId,
      eventType: 'prepare_partial',
      details: { reason: pauseReason }
    }).catch(() => {});
    await broadcastService.emitCampaignWsUpdate(campaignId, { event: 'prepare_partial' });
  } catch (error) {
    logger.error(`[BroadcastDraft] pausePreparePartial campaign ${campaignId}: ${error.message}`);
  }
}

async function prepareCampaignDrafts({ campaignId, useAi = true }) {
  const broadcastService = require('./broadcastService');
  let campaign = await broadcastService.getCampaignById(campaignId);
  if (!campaign) {
    throw new Error('campaign_not_found');
  }

  // interrupted — recoverable: можно повторить prepare
  if (['completed', 'in_progress'].includes(campaign.status)) {
    throw new Error(`campaign_cannot_prepare_from_${campaign.status}`);
  }

  // Защита от параллельного prepare одной кампании
  if (prepareCampaignDrafts._inflight?.has(campaignId)) {
    logger.info(`[BroadcastDraft] prepare already running for campaign ${campaignId}`);
    return {
      campaign,
      prepared: Number(campaign.drafts_ready_count || 0),
      total: Number(campaign.drafts_total || campaign.planned_recipients || 0),
      errors: [],
      alreadyRunning: true
    };
  }
  if (!prepareCampaignDrafts._inflight) {
    prepareCampaignDrafts._inflight = new Set();
  }
  prepareCampaignDrafts._inflight.add(campaignId);

  try {
  const recipientIds = broadcastService.getCampaignRecipientIds(campaign);
  const templateSubject = String(campaign.subject || '').trim() || 'Новое сообщение';
  const templateBody = String(campaign.message_body || campaign.message_preview || '').trim();
  if (!templateBody) {
    await failPrepare(campaignId, 'Пустой шаблон сообщения');
    throw new Error('Пустой шаблон сообщения');
  }
  if (!recipientIds.length) {
    await failPrepare(campaignId, 'Нет получателей для подготовки черновиков');
    throw new Error('Нет получателей для подготовки черновиков');
  }

  const aiWanted = Boolean(useAi && campaign.ai_personalize);
  let aiSettings = null;
  if (aiWanted) {
    aiSettings = await broadcastAiAgentService.getSettings();
    if (!aiSettings.enabled) {
      await failPrepare(campaignId, 'AI-агент выключен. Включите агента во вкладке «AI-агент»');
      throw new Error('AI-агент выключен');
    }
    if (!aiSettings.model) {
      await failPrepare(campaignId, 'Модель AI не выбрана');
      throw new Error('Модель AI не выбрана');
    }
  }

  await db.getQuery()(
    `UPDATE broadcast_campaigns
     SET status = 'preparing', completed_at = NULL, pause_reason = NULL
     WHERE id = $1`,
    [campaignId]
  );
  await broadcastService.emitCampaignWsUpdate(campaignId, { event: 'preparing' }).catch(() => {});

  let prepared = 0;
  let personalizedOk = 0;
  const errors = [];

  for (const recipientUserId of recipientIds) {
    // H1: interrupt/pause во время prepare останавливает цикл
    const live = await broadcastService.getCampaignById(campaignId);
    if (!live || ['interrupted', 'completed'].includes(live.status)) {
      logger.info(`[BroadcastDraft] prepare stopped for campaign ${campaignId}: status=${live?.status || 'missing'}`);
      break;
    }
    if (live.status === 'paused' && live.pause_reason && !String(live.pause_reason).includes('частично')) {
      // ручная пауза не ожидается во время prepare, но на всякий случай
      break;
    }

    try {
      logger.info(`[BroadcastDraft] prepare campaign ${campaignId} → user ${recipientUserId}`);
      const conversation = await broadcastSendService.getOrCreateConversation(recipientUserId);
      let subject = templateSubject;
      let body = templateBody;
      let personalized = false;
      let personalizeReason = 'template';

      if (aiWanted) {
        const result = await broadcastAiAgentService.personalizeForRecipient({
          userId: recipientUserId,
          subject: templateSubject,
          body: templateBody,
          settings: aiSettings,
          fallbackOnError: true
        });
        subject = result.subject;
        body = result.body;
        personalized = Boolean(result.personalized);
        personalizeReason = result.reason || (personalized ? 'ok' : 'llm_error');
        if (personalized) personalizedOk += 1;
        if (!personalized) {
          errors.push({
            recipientUserId,
            error: result.error || personalizeReason,
            fallback: true
          });
        }
      }

      // Отдельно от LLM: при SQL-ошибке ретраим upsert, шаблон/ответ не теряем молча
      const upserted = await upsertDraftDeliveryWithRetry({
        campaignId,
        recipientUserId,
        subject,
        body,
        conversationId: conversation.id
      });
      if (!upserted?.skipped) {
        prepared += 1;
      }
      await refreshDraftCounters(campaignId, {
        promoteReady: false,
        draft: {
          recipient_user_id: recipientUserId,
          subject,
          body,
          status: 'draft',
          personalized,
          personalize_reason: personalizeReason,
          updated_at: new Date().toISOString()
        }
      }).catch(() => {});
    } catch (error) {
      logger.warn(`[BroadcastDraft] prepare failed user ${recipientUserId}: ${error.message}`);
      errors.push({ recipientUserId, error: error.message });
    }
  }

  // Счётчики без авто-ready; ready выставляем только если полный успех ниже
  campaign = await refreshDraftCounters(campaignId, { promoteReady: false });
  const ready = Number(campaign?.drafts_ready_count || 0);
  const planned = Math.max(
    Number(campaign?.planned_recipients || 0),
    recipientIds.length
  );

  // Снова проверить: могли прервать во время цикла
  const after = await broadcastService.getCampaignById(campaignId);
  if (after && ['interrupted', 'completed'].includes(after.status)) {
    return {
      campaign: after,
      prepared,
      total: recipientIds.length,
      errors,
      personalizedOk,
      stopped: true
    };
  }

  if (ready < planned) {
    if (prepared === 0) {
      await failPrepare(campaignId, `Не удалось подготовить черновики (${errors.length || 0} ошибок)`);
    } else {
      // B1: recoverable pause, не тупик interrupted
      await pausePreparePartial(campaignId, `Подготовлено частично: ${ready}/${planned}. Можно повторить подготовку.`);
    }
    campaign = await broadcastService.getCampaignById(campaignId);
  } else if (aiWanted && personalizedOk === 0 && prepared > 0) {
    // H3: все черновики — шаблон без AI
    await pausePreparePartial(
      campaignId,
      'Черновики созданы без персонализации AI (ошибка/таймаут модели). Проверьте Ollama и повторите подготовку.'
    );
    campaign = await broadcastService.getCampaignById(campaignId);
  } else {
    campaign = await refreshDraftCounters(campaignId, { promoteReady: true });
  }
  await broadcastService.recordEvent({
    campaignId,
    eventType: 'drafts_prepared',
    details: {
      prepared,
      ready,
      planned,
      errors: errors.length,
      personalizedOk,
      ai: aiWanted
    }
  }).catch(() => {});

  return {
    campaign,
    prepared,
    total: recipientIds.length,
    errors,
    personalizedOk
  };
  } catch (error) {
    const current = await broadcastService.getCampaignById(campaignId).catch(() => null);
    if (current?.status === 'preparing') {
      await failPrepare(campaignId, error.message || 'Ошибка подготовки черновиков');
    }
    throw error;
  } finally {
    prepareCampaignDrafts._inflight.delete(campaignId);
  }
}

/**
 * Недавние сгенерированные/подготовленные черновики для истории AI-агента.
 * Не зависит от sessionStorage браузера.
 */
async function listRecentGeneratedDrafts({ limit = 50 } = {}) {
  const encryptionKey = getEncryptionKey();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);

  const { rows } = await db.getQuery()(
    `SELECT
       d.id,
       d.campaign_id,
       d.recipient_user_id,
       d.status,
       d.updated_at,
       c.status AS campaign_status,
       c.ai_personalize,
       CASE
         WHEN d.subject_encrypted IS NULL OR d.subject_encrypted = '' THEN NULL
         ELSE decrypt_text(d.subject_encrypted, $2)
       END AS subject,
       CASE
         WHEN d.body_encrypted IS NULL OR d.body_encrypted = '' THEN NULL
         ELSE decrypt_text(d.body_encrypted, $2)
       END AS body
     FROM broadcast_deliveries d
     INNER JOIN broadcast_campaigns c ON c.id = d.campaign_id
     WHERE d.status IN ('draft', 'sent', 'error')
       AND d.body_encrypted IS NOT NULL
       AND d.body_encrypted <> ''
       AND (
         c.status IN ('preparing', 'ready', 'paused', 'queued', 'in_progress', 'interrupted')
         OR (
           c.status = 'completed'
           AND d.updated_at > NOW() - INTERVAL '14 days'
         )
       )
     ORDER BY d.updated_at DESC
     LIMIT $1`,
    [safeLimit, encryptionKey]
  );

  return rows;
}

module.exports = {
  normalizeScheduleDays,
  normalizeHour,
  isWithinSchedule,
  getZonedParts,
  upsertDraftDelivery,
  updateDraftContent,
  getDraft,
  listDrafts,
  listRecentGeneratedDrafts,
  refreshDraftCounters,
  isPrepareInflight,
  prepareCampaignDrafts
};
