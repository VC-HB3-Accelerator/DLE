/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 *
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../db');
const logger = require('../utils/logger');
const emailTrackingService = require('./emailTrackingService');

const BROADCAST_EVENT_TYPES = new Set([
  'started',
  'paused',
  'resumed',
  'completed',
  'interrupted',
  'drafts_prepared',
  'prepare_partial'
]);

function getAttachmentsDir(campaignId) {
  return path.join(__dirname, '../uploads/broadcast', String(campaignId));
}

function parseRecipientIds(value) {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map(id => Number(id))
        .filter(id => Number.isInteger(id) && id > 0)
    )];
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseRecipientIds(parsed);
    } catch (error) {
      return parseRecipientIds(
        value.split(',').map(id => Number(id.trim()))
      );
    }
  }

  return [];
}

function buildMessagePreview(message, maxLength = 500) {
  const normalized = String(message || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

async function createCampaign({
  senderId,
  subject,
  message,
  greeting = '',
  signature = '',
  legalFooter = '',
  recipientIds = [],
  warmupMode = false,
  delaySeconds = 0,
  maxRecipients = 0,
  attachmentsCount = 0,
  aiPersonalize = false,
  scheduleDays = [1, 2, 3, 4, 5],
  scheduleHourStart = 10,
  scheduleHourEnd = 18,
  scheduleTimezone = 'Europe/Moscow'
}) {
  const broadcastDraftService = require('./broadcastDraftService');
  const {
    ensureBroadcastComposeSchema,
    composeEmailBody,
    resolveGreeting,
    normalizePart
  } = require('../utils/broadcastEmailCompose');

  await ensureBroadcastComposeSchema(db.getQuery());

  const uniqueRecipientIds = [...new Set(
    recipientIds
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)
  )];

  if (!uniqueRecipientIds.length) {
    throw new Error('recipient_ids is empty');
  }

  const plannedRecipients = Math.min(
    Math.max(Number(maxRecipients) || uniqueRecipientIds.length, 1),
    uniqueRecipientIds.length
  );

  const normalizedMessage = String(message || '').trim();
  const normalizedGreeting = resolveGreeting(greeting);
  const normalizedSignature = normalizePart(signature);
  const normalizedLegal = normalizePart(legalFooter);
  const composedPreview = composeEmailBody({
    greeting: normalizedGreeting,
    body: normalizedMessage,
    signature: normalizedSignature,
    legalFooter: normalizedLegal
  });
  const days = broadcastDraftService.normalizeScheduleDays(scheduleDays);
  const hourStart = broadcastDraftService.normalizeHour(scheduleHourStart, 10);
  const hourEnd = broadcastDraftService.normalizeHour(scheduleHourEnd, 18);
  const timezone = String(scheduleTimezone || 'Europe/Moscow').trim() || 'Europe/Moscow';

  const { rows } = await db.getQuery()(
    `INSERT INTO broadcast_campaigns (
      sender_id,
      subject,
      message_preview,
      message_body,
      greeting,
      signature,
      legal_footer,
      recipient_ids,
      total_recipients,
      planned_recipients,
      warmup_mode,
      delay_seconds,
      attachments_count,
      ai_personalize,
      schedule_days,
      schedule_hour_start,
      schedule_hour_end,
      schedule_timezone,
      drafts_total,
      drafts_ready_count,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15::int[], $16, $17, $18, $19, 0, 'preparing')
    RETURNING *`,
    [
      senderId,
      String(subject || '').trim() || 'Новое сообщение',
      buildMessagePreview(composedPreview || normalizedMessage),
      normalizedMessage,
      normalizedGreeting,
      normalizedSignature || null,
      normalizedLegal || null,
      JSON.stringify(uniqueRecipientIds.slice(0, plannedRecipients)),
      uniqueRecipientIds.length,
      plannedRecipients,
      Boolean(warmupMode),
      Math.max(0, Number(delaySeconds) || 0),
      Math.max(0, Number(attachmentsCount) || 0),
      Boolean(aiPersonalize),
      days,
      hourStart,
      hourEnd,
      timezone,
      plannedRecipients
    ]
  );

  return rows[0];
}

async function saveCampaignAttachments(campaignId, files = []) {
  if (!files.length) {
    return [];
  }

  const dir = getAttachmentsDir(campaignId);
  await fs.mkdir(dir, { recursive: true });
  const saved = [];

  for (const file of files) {
    const filename = path.basename(String(file.originalname || 'attachment'));
    const storagePath = path.join(dir, filename);
    await fs.writeFile(storagePath, file.buffer);

    const { rows } = await db.getQuery()(
      `INSERT INTO broadcast_campaign_attachments (
        campaign_id,
        filename,
        content_type,
        storage_path,
        file_size
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        campaignId,
        filename,
        file.mimetype || null,
        storagePath,
        Number(file.size) || file.buffer?.length || 0
      ]
    );

    saved.push(rows[0]);
  }

  return saved;
}

async function loadCampaignAttachments(campaignId) {
  const { rows } = await db.getQuery()(
    `SELECT filename, content_type, storage_path
     FROM broadcast_campaign_attachments
     WHERE campaign_id = $1
     ORDER BY id ASC`,
    [campaignId]
  );

  const attachments = [];
  for (const row of rows) {
    try {
      const content = await fs.readFile(row.storage_path);
      attachments.push({
        filename: row.filename,
        content,
        contentType: row.content_type
      });
    } catch (error) {
      logger.warn(`[broadcastService] Attachment read failed for campaign ${campaignId}: ${error.message}`);
    }
  }

  return attachments;
}

async function recordEvent({
  campaignId,
  eventType,
  actorId = null,
  details = {}
}) {
  const normalizedType = String(eventType || '').trim();
  if (!BROADCAST_EVENT_TYPES.has(normalizedType)) {
    throw new Error(`Unsupported broadcast event type: ${normalizedType}`);
  }

  const { rows } = await db.getQuery()(
    `INSERT INTO broadcast_campaign_events (campaign_id, event_type, actor_id, details)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING *`,
    [
      campaignId,
      normalizedType,
      actorId || null,
      JSON.stringify(details || {})
    ]
  );

  logger.info(`[broadcastService] Campaign ${campaignId} event: ${normalizedType}`, details || {});
  return rows[0];
}

async function getCampaignEvents(campaignId, { limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const { rows } = await db.getQuery()(
    `SELECT id, campaign_id, event_type, actor_id, details, created_at
     FROM broadcast_campaign_events
     WHERE campaign_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [campaignId, safeLimit]
  );

  return rows;
}

async function getDeliveredRecipientIds(campaignId) {
  const { rows } = await db.getQuery()(
    `SELECT recipient_user_id
     FROM broadcast_deliveries
     WHERE campaign_id = $1 AND status IN ('sent', 'bounced', 'error')`,
    [campaignId]
  );

  return new Set(rows.map(row => row.recipient_user_id));
}

async function getFinalizedRecipientIds(campaignId) {
  // error тоже финальный статус попытки: иначе очередь бесконечно
  // ретраит «Черновик не готов» / постоянные сбои отправки.
  const { rows } = await db.getQuery()(
    `SELECT recipient_user_id
     FROM broadcast_deliveries
     WHERE campaign_id = $1 AND status IN ('sent', 'bounced', 'error')`,
    [campaignId]
  );

  return new Set(rows.map(row => row.recipient_user_id));
}

function getCampaignRecipientIds(campaign) {
  return parseRecipientIds(campaign?.recipient_ids || []);
}

async function updateCurrentIndex(campaignId, currentIndex) {
  await db.getQuery()(
    `UPDATE broadcast_campaigns
     SET current_index = $2
     WHERE id = $1`,
    [campaignId, Math.max(0, Number(currentIndex) || 0)]
  );
}

async function startCampaign({ campaignId, actorId = null }) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error('campaign_not_found');
  }

  // Нельзя стартовать, пока async prepare ещё крутит LLM
  const draftSvc = require('./broadcastDraftService');
  if (typeof draftSvc.isPrepareInflight === 'function' && draftSvc.isPrepareInflight(campaignId)) {
    throw new Error('campaign_still_preparing');
  }
  if (campaign.status === 'preparing') {
    throw new Error('campaign_still_preparing');
  }

  if (!['queued', 'paused', 'ready'].includes(campaign.status)) {
    throw new Error(`campaign_cannot_start_from_${campaign.status}`);
  }

  if (campaign.status === 'ready') {
    const draftsReady = Number(campaign.drafts_ready_count || 0);
    const draftsTotal = Number(campaign.drafts_total || 0) || getCampaignRecipientIds(campaign).length;
    if (!draftsTotal || draftsReady < draftsTotal) {
      throw new Error('campaign_drafts_not_ready');
    }
  }

  // paused после частичного prepare тоже нельзя стартовать без полного набора черновиков
  if (campaign.status === 'paused') {
    const draftsReady = Number(campaign.drafts_ready_count || 0);
    const draftsTotal = Number(campaign.drafts_total || 0) || getCampaignRecipientIds(campaign).length;
    if (!draftsTotal || draftsReady < draftsTotal) {
      throw new Error('campaign_drafts_not_ready');
    }
  }

  const eventType = campaign.status === 'paused' ? 'resumed' : 'started';
  const { rows } = await db.getQuery()(
    `UPDATE broadcast_campaigns
     SET
       status = 'in_progress',
       pause_reason = NULL,
       completed_at = NULL,
       started_at = COALESCE(started_at, NOW())
     WHERE id = $1 AND status IN ('queued', 'paused', 'ready')
     RETURNING *`,
    [campaignId]
  );

  if (!rows.length) {
    throw new Error('campaign_start_failed');
  }

  await recordEvent({
    campaignId,
    eventType,
    actorId,
    details: {
      planned_recipients: rows[0].planned_recipients,
      delay_seconds: rows[0].delay_seconds,
      schedule_days: rows[0].schedule_days,
      schedule_hour_start: rows[0].schedule_hour_start,
      schedule_hour_end: rows[0].schedule_hour_end
    }
  });

  await emitCampaignWsUpdate(campaignId, { event: eventType });
  return rows[0];
}

