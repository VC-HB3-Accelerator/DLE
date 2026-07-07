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

const db = require('../db');
const emailTrackingService = require('./emailTrackingService');

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
  recipientIds = [],
  warmupMode = false,
  delaySeconds = 0,
  maxRecipients = 0,
  attachmentsCount = 0
}) {
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

  const { rows } = await db.getQuery()(
    `INSERT INTO broadcast_campaigns (
      sender_id,
      subject,
      message_preview,
      total_recipients,
      planned_recipients,
      warmup_mode,
      delay_seconds,
      attachments_count,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'in_progress')
    RETURNING *`,
    [
      senderId,
      String(subject || '').trim() || 'Новое сообщение',
      buildMessagePreview(message),
      uniqueRecipientIds.length,
      plannedRecipients,
      Boolean(warmupMode),
      Math.max(0, Number(delaySeconds) || 0),
      Math.max(0, Number(attachmentsCount) || 0)
    ]
  );

  return rows[0];
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
      'SELECT id FROM broadcast_deliveries WHERE campaign_id = $1 AND recipient_user_id = $2',
      [campaignId, recipientUserId]
    );
    if (existingDelivery.rows.length) {
      await client.query('ROLLBACK');
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

    const counterField = status === 'sent' ? 'success_count' : 'error_count';
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

async function completeCampaign({ campaignId, skippedCount = 0 }) {
  const { rows } = await db.getQuery()(
    `UPDATE broadcast_campaigns
     SET
       skipped_count = $2,
       status = 'completed',
       completed_at = NOW()
     WHERE id = $1 AND status = 'in_progress'
     RETURNING *`,
    [campaignId, Math.max(0, Number(skippedCount) || 0)]
  );

  return rows[0] || null;
}

async function getHistory({ limit = 20, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);

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
      GROUP BY c.id
      ORDER BY c.started_at DESC
      LIMIT $1 OFFSET $2`,
      [safeLimit, safeOffset]
    ),
    db.getQuery()('SELECT COUNT(*)::int AS total FROM broadcast_campaigns')
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

  const deliveriesResult = await db.getQuery()(
    `SELECT
      d.id,
      d.recipient_user_id,
      d.status,
      d.channel_results,
      d.error_message,
      d.sent_at,
      t.open_count,
      t.first_opened_at,
      t.last_opened_at
    FROM broadcast_deliveries d
    LEFT JOIN broadcast_email_tracking t
      ON t.campaign_id = d.campaign_id
      AND t.recipient_user_id = d.recipient_user_id
    WHERE d.campaign_id = $1
    ORDER BY d.sent_at ASC`,
    [campaignId]
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
        COALESCE(SUM(error_count), 0)::int AS error_count
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
  const attempted = Number(totals.total_success || 0) + Number(totals.total_errors || 0);
  const successRate = attempted > 0
    ? Math.round((Number(totals.total_success || 0) / attempted) * 100)
    : 0;

  return {
    totals: {
      campaigns: Number(totals.total_campaigns || 0),
      success: Number(totals.total_success || 0),
      errors: Number(totals.total_errors || 0),
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
  const { rows } = await db.getQuery()(
    `SELECT
      id,
      name,
      subject,
      body,
      created_by,
      created_at,
      updated_at
    FROM broadcast_templates
    ORDER BY updated_at DESC, id DESC`
  );

  return rows;
}

async function getTemplateById(templateId) {
  const { rows } = await db.getQuery()(
    'SELECT * FROM broadcast_templates WHERE id = $1',
    [templateId]
  );

  return rows[0] || null;
}

async function createTemplate({ name, subject, body, createdBy }) {
  const normalizedName = String(name || '').trim();
  const normalizedSubject = String(subject || '').trim();
  const normalizedBody = String(body || '').trim();

  const { rows } = await db.getQuery()(
    `INSERT INTO broadcast_templates (name, subject, body, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [normalizedName, normalizedSubject, normalizedBody, createdBy || null]
  );

  return rows[0];
}

async function updateTemplate(templateId, { name, subject, body }) {
  const normalizedName = String(name || '').trim();
  const normalizedSubject = String(subject || '').trim();
  const normalizedBody = String(body || '').trim();

  const { rows } = await db.getQuery()(
    `UPDATE broadcast_templates
     SET
       name = $2,
       subject = $3,
       body = $4,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [templateId, normalizedName, normalizedSubject, normalizedBody]
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

module.exports = {
  createCampaign,
  getCampaignById,
  recordDelivery,
  completeCampaign,
  getHistory,
  getCampaignDetails,
  getAnalytics,
  getRecipientsSummary,
  listTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
