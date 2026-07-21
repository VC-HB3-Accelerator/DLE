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

import api from '@/api/axios';
import { i18n } from '@/locales/index.js';

const t = (key, params) => i18n.global.t(key, params);

// Вспомогательные функции для экспорта
async function getConversationByUserId(userId) {
  if (!userId) return null;
  const { data } = await api.get(`/messages/conversations?userId=${userId}`);
  return data;
}

export default {
  async getMessagesByUserId(userId) {
    if (!userId) return [];
    // Используем новый API для публичных сообщений конкретного пользователя
    const { data } = await api.get(`/messages/public?userId=${userId}`);
    return data;
  },
  async sendMessage({ conversationId, message, attachments = [], toUserId }) {
    const formData = new FormData();
    if (conversationId) formData.append('conversationId', conversationId);
    if (message) formData.append('message', message);
    if (toUserId) formData.append('toUserId', toUserId);
    attachments.forEach(file => {
      formData.append('attachments', file);
    });
    const { data } = await api.post('/chat/message', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      withCredentials: true
    });
    return data;
  },
  async getMessagesByConversationId(conversationId, options = {}) {
    if (!conversationId) return { success: true, messages: [] };
    const { limit = 50, offset = 0 } = options;
    const { data } = await api.get(`/messages/conversations/${conversationId}/messages`, {
      params: { limit, offset },
      withCredentials: true
    });
    return data;
  },
  async getConversationByUserId(userId) {
    return getConversationByUserId(userId);
  },
  async generateAiDraft(conversationId, messages, language = 'auto') {
    const { data } = await api.post('/chat/ai-draft', { conversationId, messages, language });
    return data;
  },
  async broadcastMessage({ userId, message, subject = t('messages.defaultSubject'), attachments = [], campaignId = null }) {
    if (attachments.length > 0) {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('content', message);
      formData.append('subject', subject);
      if (campaignId) {
        formData.append('campaign_id', campaignId);
      }
      attachments.forEach(attachment => {
        const file = attachment.file || attachment.raw || attachment;
        formData.append('attachments', file);
      });

      const { data } = await api.post('/messages/broadcast', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true
      });
      return data;
    }

    const { data } = await api.post('/messages/broadcast', {
      user_id: userId,
      content: message,
      subject,
      ...(campaignId ? { campaign_id: campaignId } : {})
    }, {
      withCredentials: true
    });
    return data;
  },
  async createBroadcastCampaign({
    subject,
    greeting = '',
    message,
    signature = '',
    legalFooter = '',
    recipientIds,
    warmupMode = false,
    delaySeconds = 0,
    maxRecipients = 0,
    attachments = [],
    autoPrepare = true,
    aiPersonalize = false,
    scheduleDays = [1, 2, 3, 4, 5],
    scheduleHourStart = 10,
    scheduleHourEnd = 18,
    scheduleTimezone = 'Europe/Moscow'
  }) {
    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('greeting', greeting);
    formData.append('message', message);
    formData.append('signature', signature);
    formData.append('legal_footer', legalFooter);
    formData.append('recipient_ids', JSON.stringify(recipientIds));
    formData.append('warmup_mode', warmupMode ? 'true' : 'false');
    formData.append('delay_seconds', String(delaySeconds));
    formData.append('max_recipients', String(maxRecipients));
    formData.append('auto_prepare', autoPrepare ? 'true' : 'false');
    formData.append('ai_personalize', aiPersonalize ? 'true' : 'false');
    formData.append('schedule_days', JSON.stringify(scheduleDays));
    formData.append('schedule_hour_start', String(scheduleHourStart));
    formData.append('schedule_hour_end', String(scheduleHourEnd));
    formData.append('schedule_timezone', scheduleTimezone);
    attachments.forEach(file => {
      formData.append('attachments', file);
    });

    const { data } = await api.post('/messages/broadcast/campaigns', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      withCredentials: true
    });
    return data;
  },
  async prepareBroadcastCampaign(campaignId, { useAi = true } = {}) {
    const { data } = await api.post(`/messages/broadcast/campaigns/${campaignId}/prepare`, {
      use_ai: useAi
    }, {
      withCredentials: true
    });
    return data;
  },
  async getBroadcastDrafts(campaignId) {
    const { data } = await api.get(`/messages/broadcast/campaigns/${campaignId}/drafts`, {
      withCredentials: true,
      params: { _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache' }
    });
    return data;
  },
  async getBroadcastDraft(campaignId, userId) {
    const { data } = await api.get(`/messages/broadcast/campaigns/${campaignId}/drafts/${userId}`, {
      withCredentials: true,
      params: { _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache' }
    });
    return data;
  },
  async saveBroadcastDraft(campaignId, userId, { subject, body }) {
    const { data } = await api.put(`/messages/broadcast/campaigns/${campaignId}/drafts/${userId}`, {
      subject,
      body
    }, {
      withCredentials: true
    });
    return data;
  },
  async getBroadcastAiAgentSettings() {
    const { data } = await api.get('/messages/broadcast/ai-agent/settings', {
      withCredentials: true
    });
    return data;
  },
  async getBroadcastAiAgentHistory({ limit = 50 } = {}) {
    const { data } = await api.get('/messages/broadcast/ai-agent/history', {
      params: { limit, _ts: Date.now() },
      withCredentials: true,
      headers: { 'Cache-Control': 'no-cache' }
    });
    return data;
  },
  async saveBroadcastAiAgentSettings(payload = {}) {
    const { data } = await api.put('/messages/broadcast/ai-agent/settings', payload, {
      withCredentials: true
    });
    return data;
  },
  async getBroadcastAiAgentModels(provider) {
    const { data } = await api.get('/messages/broadcast/ai-agent/models', {
      params: provider ? { provider } : undefined,
      withCredentials: true
    });
    return data;
  },
  async previewBroadcastAiAgent({
    userId,
    subject,
    greeting = '',
    body,
    signature = '',
    legalFooter = ''
  }) {
    const { data } = await api.post('/messages/broadcast/ai-agent/preview', {
      userId,
      subject,
      greeting,
      body,
      signature,
      legal_footer: legalFooter
    }, {
      withCredentials: true
    });
    return data;
  },
  async getBroadcastCampaignStatus(campaignId) {
    const { data } = await api.get(`/messages/broadcast/campaigns/${campaignId}/status`, {
      withCredentials: true,
      params: { _ts: Date.now() },
      headers: { 'Cache-Control': 'no-cache' }
    });
    return data;
  },
  async startBroadcastCampaign(campaignId) {
    const { data } = await api.post(`/messages/broadcast/campaigns/${campaignId}/start`, {}, {
      withCredentials: true
    });
    return data;
  },
  async pauseBroadcastCampaign(campaignId, { reason = '' } = {}) {
    const { data } = await api.post(`/messages/broadcast/campaigns/${campaignId}/pause`, {
      reason
    }, {
      withCredentials: true
    });
    return data;
  },
  async resumeBroadcastCampaign(campaignId) {
    const { data } = await api.post(`/messages/broadcast/campaigns/${campaignId}/resume`, {}, {
      withCredentials: true
    });
    return data;
  },
  async interruptBroadcastCampaign(campaignId, { reason = '' } = {}) {
    const { data } = await api.post(`/messages/broadcast/campaigns/${campaignId}/interrupt`, {
      reason
    }, {
      withCredentials: true
    });
    return data;
  },
  async getBroadcastCampaignEvents(campaignId, { limit = 50 } = {}) {
    const { data } = await api.get(`/messages/broadcast/campaigns/${campaignId}/events`, {
      params: { limit },
      withCredentials: true
    });
    return data;
  },
  async completeBroadcastCampaign(campaignId, { skippedCount = 0 } = {}) {
    const { data } = await api.post(`/messages/broadcast/campaigns/${campaignId}/complete`, {
      skipped_count: skippedCount
    }, {
      withCredentials: true
    });
    return data;
  },
  async recordBroadcastDeliveryError(campaignId, { recipientUserId, errorMessage, channelResults = [] }) {
    const { data } = await api.post(`/messages/broadcast/campaigns/${campaignId}/deliveries`, {
      recipient_user_id: recipientUserId,
      error_message: errorMessage,
      channel_results: channelResults
    }, {
      withCredentials: true
    });
    return data;
  },
  async getBroadcastHistory({ limit = 20, offset = 0, dateFrom = '', dateTo = '' } = {}) {
    const params = { limit, offset };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    const { data } = await api.get('/messages/broadcast/history', {
      params,
      withCredentials: true
    });
    return data;
  },
  async getBroadcastAnalytics() {
    const { data } = await api.get('/messages/broadcast/analytics', {
      withCredentials: true
    });
    return data;
  },
  async getBroadcastCampaignDetails(campaignId) {
    const { data } = await api.get(`/messages/broadcast/campaigns/${campaignId}`, {
      withCredentials: true
    });
    return data;
  },
  async deleteBroadcastCampaigns(ids = []) {
    const { data } = await api.delete('/messages/broadcast/campaigns', {
      data: { ids },
      withCredentials: true
    });
    return data;
  },
  async getBroadcastRecipientsSummary(ids = []) {
    const { data } = await api.get('/messages/broadcast/recipients-summary', {
      params: { ids: ids.join(',') },
      withCredentials: true
    });
    return data;
  },
  async getBroadcastTemplates() {
    const { data } = await api.get('/messages/broadcast/templates', {
      withCredentials: true
    });
    return data;
  },
  async createBroadcastTemplate({
    name,
    subject,
    greeting = '',
    body,
    signature = '',
    legalFooter = ''
  }) {
    const { data } = await api.post('/messages/broadcast/templates', {
      name,
      subject,
      greeting,
      body,
      signature,
      legal_footer: legalFooter
    }, {
      withCredentials: true
    });
    return data;
  },
  async updateBroadcastTemplate(templateId, {
    name,
    subject,
    greeting = '',
    body,
    signature = '',
    legalFooter = ''
  }) {
    const { data } = await api.put(`/messages/broadcast/templates/${templateId}`, {
      name,
      subject,
      greeting,
      body,
      signature,
      legal_footer: legalFooter
    }, {
      withCredentials: true
    });
    return data;
  },
  async deleteBroadcastTemplate(templateId) {
    const { data } = await api.delete(`/messages/broadcast/templates/${templateId}`, {
      withCredentials: true
    });
    return data;
  },
  async deleteMessagesHistory(userId) {
    const { data } = await api.delete(`/messages/history/${userId}`, {
      withCredentials: true
    });
    return data;
  }
};

// Экспортируем функцию для использования в других компонентах
export { getConversationByUserId };

export async function getAllMessages() {
  // Используем новый API для публичных сообщений
  const { data } = await api.get('/messages/public');
  return data;
}

// Новые методы для работы с типами сообщений
export async function sendMessage({ recipientId, content, messageType = 'public' }) {
  if (messageType === 'private') {
    // Используем новый API для приватных сообщений
    const { data } = await api.post('/messages/private/send', {
      recipientId,
      content
    });
    return data;
  } else {
    // Используем старый API для публичных сообщений
    const { data } = await api.post('/messages/send', {
      recipientId,
      content,
      messageType
    });
    return data;
  }
}

export async function getPublicMessages(userId = null, options = {}) {
  const params = { ...options };
  if (userId) params.userId = userId;
  const { data } = await api.get('/messages/public', { params });
  return data;
}


// Новые функции для работы с диалогами
export async function getConversations(userId) {
  const { data } = await api.get('/messages/conversations', { params: { userId } });
  return data;
}

export async function createConversation(userId, title) {
  const { data } = await api.post('/messages/conversations', { userId, title });
  return data;
}

// Функция для отметки сообщений как прочитанных
export async function markMessagesAsRead(userId, lastReadAt) {
  const { data } = await api.post('/messages/mark-read', { userId, lastReadAt });
  return data;
}

// Функция для получения статуса прочтения
export async function getReadStatus() {
  const { data } = await api.get('/messages/read-status');
  return data;
}

// Функция для удаления истории сообщений
export async function deleteMessageHistory(userId) {
  const { data } = await api.delete(`/messages/delete-history/${userId}`);
  return data;
}

// Новые функции для приватных сообщений
export async function getPrivateConversations() {
  const { data } = await api.get('/messages/private/conversations');
  return data;
}

export async function getPrivateMessages(conversationId) {
  const { data } = await api.get(`/messages/private/${conversationId}`);
  return data;
}

export async function sendPrivateMessage({ recipientId, content }) {
  const { data } = await api.post('/messages/private/send', {
    recipientId,
    content
  });
  return data;
}

// Функции для работы с уведомлениями
export async function getPrivateUnreadCount() {
  const { data } = await api.get('/messages/private/unread-count');
  return data;
}

export async function markPrivateMessagesAsRead(conversationId) {
  const { data } = await api.post('/messages/private/mark-read', {
    conversationId
  });
  return data;
}

export async function getMessagesByConversationId(conversationId, options = {}) {
  if (!conversationId) return { success: true, messages: [] };
  const { limit = 50, offset = 0 } = options;
  const { data } = await api.get(`/messages/conversations/${conversationId}/messages`, {
    params: { limit, offset },
    withCredentials: true
  });
  return data;
}

// Функция для загрузки личных сообщений с ИИ
export async function getPersonalChatHistory(options = {}) {
  const { limit = 50, offset = 0 } = options;
  const { data } = await api.get('/chat/history', {
    params: { limit, offset }
  });
  return data;
} 