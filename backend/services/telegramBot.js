const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

// Создаем бота
const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

// Добавим хранилище для кодов подтверждения
const verificationCodes = new Map(); // Формат: { telegramId: { code: '123456', token: 'auth_token', expires: timestamp } }

/**
 * Инициализация Telegram бота
 * @returns {Object|null} - Объект с методами для работы с ботом или null, если инициализация не удалась
 */
function initTelegramBot() {
  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN not set, Telegram integration disabled');
    return null;
  }

  try {
    // Создаем бота с опцией polling
    bot = new TelegramBot(token, { polling: true });
    console.log('Telegram bot initialized');

    // Регистрируем обработчики событий
    registerHandlers();

    return {
      bot,
      sendMessage: (chatId, text) => bot.sendMessage(chatId, text)
    };
  } catch (error) {
    console.error('Error initializing Telegram bot:', error);
    return null;
  }
}

/**
 * Регистрация обработчиков событий для бота
 */
function registerHandlers() {
  // Обработчик /start
  bot.onText(/\/start(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const param = match[1] ? match[1].trim() : '';
    
    console.log(`Получена команда /start с параметром: "${param}" от пользователя ${chatId}`);
    
    if (param.startsWith('auth_')) {
      // Это токен авторизации через deep link
      const authToken = param.replace('auth_', '');
      console.log(`Обработка токена авторизации: ${authToken}`);
      
      try {
        // Проверяем, существует ли токен
        const { pool } = require('../db');
        const tokenResult = await pool.query(
          'SELECT user_id, expires_at FROM telegram_auth_tokens WHERE token = $1',
          [authToken]
        );
        
        if (tokenResult.rows.length === 0 || new Date(tokenResult.rows[0].expires_at) < new Date()) {
          bot.sendMessage(chatId, '❌ Недействительный или истекший токен авторизации.');
          return;
        }
        
        // Генерируем код подтверждения
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-значный код
        
        // Сохраняем в хранилище
        verificationCodes.set(chatId.toString(), {
          code: verificationCode,
          token: authToken,
          expires: Date.now() + 5 * 60 * 1000 // Срок действия 5 минут
        });
        
        // Отправляем код пользователю
        bot.sendMessage(chatId, 
          '🔐 Для завершения связывания аккаунта, пожалуйста, введите этот код:\n\n' +
          `<code>${verificationCode}</code>\n\n` +
          'Код действителен в течение 5 минут.',
          { parse_mode: 'HTML' }
        );
      } catch (error) {
        console.error('Error processing auth token:', error);
        bot.sendMessage(chatId, '❌ Произошла ошибка при обработке запроса авторизации.');
      }
    } else {
      // Получаем последний активный токен для этого чата, если есть
      const { pool } = require('../db');
      try {
        const lastTokenResult = await pool.query(`
          SELECT token FROM telegram_auth_tokens 
          WHERE expires_at > NOW() AND used = FALSE 
          ORDER BY created_at DESC LIMIT 1
        `);
        
        if (lastTokenResult.rows.length > 0) {
          const authToken = lastTokenResult.rows[0].token;
          
          // Генерируем код подтверждения
          const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-значный код
          
          // Сохраняем в хранилище
          verificationCodes.set(chatId.toString(), {
            code: verificationCode,
            token: authToken,
            expires: Date.now() + 5 * 60 * 1000 // Срок действия 5 минут
          });
          
          // Отправляем код пользователю
          bot.sendMessage(chatId, 
            '🔐 Для завершения связывания аккаунта, пожалуйста, введите этот код:\n\n' +
            `<code>${verificationCode}</code>\n\n` +
            'Код действителен в течение 5 минут.',
            { parse_mode: 'HTML' }
          );
          return;
        }
      } catch (error) {
        console.error('Error checking last token:', error);
      }
      
      // Если нет активного токена, отправляем стандартное сообщение
      bot.sendMessage(chatId, 
        'Привет! Я бот для аутентификации в DApp for Business.\n\n' +
        'Для связи с вашим аккаунтом используйте кнопку на сайте.'
      );
    }
  });

  // Обработчик для проверки кода подтверждения
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Игнорируем команды
    if (text && text.startsWith('/')) return;
    
    // Проверяем, есть ли ожидающая верификация для этого чата
    const verificationData = verificationCodes.get(chatId.toString());
    
    if (verificationData && text === verificationData.code) {
      // Код верный, проверяем срок действия
      if (Date.now() > verificationData.expires) {
        bot.sendMessage(chatId, '❌ Срок действия кода истек. Пожалуйста, начните процесс заново.');
        verificationCodes.delete(chatId.toString());
        return;
      }
      
      // Код верный и актуальный, завершаем аутентификацию
      try {
        const result = await linkTelegramAccount(chatId.toString(), verificationData.token);
        
        if (result.success) {
          bot.sendMessage(chatId, 
            '✅ Аутентификация успешна!\n\n' +
            'Ваш Telegram аккаунт связан с DApp for Business.\n' +
            'Теперь вы можете использовать бота для общения с системой.'
          );
        } else {
          bot.sendMessage(chatId, 
            '❌ Ошибка аутентификации: ' + (result.error || 'неизвестная ошибка')
          );
        }
        
        // Удаляем данные верификации
        verificationCodes.delete(chatId.toString());
      } catch (error) {
        console.error('Error completing authentication:', error);
        bot.sendMessage(chatId, '❌ Произошла ошибка при завершении аутентификации.');
      }
    } else if (verificationData) {
      // Есть ожидающая верификация, но код неверный
      bot.sendMessage(chatId, '❌ Неверный код. Пожалуйста, попробуйте еще раз.');
    } else {
      // Нет ожидающей верификации
      bot.sendMessage(chatId, 'Я могу помочь с аутентификацией. Используйте кнопку на сайте для начала процесса.');
    }
  });

  // Добавить обработку прямых команд аутентификации
  bot.onText(/\/auth (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const authToken = match[1].trim();
    
    console.log(`Получена прямая команда авторизации с токеном: ${authToken}`);
    
    try {
      // Связываем Telegram ID с аккаунтом по токену
      const result = await linkTelegramAccount(chatId.toString(), authToken);
      console.log(`Результат связывания: ${JSON.stringify(result)}`);
      
      if (result.success) {
        bot.sendMessage(chatId, 
          '✅ Аутентификация успешна!\n\n' +
          'Ваш Telegram аккаунт связан с DApp for Business.\n' +
          'Теперь вы можете использовать бота для общения с системой.'
        );
      } else {
        bot.sendMessage(chatId, 
          '❌ Ошибка аутентификации: ' + (result.error || 'неизвестная ошибка')
        );
      }
    } catch (error) {
      console.error('Error linking telegram account:', error);
      bot.sendMessage(chatId, '❌ Произошла ошибка при связывании аккаунта.');
    }
  });

  // Обработка ошибок
  bot.on('polling_error', (error) => {
    logger.error(`[polling_error] ${JSON.stringify(error)}`);
  });

  console.log('Telegram bot handlers registered');
}

