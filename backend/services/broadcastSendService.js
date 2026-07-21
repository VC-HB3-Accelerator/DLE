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
const botManager = require('./botManager');
const broadcastService = require('./broadcastService');
const emailTrackingService = require('./emailTrackingService');
const { isUserBlocked } = require('../utils/userUtils');
const { broadcastMessagesUpdate } = require('../wsHub');

async function saveBroadcastOutgoingMessage({
  conversationId,
  senderId,
  recipientUserId,
  content,
  channel,
  encryptionKey
}) {
  await db.getQuery()(
    `INSERT INTO messages (
      conversation_id,
      sender_id,
      sender_type_encrypted,
      content_encrypted,
      channel_encrypted,
      role_encrypted,
      direction_encrypted,
      message_type,
      user_id,
      role,
      direction,
      created_at
    ) VALUES (
      $1, $2,
      encrypt_text($3, $12),
      encrypt_text($4, $12),
      encrypt_text($5, $12),
      encrypt_text($6, $12),
      encrypt_text($7, $12),
      $8, $9, $10, $11,
      NOW()
    )`,
    [
      conversationId,
      senderId,
      'editor',
      content,
      channel,
      'editor',
      'outgoing',
      'user_chat',
      recipientUserId,
      'user',
      'outgoing',
      encryptionKey
    ]
  );
}

async function getOrCreateConversation(recipientUserId) {
  const conversationResult = await db.getQuery()(
    'SELECT id, user_id, created_at, updated_at, title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
    [recipientUserId]
  );

  if (conversationResult.rows.length > 0) {
    return conversationResult.rows[0];
  }

  const title = `Чат с пользователем ${recipientUserId}`;
  const newConv = await db.getQuery()(
    'INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
    [recipientUserId, title]
  );
  return newConv.rows[0];
}

async function sendToRecipient({
  recipientUserId,
  senderId,
  subject,
  content,
  attachments = [],
  campaignId = null,
  recordDelivery = true
}) {
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const trimmedContent = String(content || '').trim();
  const normalizedCampaignId = Number(campaignId) || null;

  if (await isUserBlocked(recipientUserId)) {
    const blockedError = 'Пользователь заблокирован. Рассылка невозможна.';
    if (normalizedCampaignId && recordDelivery) {
      await broadcastService.recordDelivery({
        campaignId: normalizedCampaignId,
        recipientUserId,
        status: 'error',
        channelResults: [],
        errorMessage: blockedError
      });
    }
    return {
      success: false,
      statusCode: 403,
      error: blockedError,
      results: []
    };
  }

  const identitiesRes = await db.getQuery()(
    'SELECT decrypt_text(provider_encrypted, $2) as provider, decrypt_text(provider_id_encrypted, $2) as provider_id FROM user_identities WHERE user_id = $1',
    [recipientUserId, encryptionKey]
  );
  const identities = identitiesRes.rows;
  const conversation = await getOrCreateConversation(recipientUserId);
  const results = [];
  let sent = false;

  const email = identities.find(i => i.provider === 'email')?.provider_id;
  if (email) {
    try {
      const emailBot = botManager.getBot('email');
      if (emailBot && emailBot.isInitialized) {
        let trackingToken = null;
        if (normalizedCampaignId) {
          trackingToken = await emailTrackingService.createTracking({
            campaignId: normalizedCampaignId,
            recipientUserId,
            recipientEmail: email
          });
        }

        const publicBaseUrl = await emailTrackingService.getPublicBaseUrl();
        let legalFooter = '';
        if (normalizedCampaignId) {
          try {
            const campaign = await broadcastService.getCampaignById(normalizedCampaignId);
            legalFooter = String(campaign?.legal_footer || '').trim();
          } catch (_) {
            // ignore — HTML всё равно соберётся с fingerprint-эвристикой
          }
        }

        const emailHtml = trackingToken
          ? emailTrackingService.buildHtmlEmailBody(
            trimmedContent,
            trackingToken,
            publicBaseUrl,
            { legalFooter }
          )
          : emailTrackingService.buildHtmlEmailBody(
            trimmedContent,
            null,
            publicBaseUrl,
            { legalFooter }
          );

        await emailBot.sendEmail(email, subject, trimmedContent, attachments, { html: emailHtml });
        await saveBroadcastOutgoingMessage({
          conversationId: conversation.id,
          senderId,
          recipientUserId,
          content: trimmedContent,
          channel: 'email',
          encryptionKey
        });
        results.push({ channel: 'email', status: 'sent' });
        sent = true;
      } else {
        results.push({ channel: 'email', status: 'error', error: 'Email-бот не инициализирован' });
      }
    } catch (err) {
      logger.error(`[broadcastSendService] Email error for user ${recipientUserId}:`, err);
      results.push({ channel: 'email', status: 'error', error: err.message });
    }
  }

  const telegram = identities.find(i => i.provider === 'telegram')?.provider_id;
  if (telegram) {
    try {
      const telegramBot = botManager.getBot('telegram');
      if (telegramBot && telegramBot.isInitialized) {
        const bot = telegramBot.getBot();
        await bot.telegram.sendMessage(telegram, trimmedContent);
        await saveBroadcastOutgoingMessage({
          conversationId: conversation.id,
          senderId,
          recipientUserId,
          content: trimmedContent,
          channel: 'telegram',
          encryptionKey
        });
        results.push({ channel: 'telegram', status: 'sent' });
        sent = true;
      } else {
        results.push({ channel: 'telegram', status: 'error', error: 'Telegram-бот не инициализирован' });
      }
    } catch (err) {
      logger.error(`[broadcastSendService] Telegram error for user ${recipientUserId}:`, err);
      results.push({ channel: 'telegram', status: 'error', error: err.message });
    }
  }

  const wallet = identities.find(i => i.provider === 'wallet')?.provider_id;
  if (wallet) {
    try {
      await saveBroadcastOutgoingMessage({
        conversationId: conversation.id,
        senderId,
        recipientUserId,
        content: trimmedContent,
        channel: 'wallet',
        encryptionKey
      });
      results.push({ channel: 'wallet', status: 'saved' });
      sent = true;
    } catch (err) {
      logger.error(`[broadcastSendService] Wallet save error for user ${recipientUserId}:`, err);
      results.push({ channel: 'wallet', status: 'error', error: err.message });
    }
  }

  if (!sent) {
    const channelErrors = results.filter(item => item.status === 'error');
    const errorMessage = channelErrors.length
      ? channelErrors.map(item => `${item.channel}: ${item.error}`).join('; ')
      : 'У пользователя нет ни одного канала для рассылки.';

    if (normalizedCampaignId && recordDelivery) {
      await broadcastService.recordDelivery({
        campaignId: normalizedCampaignId,
        recipientUserId,
        status: 'error',
        channelResults: results,
        errorMessage
      });
    }

    return {
      success: false,
      statusCode: 400,
      error: errorMessage,
      results
    };
  }

  if (normalizedCampaignId && recordDelivery) {
    await broadcastService.recordDelivery({
      campaignId: normalizedCampaignId,
      recipientUserId,
      status: 'sent',
      channelResults: results
    });
  }

  try {
    broadcastMessagesUpdate();
  } catch (wsError) {
    logger.warn('[broadcastSendService] WebSocket update failed:', wsError.message);
  }

  return {
    success: true,
    results
  };
}

module.exports = {
  sendToRecipient,
  saveBroadcastOutgoingMessage,
  getOrCreateConversation
};
