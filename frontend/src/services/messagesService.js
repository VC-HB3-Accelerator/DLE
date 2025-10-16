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
  async getMessagesByConversationId(conversationId) {
    if (!conversationId) return [];
    // Используем новый API для публичных сообщений
    const { data } = await api.get('/messages/public');
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
  // Используем новый API для публичных сообщений
  const { data } = await api.get('/messages/public');
  return data;
}

// Новые методы для работы с типами сообщений
export async function sendMessage({ recipientId, content, messageType = 'public' }) {
  const { data } = await api.post('/messages/send', {
    recipientId,
    content,
    messageType
  });
  return data;
}

export async function getPublicMessages(userId = null, options = {}) {
  const params = { ...options };
  if (userId) params.userId = userId;
  const { data } = await api.get('/messages/public', { params });
  return data;
}

export async function getPrivateMessages(options = {}) {
  const { data } = await api.get('/messages/private', { params: options });
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