/**
 * Связывание Telegram ID с аккаунтом пользователя
 * @param {string} telegramId - ID пользователя в Telegram
 * @param {string} authToken - Токен авторизации
 * @returns {Promise<Object>} - Результат операции
 */
async function linkTelegramAccount(telegramId, authToken) {
  try {
    console.log(`Попытка связать Telegram ID ${telegramId} с токеном ${authToken}`);
    
    // Здесь должен быть код для связывания через API или напрямую с БД
    const { pool } = require('../db');
    
    // Проверяем токен авторизации
    const tokenResult = await pool.query(
      'SELECT user_id, expires_at FROM telegram_auth_tokens WHERE token = $1',
      [authToken]
    );
    
    console.log(`Результат запроса токена: ${JSON.stringify(tokenResult.rows)}`);
    
    if (tokenResult.rows.length === 0 || new Date(tokenResult.rows[0].expires_at) < new Date()) {
      console.log('Токен не найден или истек');
      return { success: false, error: 'Недействительный или истекший токен' };
    }
    
    const userId = tokenResult.rows[0].user_id;
    console.log(`Найден пользователь с ID: ${userId}`);
    
    // Добавляем идентификатор Telegram для пользователя
    await pool.query(
      'INSERT INTO user_identities (user_id, identity_type, identity_value, verified, created_at) ' +
      'VALUES ($1, $2, $3, true, NOW()) ' +
      'ON CONFLICT (identity_type, identity_value) ' +
      'DO UPDATE SET user_id = $1, verified = true',
      [userId, 'telegram', telegramId]
    );
    
    // Отмечаем токен как использованный
    await pool.query(
      'UPDATE telegram_auth_tokens SET used = true WHERE token = $1',
      [authToken]
    );
    
    return { success: true };
  } catch (error) {
    console.error('Error in linkTelegramAccount:', error);
    return { success: false, error: 'Внутренняя ошибка сервера' };
  }
}

module.exports = {
  initTelegramBot
}; 