async function pauseCampaign({ campaignId, actorId = null, reason = '' }) {
  const pauseReason = String(reason || '').trim() || 'Остановлено вручную';
  const { rows } = await db.getQuery()(
    `UPDATE broadcast_campaigns
     SET
       status = 'paused',
       pause_reason = $2
     WHERE id = $1 AND status = 'in_progress'
     RETURNING *`,
    [campaignId, pauseReason]
  );

  if (!rows.length) {
    return null;
  }

  await recordEvent({
    campaignId,
    eventType: 'paused',
    actorId,
    details: { reason: pauseReason }
  });

  await emitCampaignWsUpdate(campaignId, { event: 'paused' });
  return rows[0];
}

async function interruptCampaign({ campaignId, actorId = null, reason = '' }) {
  const interruptReason = String(reason || '').trim() || 'Рассылка прервана';
  const { rows } = await db.getQuery()(
    `UPDATE broadcast_campaigns
     SET
       status = 'interrupted',
       pause_reason = $2,
       completed_at = NOW()
     WHERE id = $1 AND status IN ('queued', 'in_progress', 'paused', 'preparing', 'ready')
     RETURNING *`,
    [campaignId, interruptReason]
  );

  if (!rows.length) {
    return null;
  }

  await recordEvent({
    campaignId,
    eventType: 'interrupted',
    actorId,
    details: { reason: interruptReason }
  });

  await emitCampaignWsUpdate(campaignId, { event: 'interrupted' });
  return rows[0];
}

