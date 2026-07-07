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

const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');

const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);

let cachedBaseUrl = null;
let cacheExpiresAt = 0;

async function getPublicBaseUrl() {
  const now = Date.now();
  if (cachedBaseUrl && cacheExpiresAt > now) {
    return cachedBaseUrl;
  }

  try {
    const encryptedDb = require('./encryptedDatabaseService');
    const settings = await encryptedDb.getData('vds_settings', {}, 1);
    const domain = settings?.[0]?.domain ? String(settings[0].domain).trim() : '';
    if (domain) {
      cachedBaseUrl = `https://${domain.replace(/^https?:\/\//i, '').replace(/\/$/, '')}`;
      cacheExpiresAt = now + 60_000;
      return cachedBaseUrl;
    }
  } catch (error) {
    logger.warn('[EmailTracking] Failed to resolve BASE_URL from vds_settings:', error.message);
  }

  const fallback = process.env.BASE_URL || process.env.PUBLIC_URL || 'http://localhost:8000';
  cachedBaseUrl = String(fallback).replace(/\/$/, '');
  cacheExpiresAt = now + 60_000;
  return cachedBaseUrl;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlEmailBody(text, trackingToken, baseUrl) {
  const resolvedBaseUrl = String(baseUrl || '').replace(/\/$/, '');
  const pixelUrl = `${resolvedBaseUrl}/api/email/track/${trackingToken}.gif`;
  const bodyHtml = escapeHtml(text).replace(/\r?\n/g, '<br>');

  return [
    '<!DOCTYPE html>',
    '<html><body style="margin:0;padding:0;">',
    '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#333;">',
    bodyHtml,
    `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`,
    '</div>',
    '</body></html>'
  ].join('');
}

async function createTracking({ campaignId, recipientUserId, recipientEmail = null }) {
  const token = crypto.randomBytes(24).toString('hex');

  const { rows } = await db.getQuery()(
    `INSERT INTO broadcast_email_tracking (
      token,
      campaign_id,
      recipient_user_id,
      recipient_email
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (campaign_id, recipient_user_id)
    DO UPDATE SET
      token = EXCLUDED.token,
      recipient_email = EXCLUDED.recipient_email,
      open_count = 0,
      first_opened_at = NULL,
      last_opened_at = NULL,
      created_at = NOW()
    RETURNING token`,
    [token, campaignId, recipientUserId, recipientEmail]
  );

  return rows[0].token;
}

async function recordOpen(rawToken, metadata = {}) {
  const token = String(rawToken || '').replace(/\.gif$/i, '').trim();
  if (!token) {
    return null;
  }

  const { rows } = await db.getQuery()(
    `UPDATE broadcast_email_tracking
     SET
       open_count = open_count + 1,
       first_opened_at = COALESCE(first_opened_at, NOW()),
       last_opened_at = NOW()
     WHERE token = $1
     RETURNING id, campaign_id, recipient_user_id, open_count, first_opened_at`,
    [token]
  );

  return rows[0] || null;
}

async function getOpenStats() {
  const { rows } = await db.getQuery()(
    `SELECT
      COUNT(*)::int AS tracked_emails,
      COUNT(*) FILTER (WHERE open_count > 0)::int AS opened_emails,
      COALESCE(SUM(open_count), 0)::int AS total_opens
    FROM broadcast_email_tracking`
  );

  const stats = rows[0] || {};
  const tracked = Number(stats.tracked_emails || 0);
  const opened = Number(stats.opened_emails || 0);

  return {
    trackedEmails: tracked,
    openedEmails: opened,
    totalOpens: Number(stats.total_opens || 0),
    openRate: tracked > 0 ? Math.round((opened / tracked) * 100) : 0
  };
}

async function getOpenStatsByCampaign(campaignId) {
  const { rows } = await db.getQuery()(
    `SELECT
      COUNT(*)::int AS tracked_emails,
      COUNT(*) FILTER (WHERE open_count > 0)::int AS opened_emails,
      COALESCE(SUM(open_count), 0)::int AS total_opens
    FROM broadcast_email_tracking
    WHERE campaign_id = $1`,
    [campaignId]
  );

  const stats = rows[0] || {};
  const tracked = Number(stats.tracked_emails || 0);
  const opened = Number(stats.opened_emails || 0);

  return {
    trackedEmails: tracked,
    openedEmails: opened,
    totalOpens: Number(stats.total_opens || 0),
    openRate: tracked > 0 ? Math.round((opened / tracked) * 100) : 0
  };
}

async function getTrackingByCampaign(campaignId) {
  const { rows } = await db.getQuery()(
    `SELECT
      recipient_user_id,
      recipient_email,
      open_count,
      first_opened_at,
      last_opened_at
    FROM broadcast_email_tracking
    WHERE campaign_id = $1`,
    [campaignId]
  );

  return rows;
}

module.exports = {
  TRANSPARENT_GIF,
  getPublicBaseUrl,
  buildHtmlEmailBody,
  createTracking,
  recordOpen,
  getOpenStats,
  getOpenStatsByCampaign,
  getTrackingByCampaign
};
