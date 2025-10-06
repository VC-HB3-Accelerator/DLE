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

import api from '../api/axios';

/**
 * Сервис для работы с админскими чатами
 */
const adminChatService = {
  /**
   * Отправляет сообщение другому администратору
   * @param {number} recipientAdminId - ID получателя
   * @param {string} content - Содержимое сообщения
   * @param {Array} attachments - Вложения
   * @returns {Promise} - Результат отправки
   */
  async sendMessage(recipientAdminId, content, attachments = []) {
    try {
      const response = await api.post('/messages/admin/send', {
        recipientAdminId,
        content,
        attachments
      });
      return response.data;
    } catch (error) {
      console.error('[adminChatService] Ошибка отправки сообщения:', error);
      throw error;
    }
  },

  /**
   * Получает список админских контактов
   * @returns {Promise} - Список контактов
   */
  async getAdminContacts() {
    try {
      console.log('[adminChatService] Запрашиваем админские контакты...');
      const response = await api.get('/messages/admin/contacts');
      console.log('[adminChatService] Получен ответ:', response.data);
      return response.data;
    } catch (error) {
      console.error('[adminChatService] Ошибка получения админов для приватного чата:', error);
      throw error;
    }
  },

  /**
   * Получает сообщения из приватной беседы с другим администратором
   * @param {number} adminId - ID администратора
   * @returns {Promise} - Сообщения
   */
  async getMessages(adminId) {
    try {
      const response = await api.get(`/messages/admin/${adminId}`);
      return response.data;
    } catch (error) {
      console.error('[adminChatService] Ошибка получения сообщений:', error);
      throw error;
    }
  }
};

export default adminChatService;