async function getCampaignProgress(campaignId) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    return null;
  }

  const recipientIds = getCampaignRecipientIds(campaign);
  const deliveredIds = await getDeliveredRecipientIds(campaignId);
  const processedCount = deliveredIds.size;
  const pendingIds = recipientIds.filter(id => !deliveredIds.has(id));
  const currentRecipientId = pendingIds[0] || null;

  return {
    campaign,
    progress: {
      total: recipientIds.length,
      processed: processedCount,
      pending: pendingIds.length,
      currentRecipientId,
      successCount: Number(campaign.success_count || 0),
      errorCount: Number(campaign.error_count || 0),
      bounceCount: Number(campaign.bounce_count || 0),
      draftsReady: Number(campaign.drafts_ready_count || 0),
      draftsTotal: Number(campaign.drafts_total || recipientIds.length || 0)
    }
  };
}

async function emitCampaignWsUpdate(campaignId, { draft = null, event = 'progress' } = {}) {
  try {
    const { broadcastCampaignUpdate } = require('../wsHub');
    const data = await getCampaignProgress(campaignId);
    if (!data) return null;

    const c = data.campaign || {};
    const safeCampaign = {
      id: c.id,
      status: c.status,
      ai_personalize: c.ai_personalize,
      planned_recipients: c.planned_recipients,
      drafts_ready_count: c.drafts_ready_count,
      drafts_total: c.drafts_total,
      pause_reason: c.pause_reason,
      skipped_count: c.skipped_count,
      success_count: c.success_count,
      error_count: c.error_count,
      bounce_count: c.bounce_count
    };

    let safeDraft = null;
    if (draft) {
      const body = String(draft.body || '');
      safeDraft = {
        recipient_user_id: draft.recipient_user_id,
        status: draft.status || 'draft',
        subject: draft.subject || '',
        bodyPreview: body.length > 160 ? `${body.slice(0, 160)}…` : body,
        personalized: draft.personalized,
        personalize_reason: draft.personalize_reason,
        updated_at: draft.updated_at || new Date().toISOString()
      };
    }

    broadcastCampaignUpdate({
      campaign: safeCampaign,
      progress: data.progress,
      draft: safeDraft,
      event
    });
    return data;
  } catch (error) {
    logger.warn(`[broadcastService] WS campaign update failed #${campaignId}: ${error.message}`);
    return null;
  }
}

