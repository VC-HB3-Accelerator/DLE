const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

class TelegramBotService {
  constructor(token) {
    this.bot = new TelegramBot(token, { 
      polling: true,
      request: {
        timeout: 30000 // 30 секунд таймаут
      }
    });
    this.verificationCodes = new Map();
    this.setupHandlers();
    
    logger.info('TelegramBot service initialized');
  }

  setupHandlers() {
    this.bot.on('message', this.handleMessage.bind(this));
    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
    
    // Обработка ошибок
    this.bot.on('polling_error', (error) => {
      logger.error('Telegram polling error:', error);
    });
    
    this.bot.on('error', (error) => {
      logger.error('Telegram bot error:', error);
    });
  }

  async handleMessage(msg) {
    try {
      const chatId = msg.chat.id;
      const text = msg.text;

      logger.info(`Received message from ${chatId}: ${text}`);

      if (text.startsWith('/start')) {
        await this.handleStart(msg);
      } else if (this.verificationCodes.has(chatId)) {
        await this.handleVerificationCode(msg);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
    }
  }

  async handleCallbackQuery(query) {
    try {
      const chatId = query.message.chat.id;
      await this.bot.answerCallbackQuery(query.id);
      
      logger.info(`Handled callback query from ${chatId}`);
    } catch (error) {
      logger.error('Error handling callback query:', error);
    }
  }

  async handleStart(msg) {
    const chatId = msg.chat.id;
    try {
      await this.bot.sendMessage(
        chatId,
        'Добро пожаловать! Используйте этого бота для аутентификации в приложении.'
      );
      logger.info(`Sent welcome message to ${chatId}`);
    } catch (error) {
      logger.error(`Error sending welcome message to ${chatId}:`, error);
    }
  }

  async handleVerificationCode(msg) {
    const chatId = msg.chat.id;
    const code = msg.text.trim();
    
    try {
      const verificationData = this.verificationCodes.get(chatId);

      if (!verificationData) {
        await this.bot.sendMessage(chatId, 'Нет активного кода подтверждения.');
        return;
      }

      if (Date.now() > verificationData.expires) {
        this.verificationCodes.delete(chatId);
        await this.bot.sendMessage(chatId, 'Код подтверждения истек. Запросите новый.');
        return;
      }

      if (verificationData.code === code) {
        await this.bot.sendMessage(chatId, 'Код подтвержден успешно!');
        this.verificationCodes.delete(chatId);
      } else {
        await this.bot.sendMessage(chatId, 'Неверный код. Попробуйте еще раз.');
      }
    } catch (error) {
      logger.error(`Error handling verification code for ${chatId}:`, error);
    }
  }

  async sendVerificationCode(chatId, code) {
    try {
      // Сохраняем код с временем истечения (15 минут)
      this.verificationCodes.set(chatId, {
        code,
        expires: Date.now() + 15 * 60 * 1000
      });

      await this.bot.sendMessage(
        chatId,
        `Ваш код подтверждения: ${code}\nВведите его в приложении.`
      );
      
      logger.info(`Sent verification code to ${chatId}`);
      return true;
    } catch (error) {
      logger.error(`Error sending verification code to ${chatId}:`, error);
      return false;
    }
  }

  async verifyCode(code) {
    try {
      for (const [chatId, data] of this.verificationCodes.entries()) {
        if (data.code === code) {
          if (Date.now() > data.expires) {
            this.verificationCodes.delete(chatId);
            return { success: false, error: 'Код истек' };
          }
          this.verificationCodes.delete(chatId);
          return { success: true, telegramId: chatId.toString() };
        }
      }
      return { success: false, error: 'Неверный код' };
    } catch (error) {
      logger.error('Error verifying code:', error);
      return { success: false, error: 'Внутренняя ошибка' };
    }
  }
}

module.exports = TelegramBotService; 