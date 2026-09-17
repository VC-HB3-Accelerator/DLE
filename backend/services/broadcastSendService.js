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
const conversationService = require('./conversationService');
const { isUserBlocked } = require('../utils/userUtils');
const { broadcastMessagesUpdate } = require('../wsHub');

/**
 * Публичное сообщение рассылки на карточку получателя (TZ_CHAT_SYSTEM §2.3 / §1).
 * Не user_chat — иначе попадает в ИИ-ленту, а не в public.
 */
async function saveBroadcastPublicMessage({
  conversationId,
  senderId,
  recipientUserId,
  content,
  channel,
  encryptionKey,
  campaignId = null
}) {
  const metadata = campaignId
    ? { broadcast_campaign_id: Number(campaignId) }
    : {};

  const { rows } = await db.getQuery()(
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
      metadata,
      created_at
    ) VALUES (
      $1, $2,
      encrypt_text($3, $10),
      encrypt_text($4, $10),
      encrypt_text($5, $10),
      encrypt_text($6, $10),
      encrypt_text($7, $10),
      'public',
      $8,
      'user',
      'incoming',
      $9::jsonb,
      NOW()
    ) RETURNING id`,
    [
      conversationId,
      senderId,
      'editor',
      content,
      channel,
      'user',
      'incoming',
      recipientUserId,
      JSON.stringify(metadata),
      encryptionKey
    ]
  );
  return rows[0]?.id || null;
}

/** @deprecated use conversationService.getOrCreatePublicConversation */
async function getOrCreateConversation(recipientUserId) {
  // Черновики/превью привязываем к public_chat паре; sender берём из кампании позже —
  // для черновика достаточно беседы на карточке получателя с самим собой как placeholder host.
  // Реальная отправка всегда создаёт public через getOrCreatePublicConversation(sender, recipient).
  return conversationService.getOrCreateConversation(recipientUserId);
}

async function sendToRecipient({
  recipientUserId,
  senderId,
  subject,
  content,
  attachments = [],
  campaignId = null,
  recordDelivery = true,
  channels = null
}) {
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  const trimmedContent = String(content || '').trim();
  const normalizedCampaignId = Number(campaignId) || null;
  const enabled = new Set(broadcastService.normalizeBroadcastChannels(channels));

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

  if (!trimmedContent) {
    const emptyError = 'Пустой текст рассылки';
    if (normalizedCampaignId && recordDelivery) {
      await broadcastService.recordDelivery({
        campaignId: normalizedCampaignId,
        recipientUserId,
        status: 'error',
        channelResults: [],
        errorMessage: emptyError
      });
    }
    return {
      success: false,
      statusCode: 400,
      error: emptyError,
      results: []
    };
  }

  const identitiesRes = await db.getQuery()(
    `SELECT decrypt_text(provider_encrypted, $2) as provider,
            decrypt_text(provider_id_encrypted, $2) as provider_id,
            COALESCE(is_primary, false) as is_primary
     FROM user_identities WHERE user_id = $1`,
    [recipientUserId, encryptionKey]
  );
  const identities = identitiesRes.rows;
  const results = [];
  let sent = false;
  let publicConversationId = null;

  // 1) Чат карточки (web/public)
  if (enabled.has('web')) {
    try {
      const conversation = await conversationService.getOrCreatePublicConversation(
        senderId,
        recipientUserId
      );
      publicConversationId = conversation.id;
      await saveBroadcastPublicMessage({
        conversationId: conversation.id,
        senderId,
        recipientUserId,
        content: trimmedContent,
        channel: 'web',
        encryptionKey,
        campaignId: normalizedCampaignId
      });
      results.push({ channel: 'web', status: 'sent' });
      sent = true;
    } catch (err) {
      logger.error(`[broadcastSendService] Public/web error for user ${recipientUserId}:`, err);
      results.push({ channel: 'web', status: 'error', error: err.message });
    }
  } else {
    results.push({ channel: 'web', status: 'skipped', error: 'Канал отключён в кампании' });
  }

  // 2) Email
  if (enabled.has('email')) {
    const email = identities.find(i => i.provider === 'email' && i.is_primary)?.provider_id
      || null;
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
              // ignore
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
          results.push({ channel: 'email', status: 'sent' });
          sent = true;
        } else {
          results.push({ channel: 'email', status: 'skipped', error: 'Email-бот не инициализирован' });
        }
      } catch (err) {
        logger.error(`[broadcastSendService] Email error for user ${recipientUserId}:`, err);
        results.push({ channel: 'email', status: 'error', error: err.message });
      }
    } else if (identities.some(i => i.provider === 'email')) {
      results.push({ channel: 'email', status: 'skipped', error: 'Нет основного email у контакта' });
    } else {
      results.push({ channel: 'email', status: 'skipped', error: 'У контакта нет email' });
    }
  } else {
    results.push({ channel: 'email', status: 'skipped', error: 'Канал отключён в кампании' });
  }

  // 3) Telegram
  if (enabled.has('telegram')) {
    const telegram = identities.find(i => i.provider === 'telegram')?.provider_id;
    if (telegram) {
      try {
        const telegramBot = botManager.getBot('telegram');
        if (telegramBot && telegramBot.isInitialized) {
          const bot = telegramBot.getBot();
          await bot.telegram.sendMessage(telegram, trimmedContent);
          results.push({ channel: 'telegram', status: 'sent' });
          sent = true;
        } else {
          results.push({ channel: 'telegram', status: 'skipped', error: 'Telegram-бот не инициализирован' });
        }
      } catch (err) {
        logger.error(`[broadcastSendService] Telegram error for user ${recipientUserId}:`, err);
        results.push({ channel: 'telegram', status: 'error', error: err.message });
      }
    } else {
      results.push({ channel: 'telegram', status: 'skipped', error: 'У контакта нет telegram' });
    }
  } else {
    results.push({ channel: 'telegram', status: 'skipped', error: 'Канал отключён в кампании' });
  }

  if (!sent) {
    const channelErrors = results.filter(item => item.status === 'error');
    const errorMessage = channelErrors.length
      ? channelErrors.map(item => `${item.channel}: ${item.error}`).join('; ')
      : 'Не удалось доставить рассылку ни в один выбранный канал.';

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
    broadcastMessagesUpdate(
      publicConversationId ? { conversationId: publicConversationId } : undefined
    );
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
  saveBroadcastPublicMessage,
  saveBroadcastOutgoingMessage: saveBroadcastPublicMessage,
  getOrCreateConversation
};
