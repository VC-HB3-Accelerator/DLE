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

const logger = require('../utils/logger');
const unifiedMessageProcessor = require('./unifiedMessageProcessor');

/**
 * WebBot - обработчик веб-чата
 * Простой бот для веб-интерфейса, всегда активен
 */
class WebBot {
  constructor() {
    this.name = 'WebBot';
    this.channel = 'web';
    this.isInitialized = false;
    this.status = 'inactive';
  }

  /**
   * Инициализация Web Bot
   */
  async initialize() {
    try {
      logger.info('[WebBot] 🚀 Инициализация Web Bot...');
      
      // Web bot всегда готов к работе
      this.isInitialized = true;
      this.status = 'active';
      
      logger.info('[WebBot] ✅ Web Bot успешно инициализирован');
      return { success: true };
      
    } catch (error) {
      logger.error('[WebBot] ❌ Ошибка инициализации:', error);
      this.status = 'error';
      return { success: false, error: error.message };
    }
  }

  /**
   * Обработка сообщения из веб-чата
   * @param {Object} messageData - Данные сообщения
   * @returns {Promise<Object>}
   */
  async processMessage(messageData) {
    try {
      if (!this.isInitialized) {
        throw new Error('WebBot is not initialized');
      }

      // Устанавливаем канал
      messageData.channel = 'web';

      // Обрабатываем через unified processor
      return await unifiedMessageProcessor.processMessage(messageData);
      
    } catch (error) {
      logger.error('[WebBot] Ошибка обработки сообщения:', error);
      throw error;
    }
  }

  /**
   * Отправка сообщения в веб-чат
   * @param {number} userId - ID пользователя
   * @param {string} message - Текст сообщения
   * @returns {Promise<Object>}
   */
  async sendMessage(userId, message) {
    try {
      logger.info('[WebBot] Отправка сообщения пользователю:', userId);
      
      // Для веб-чата отправка происходит через WebSocket
      // Здесь просто возвращаем успех, реальная отправка через wsHub
      
      return { 
        success: true,
        userId,
        message,
        channel: 'web'
      };
      
    } catch (error) {
      logger.error('[WebBot] Ошибка отправки сообщения:', error);
      throw error;
    }
  }

  /**
   * Получить статус бота
   * @returns {Object}
   */
  getStatus() {
    return {
      name: this.name,
      channel: this.channel,
      isInitialized: this.isInitialized,
      status: this.status
    };
  }

  /**
   * Остановка бота
   */
  async stop() {
    try {
      logger.info('[WebBot] Остановка Web Bot...');
      this.isInitialized = false;
      this.status = 'inactive';
      logger.info('[WebBot] ✅ Web Bot остановлен');
    } catch (error) {
      logger.error('[WebBot] Ошибка остановки:', error);
      throw error;
    }
  }
}

module.exports = WebBot;

