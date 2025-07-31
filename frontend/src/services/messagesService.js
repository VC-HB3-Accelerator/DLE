/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

import api from '@/api/axios';

export default {
  async getMessagesByUserId(userId) {
    if (!userId) return [];
    const { data } = await api.get(`/messages?userId=${userId}`);
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
  async getMessagesByConversationId(conversationId) {
    if (!conversationId) return [];
    const { data } = await api.get(`/messages?conversationId=${conversationId}`);
    return data;
  },
  async getConversationByUserId(userId) {
    if (!userId) return null;
    const { data } = await api.get(`/messages/conversations?userId=${userId}`);
    return data;
  },
  async generateAiDraft(conversationId, messages, language = 'auto') {
    const { data } = await api.post('/chat/ai-draft', { conversationId, messages, language });
    return data;
  },
  async broadcastMessage({ userId, message }) {
    const { data } = await api.post('/messages/broadcast', {
      user_id: userId,
      content: message
    }, {
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

export async function getAllMessages() {
  const { data } = await api.get('/messages');
  return data;
} 