async function listActiveCampaignIds() {
  const { rows } = await db.getQuery()(
    `SELECT id
     FROM broadcast_campaigns
     WHERE status = 'in_progress'
     ORDER BY id ASC`
  );

  return rows.map(row => row.id);
}

async function getCampaignById(campaignId) {
  const { rows } = await db.getQuery()(
    'SELECT * FROM broadcast_campaigns WHERE id = $1',
    [campaignId]
  );

  return rows[0] || null;
}

async function recordDelivery({
  campaignId,
  recipientUserId,
  status,
  channelResults = [],
  errorMessage = null
}) {
  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingDelivery = await client.query(
      `SELECT id, status
       FROM broadcast_deliveries
       WHERE campaign_id = $1 AND recipient_user_id = $2
       FOR UPDATE`,
      [campaignId, recipientUserId]
    );

    if (existingDelivery.rows.length) {
      const previousStatus = existingDelivery.rows[0].status;
      const deliveryId = existingDelivery.rows[0].id;

      if (previousStatus === 'sent' && status === 'error') {
        await client.query('COMMIT');
        return;
      }

      if (previousStatus === status) {
        await client.query(
          `UPDATE broadcast_deliveries
           SET
             channel_results = $2::jsonb,
             error_message = $3,
             sent_at = NOW(),
             updated_at = NOW()
           WHERE id = $1`,
          [deliveryId, JSON.stringify(channelResults), errorMessage]
        );
        await client.query('COMMIT');
        return;
      }

      if (previousStatus === 'draft' && (status === 'sent' || status === 'error' || status === 'bounced')) {
        await client.query(
          `UPDATE broadcast_deliveries
           SET
             status = $2,
             channel_results = $3::jsonb,
             error_message = $4,
             sent_at = NOW(),
             updated_at = NOW()
           WHERE id = $1`,
          [deliveryId, status, JSON.stringify(channelResults), errorMessage]
        );

        const counterField = status === 'sent'
          ? 'success_count'
          : status === 'bounced'
            ? 'bounce_count'
            : 'error_count';
        await client.query(
          `UPDATE broadcast_campaigns
           SET ${counterField} = ${counterField} + 1
           WHERE id = $1`,
          [campaignId]
        );
        await client.query('COMMIT');
        return;
      }

      if (previousStatus === 'error' && status === 'sent') {
        await client.query(
          `UPDATE broadcast_deliveries
           SET
             status = 'sent',
             channel_results = $2::jsonb,
             error_message = NULL,
             sent_at = NOW(),
             updated_at = NOW()
           WHERE id = $1`,
          [deliveryId, JSON.stringify(channelResults)]
        );
        await client.query(
          `UPDATE broadcast_campaigns
           SET
             success_count = success_count + 1,
             error_count = GREATEST(error_count - 1, 0)
           WHERE id = $1`,
          [campaignId]
        );
        await client.query('COMMIT');
        return;
      }

      await client.query('COMMIT');
      return;
    }

    await client.query(
      `INSERT INTO broadcast_deliveries (
        campaign_id,
        recipient_user_id,
        status,
        channel_results,
        error_message
      ) VALUES ($1, $2, $3, $4::jsonb, $5)`,
      [
        campaignId,
        recipientUserId,
        status,
        JSON.stringify(channelResults),
        errorMessage
      ]
    );

    const counterField = status === 'sent'
      ? 'success_count'
      : status === 'bounced'
        ? 'bounce_count'
        : 'error_count';
    await client.query(
      `UPDATE broadcast_campaigns
       SET ${counterField} = ${counterField} + 1
       WHERE id = $1`,
      [campaignId]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function completeCampaign({ campaignId, skippedCount = 0, actorId = null }) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    return null;
  }

  const recipientIds = getCampaignRecipientIds(campaign);
  const deliveredIds = await getDeliveredRecipientIds(campaignId);
  const pendingCount = recipientIds.filter(id => !deliveredIds.has(id)).length;
  const limitSkipped = Math.max(Number(campaign.total_recipients || 0) - Number(campaign.planned_recipients || 0), 0);
  const computedSkipped = Math.max(
    Number(skippedCount) || 0,
    limitSkipped + pendingCount
  );

  const { rows } = await db.getQuery()(
    `UPDATE broadcast_campaigns
     SET
       skipped_count = $2,
       status = 'completed',
       completed_at = NOW(),
       current_index = planned_recipients
     WHERE id = $1 AND status = 'in_progress'
     RETURNING *`,
    [campaignId, computedSkipped]
  );

  if (rows[0]) {
    await recordEvent({
      campaignId,
      eventType: 'completed',
      actorId,
      details: {
        skipped_count: computedSkipped,
        success_count: rows[0].success_count,
        error_count: rows[0].error_count,
        bounce_count: rows[0].bounce_count
      }
    });
    await emitCampaignWsUpdate(campaignId, { event: 'completed' });
  }

  return rows[0] || null;
}

