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
const logger = require('../utils/logger');
const broadcastService = require('./broadcastService');
const {
  isBounceNotification,
  parseBounceNotification
} = require('./emailBounceParser');

async function wasBounceProcessed(bounceMessageId, recipientEmail) {
  if (!bounceMessageId || !recipientEmail) {
    return false;
  }

  const { rows } = await db.getQuery()(
    `SELECT id
     FROM broadcast_bounce_events
     WHERE bounce_message_id = $1
       AND LOWER(recipient_email) = LOWER($2)
     LIMIT 1`,
    [bounceMessageId, recipientEmail]
  );

  return rows.length > 0;
}

async function logBounceEvent({
  bounceMessageId,
  recipientEmail,
  campaignId,
  deliveryId,
  diagnosticMessage
}) {
  await db.getQuery()(
    `INSERT INTO broadcast_bounce_events (
      bounce_message_id,
      recipient_email,
      campaign_id,
      delivery_id,
      diagnostic_message
    ) VALUES ($1, $2, $3, $4, $5)`,
    [
      bounceMessageId || null,
      recipientEmail,
      campaignId || null,
      deliveryId || null,
      diagnosticMessage || null
    ]
  );
}

async function processBounce(parsed, metadata = {}) {
  const bounce = parseBounceNotification(parsed, metadata.ownEmail || null);
  if (!bounce) {
    return { processed: false, reason: 'not_bounce' };
  }

  if (!bounce.failedRecipients.length) {
    logger.warn('[EmailBounce] Bounce detected but failed recipients not found', {
      subject: bounce.subject,
      bounceMessageId: bounce.bounceMessageId
    });
    return { processed: false, reason: 'no_recipients', bounce };
  }

  const results = [];

  for (const recipientEmail of bounce.failedRecipients) {
    if (bounce.bounceMessageId && await wasBounceProcessed(bounce.bounceMessageId, recipientEmail)) {
      results.push({
        recipientEmail,
        processed: false,
        reason: 'duplicate'
      });
      continue;
    }

    try {
      const result = await broadcastService.recordBounce({
        recipientEmail,
        diagnosticMessage: bounce.diagnosticMessage,
        bounceMessageId: bounce.bounceMessageId
      });
      results.push({ recipientEmail, ...result });

      if (result.processed) {
        await logBounceEvent({
          bounceMessageId: bounce.bounceMessageId,
          recipientEmail,
          campaignId: result.campaignId,
          deliveryId: result.deliveryId,
          diagnosticMessage: bounce.diagnosticMessage
        });
      }
    } catch (error) {
      logger.error(`[EmailBounce] Failed to record bounce for ${recipientEmail}:`, error);
      results.push({
        recipientEmail,
        processed: false,
        reason: 'record_error',
        error: error.message
      });
    }
  }

  const processedCount = results.filter(item => item.processed).length;
  logger.info(`[EmailBounce] Processed bounce for ${processedCount}/${bounce.failedRecipients.length} recipients`, {
    bounceMessageId: bounce.bounceMessageId,
    subject: bounce.subject
  });

  return {
    processed: processedCount > 0,
    processedCount,
    totalRecipients: bounce.failedRecipients.length,
    diagnosticMessage: bounce.diagnosticMessage,
    results
  };
}

module.exports = {
  isBounceNotification,
  parseBounceNotification,
  processBounce
};
