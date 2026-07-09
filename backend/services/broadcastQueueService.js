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

const logger = require('../utils/logger');
const broadcastService = require('./broadcastService');
const broadcastSendService = require('./broadcastSendService');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class BroadcastQueueService {
  constructor() {
    this.activeCampaigns = new Set();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    const campaignIds = await broadcastService.listActiveCampaignIds();

    if (!campaignIds.length) {
      logger.info('[BroadcastQueue] Нет активных рассылок для возобновления');
      return;
    }

    logger.info(`[BroadcastQueue] Возобновление рассылок: ${campaignIds.join(', ')}`);
    for (const campaignId of campaignIds) {
      this.enqueue(campaignId);
    }
  }

  enqueue(campaignId) {
    const normalizedId = Number(campaignId);
    if (!Number.isInteger(normalizedId) || normalizedId <= 0) {
      return;
    }

    if (this.activeCampaigns.has(normalizedId)) {
      return;
    }

    this.processCampaign(normalizedId).catch(error => {
      logger.error(`[BroadcastQueue] Ошибка обработки кампании ${normalizedId}:`, error);
    });
  }

  async interruptibleDelay(campaignId, delaySeconds) {
    const totalMs = Math.max(0, Number(delaySeconds) || 0) * 1000;
    if (!totalMs) {
      return true;
    }

    const stepMs = 1000;
    let elapsed = 0;

    while (elapsed < totalMs) {
      const campaign = await broadcastService.getCampaignById(campaignId);
      if (!campaign || campaign.status !== 'in_progress') {
        return false;
      }

      const chunk = Math.min(stepMs, totalMs - elapsed);
      await sleep(chunk);
      elapsed += chunk;
    }

    return true;
  }

  async processCampaign(campaignId) {
    if (this.activeCampaigns.has(campaignId)) {
      return;
    }

    this.activeCampaigns.add(campaignId);

    try {
      let campaign = await broadcastService.getCampaignById(campaignId);
      if (!campaign) {
        return;
      }

      if (campaign.status === 'queued') {
        campaign = await broadcastService.startCampaign({ campaignId });
      }

      if (!campaign || campaign.status !== 'in_progress') {
        return;
      }

      const recipientIds = broadcastService.getCampaignRecipientIds(campaign);
      if (!recipientIds.length) {
        await broadcastService.completeCampaign({ campaignId });
        return;
      }

      const attachments = await broadcastService.loadCampaignAttachments(campaignId);
      const deliveredIds = await broadcastService.getDeliveredRecipientIds(campaignId);
      const pendingRecipientIds = recipientIds.filter(id => !deliveredIds.has(id));
      const subject = String(campaign.subject || '').trim() || 'Новое сообщение';
      const message = String(campaign.message_body || campaign.message_preview || '').trim();

      for (let index = 0; index < pendingRecipientIds.length; index += 1) {
        campaign = await broadcastService.getCampaignById(campaignId);
        if (!campaign || campaign.status !== 'in_progress') {
          logger.info(`[BroadcastQueue] Кампания ${campaignId} остановлена со статусом ${campaign?.status || 'missing'}`);
          return;
        }

        const recipientUserId = pendingRecipientIds[index];
        await broadcastService.updateCurrentIndex(
          campaignId,
          recipientIds.indexOf(recipientUserId) + 1
        );

        try {
          const result = await broadcastSendService.sendToRecipient({
            recipientUserId,
            senderId: campaign.sender_id,
            subject,
            content: message,
            attachments,
            campaignId
          });

          if (!result.success) {
            logger.warn(`[BroadcastQueue] Campaign ${campaignId} recipient ${recipientUserId}: ${result.error}`);
          }
        } catch (error) {
          logger.error(`[BroadcastQueue] Campaign ${campaignId} recipient ${recipientUserId} failed:`, error);
          try {
            await broadcastService.recordDelivery({
              campaignId,
              recipientUserId,
              status: 'error',
              channelResults: [],
              errorMessage: error.message || 'Ошибка рассылки'
            });
          } catch (recordError) {
            logger.error(`[BroadcastQueue] Delivery record failed for campaign ${campaignId}:`, recordError);
          }
        }

        if (index < pendingRecipientIds.length - 1) {
          const canContinue = await this.interruptibleDelay(campaignId, campaign.delay_seconds);
          if (!canContinue) {
            return;
          }
        }
      }

      campaign = await broadcastService.getCampaignById(campaignId);
      if (campaign?.status === 'in_progress') {
        await broadcastService.completeCampaign({ campaignId });
        logger.info(`[BroadcastQueue] Кампания ${campaignId} завершена`);
      }
    } finally {
      this.activeCampaigns.delete(campaignId);
    }
  }
}

module.exports = new BroadcastQueueService();