async function getHistory({ limit = 20, offset = 0, dateFrom = '', dateTo = '' } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const where = [];
  const params = [];
  let idx = 1;

  if (dateFrom) {
    where.push(`DATE(c.started_at) >= $${idx++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    where.push(`DATE(c.started_at) <= $${idx++}`);
    params.push(dateTo);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [itemsResult, totalResult] = await Promise.all([
    db.getQuery()(
      `SELECT
        c.id,
        c.sender_id,
        c.subject,
        c.message_preview,
        c.total_recipients,
        c.planned_recipients,
        c.success_count,
        c.error_count,
        c.bounce_count,
        c.skipped_count,
        c.warmup_mode,
        c.delay_seconds,
        c.attachments_count,
        c.status,
        c.started_at,
        c.completed_at,
        COUNT(t.id) FILTER (WHERE t.open_count > 0)::int AS opened_emails,
        COUNT(t.id)::int AS tracked_emails
      FROM broadcast_campaigns c
      LEFT JOIN broadcast_email_tracking t ON t.campaign_id = c.id
      ${whereSql}
      GROUP BY c.id
      ORDER BY c.started_at DESC
      LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, safeLimit, safeOffset]
    ),
    db.getQuery()(
      `SELECT COUNT(*)::int AS total FROM broadcast_campaigns c ${whereSql}`,
      params
    )
  ]);

  return {
    campaigns: itemsResult.rows,
    total: totalResult.rows[0]?.total || 0,
    limit: safeLimit,
    offset: safeOffset
  };
}

async function getCampaignDetails(campaignId) {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    return null;
  }

  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  const deliveriesResult = await db.getQuery()(
    `SELECT
      d.id,
      d.recipient_user_id,
      d.status,
      d.channel_results,
      d.error_message,
      d.sent_at,
      d.bounced_at,
      t.open_count,
      t.first_opened_at,
      t.last_opened_at,
      COALESCE(
        t.recipient_email,
        (
          SELECT decrypt_text(ui.provider_id_encrypted, $2)
          FROM user_identities ui
          WHERE ui.user_id = d.recipient_user_id
            AND decrypt_text(ui.provider_encrypted, $2) = 'email'
          LIMIT 1
        )
      ) AS recipient_email
    FROM broadcast_deliveries d
    LEFT JOIN broadcast_email_tracking t
      ON t.campaign_id = d.campaign_id
      AND t.recipient_user_id = d.recipient_user_id
    WHERE d.campaign_id = $1
    ORDER BY d.sent_at ASC`,
    [campaignId, encryptionKey]
  );

  const emailOpens = await emailTrackingService.getOpenStatsByCampaign(campaignId);

  return {
    campaign,
    deliveries: deliveriesResult.rows,
    emailOpens
  };
}

