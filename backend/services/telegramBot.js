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

const { Telegraf } = require('telegraf');
const logger = require('../utils/logger');
const encryptedDb = require('./encryptedDatabaseService');

/**
 * TelegramBot - обработчик Telegram сообщений
 * Унифицированный интерфейс для работы с Telegram
 */
class TelegramBot {
  constructor() {
    this.name = 'TelegramBot';
    this.channel = 'telegram';
    this.bot = null;
    this.settings = null;
    this.isInitialized = false;
    this.status = 'inactive';
  }

  /**
   * Инициализация Telegram Bot
   */
  async initialize() {
    try {
      logger.info('[TelegramBot] 🚀 Инициализация Telegram Bot...');
      
      // Загружаем настройки из БД
      this.settings = await this.loadSettings();
      
      if (!this.settings || !this.settings.bot_token) {
        logger.warn('[TelegramBot] ⚠️ Настройки Telegram не найдены');
        this.status = 'not_configured';
        return { success: false, reason: 'not_configured' };
      }

      // Проверяем токен
      if (!this.settings.bot_token || typeof this.settings.bot_token !== 'string') {
        logger.error('[TelegramBot] ❌ Некорректный токен:', { 
          tokenExists: !!this.settings.bot_token,
          tokenType: typeof this.settings.bot_token,
          tokenLength: this.settings.bot_token?.length || 0
        });
        this.status = 'invalid_token';
        return { success: false, reason: 'invalid_token' };
      }

      // Проверяем токен через Telegram API
      try {
        logger.info('[TelegramBot] Проверяем токен через Telegram API...');
        const testBot = new Telegraf(this.settings.bot_token);
        const me = await testBot.telegram.getMe();
        logger.info('[TelegramBot] ✅ Токен валиден, бот:', me.username);
        // Не вызываем stop() - может вызвать ошибку
      } catch (error) {
        logger.error('[TelegramBot] ❌ Токен невалиден или проблема с API:', {
          message: error.message,
          code: error.code,
          response: error.response?.data
        });
        this.status = 'invalid_token';
        return { success: false, reason: 'invalid_token' };
      }

      // Создаем экземпляр бота
      this.bot = new Telegraf(this.settings.bot_token);
      
      // Настраиваем обработчики
      this.setupHandlers();
      
      // Сначала помечаем как инициализированный
      this.isInitialized = true;
      this.status = 'active';
      
      // Запускаем бота асинхронно (может долго подключаться)
      this.launch()
        .then(() => {
          logger.info('[TelegramBot] ✅ Бот успешно подключен к Telegram');
          this.status = 'active';
        })
        .catch(error => {
          logger.error('[TelegramBot] Ошибка подключения к Telegram:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            stack: error.stack
          });
          this.status = 'error';
        });
      
      logger.info('[TelegramBot] ✅ Telegram Bot инициализирован (подключение в фоне)');
      return { success: true };
      
    } catch (error) {
      if (error.message.includes('409: Conflict')) {
        logger.warn('[TelegramBot] ⚠️ Telegram Bot уже запущен в другом процессе');
        this.status = 'conflict';
          } else {
        logger.error('[TelegramBot] ❌ Ошибка инициализации:', error);
        this.status = 'error';
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Загрузка настроек из БД
   */
  async loadSettings() {
    try {
      const settings = await encryptedDb.getData('telegram_settings', {}, 1);
      if (!settings.length) {
        return null;
      }
      return settings[0];
    } catch (error) {
      logger.error('[TelegramBot] Ошибка загрузки настроек:', error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков команд и сообщений
   */
  setupHandlers() {
    // Обработчик команды /start
    this.bot.command('start', (ctx) => {
      logger.info('[TelegramBot] 📨 Получена команда /start');
      ctx.reply('Добро пожаловать! Отправьте код подтверждения для аутентификации.');
    });

    // Обработчик текстовых сообщений
    this.bot.on('text', async (ctx) => {
      logger.info('[TelegramBot] 📨 Получено текстовое сообщение');
      await this.handleTextMessage(ctx);
    });

    // Обработчик документов
    this.bot.on('document', async (ctx) => {
      logger.info('[TelegramBot] 📨 Получен документ');
      await this.handleMessage(ctx);
    });

    // Обработчик фото
    this.bot.on('photo', async (ctx) => {
      logger.info('[TelegramBot] 📨 Получено фото');
      await this.handleMessage(ctx);
    });

    // Обработчик аудио
    this.bot.on('audio', async (ctx) => {
      logger.info('[TelegramBot] 📨 Получено аудио');
      await this.handleMessage(ctx);
    });

    // Обработчик видео
    this.bot.on('video', async (ctx) => {
      logger.info('[TelegramBot] 📨 Получено видео');
      await this.handleMessage(ctx);
    });
  }

  /**
   * Обработка текстовых сообщений
   */
  async handleTextMessage(ctx) {
    const text = ctx.message.text.trim();
    
    // Пропускаем команды
    if (text.startsWith('/')) return;

    // Обрабатываем как обычное сообщение
    await this.handleMessage(ctx);
  }

  /**
   * Извлечение данных из Telegram сообщения
   * @param {Object} ctx - Telegraf context
   * @returns {Object} - Стандартизированные данные сообщения
   */
  extractMessageData(ctx) {
      try {
        const telegramId = ctx.from.id.toString();
      let content = '';
      let attachments = [];

      // Текст сообщения
      if (ctx.message.text) {
        content = ctx.message.text.trim();
      } else if (ctx.message.caption) {
        content = ctx.message.caption.trim();
      }

      // Обработка вложений
      let fileId, fileName, mimeType, fileSize;

        if (ctx.message.document) {
          fileId = ctx.message.document.file_id;
          fileName = ctx.message.document.file_name;
          mimeType = ctx.message.document.mime_type;
          fileSize = ctx.message.document.file_size;
        } else if (ctx.message.photo && ctx.message.photo.length > 0) {
          const photo = ctx.message.photo[ctx.message.photo.length - 1];
          fileId = photo.file_id;
          fileName = 'photo.jpg';
          mimeType = 'image/jpeg';
          fileSize = photo.file_size;
        } else if (ctx.message.audio) {
          fileId = ctx.message.audio.file_id;
          fileName = ctx.message.audio.file_name || 'audio.ogg';
          mimeType = ctx.message.audio.mime_type || 'audio/ogg';
          fileSize = ctx.message.audio.file_size;
        } else if (ctx.message.video) {
          fileId = ctx.message.video.file_id;
          fileName = ctx.message.video.file_name || 'video.mp4';
          mimeType = ctx.message.video.mime_type || 'video/mp4';
          fileSize = ctx.message.video.file_size;
        }
        
        if (fileId) {
        attachments.push({
          type: 'telegram_file',
          fileId: fileId,
          filename: fileName,
          mimetype: mimeType,
          size: fileSize,
          ctx: ctx // Сохраняем контекст для последующей загрузки
        });
      }

      return {
        channel: 'telegram',
        identifier: telegramId,
        content: content,
        attachments: attachments,
        metadata: {
          telegramUsername: ctx.from.username,
          telegramFirstName: ctx.from.first_name,
          telegramLastName: ctx.from.last_name,
          messageId: ctx.message.message_id,
          chatId: ctx.chat.id
        }
      };
    } catch (error) {
      logger.error('[TelegramBot] Ошибка извлечения данных из сообщения:', error);
      throw error;
    }
  }

  /**
   * Загрузка файла из Telegram
   * @param {Object} attachment - Данные вложения
   * @returns {Promise<Buffer>} - Буфер с данными файла
   */
  async downloadAttachment(attachment) {
    try {
      const fileLink = await attachment.ctx.telegram.getFileLink(attachment.fileId);
      const res = await fetch(fileLink.href);
      return await res.buffer();
    } catch (error) {
      logger.error('[TelegramBot] Ошибка загрузки файла:', error);
      return null;
    }
  }

  /**
   * Обработка сообщения через процессор
   * @param {Object} ctx - Telegraf context
   * @param {Function} processor - Функция обработки сообщения
   */
  async handleMessage(ctx, processor = null) {
    try {
      await ctx.replyWithChatAction('typing');
      
      // Извлекаем данные из сообщения
      const messageData = this.extractMessageData(ctx);
      
      logger.info(`[TelegramBot] Обработка сообщения от пользователя: ${messageData.identifier}`);

      // Загружаем вложения если есть
      for (const attachment of messageData.attachments) {
        const buffer = await this.downloadAttachment(attachment);
        if (buffer) {
          attachment.data = buffer;
          // Удаляем ctx из вложения
          delete attachment.ctx;
        }
      }

      // Используем установленный процессор или переданный
      const messageProcessor = processor || this.messageProcessor;
      
      if (!messageProcessor) {
        await ctx.reply('Сообщение получено и будет обработано.');
          return;
        }

      // Обрабатываем сообщение через унифицированный процессор
      const result = await messageProcessor(messageData);

      // Отправляем ответ пользователю
      if (result.success && result.aiResponse) {
        await ctx.reply(result.aiResponse.response);
      } else if (result.success) {
        await ctx.reply('Сообщение получено');
      } else {
        await ctx.reply('Произошла ошибка при обработке сообщения');
      }

      } catch (error) {
      logger.error('[TelegramBot] Ошибка обработки сообщения:', error);
        try {
          await ctx.reply('Произошла ошибка при обработке вашего сообщения. Попробуйте позже.');
        } catch (replyError) {
        logger.error('[TelegramBot] Не удалось отправить сообщение об ошибке:', replyError);
      }
    }
  }

  /**
   * Запуск бота (без timeout и retry - Telegraf сам управляет подключением)
   */
  async launch() {
    try {
      logger.info('[TelegramBot] Запуск polling...');
      
      // Запускаем бота без таймаута - пусть Telegraf сам управляет подключением
      await this.bot.launch({ 
        dropPendingUpdates: true,
        allowedUpdates: ['message', 'callback_query']
      });
      
      logger.info('[TelegramBot] ✅ Бот запущен успешно');
    } catch (error) {
      logger.error('[TelegramBot] ❌ Ошибка запуска:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        stack: error.stack
      });
      throw error;
    }
  }


  /**
   * Установка процессора сообщений
   * @param {Function} processor - Функция обработки сообщений
   */
  setMessageProcessor(processor) {
    this.messageProcessor = processor;
    logger.info('[TelegramBot] ✅ Процессор сообщений установлен');
  }

  /**
   * Проверка статуса бота
   * @returns {Object} - Статус бота
   */
  getStatus() {
    return {
      name: this.name,
      channel: this.channel,
      isInitialized: this.isInitialized,
      status: this.status,
      hasSettings: !!this.settings
    };
  }

  /**
   * Получение экземпляра бота (для совместимости)
   * @returns {Object} - Экземпляр Telegraf бота
   */
  getBot() {
    return this.bot;
  }

  /**
   * Остановка бота
   */
  async stop() {
    try {
      logger.info('[TelegramBot] 🛑 Остановка Telegram Bot...');
      
      if (this.bot) {
        await this.bot.stop();
        this.bot = null;
      }
      
      this.isInitialized = false;
      this.status = 'inactive';
      
      logger.info('[TelegramBot] ✅ Telegram Bot остановлен');
  } catch (error) {
      logger.error('[TelegramBot] ❌ Ошибка остановки:', error);
    throw error;
  }
}
}

module.exports = TelegramBot;

