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
const broadcastDraftService = require('./broadcastDraftService');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForEmailBot(maxWaitMs = 120000) {
  const botManager = require('./botManager');
  const stepMs = 2000;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const emailBot = botManager.getBot('email');
    if (emailBot?.isInitialized) {
      return true;
    }
    if (emailBot?.status === 'not_configured') {
      logger.warn('[BroadcastQueue] Email-бот не настроен');
      return false;
    }
    await sleep(stepMs);
  }

  logger.warn('[BroadcastQueue] Таймаут ожидания инициализации Email-бота');
  return false;
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

    try {
      await waitForEmailBot();
      const campaignIds = await broadcastService.listActiveCampaignIds();

      if (!campaignIds.length) {
        logger.info('[BroadcastQueue] Нет активных рассылок для возобновления');
      } else {
        logger.info(`[BroadcastQueue] Возобновление рассылок: ${campaignIds.join(', ')}`);
        for (const campaignId of campaignIds) {
          this.enqueue(campaignId);
        }
      }

      this.initialized = true;
    } catch (error) {
      logger.error('[BroadcastQueue] Ошибка инициализации очереди:', error);
      throw error;
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

  async waitForScheduleWindow(campaignId) {
    let loggedOutside = false;

    while (true) {
      const campaign = await broadcastService.getCampaignById(campaignId);
      if (!campaign || campaign.status !== 'in_progress') {
        return false;
      }

      if (broadcastDraftService.isWithinSchedule(campaign)) {
        if (loggedOutside) {
          logger.info(`[BroadcastQueue] Campaign ${campaignId}: окно отправки открыто`);
        }
        return true;
      }

      if (!loggedOutside) {
        logger.info(
          `[BroadcastQueue] Campaign ${campaignId}: вне окна расписания `
          + `(days=${JSON.stringify(campaign.schedule_days)}, `
          + `${campaign.schedule_hour_start}-${campaign.schedule_hour_end} ${campaign.schedule_timezone})`
        );
        loggedOutside = true;
      }

      await sleep(30000);
    }
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

      if (campaign.status === 'queued' || campaign.status === 'ready') {
        campaign = await broadcastService.startCampaign({ campaignId });
      }

      if (!campaign || campaign.status !== 'in_progress') {
        return;
      }

      const emailReady = await waitForEmailBot();
      if (!emailReady) {
        logger.warn(`[BroadcastQueue] Кампания ${campaignId}: Email-бот не готов — ставим на паузу`);
        await broadcastService.pauseCampaign({
          campaignId,
          reason: 'Email-бот не готов, отправка отложена'
        }).catch((error) => {
          logger.error(`[BroadcastQueue] Не удалось поставить кампанию ${campaignId} на паузу: ${error.message}`);
        });
        return;
      }

      const recipientIds = broadcastService.getCampaignRecipientIds(campaign);
      if (!recipientIds.length) {
        await broadcastService.completeCampaign({ campaignId });
        return;
      }

      const attachments = await broadcastService.loadCampaignAttachments(campaignId);
      const finalizedIds = await broadcastService.getFinalizedRecipientIds(campaignId);
      const pendingRecipientIds = recipientIds.filter(id => !finalizedIds.has(id));

      if (!pendingRecipientIds.length) {
        await broadcastService.completeCampaign({ campaignId });
        logger.info(`[BroadcastQueue] Кампания ${campaignId} завершена, все получатели обработаны`);
        return;
      }

      for (let index = 0; index < pendingRecipientIds.length; index += 1) {
        campaign = await broadcastService.getCampaignById(campaignId);
        if (!campaign || campaign.status !== 'in_progress') {
          logger.info(`[BroadcastQueue] Кампания ${campaignId} остановлена со статусом ${campaign?.status || 'missing'}`);
          return;
        }

        const withinWindow = await this.waitForScheduleWindow(campaignId);
        if (!withinWindow) {
          return;
        }

        const recipientUserId = pendingRecipientIds[index];
        await broadcastService.updateCurrentIndex(
          campaignId,
          recipientIds.indexOf(recipientUserId) + 1
        );

        try {
          const draft = await broadcastDraftService.getDraft({
            campaignId,
            recipientUserId
          });

          if (!draft || draft.status !== 'draft' || !String(draft.body || '').trim()) {
            throw new Error('Черновик не готов');
          }

          const sendSubject = String(draft.subject || campaign.subject || '').trim() || 'Новое сообщение';
          const sendContent = String(draft.body || '').trim();

          const result = await broadcastSendService.sendToRecipient({
            recipientUserId,
            senderId: campaign.sender_id,
            subject: sendSubject,
            content: sendContent,
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
          campaign = await broadcastService.getCampaignById(campaignId);
          const canContinue = await this.interruptibleDelay(campaignId, campaign?.delay_seconds);
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