async function getAnalytics() {
  const [
    totalsResult,
    channelResult,
    dailyResult,
    recentResult,
    emailOpens
  ] = await Promise.all([
    db.getQuery()(
      `SELECT
        COUNT(*)::int AS total_campaigns,
        COALESCE(SUM(success_count), 0)::int AS total_success,
        COALESCE(SUM(error_count), 0)::int AS total_errors,
        COALESCE(SUM(bounce_count), 0)::int AS total_bounces,
        COALESCE(SUM(planned_recipients), 0)::int AS total_planned,
        COALESCE(SUM(skipped_count), 0)::int AS total_skipped
      FROM broadcast_campaigns`
    ),
    db.getQuery()(
      `SELECT
        channel_item->>'channel' AS channel,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE channel_item->>'status' IN ('sent', 'saved'))::int AS success_count,
        COUNT(*) FILTER (WHERE channel_item->>'status' = 'error')::int AS error_count
      FROM broadcast_deliveries bd
      CROSS JOIN LATERAL jsonb_array_elements(bd.channel_results) AS channel_item
      WHERE channel_item->>'channel' IS NOT NULL
      GROUP BY channel_item->>'channel'
      ORDER BY total DESC`
    ),
    db.getQuery()(
      `SELECT
        DATE(started_at) AS day,
        COUNT(*)::int AS campaigns_count,
        COALESCE(SUM(success_count), 0)::int AS success_count,
        COALESCE(SUM(error_count), 0)::int AS error_count,
        COALESCE(SUM(bounce_count), 0)::int AS bounce_count
      FROM broadcast_campaigns
      WHERE started_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(started_at)
      ORDER BY day ASC`
    ),
    db.getQuery()(
      `SELECT
        c.id,
        c.subject,
        c.success_count,
        c.error_count,
        c.bounce_count,
        c.planned_recipients,
        c.status,
        c.started_at,
        COUNT(t.id) FILTER (WHERE t.open_count > 0)::int AS opened_emails,
        COUNT(t.id)::int AS tracked_emails
      FROM broadcast_campaigns c
      LEFT JOIN broadcast_email_tracking t ON t.campaign_id = c.id
      GROUP BY c.id
      ORDER BY c.started_at DESC
      LIMIT 5`
    ),
    emailTrackingService.getOpenStats()
  ]);

  const totals = totalsResult.rows[0] || {};
  const attempted = Number(totals.total_success || 0)
    + Number(totals.total_errors || 0)
    + Number(totals.total_bounces || 0);
  const successRate = attempted > 0
    ? Math.round((Number(totals.total_success || 0) / attempted) * 100)
    : 0;

  return {
    totals: {
      campaigns: Number(totals.total_campaigns || 0),
      success: Number(totals.total_success || 0),
      errors: Number(totals.total_errors || 0),
      bounces: Number(totals.total_bounces || 0),
      planned: Number(totals.total_planned || 0),
      skipped: Number(totals.total_skipped || 0),
      successRate
    },
    byChannel: channelResult.rows,
    daily: dailyResult.rows,
    recentCampaigns: recentResult.rows,
    emailOpens
  };
}

