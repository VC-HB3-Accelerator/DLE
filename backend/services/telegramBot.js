const { Telegraf } = require('telegraf');
const logger = require('../utils/logger');
const db = require('../db');
const authService = require('./auth-service');
const verificationService = require('./verification-service');

let botInstance = null;

// Создание и настройка бота
async function getBot() {
  if (!botInstance) {
    botInstance = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // Обработка команды /start
    botInstance.command('start', (ctx) => {
      ctx.reply('Добро пожаловать! Отправьте код подтверждения для аутентификации.');
    });

    // Обработка кодов верификации
    botInstance.on('text', async (ctx) => {
      const code = ctx.message.text.trim();
      
      try {
        // Получаем код верификации для всех активных кодов с провайдером telegram
        const codeResult = await db.query(
          `SELECT * FROM verification_codes 
           WHERE code = $1 
           AND provider = 'telegram' 
           AND used = false 
           AND expires_at > NOW()`,
          [code]
        );
        
        if (codeResult.rows.length === 0) {
          ctx.reply('Неверный код подтверждения');
          return;
        }
        
        const verification = codeResult.rows[0];
        const providerId = verification.provider_id;
        let userId = verification.user_id;
        
        // Отмечаем код как использованный
        await db.query(
          'UPDATE verification_codes SET used = true WHERE id = $1',
          [verification.id]
        );
        
        logger.info('Starting Telegram auth process for code:', code);
        
        // Проверяем, существует ли уже пользователь с таким Telegram ID
        const existingTelegramUser = await db.query(
          `SELECT ui.user_id 
           FROM user_identities ui 
           WHERE ui.provider = 'telegram' AND ui.provider_id = $1`,
          [ctx.from.id.toString()]
        );
        
        if (existingTelegramUser.rows.length > 0) {
          // Если пользователь с таким Telegram ID уже существует,
          // используем его ID вместо создания нового связывания
          const existingUserId = existingTelegramUser.rows[0].user_id;
          
          // Связываем гостевой ID с существующим пользователем, если его еще нет
          const guestIdentity = await db.query(
            `SELECT * FROM user_identities 
             WHERE user_id = $1 AND provider = 'guest' AND provider_id = $2`,
            [existingUserId, providerId]
          );
          
          if (guestIdentity.rows.length === 0 && providerId) {
            await db.query(
              `INSERT INTO user_identities 
               (user_id, provider, provider_id, created_at) 
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1`,
              [existingUserId, 'guest', providerId]
            );
          }
          
          userId = existingUserId;
          logger.info(`Using existing user ${userId} for Telegram account ${ctx.from.id}`);
        } else {
          // Связываем Telegram с пользователем
          await db.query(
            `INSERT INTO user_identities 
             (user_id, provider, provider_id, created_at) 
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1`,
            [userId, 'telegram', ctx.from.id.toString()]
          );
          
          logger.info(`User ${userId} successfully linked Telegram account ${ctx.from.id}`);
        }
        
        // Обновляем сессию в базе данных
        await db.query(
          `UPDATE session 
           SET sess = (sess::jsonb || $1::jsonb)::json
           WHERE sess::jsonb @> $2::jsonb`,
          [
            JSON.stringify({
              userId: userId.toString(),
              authenticated: true,
              authType: "telegram",
              telegramId: ctx.from.id.toString()
            }),
            JSON.stringify({guestId: providerId})
          ]
        );
        
        // Отправляем сообщение об успешной аутентификации
        await ctx.reply('Аутентификация успешна! Можете вернуться в приложение.');
        
        // Удаляем сообщение с кодом
        try {
          await ctx.deleteMessage(ctx.message.message_id);
        } catch (error) {
          logger.warn('Could not delete code message:', error);
        }
        
      } catch (error) {
        logger.error('Error in Telegram auth:', error);
        await ctx.reply('Произошла ошибка при аутентификации. Попробуйте позже.');
      }
    });

    // Запускаем бота
    await botInstance.launch();
  }
  
  return botInstance;
}

// Остановка бота
async function stopBot() {
  if (botInstance) {
    try {
      await botInstance.stop();
      botInstance = null;
      logger.info('Telegram bot stopped successfully');
    } catch (error) {
      logger.error('Error stopping Telegram bot:', error);
      throw error;
    }
  }
}

// Инициализация процесса аутентификации
async function initTelegramAuth(session) {
  try {
    // Создаем или получаем ID пользователя
    let userId;
    
    if (session.authenticated && session.userId) {
      // Если пользователь уже аутентифицирован, используем его ID
      userId = session.userId;
    } else if (session.guestId) {
      // Проверяем, есть ли уже пользователь с этим guestId
      const existingUser = await db.query(
        `SELECT u.id 
         FROM users u 
         JOIN user_identities ui ON u.id = ui.user_id 
         WHERE ui.provider = 'guest' AND ui.provider_id = $1`,
        [session.guestId]
      );
      
      if (existingUser.rows.length > 0) {
        // Используем существующего пользователя
        userId = existingUser.rows[0].id;
      } else {
        // Создаем нового пользователя
        const userResult = await db.query(
          'INSERT INTO users (created_at) VALUES (NOW()) RETURNING id'
        );
        userId = userResult.rows[0].id;
        
        // Связываем гостевой ID с пользователем
        await db.query(
          `INSERT INTO user_identities 
           (user_id, provider, provider_id, created_at) 
           VALUES ($1, $2, $3, NOW())`,
          [userId, 'guest', session.guestId]
        );
      }
      
      session.tempUserId = userId;
    } else {
      // Создаем нового пользователя без гостевого ID
      const userResult = await db.query(
        'INSERT INTO users (created_at) VALUES (NOW()) RETURNING id'
      );
      userId = userResult.rows[0].id;
      session.tempUserId = userId;
    }
    
    // Создаем код через сервис верификации
    const code = await verificationService.createVerificationCode(
      'telegram',
      session.guestId || 'temp',
      userId
    );
    
    return {
      verificationCode: code,
      botLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}`
    };
  } catch (error) {
    logger.error('Error initializing Telegram auth:', error);
    throw error;
  }
}

module.exports = {
  getBot,
  stopBot,
  initTelegramAuth
};