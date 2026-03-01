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
const TelegramBot = require('./telegramBot');
const EmailBot = require('./emailBot');
const unifiedMessageProcessor = require('./unifiedMessageProcessor');

/**
 * BotManager - централизованный менеджер всех ботов
 * Управляет жизненным циклом ботов (инициализация, обработка сообщений, остановка)
 */
class BotManager {
  constructor() {
    this.bots = new Map();
    this.isInitialized = false;
    this.processingQueue = [];
  }

  /**
   * Инициализация всех ботов
   */
  async initialize() {
    try {
      logger.info('[BotManager] 🚀 Инициализация BotManager...');

      // Создаем экземпляры ботов
      const WebBot = require('./webBot');
      const webBot = new WebBot();
      
      const telegramBot = new TelegramBot();
      const emailBot = new EmailBot();

      // Регистрируем ботов
      this.bots.set('web', webBot);
      this.bots.set('telegram', telegramBot);
      this.bots.set('email', emailBot);

      // Инициализируем Web Bot
      logger.info('[BotManager] Инициализация Web Bot...');
      await webBot.initialize().catch(error => {
        logger.warn('[BotManager] Web Bot не инициализирован:', error.message);
      });

      // Инициализируем Telegram Bot
      logger.info('[BotManager] Инициализация Telegram Bot...');
      await telegramBot.initialize().catch(error => {
        logger.warn('[BotManager] Telegram Bot не инициализирован:', error.message);
      });
      
      // Устанавливаем централизованный процессор сообщений для Telegram
      telegramBot.setMessageProcessor(this.processMessage.bind(this));
      logger.info('[BotManager] ✅ Telegram Bot подключен к unified processor');

      // Инициализируем Email Bot
      logger.info('[BotManager] Инициализация Email Bot...');
      await emailBot.initialize().catch(error => {
        logger.warn('[BotManager] Email Bot не инициализирован:', error.message);
      });
      
      // Устанавливаем централизованный процессор сообщений для Email
      emailBot.setMessageProcessor(this.processMessage.bind(this));
      logger.info('[BotManager] ✅ Email Bot подключен к unified processor');

      this.isInitialized = true;
      logger.info('[BotManager] ✅ BotManager успешно инициализирован');

      return { success: true };
    } catch (error) {
      logger.error('[BotManager] ❌ Ошибка инициализации BotManager:', error);
      throw error;
    }
  }

  /**
   * Получить бота по имени
   * @param {string} botName - Имя бота (web, telegram, email)
   * @returns {Object|null} Экземпляр бота или null
   */
  getBot(botName) {
    return this.bots.get(botName) || null;
  }

  /**
   * Проверить готовность BotManager
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Получить статус всех ботов
   * @returns {Object}
   */
  getStatus() {
    const status = {};
    
    for (const [name, bot] of this.bots) {
      status[name] = {
        initialized: bot.isInitialized || false,
        status: bot.status || 'unknown'
      };
    }
    
    return status;
  }

  /**
   * Обработать сообщение через соответствующий бот
   * @param {Object} messageData - Данные сообщения
   * @returns {Promise<Object>}
   */
  async processMessage(messageData) {
    try {
      const channel = messageData.channel || 'web';
      const bot = this.bots.get(channel);

      if (!bot) {
        throw new Error(`Bot for channel "${channel}" not found`);
      }

      if (!bot.isInitialized) {
        throw new Error(`Bot "${channel}" is not initialized`);
      }

      // Обрабатываем сообщение через unified processor
      return await unifiedMessageProcessor.processMessage(messageData);
      
    } catch (error) {
      logger.error('[BotManager] Ошибка обработки сообщения:', error);
      throw error;
    }
  }

  /**
   * Перезапустить конкретный бот
   * @param {string} botName - Имя бота
   * @returns {Promise<Object>}
   */
  async restartBot(botName) {
    try {
      logger.info(`[BotManager] Перезапуск бота: ${botName}`);
      
      const bot = this.bots.get(botName);
      
      if (!bot) {
        throw new Error(`Bot "${botName}" not found`);
      }

      // Останавливаем бота (если есть метод stop)
      if (typeof bot.stop === 'function') {
        await bot.stop();
      }

      // Переинициализируем
      if (typeof bot.initialize === 'function') {
        await bot.initialize();
      }

      logger.info(`[BotManager] ✅ Бот ${botName} перезапущен`);
      
      return { 
        success: true, 
        bot: botName,
        status: bot.status
      };
      
    } catch (error) {
      logger.error(`[BotManager] Ошибка перезапуска бота ${botName}:`, error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Остановить все боты
   */
  async stop() {
    try {
      logger.info('[BotManager] Остановка всех ботов...');

      for (const [name, bot] of this.bots) {
        if (typeof bot.stop === 'function') {
          logger.info(`[BotManager] Остановка ${name}...`);
          await bot.stop().catch(error => {
            logger.error(`[BotManager] Ошибка остановки ${name}:`, error);
          });
        }
      }

      this.isInitialized = false;
      logger.info('[BotManager] ✅ Все боты остановлены');
      
    } catch (error) {
      logger.error('[BotManager] Ошибка остановки ботов:', error);
      throw error;
    }
  }
}

// Singleton instance
const botManager = new BotManager();

module.exports = botManager;