async function getRecipientsSummary(recipientIds = []) {
  const uniqueRecipientIds = [...new Set(
    recipientIds
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)
  )];

  if (!uniqueRecipientIds.length) {
    return {
      total: 0,
      blocked: 0,
      withoutEmail: 0,
      withEmail: 0,
      missing: 0,
      blockedIds: [],
      withoutEmailIds: []
    };
  }

  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  const { rows } = await db.getQuery()(
    `SELECT
      u.id,
      u.is_blocked,
      EXISTS (
        SELECT 1
        FROM user_identities ui
        WHERE ui.user_id = u.id
          AND decrypt_text(ui.provider_encrypted, $2) = 'email'
          AND COALESCE(decrypt_text(ui.provider_id_encrypted, $2), '') <> ''
      ) AS has_email
    FROM users u
    WHERE u.id = ANY($1::int[])`,
    [uniqueRecipientIds, encryptionKey]
  );

  const foundIds = new Set(rows.map(row => row.id));
  const missingIds = uniqueRecipientIds.filter(id => !foundIds.has(id));
  const blockedIds = rows.filter(row => row.is_blocked).map(row => row.id);
  const withoutEmailIds = rows.filter(row => !row.has_email).map(row => row.id);

  return {
    total: uniqueRecipientIds.length,
    blocked: blockedIds.length,
    withoutEmail: withoutEmailIds.length + missingIds.length,
    withEmail: rows.filter(row => row.has_email && !row.is_blocked).length,
    missing: missingIds.length,
    blockedIds,
    withoutEmailIds: [...withoutEmailIds, ...missingIds]
  };
}

async function listTemplates() {
  const { ensureBroadcastComposeSchema } = require('../utils/broadcastEmailCompose');
  await ensureBroadcastComposeSchema(db.getQuery());

  const { rows } = await db.getQuery()(
    `SELECT
      id,
      name,
      subject,
      body,
      greeting,
      signature,
      legal_footer,
      created_by,
      created_at,
      updated_at
    FROM broadcast_templates
    ORDER BY updated_at DESC, id DESC`
  );

  return rows;
}

async function getTemplateById(templateId) {
  const { ensureBroadcastComposeSchema } = require('../utils/broadcastEmailCompose');
  await ensureBroadcastComposeSchema(db.getQuery());

  const { rows } = await db.getQuery()(
    'SELECT * FROM broadcast_templates WHERE id = $1',
    [templateId]
  );

  return rows[0] || null;
}

async function createTemplate({
  name,
  subject,
  body,
  greeting = '',
  signature = '',
  legalFooter = '',
  createdBy
}) {
  const { ensureBroadcastComposeSchema, resolveGreeting, normalizePart } = require('../utils/broadcastEmailCompose');
  await ensureBroadcastComposeSchema(db.getQuery());

  const normalizedName = String(name || '').trim();
  const normalizedSubject = String(subject || '').trim();
  const normalizedBody = String(body || '').trim();
  const normalizedGreeting = resolveGreeting(greeting);
  const normalizedSignature = normalizePart(signature) || null;
  const normalizedLegal = normalizePart(legalFooter) || null;

  const { rows } = await db.getQuery()(
    `INSERT INTO broadcast_templates (name, subject, body, greeting, signature, legal_footer, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      normalizedName,
      normalizedSubject,
      normalizedBody,
      normalizedGreeting,
      normalizedSignature,
      normalizedLegal,
      createdBy || null
    ]
  );

  return rows[0];
}

async function updateTemplate(templateId, {
  name,
  subject,
  body,
  greeting = '',
  signature = '',
  legalFooter = ''
}) {
  const { ensureBroadcastComposeSchema, resolveGreeting, normalizePart } = require('../utils/broadcastEmailCompose');
  await ensureBroadcastComposeSchema(db.getQuery());

  const normalizedName = String(name || '').trim();
  const normalizedSubject = String(subject || '').trim();
  const normalizedBody = String(body || '').trim();
  const normalizedGreeting = resolveGreeting(greeting);
  const normalizedSignature = normalizePart(signature) || null;
  const normalizedLegal = normalizePart(legalFooter) || null;

  const { rows } = await db.getQuery()(
    `UPDATE broadcast_templates
     SET
       name = $2,
       subject = $3,
       body = $4,
       greeting = $5,
       signature = $6,
       legal_footer = $7,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      templateId,
      normalizedName,
      normalizedSubject,
      normalizedBody,
      normalizedGreeting,
      normalizedSignature,
      normalizedLegal
    ]
  );

  return rows[0] || null;
}

async function deleteTemplate(templateId) {
  const { rowCount } = await db.getQuery()(
    'DELETE FROM broadcast_templates WHERE id = $1',
    [templateId]
  );

  return rowCount > 0;
}

