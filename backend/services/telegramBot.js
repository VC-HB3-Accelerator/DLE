const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');
const { pool } = require('../db');
const crypto = require('crypto');

// Создаем бота
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

/**
 * Функция для отправки кода подтверждения
 */
async function sendVerificationCode(chatId) {
  try {
    // Генерируем код и токен
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const authToken = crypto.randomBytes(32).toString('hex');
    
    // Создаем пользователя и сохраняем код в базу данных
    const result = await pool.query(
      `WITH new_user AS (
         INSERT INTO users (created_at)
         VALUES (NOW())
         RETURNING id
       )
       INSERT INTO telegram_auth_tokens 
       (user_id, token, verification_code, telegram_id, expires_at) 
       VALUES (
         (SELECT id FROM new_user),
         $1, $2, $3,
         NOW() + INTERVAL '5 minutes'
       )
       RETURNING user_id`,
      [authToken, code, chatId.toString()]
    );

    // Отправляем код с инлайн-кнопкой
    const sentMessage = await bot.sendMessage(chatId,
      'Привет! Я бот для аутентификации в DApp for Business.\n\n' +
      '🔐 Ваш код подтверждения:\n\n' +
      `<code>${code}</code>\n\n` +
      'Введите этот код на сайте для завершения авторизации.\n' +
      'Код действителен в течение 5 минут.',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Получить новый код', callback_data: 'new_code' }]
          ]
        }
      }
    );

    // Удаляем сообщение через 30 секунд
    setTimeout(async () => {
      try {
        await bot.deleteMessage(chatId, sentMessage.message_id);
        await bot.sendMessage(chatId,
          'Для получения нового кода используйте команду /start или меню команд',
          {
            reply_markup: {
              keyboard: [
                [{ text: '/start' }]
              ],
              resize_keyboard: true,
              persistent: true
            }
          }
        );
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    }, 30000);

    return { code, token: authToken, userId: result.rows[0].user_id };
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw error;
  }
}

/**
 * Функция для проверки кода
 */
async function verifyCode(code) {
  try {
    const result = await pool.query(
      `SELECT token, telegram_id, user_id 
       FROM telegram_auth_tokens 
       WHERE verification_code = $1 
       AND expires_at > NOW() 
       AND NOT used`,
      [code]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Неверный или истекший код' };
    }

    const { token, telegram_id, user_id } = result.rows[0];

    // Помечаем токен как использованный
    await pool.query(
      'UPDATE telegram_auth_tokens SET used = true WHERE token = $1',
      [token]
    );

    // Добавляем Telegram ID в таблицу идентификаторов
    await pool.query(
      `INSERT INTO user_identities 
       (user_id, identity_type, identity_value, verified, created_at)
       VALUES ($1, 'telegram', $2, true, NOW())
       ON CONFLICT (identity_type, identity_value) 
       DO UPDATE SET verified = true`,
      [user_id, telegram_id]
    );

    return {
      success: true,
      telegramId: telegram_id,
      userId: user_id
    };
  } catch (error) {
    console.error('Error verifying code:', error);
    throw error;
  }
}

/**
 * Инициализация Telegram бота
 */
function initTelegramBot() {
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN not set');
    return null;
  }

  try {
    // Создаем бота с опцией обработки ошибок
    bot = new TelegramBot(token, { 
      polling: {
        autoStart: true,
        params: {
          timeout: 10
        }
      },
      request: {
        timeout: 30000, // увеличиваем таймаут до 30 секунд
        proxy: process.env.HTTPS_PROXY // используем прокси если есть
      }
    });

    console.log('Telegram bot initialized');

    // Очищаем все предыдущие обработчики
    bot.removeAllListeners();

    // Устанавливаем команды бота с обработкой ошибок
    bot.setMyCommands([
      { command: '/start', description: 'Получить код подтверждения' },
      { command: '/help', description: 'Показать справку' }
    ]).catch(error => {
      console.warn('Error setting bot commands:', error);
      // Продолжаем работу даже если не удалось установить команды
    });

    // Обработчик команды /start
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        await sendVerificationCode(chatId);
      } catch (error) {
        console.error('Error handling /start:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, попробуйте позже.')
          .catch(err => console.error('Error sending error message:', err));
      }
    });

    // Обработчик ошибок polling
    bot.on('polling_error', (error) => {
      console.error('Telegram bot polling error:', error);
      // Перезапускаем polling при ошибке
      setTimeout(() => {
        try {
          bot.startPolling();
        } catch (e) {
          console.error('Error restarting polling:', e);
        }
      }, 10000); // пробуем перезапустить через 10 секунд
    });

    // Обработчик остановки polling
    bot.on('stop', () => {
      console.log('Bot polling stopped');
      // Пробуем перезапустить
      setTimeout(() => {
        try {
          bot.startPolling();
        } catch (e) {
          console.error('Error restarting polling after stop:', e);
        }
      }, 5000);
    });

    return bot;

  } catch (error) {
    console.error('Error initializing Telegram bot:', error);
    return null;
  }
}

// Экспортируем функции
module.exports = {
  initTelegramBot,
  verifyCode,
  sendVerificationCode
}; 