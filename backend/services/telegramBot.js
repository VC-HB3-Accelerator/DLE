const { Telegraf } = require('telegraf');
const logger = require('../utils/logger');
const db = require('../db');
const authService = require('./auth-service');

let botInstance = null;
const verificationCodes = new Map();

// Простая остановка бота
async function stopBot() {
  if (botInstance) {
    await botInstance.stop();
    botInstance = null;
  }
}

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
      const verification = verificationCodes.get(code);
      
      if (!verification) {
        ctx.reply('Неверный код подтверждения');
        return;
      }
      
      try {
        logger.info('Starting Telegram auth process for code:', code);
        logger.info('Verification data:', verification);
        
        // Сначала проверяем, существует ли пользователь с этим Telegram ID
        let userId;
        const existingUser = await db.query(
          `SELECT u.id 
           FROM users u
           JOIN user_identities ui ON u.id = ui.user_id
           WHERE ui.provider = $1 
           AND ui.provider_id = $2`,
          ['telegram', ctx.from.id.toString()]
        );
        
        if (existingUser.rows.length > 0) {
          userId = existingUser.rows[0].id;
          logger.info('Found existing user with ID:', userId);
        } else {
          // Создаем нового пользователя
          const result = await db.query(
            `INSERT INTO users (created_at, updated_at) 
             VALUES (NOW(), NOW()) 
             RETURNING id`,
            []
          );
          userId = result.rows[0].id;
          logger.info('Created new user with ID:', userId);
        }
        
        // Связываем Telegram с пользователем
        await db.query(
          `INSERT INTO user_identities 
           (user_id, provider, provider_id, created_at) 
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1`,
          [userId, 'telegram', ctx.from.id.toString()]
        );
        
        logger.info(`User ${userId} successfully linked Telegram account ${ctx.from.id}`);
        
        // Обновляем сессию
        if (verification?.session) {
          logger.info('Creating session with data:', verification.session);
          
          // Обновляем данные сессии напрямую
          verification.session.userId = userId;
          verification.session.authenticated = true;
          verification.session.authType = 'telegram';
          verification.session.telegramId = ctx.from.id.toString(); // Добавляем идентификатор Telegram в сессию
          
          // Проверяем роль пользователя
          const userRole = await authService.checkUserRole(userId);
          verification.session.userRole = userRole;
          
          await new Promise((resolve, reject) => {
            verification.session.save(err => {
              if (err) reject(err);
              else resolve();
            });
          });
          
          logger.info('Session created successfully');
        }
        
        // Отправляем последнее сообщение пользователя
        if (verification.session.guestId) {
          logger.info('Fetching last guest message for guestId:', verification.session.guestId);
          const messageResult = await db.query(`
            SELECT content FROM guest_messages 
            WHERE guest_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
          `, [verification.session.guestId]);
          
          const lastMessage = messageResult.rows[0]?.content;
          logger.info('Found last message:', lastMessage);
          if (lastMessage) {
            await ctx.reply(`Ваше последнее сообщение: "${lastMessage}"`);
          }
        }
        
        // Отправляем сообщение об успешной аутентификации
        await ctx.reply('Аутентификация успешна! Можете вернуться в приложение.');
        
        // Удаляем сообщение с кодом
        try {
          await ctx.deleteMessage(ctx.message.message_id);
        } catch (error) {
          logger.warn('Could not delete code message:', error);
        }
        
        // Удаляем код верификации
        verificationCodes.delete(code);
        
      } catch (error) {
        logger.error('Error in Telegram auth:', error);
        
        // Более информативные сообщения об ошибках
        let errorMessage = 'Произошла ошибка при сохранении. Попробуйте позже.';
        
        if (error.code === '42P01') {
          errorMessage = 'Ошибка сессии. Пожалуйста, обновите страницу и попробуйте снова.';
        } else if (error.code === '42703') {
          errorMessage = 'Ошибка структуры данных. Обратитесь к администратору.';
        }
        
        if (error.code) {
          logger.error('Database error code:', error.code);
        }
        if (error.detail) {
          logger.error('Error detail:', error.detail);
        }
        if (error.stack) {
          logger.error('Error stack:', error.stack);
        }
        await ctx.reply(errorMessage);
      }
    });

    // Запускаем бота
    await botInstance.launch();
  }
  
  return botInstance;
}

// Инициализация процесса аутентификации
async function initTelegramAuth(session) {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const botLink = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}`;
  
  verificationCodes.set(code, {
    timestamp: Date.now(),
    session: session
  });
  
  logger.info(`Generated verification code: ${code} for Telegram auth`);
  return { verificationCode: code, botLink };
}

module.exports = {
  getBot,
  stopBot,
  verificationCodes,
  initTelegramAuth
}; 