async function deleteCampaigns(campaignIds = []) {
  const uniqueIds = [...new Set(
    campaignIds
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)
  )];

  if (!uniqueIds.length) {
    throw new Error('campaign_ids is empty');
  }

  const { rowCount } = await db.getQuery()(
    'DELETE FROM broadcast_campaigns WHERE id = ANY($1::int[])',
    [uniqueIds]
  );

  return { deleted: rowCount };
}

async function recordBounce({
  recipientEmail,
  diagnosticMessage = null,
  bounceMessageId = null
}) {
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const normalizedEmail = String(recipientEmail || '').trim().toLowerCase();

  if (!normalizedEmail) {
    return { processed: false, reason: 'no_email' };
  }

  const userResult = await db.getQuery()(
    `SELECT u.id
     FROM users u
     JOIN user_identities ui ON ui.user_id = u.id
     WHERE decrypt_text(ui.provider_encrypted, $1) = 'email'
       AND LOWER(decrypt_text(ui.provider_id_encrypted, $1)) = $2
     LIMIT 1`,
    [encryptionKey, normalizedEmail]
  );

  if (!userResult.rows.length) {
    return { processed: false, reason: 'user_not_found', email: normalizedEmail };
  }

  const recipientUserId = userResult.rows[0].id;

  const deliveryResult = await db.getQuery()(
    `SELECT d.id, d.campaign_id, d.status
     FROM broadcast_deliveries d
     LEFT JOIN broadcast_email_tracking t
       ON t.campaign_id = d.campaign_id
       AND t.recipient_user_id = d.recipient_user_id
     WHERE d.recipient_user_id = $1
       AND d.status IN ('sent', 'bounced')
     ORDER BY
       CASE WHEN d.status = 'sent' THEN 0 ELSE 1 END,
       d.sent_at DESC
     LIMIT 1`,
    [recipientUserId]
  );

  if (!deliveryResult.rows.length) {
    return { processed: false, reason: 'no_delivery', email: normalizedEmail };
  }

  const delivery = deliveryResult.rows[0];
  if (delivery.status === 'bounced') {
    return {
      processed: false,
      reason: 'already_bounced',
      deliveryId: delivery.id,
      campaignId: delivery.campaign_id,
      email: normalizedEmail
    };
  }

  const pool = db.getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockedDelivery = await client.query(
      `SELECT id, campaign_id, status
       FROM broadcast_deliveries
       WHERE id = $1
       FOR UPDATE`,
      [delivery.id]
    );

    if (!lockedDelivery.rows.length || lockedDelivery.rows[0].status !== 'sent') {
      await client.query('COMMIT');
      return {
        processed: false,
        reason: 'already_updated',
        deliveryId: delivery.id,
        campaignId: delivery.campaign_id,
        email: normalizedEmail
      };
    }

    const bounceText = String(diagnosticMessage || '').trim() || 'Отказ доставки (bounce/NDR)';

    await client.query(
      `UPDATE broadcast_deliveries
       SET
         status = 'bounced',
         error_message = $2,
         bounced_at = NOW()
       WHERE id = $1`,
      [delivery.id, bounceText]
    );

    await client.query(
      `UPDATE broadcast_campaigns
       SET
         success_count = GREATEST(success_count - 1, 0),
         bounce_count = bounce_count + 1
       WHERE id = $1`,
      [delivery.campaign_id]
    );

    await client.query('COMMIT');

    return {
      processed: true,
      deliveryId: delivery.id,
      campaignId: delivery.campaign_id,
      recipientUserId,
      email: normalizedEmail,
      bounceMessageId: bounceMessageId || null
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createCampaign,
  getCampaignById,
  recordDelivery,
  recordBounce,
  completeCampaign,
  getHistory,
  getCampaignDetails,
  getAnalytics,
  getRecipientsSummary,
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  deleteCampaigns,
  saveCampaignAttachments,
  loadCampaignAttachments,
  recordEvent,
  getCampaignEvents,
  getDeliveredRecipientIds,
  getFinalizedRecipientIds,
  getCampaignRecipientIds,
  updateCurrentIndex,
  startCampaign,
  pauseCampaign,
  interruptCampaign,
  getCampaignProgress,
  emitCampaignWsUpdate,
  listActiveCampaignIds,
  parseRecipientIds
};
