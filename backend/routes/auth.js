const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { checkRole, requireAuth } = require('../middleware/auth');
const { pool } = require('../db');
const authService = require('../services/auth-service');
const { SiweMessage } = require('siwe');
const emailBot = require('../services/emailBot');
const { verificationCodes } = require('../services/telegramBot');
const { checkTokensAndUpdateRole } = require('../services/auth-service');
const { ethers } = require('ethers');
const { initTelegramAuth } = require('../services/telegramBot');
const emailAuth = require('../services/emailAuth');
const verificationService = require('../services/verification-service');
const { processGuestMessages } = require('./chat'); // Импортируем функцию обработки гостевых сообщений

// Создайте лимитер для попыток аутентификации
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток аутентификации. Попробуйте позже.' },
});

// Получение nonce для аутентификации
router.get('/nonce', async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    // Генерируем случайный nonce
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Проверяем, существует ли уже nonce для этого адреса
    const existingNonce = await db.query(
      'SELECT id FROM nonces WHERE identity_value = $1',
      [address.toLowerCase()]
    );
    
    if (existingNonce.rows.length > 0) {
      // Обновляем существующий nonce
      await db.query(
        'UPDATE nonces SET nonce = $1, expires_at = NOW() + INTERVAL \'15 minutes\' WHERE identity_value = $2',
        [nonce, address.toLowerCase()]
      );
    } else {
      // Создаем новый nonce
      await db.query(
        'INSERT INTO nonces (identity_value, nonce, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'15 minutes\')',
        [address.toLowerCase(), nonce]
      );
    }
    
    console.log(`Nonce ${nonce} сохранен для адреса ${address}`);
    
    res.json({ nonce });
  } catch (error) {
    console.error('Error generating nonce:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

// Минимальный ABI для проверки баланса ERC20
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)"
];

// Верификация подписи и создание сессии
router.post('/verify', async (req, res) => {
  try {
    const { address, message, signature } = req.body;
    
    logger.info(`[verify] Verifying signature for address: ${address}`);
    
    // Сохраняем гостевые ID до проверки
    const guestId = req.session.guestId;
    const previousGuestId = req.session.previousGuestId;
    
    logger.info(`[verify] Guest context: guestId=${guestId}, previousGuestId=${previousGuestId}`);
    
    // Проверяем подпись
    const isValid = await authService.verifySignature(message, signature, address);
    if (!isValid) {
      logger.warn(`[verify] Invalid signature for address: ${address}`);
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
    
    // Проверяем nonce
    const nonceResult = await db.query('SELECT nonce FROM nonces WHERE identity_value = $1', [address.toLowerCase()]);
    if (nonceResult.rows.length === 0 || nonceResult.rows[0].nonce !== message.match(/Nonce: ([^\n]+)/)[1]) {
      logger.warn(`[verify] Invalid nonce for address: ${address}`);
      return res.status(401).json({ success: false, error: 'Invalid nonce' });
    }
    
    logger.info(`[verify] Signature and nonce verified for address: ${address}`);
    
    // Находим или создаем пользователя
    let userId, isAdmin;
    
    // Ищем пользователя по адресу в таблице user_identities
    const userResult = await db.query(`
      SELECT u.* FROM users u 
      JOIN user_identities ui ON u.id = ui.user_id 
      WHERE ui.provider = 'wallet' AND ui.provider_id = $1
    `, [address.toLowerCase()]);
    
    if (userResult.rows.length > 0) {
      // Пользователь найден по кошельку
      userId = userResult.rows[0].id;
      isAdmin = userResult.rows[0].role === 'admin';
      logger.info(`[verify] Found existing user: ID=${userId}, isAdmin=${isAdmin}`);
    } else if (req.session.guestId) {
      // Проверяем, есть ли пользователь с текущим guestId
      const guestUserResult = await db.query(`
        SELECT u.* FROM users u 
        JOIN user_identities ui ON u.id = ui.user_id 
        WHERE ui.provider = 'guest' AND ui.provider_id = $1
      `, [req.session.guestId]);
      
      if (guestUserResult.rows.length > 0) {
        // Используем существующего пользователя с guestId
        userId = guestUserResult.rows[0].id;
        isAdmin = guestUserResult.rows[0].role === 'admin';
        logger.info(`[verify] Found user by guestId: ID=${userId}, isAdmin=${isAdmin}`);
        
        // Добавляем идентификатор кошелька к существующему пользователю
        await saveUserIdentity(userId, 'wallet', address.toLowerCase(), true);
        logger.info(`[verify] Added wallet identity ${address.toLowerCase()} to existing user ${userId}`);
      } else {
        // Создаем нового пользователя
        const newUserResult = await db.query(
          'INSERT INTO users (role) VALUES ($1) RETURNING id',
          ['user']
        );
        
        userId = newUserResult.rows[0].id;
        isAdmin = false;
        logger.info(`[verify] Created new user: ID=${userId}`);
        
        // Добавляем идентификатор кошелька
        await saveUserIdentity(userId, 'wallet', address.toLowerCase(), true);
        logger.info(`[verify] Added wallet identity ${address.toLowerCase()} to new user ${userId}`);
        
        // Добавляем идентификатор гостя
        await saveUserIdentity(userId, 'guest', req.session.guestId, true);
        logger.info(`[verify] Added guest identity ${req.session.guestId} to new user ${userId}`);
      }
    } else {
      // Создаем нового пользователя без гостевого ID
      const newUserResult = await db.query(
        'INSERT INTO users (role) VALUES ($1) RETURNING id',
        ['user']
      );
      
      userId = newUserResult.rows[0].id;
      isAdmin = false;
      logger.info(`[verify] Created new user without guest ID: ID=${userId}`);
      
      // Добавляем идентификатор кошелька
      await saveUserIdentity(userId, 'wallet', address.toLowerCase(), true);
      logger.info(`[verify] Added wallet identity ${address.toLowerCase()} to new user ${userId}`);
    }
    
    // Проверяем наличие админских токенов
    const adminStatus = await authService.checkAdminTokens(address.toLowerCase());
    if (adminStatus) {
      isAdmin = true;
      await db.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', userId]);
      logger.info(`[verify] Updated user ${userId} to admin role based on token check`);
    }
    
    // Обновляем сессию
    req.session.userId = userId;
    req.session.authenticated = true;
    req.session.authType = 'wallet';
    req.session.isAdmin = isAdmin;
    req.session.address = address.toLowerCase();
    
    // Сохраняем сессию перед связыванием сообщений
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('[verify] Error saving session:', err);
          reject(err);
        } else {
          logger.info(`[verify] Session saved successfully for user ${userId}`);
          resolve();
        }
      });
    });
    
    // Связываем гостевые сообщения с пользователем
    const linkResults = await linkGuestMessagesAfterAuth(req.session, userId);
    logger.info(`[verify] Guest messages linking results:`, linkResults);
    
    // Возвращаем успешный ответ
    return res.json({
      success: true,
      userId,
      address,
      isAdmin,
      authenticated: true
    });
    
  } catch (error) {
    logger.error('[verify] Error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Аутентификация через Telegram
router.post('/telegram/verify', async (req, res) => {
  try {
    const { telegramId, authData } = req.body;
    
    logger.info(`[telegram/verify] Authentication request with telegramId: ${telegramId}`);
    
    // Сохраняем гостевые ID до проверки
    const guestId = req.session.guestId;
    const previousGuestId = req.session.previousGuestId;
    
    logger.info(`[telegram/verify] Guest context: guestId=${guestId}, previousGuestId=${previousGuestId}`);
    
    // Проверяем данные от Telegram
    const isValid = await authService.verifyTelegramAuth(authData);
    
    if (!isValid) {
      logger.warn(`[telegram/verify] Invalid Telegram authentication data for user ${telegramId}`);
      return res.status(401).json({ 
        success: false, 
        error: 'Ошибка верификации Telegram' 
      });
    }
    
    logger.info(`[telegram/verify] Telegram authentication data verified for user ${telegramId}`);
    
    // Получаем или создаем пользователя
    let userId = await authService.getUserIdByIdentity('telegram', telegramId);
    
    if (!userId) {
      // Создаем нового пользователя
      const userResult = await db.query(
        'INSERT INTO users (created_at) VALUES (NOW()) RETURNING id'
      );
      
      userId = userResult.rows[0].id;
      logger.info(`[telegram/verify] Created new user with ID ${userId} for Telegram user ${telegramId}`);
    } else {
      logger.info(`[telegram/verify] Found existing user ID ${userId} for Telegram user ${telegramId}`);
    }
    
    // Явно сохраняем идентификатор Telegram
    await saveUserIdentity(userId, 'telegram', telegramId, true);
    logger.info(`[telegram/verify] Saved Telegram identity ${telegramId} for user ${userId}`);
    
    // Если есть гостевые ID, сохраняем их
    if (guestId) {
      await saveUserIdentity(userId, 'guest', guestId, true);
      logger.info(`[telegram/verify] Saved guest ID ${guestId} for user ${userId}`);
    }
    
    if (previousGuestId && previousGuestId !== guestId) {
      await saveUserIdentity(userId, 'guest', previousGuestId, true);
      logger.info(`[telegram/verify] Saved previous guest ID ${previousGuestId} for user ${userId}`);
    }
    
    // Устанавливаем сессию
    req.session.userId = userId;
    req.session.telegramId = telegramId;
    req.session.authType = 'telegram';
    req.session.authenticated = true;
    
    // Дополнительно устанавливаем данные из Telegram, если они есть
    if (authData.first_name) {
      req.session.telegramFirstName = authData.first_name;
    }
    
    if (authData.username) {
      req.session.telegramUsername = authData.username;
    }
    
    // Сохраняем сессию перед связыванием сообщений
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('[telegram/verify] Error saving session:', err);
          reject(err);
        } else {
          logger.info(`[telegram/verify] Session saved successfully for telegramId ${telegramId}, userId ${userId}`);
          resolve();
        }
      });
    });
    
    // Связываем гостевые сообщения с пользователем
    const linkResults = await linkGuestMessagesAfterAuth(req.session, userId);
    logger.info(`[telegram/verify] Guest messages linking results:`, linkResults);
    
    // Возвращаем успешный ответ
    return res.json({
      success: true,
      userId,
      telegramId,
      authenticated: true
    });
    
  } catch (error) {
    logger.error('[telegram/verify] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера при аутентификации через Telegram' 
    });
  }
});

// Маршрут для запроса кода подтверждения по email
router.post('/email/request', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Используем общую логику инициализации email аутентификации
    const { verificationCode } = await emailAuth.initEmailAuth(req.session, email);
    
    // Сохраняем сессию после установки pendingEmail
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('Error saving session:', err);
          reject(err);
        } else {
          logger.info(`Session saved successfully with pendingEmail: ${email}`);
          resolve();
        }
      });
    });
    
    // Отправляем email с кодом подтверждения
    const emailBot = new emailBot(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD);
    const result = await emailBot.sendVerificationCode(email, req.session.tempUserId || req.session.userId);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Код подтверждения отправлен на email' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error || 'Ошибка отправки кода' 
      });
    }
  } catch (error) {
    logger.error('Error requesting email code:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для верификации email
router.post('/email/verify', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Код подтверждения обязателен'
      });
    }
    
    if (!req.session.pendingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email не найден в сессии. Пожалуйста, запросите код подтверждения снова.'
      });
    }
    
    // Проверяем код через сервис верификации
    const result = await verificationService.verifyCode(code, 'email', req.session.pendingEmail);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Неверный код подтверждения'
      });
    }
    
    const userId = result.userId;
    const email = req.session.pendingEmail;
    
    // Проверяем, существует ли пользователь
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }
    
    // Добавляем email в базу данных
    await db.query(
      `INSERT INTO user_identities 
       (user_id, provider, provider_id) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (provider, provider_id) 
       DO UPDATE SET user_id = $1`,
      [userId, 'email', email.toLowerCase()]
    );
    
    // Проверяем наличие кошелька и определяем роль
    const wallet = await authService.getLinkedWallet(userId);
    let role = 'user'; // Базовая роль для доступа к чату
    
    if (wallet) {
      // Если есть кошелек, проверяем баланс токенов
      const isAdmin = await authService.checkAdminRole(wallet);
      role = isAdmin ? 'admin' : 'user';
      logger.info(`User ${userId} has wallet ${wallet}, role set to ${role}`);
    } else {
      logger.info(`User ${userId} has no wallet, using basic user role`);
    }
    
    // Устанавливаем аутентификацию пользователя
    req.session.authenticated = true;
    req.session.userId = userId;
    req.session.email = email.toLowerCase();
    req.session.authType = 'email';
    req.session.role = role;
    
    if (wallet) {
      req.session.address = wallet;
    }
    
    // Очищаем временные данные
    delete req.session.pendingEmail;
    delete req.session.tempUserId;
    
    // Сохраняем сессию перед отправкой ответа
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('Error saving session:', err);
          reject(err);
        } else {
          logger.info(`Session saved successfully for user ${userId} with role ${role}`);
          resolve();
        }
      });
    });
    
    // Связываем гостевые сообщения с пользователем
    await linkGuestMessagesAfterAuth(req.session, userId);
    
    return res.json({
      success: true,
      userId,
      email: email.toLowerCase(),
      role,
      wallet: wallet || null,
      message: 'Аутентификация успешна'
    });
    
  } catch (error) {
    logger.error('Error in email verification:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Связывание аккаунтов
router.post('/link-identity', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Требуется аутентификация' });
    }
    
    const { identityType, identityValue } = req.body;
    
    // Проверяем, не привязан ли уже этот идентификатор к другому пользователю
    const existingUserId = await authService.getUserIdByIdentity(identityType, identityValue);
    
    if (existingUserId && existingUserId !== req.session.userId) {
      return res.status(400).json({ error: 'Этот идентификатор уже привязан к другому аккаунту' });
    }
    
    // Добавляем новый идентификатор
    if (!existingUserId) {
      await db.query(
        'INSERT INTO user_identities (user_id, identity_type, identity_value, created_at) VALUES ($1, $2, $3, NOW())',
        [req.session.userId, identityType, identityValue]
      );
    }
    
    // Если добавлен кошелек, проверяем токены
    if (identityType === 'wallet') {
      await authService.checkTokensAndUpdateRole(identityValue);
    }
    
    // Получаем все идентификаторы пользователя
    const identitiesResult = await db.query(`
      SELECT identity_type, identity_value
      FROM user_identities
      WHERE user_id = $1
    `, [req.session.userId]);
    const identities = identitiesResult.rows;
    
    // Получаем текущую роль
    const isAdmin = await authService.isAdmin(req.session.userId);
    
    res.json({
      success: true,
      identities,
      isAdmin
    });
  } catch (error) {
    logger.error(`Link identity error: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверка статуса аутентификации
router.get('/check', async (req, res) => {
  try {
    console.log('Check auth, session data:', {
      userId: req.session.userId,
      authenticated: req.session.authenticated,
      authType: req.session.authType,
      telegramId: req.session.telegramId
    });
    
    // Если пользователь не аутентифицирован
    if (!req.session.authenticated || !req.session.userId) {
      return res.json({
        authenticated: false
      });
    }
    
    // Возвращаем полную информацию об аутентифицированном пользователе
    const userData = {
      authenticated: true,
      userId: req.session.userId,
      authType: req.session.authType,
      isAdmin: req.session.isAdmin || false
    };
    
    // Добавляем идентификаторы, если они есть в сессии
    if (req.session.address) userData.address = req.session.address;
    if (req.session.telegramId) userData.telegramId = req.session.telegramId;
    if (req.session.email) userData.email = req.session.email;
    
    console.log('Returning auth data:', userData);
    
    res.json(userData);
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Выход из системы
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

// Маршрут для авторизации через Telegram
router.get('/telegram', (req, res) => {
  // Генерируем случайный токен для авторизации
  const token = crypto.randomBytes(32).toString('hex');

  // Сохраняем токен в сессии
  req.session.telegramToken = token;

  // Создаем URL для авторизации через Telegram
  const botName = process.env.TELEGRAM_BOT_NAME || 'YourBotName';
  const authUrl = `https://t.me/${botName}?start=${token}`;

  res.json({ authUrl });
});

// Маршрут для получения кода подтверждения Telegram
router.get('/telegram/code', authLimiter, async (req, res) => {
  try {
    // Создаем или получаем ID пользователя
    let userId;
    
    if (req.session.authenticated && req.session.userId) {
      userId = req.session.userId;
    } else {
      const userResult = await db.query(
        'INSERT INTO users (created_at) VALUES (NOW()) RETURNING id'
      );
      userId = userResult.rows[0].id;
      req.session.tempUserId = userId;
    }
    
    // Создаем код через сервис верификации
    const code = await verificationService.createVerificationCode(
      'telegram',
      req.session.guestId || 'temp',
      userId
    );
    
    res.json({
      success: true,
      message: 'Отправьте этот код боту @' + process.env.TELEGRAM_BOT_USERNAME,
      code,
      botUsername: process.env.TELEGRAM_BOT_USERNAME || 'YourDAppBot'
    });
  } catch (error) {
    logger.error(`Error in telegram code request: ${error.message}`);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Функция для проверки кода Telegram
async function verifyTelegramCode(code) {
  try {
    // Используем глобальное хранилище кодов
    const verificationCodes = global.verificationCodes;
    
    if (!verificationCodes) {
      return { success: false, error: 'Система верификации не инициализирована' };
    }

    // Ищем chatId по коду
    for (const [chatId, data] of verificationCodes.entries()) {
      if (data.code === code) {
        // Проверяем срок действия
        if (Date.now() > data.expires) {
          verificationCodes.delete(chatId);
          return { success: false, error: 'Код истек' };
        }

        // Код верный и не истек
        const telegramId = chatId;
        verificationCodes.delete(chatId);
        return { 
          success: true, 
          telegramId: telegramId 
        };
      }
    }
    return { success: false, error: 'Неверный код' };
  } catch (error) {
    console.error('Error in verifyTelegramCode:', error);
    throw error;
  }
}

// Функция для проверки баланса токенов
async function checkTokenBalance(address) {
  try {
    const authService = require('../services/auth-service');
    const isAdmin = await authService.checkTokensAndUpdateRole(address);
    return isAdmin;
  } catch (error) {
    console.error('Error checking token balance:', error);
    return false;
  }
}

// Маршрут для связывания разных идентификаторов
router.post('/link-identity', requireAuth, async (req, res) => {
  try {
    const { type, value } = req.body;
    const userId = req.session.userId;
    
    // Проверяем валидность типа
    if (!['wallet', 'email', 'telegram'].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Неподдерживаемый тип идентификатора' 
      });
    }
    
    // Проверяем, не связан ли идентификатор с другим пользователем
    const existingResult = await db.query(`
      SELECT ui.user_id 
      FROM user_identities ui
      WHERE ui.identity_type = $1 AND ui.identity_value = $2
    `, [type, value]);
    
    if (existingResult.rows.length > 0 && existingResult.rows[0].user_id !== userId) {
      return res.status(400).json({
        success: false,
        error: 'Этот идентификатор уже связан с другим аккаунтом'
      });
    }
    
    // Добавляем или обновляем идентификатор
    await db.query(`
      INSERT INTO user_identities (user_id, identity_type, identity_value, created_at, verified)
      VALUES ($1, $2, $3, NOW(), true)
      ON CONFLICT (identity_type, identity_value) 
      DO UPDATE SET verified = true
    `, [userId, type, value]);
    
    // Если связываем кошелек, обновляем также поле address в таблице users
    if (type === 'wallet') {
      await db.query('UPDATE users SET address = $1 WHERE id = $2', [value, userId]);
      
      // Проверяем наличие токенов для статуса админа
      const isAdmin = await authService.checkAdminTokens(value);
      if (isAdmin) {
        await db.query('UPDATE users SET is_admin = true WHERE id = $1', [userId]);
        req.session.isAdmin = true;
      }
      
      req.session.address = value;
    }
    
    // Если связываем email, обновляем сессию
    if (type === 'email') {
      req.session.email = value;
    }
    
    // Если связываем telegram, обновляем сессию
    if (type === 'telegram') {
      req.session.telegramId = value;
    }
    
    // Сохраняем сессию
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    res.json({
      success: true,
      message: `Идентификатор успешно связан с вашим аккаунтом`,
      isAdmin: req.session.isAdmin
    });
  } catch (error) {
    logger.error(`Error linking identity: ${error.message}`);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Добавляем маршрут для проверки прав доступа
router.get('/check-access', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const address = req.session.address;

    if (address) {
      const isAdmin = await checkTokensAndUpdateRole(address);
      
      // Обновляем сессию
      req.session.isAdmin = isAdmin;

      return res.json({
        success: true,
        isAdmin,
        userId,
        address
      });
    }

    return res.json({
      success: true,
      isAdmin: false,
      userId,
      address: null
    });

  } catch (error) {
    logger.error('Error checking access:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновление сессии
router.post('/refresh-session', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (req.session && req.session.authenticated) {
      console.log('Обновление сессии для пользователя:', req.session.userId);
      
      // Обновляем время жизни сессии
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 дней
      
      // Сохраняем обновленную сессию
      await new Promise((resolve, reject) => {
        req.session.save(err => {
          if (err) {
            console.error('Ошибка при сохранении сессии:', err);
            reject(err);
          } else {
            console.log('Сессия успешно обновлена');
            resolve();
          }
        });
      });
      
      return res.json({ success: true });
    } else if (address) {
      // Если сессия не аутентифицирована, но есть адрес
      try {
        const { pool } = require('../db');
        const result = await pool.query('SELECT * FROM users WHERE address = $1', [address]);
        
        if (result.rows.length > 0) {
          const user = result.rows[0];
          
          // Обновляем сессию
          req.session.authenticated = true;
          req.session.userId = user.id;
          req.session.address = address;
          req.session.isAdmin = user.is_admin;
          req.session.authType = 'wallet';
          
          // Сохраняем обновленную сессию
          await new Promise((resolve, reject) => {
            req.session.save(err => {
              if (err) {
                console.error('Ошибка при сохранении сессии:', err);
                reject(err);
              } else {
                console.log('Сессия успешно обновлена');
                resolve();
              }
            });
          });
          
          return res.json({ success: true });
        }
      } catch (error) {
        console.error('Ошибка при проверке пользователя:', error);
      }
    }
    
    // Если не удалось обновить сессию, возвращаем успех=false, но не ошибку
    return res.json({ success: false });
  } catch (error) {
    console.error('Ошибка при обновлении сессии:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Маршрут для обновления статуса администратора
router.post('/update-admin-status', async (req, res) => {
  try {
    const { address, isAdmin } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    console.log(`Запрос на обновление статуса администратора для адреса ${address} на ${isAdmin}`);

    // Проверяем, существует ли пользователь
    const userResult = await db.query('SELECT * FROM users WHERE address = $1', [
      address.toLowerCase(),
    ]);

    if (userResult.rows.length === 0) {
      // Если пользователь не найден, создаем его
      await db.query('INSERT INTO users (address, is_admin, created_at) VALUES ($1, $2, NOW())', [
        address.toLowerCase(),
        isAdmin,
      ]);

      console.log(
        `Создан новый пользователь с адресом ${address} и статусом администратора ${isAdmin}`
      );
    } else {
      // Если пользователь найден, обновляем его статус
      await db.query('UPDATE users SET is_admin = $1 WHERE address = $2', [
        isAdmin,
        address.toLowerCase(),
      ]);

      console.log(
        `Создан новый пользователь с адресом ${address} и статусом администратора ${isAdmin}`
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при обновлении статуса администратора:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Маршрут для создания токена авторизации через Email
router.post('/email/auth-token', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ success: false, error: 'Неверный формат email' });
    }
    
    // Генерируем уникальный токен
    const token = crypto.randomBytes(20).toString('hex');
    
    // Получаем ID пользователя из сессии или создаем нового гостевого пользователя
    let userId;
    
    if (req.session.authenticated && req.session.userId) {
      // Если пользователь уже аутентифицирован, используем его ID
      userId = req.session.userId;
    } else {
      // Создаем временного пользователя
      const userResult = await db.query(
        'INSERT INTO users (created_at) VALUES (NOW()) RETURNING id'
      );
      userId = userResult.rows[0].id;
      
      // Сохраняем ID в сессии как временный
      req.session.tempUserId = userId;
    }
    
    // Сохраняем токен в базе данных
    await db.query(`
      INSERT INTO email_auth_tokens (user_id, token, created_at, expires_at)
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '15 minutes')
    `, [userId, token]);
    
    // Отправляем email с кодом подтверждения через emailBot
    const emailBot = require('../services/emailBot');
    const emailService = new emailBot(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD);
    const sendResult = await emailService.sendVerificationCode(email, token);
    
    if (sendResult.success) {
      res.json({
        success: true,
        message: 'Код подтверждения отправлен на ваш email'
      });
    } else {
      res.status(500).json({ success: false, error: 'Ошибка отправки email' });
    }
  } catch (error) {
    logger.error(`Error creating Email auth token: ${error.message}`);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Маршрут для проверки статуса аутентификации через Email
router.get('/email/auth-status/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Проверяем статус токена
    const tokenResult = await db.query(`
      SELECT user_id, used FROM email_auth_tokens
      WHERE token = $1 AND expires_at > NOW()
    `, [token]);
    
    if (tokenResult.rows.length === 0) {
      return res.json({ success: false, error: 'Токен не найден или истек' });
    }
    
    const userId = tokenResult.rows[0].user_id;
    const isAuthenticated = tokenResult.rows[0].used;
    
    if (isAuthenticated) {
      // Токен использован, email подключен
      
      // Получаем email пользователя
      const emailResult = await db.query(`
        SELECT ui.identity_value FROM user_identities ui
        WHERE ui.user_id = $1 AND ui.identity_type = 'email'
      `, [userId]);
      
      if (emailResult.rows.length > 0) {
        // Устанавливаем полную аутентификацию в сессии
        req.session.authenticated = true;
        req.session.userId = userId;
        req.session.email = emailResult.rows[0].identity_value;
        req.session.authType = 'email';
        
        // Если был временный ID, удаляем его
        if (req.session.tempUserId) {
          delete req.session.tempUserId;
        }
        
        // Сохраняем сессию
        await new Promise((resolve, reject) => {
          req.session.save(err => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    }
    
    res.json({
      success: true,
      authenticated: isAuthenticated
    });
  } catch (error) {
    logger.error(`Error checking Email auth status: ${error.message}`);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Маршрут для проверки кода email
router.post('/email/verify-code', authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email и код обязательны' 
      });
    }
    
    logger.info(`[email/verify-code] Verifying code for email: ${email}`);

    // Сохраняем гостевой ID до проверки кода
    const guestId = req.session.guestId;
    const previousGuestId = req.session.previousGuestId;
    
    logger.info(`[email/verify-code] Guest context: guestId=${guestId}, previousGuestId=${previousGuestId}`);

    // Проверяем код через сервис верификации
    const result = await verificationService.verifyCode(code, 'email', email.toLowerCase());
    
    if (!result.success) {
      logger.warn(`[email/verify-code] Invalid code for email ${email}: ${result.error}`);
      return res.status(400).json({ 
        success: false, 
        error: result.error || 'Неверный код подтверждения' 
      });
    }
    
    const userId = result.userId;
    logger.info(`[email/verify-code] Code verified successfully for email ${email}, userId: ${userId}`);
    
    // Явно сохраняем email в таблицу user_identities
    await saveUserIdentity(userId, 'email', email.toLowerCase(), true);
    
    // Если есть гостевые ID, сохраняем их до установки аутентификации
    if (guestId) {
      await saveUserIdentity(userId, 'guest', guestId, true);
      logger.info(`[email/verify-code] Saved guest ID ${guestId} for user ${userId}`);
    }
    
    if (previousGuestId && previousGuestId !== guestId) {
      await saveUserIdentity(userId, 'guest', previousGuestId, true);
      logger.info(`[email/verify-code] Saved previous guest ID ${previousGuestId} for user ${userId}`);
    }
    
    // Устанавливаем аутентификацию пользователя
    req.session.authenticated = true;
    req.session.userId = userId;
    req.session.email = email.toLowerCase();
    req.session.authType = 'email';
    
    // Если был временный ID, удаляем его
    if (req.session.tempUserId) {
      delete req.session.tempUserId;
    }
    
    // Сохраняем сессию перед связыванием сообщений
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('[email/verify-code] Error saving session:', err);
          reject(err);
        } else {
          logger.info(`[email/verify-code] Session saved successfully for user ${userId}`);
          resolve();
        }
      });
    });
    
    // Связываем гостевые сообщения с пользователем
    const linkResults = await linkGuestMessagesAfterAuth(req.session, userId);
    logger.info(`[email/verify-code] Guest messages linking results:`, linkResults);
    
    return res.json({
      success: true,
      userId,
      email: email.toLowerCase(),
      message: 'Аутентификация успешна'
    });
    
  } catch (error) {
    logger.error('[email/verify-code] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Ошибка сервера' 
    });
  }
});

// Маршрут для очистки сессии
router.post('/clear-session', async (req, res) => {
  try {
    // Очищаем все данные сессии
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Инициализация Telegram аутентификации
router.post('/telegram/init', async (req, res) => {
  try {
    const { verificationCode, botLink } = await initTelegramAuth(req.session);
    
    if (!verificationCode || !botLink) {
      throw new Error('Failed to generate verification code');
    }
    
    res.json({ 
      success: true,
      verificationCode, 
      botLink 
    });
  } catch (error) {
    logger.error('Error initializing Telegram auth:', error);
    
    if (error.message === 'Telegram уже привязан к этому аккаунту') {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to initialize Telegram auth' 
    });
  }
});

// Инициализация email аутентификации
router.post('/email/init', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректный формат email'
      });
    }

    // Создаем или получаем ID пользователя
    let userId;
    if (req.session.authenticated && req.session.userId) {
      userId = req.session.userId;
    } else {
      const userResult = await db.query(
        'INSERT INTO users (role) VALUES ($1) RETURNING id',
        ['user']
      );
      userId = userResult.rows[0].id;
      req.session.tempUserId = userId;
    }

    // Сохраняем email в сессии
    req.session.pendingEmail = email.toLowerCase();

    // Генерируем код верификации
    const code = await verificationService.createVerificationCode('email', email.toLowerCase(), userId);

    // Инициализируем верификацию через email бот
    const result = await emailBot.initEmailVerification(email, userId, code);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Ошибка при отправке кода верификации'
      });
    }

    // Сохраняем сессию
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('Error saving session:', err);
          reject(err);
        } else {
          logger.info(`Session saved successfully with pendingEmail: ${email}`);
          resolve();
        }
      });
    });

    // Связываем гостевые сообщения с пользователем
    await linkGuestMessagesAfterAuth(req.session, userId);

    return res.json({
      success: true,
      message: 'Код верификации отправлен на email'
    });

  } catch (error) {
    logger.error('Error in email auth initialization:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Проверка кода подтверждения email
router.post('/email/verify', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await emailAuth.checkEmailVerification(code);
    res.json(result);
  } catch (error) {
    console.error('Error verifying email code:', error);
    res.status(400).json({ error: error.message });
  }
});

// Проверка кода верификации email
router.post('/email/check-verification', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Код верификации не предоставлен' 
      });
    }
    
    // Сохраняем гостевой ID до проверки кода
    const guestId = req.session.guestId;
    const previousGuestId = req.session.previousGuestId;
    
    logger.info(`[email/check-verification] Checking verification with code ${code}, guest context: guestId=${guestId}, previousGuestId=${previousGuestId}`);
    
    // Проверяем код через сервис верификации
    const result = await emailAuth.checkEmailVerification(code, req.session);
    
    if (!result.verified) {
      logger.warn(`[email/check-verification] Invalid code: ${result.message}`);
      // Преобразуем ответ для совместимости с фронтендом
      return res.json({
        success: false,
        message: result.message
      });
    }
    
    logger.info(`[email/check-verification] Email verification successful for userId: ${result.userId}, email: ${result.email}`);
    
    // Код верный, обновляем сессию
    req.session.authenticated = true;
    req.session.userId = result.userId;
    req.session.authType = 'email';
    req.session.email = result.email;
    
    // Восстанавливаем гостевой ID, если он был потерян в процессе верификации
    if (!req.session.guestId && guestId) {
      req.session.guestId = guestId;
      logger.info(`[email/check-verification] Restored guestId ${guestId}`);
    }
    
    if (!req.session.previousGuestId && previousGuestId) {
      req.session.previousGuestId = previousGuestId;
      logger.info(`[email/check-verification] Restored previous guest ID ${previousGuestId}`);
    }
    
    // Получаем роль пользователя
    const roleResult = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [result.userId]
    );
    
    if (roleResult.rows.length > 0) {
      req.session.userRole = roleResult.rows[0].role || 'user';
      logger.info(`[email/check-verification] User role: ${req.session.userRole}`);
    } else {
      req.session.userRole = 'user';
      logger.info(`[email/check-verification] User role not found, setting default: user`);
    }
    
    // Явно добавляем email в таблицу user_identities
    await saveUserIdentity(result.userId, 'email', result.email.toLowerCase(), true);
    logger.info(`[email/check-verification] Email identity ${result.email} saved for user ${result.userId}`);
    
    // Сохраняем сессию
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('[email/check-verification] Error saving session:', err);
          reject(err);
        } else {
          logger.info(`[email/check-verification] Session saved successfully for email ${result.email}`);
          resolve();
        }
      });
    });
    
    // Связываем гостевые сообщения с пользователем
    const linkResults = await linkGuestMessagesAfterAuth(req.session, result.userId);
    logger.info(`[email/check-verification] Guest messages linking results:`, linkResults);
    
    return res.json({
      success: true,
      userId: result.userId,
      email: result.email
    });
  } catch (error) {
    logger.error('[email/check-verification] Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка при проверке кода верификации' 
    });
  }
});

// Маршрут для имитации отправки email
router.post('/email/send', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }
    
    const result = await emailAuth.markEmailAsSent(code);
    
    if (result.success) {
      return res.json({ success: true });
    } else {
      return res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('Error marking email as sent:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обертка для функции processGuestMessages с правильным порядком аргументов
async function processGuestMessagesWrapper(guestId, userId) {
  try {
    logger.info(`[processGuestMessagesWrapper] Correcting order of arguments: userId=${userId}, guestId=${guestId}`);
    return await processGuestMessages(userId, guestId);
  } catch (error) {
    logger.error(`[processGuestMessagesWrapper] Error: ${error.message}`, error);
    throw error;
  }
}

// Функция для сохранения идентификатора пользователя в базу данных
async function saveUserIdentity(userId, provider, providerId, verified = true) {
  try {
    logger.info(`[saveUserIdentity] Saving identity for user ${userId}: ${provider}:${providerId}`);
    
    // Проверяем, существует ли уже такой идентификатор
    const existingResult = await db.query(
      `SELECT user_id FROM user_identities WHERE provider = $1 AND provider_id = $2`,
      [provider, providerId]
    );
    
    if (existingResult.rows.length > 0) {
      const existingUserId = existingResult.rows[0].user_id;
      
      // Если идентификатор уже принадлежит этому пользователю, ничего не делаем
      if (existingUserId === userId) {
        logger.info(`[saveUserIdentity] Identity ${provider}:${providerId} already exists for user ${userId}`);
      } else {
        // Если идентификатор принадлежит другому пользователю, логируем это
        logger.warn(`[saveUserIdentity] Identity ${provider}:${providerId} already belongs to user ${existingUserId}, not user ${userId}`);
        return {
          success: false,
          error: `Identity already belongs to another user (${existingUserId})`
        };
      }
    } else {
      // Создаем новую запись
      await db.query(
        `INSERT INTO user_identities (user_id, provider, provider_id) 
         VALUES ($1, $2, $3)`,
        [userId, provider, providerId]
      );
      logger.info(`[saveUserIdentity] Created new identity ${provider}:${providerId} for user ${userId}`);
    }
    
    return { success: true };
  } catch (error) {
    logger.error(`[saveUserIdentity] Error saving identity ${provider}:${providerId} for user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

// Функция для связывания гостевых сообщений после аутентификации
async function linkGuestMessagesAfterAuth(session, userId) {
  try {
    const guestId = session.guestId;
    const previousGuestId = session.previousGuestId;
    
    logger.info(`[linkGuestMessagesAfterAuth] Starting for user ${userId} with guestId=${guestId}, previousGuestId=${previousGuestId}`);
    
    // Проверяем, есть ли идентификаторы для обработки
    if (!guestId && !previousGuestId) {
      logger.debug('[linkGuestMessagesAfterAuth] No guest IDs to process');
      return { success: true, message: 'No guest IDs to process' };
    }
    
    // Получаем список постоянных идентификаторов пользователя
    const permanentIdentitiesResult = await db.query(
      `SELECT provider, provider_id FROM user_identities WHERE user_id = $1 AND provider IN ('wallet', 'email', 'telegram')`,
      [userId]
    );
    
    // Логирование найденных постоянных идентификаторов
    logger.info(`[linkGuestMessagesAfterAuth] Found ${permanentIdentitiesResult.rows.length} permanent identities for user ${userId}`);
    permanentIdentitiesResult.rows.forEach(identity => {
      logger.info(`[linkGuestMessagesAfterAuth] - ${identity.provider}:${identity.provider_id}`);
    });
    
    // Сохраняем все постоянные идентификаторы из сессии
    if (session.email) {
      await saveUserIdentity(userId, 'email', session.email, true);
    }
    
    if (session.address) {
      await saveUserIdentity(userId, 'wallet', session.address, true);
    }
    
    if (session.telegramId) {
      await saveUserIdentity(userId, 'telegram', session.telegramId, true);
    }
    
    let results = [];
    
    // Обрабатываем текущий гостевой ID
    if (guestId) {
      logger.info(`[linkGuestMessagesAfterAuth] Processing current guest ID ${guestId} for user ${userId}`);
      
      try {
        // Сохраняем гостевой ID как идентификатор пользователя
        await saveUserIdentity(userId, 'guest', guestId, true);
        
        // Связываем сообщения с пользователем через обертку с правильным порядком аргументов
        const result = await processGuestMessagesWrapper(guestId, userId);
        results.push({ guestId, result });
        logger.info(`[linkGuestMessagesAfterAuth] Successfully processed guest ID ${guestId}`);
      } catch (error) {
        logger.error(`[linkGuestMessagesAfterAuth] Error processing guest ID ${guestId}:`, error);
        results.push({ guestId, error: error.message });
      }
    }
    
    // Обрабатываем предыдущий гостевой ID
    if (previousGuestId && previousGuestId !== guestId) {
      logger.info(`[linkGuestMessagesAfterAuth] Processing previous guest ID ${previousGuestId} for user ${userId}`);
      
      try {
        // Сохраняем предыдущий гостевой ID как идентификатор пользователя
        await saveUserIdentity(userId, 'guest', previousGuestId, true);
        
        // Связываем сообщения с пользователем через обертку с правильным порядком аргументов
        const result = await processGuestMessagesWrapper(previousGuestId, userId);
        results.push({ guestId: previousGuestId, result });
        logger.info(`[linkGuestMessagesAfterAuth] Successfully processed previous guest ID ${previousGuestId}`);
      } catch (error) {
        logger.error(`[linkGuestMessagesAfterAuth] Error processing previous guest ID ${previousGuestId}:`, error);
        results.push({ guestId: previousGuestId, error: error.message });
      }
    }
    
    // Очищаем гостевые идентификаторы из сессии
    delete session.guestId;
    delete session.previousGuestId;
    
    // Сохраняем сессию
    await new Promise((resolve, reject) => {
      session.save(err => {
        if (err) {
          logger.error('[linkGuestMessagesAfterAuth] Error saving session after guest ID processing:', err);
          reject(err);
        } else {
          logger.info('[linkGuestMessagesAfterAuth] Session saved successfully after guest ID processing');
          resolve();
        }
      });
    });
    
    return { success: true, results };
  } catch (error) {
    logger.error(`[linkGuestMessagesAfterAuth] Error: ${error.message}`, error);
    return { success: false, error: error.message };
  }
}

// Маршрут для получения всех идентификаторов пользователя
router.get('/identities', requireAuth, async (req, res) => {
  try {
    const { userId } = req.session;
    
    // Получаем все идентификаторы пользователя
    const identitiesResult = await db.query(
      `SELECT provider, provider_id FROM user_identities WHERE user_id = $1`,
      [userId]
    );
    
    const identities = identitiesResult.rows;
    
    res.json({
      success: true,
      identities
    });
  } catch (error) {
    logger.error('Error getting user identities:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Аутентификация через wallet
router.post('/wallet', async (req, res) => {
  try {
    const { address, nonce, signature } = req.body;
    
    if (!address || !nonce || !signature) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    logger.info(`[wallet] Authentication request for address: ${address}`);
    
    // Сохраняем гостевые ID до аутентификации
    const guestId = req.session.guestId;
    const previousGuestId = req.session.previousGuestId;
    
    logger.info(`[wallet] Guest context: guestId=${guestId}, previousGuestId=${previousGuestId}`);

    // Формируем сообщение для проверки
    const message = `Sign this message to authenticate with HB3 DApp: ${nonce}`;
    
    // Проверяем подпись
    const validSignature = await authService.verifySignature(message, signature, address);
    if (!validSignature) {
      logger.warn(`[wallet] Invalid signature for address: ${address}`);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid signature' 
      });
    }
    
    logger.info(`[wallet] Valid signature from address: ${address}`);
    
    // Получаем или создаем пользователя
    const { userId } = await authService.findOrCreateUser(address);
    logger.info(`[wallet] User ID for address ${address}: ${userId}`);
    
    // Проверяем наличие админских токенов
    const isAdmin = await authService.checkAdminTokens(address);
    logger.info(`[wallet] Admin status for ${address}: ${isAdmin}`);
    
    // Обновляем роль пользователя в базе данных, если нужно
    if (isAdmin) {
      try {
        await db.query(
          'UPDATE users SET role = $1 WHERE id = $2',
          ['admin', userId]
        );
        logger.info(`[wallet] Updated user ${userId} role to admin`);
      } catch (updateError) {
        logger.error(`[wallet] Error updating user role:`, updateError);
      }
    }
    
    // Явно сохраняем wallet адрес как идентификатор пользователя
    await saveUserIdentity(userId, 'wallet', address.toLowerCase(), true);
    logger.info(`[wallet] Saved wallet identity ${address.toLowerCase()} for user ${userId}`);
    
    // Если есть гостевые ID, сохраняем их
    if (guestId) {
      await saveUserIdentity(userId, 'guest', guestId, true);
      logger.info(`[wallet] Saved guest ID ${guestId} for user ${userId}`);
    }
    
    if (previousGuestId && previousGuestId !== guestId) {
      await saveUserIdentity(userId, 'guest', previousGuestId, true);
      logger.info(`[wallet] Saved previous guest ID ${previousGuestId} for user ${userId}`);
    }
    
    // Устанавливаем сессию
    req.session.userId = userId;
    req.session.address = address.toLowerCase();
    req.session.authType = 'wallet';
    req.session.authenticated = true;
    req.session.isAdmin = isAdmin;
    
    // Сохраняем сессию перед связыванием сообщений
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('[wallet] Error saving session:', err);
          reject(err);
        } else {
          logger.info(`[wallet] Session saved successfully for user ${userId}, address ${address}`);
          resolve();
        }
      });
    });
    
    // Связываем гостевые сообщения с пользователем
    const linkResults = await linkGuestMessagesAfterAuth(req.session, userId);
    logger.info(`[wallet] Guest messages linking results:`, linkResults);
    
    // Возвращаем успешный ответ
    return res.json({
      success: true,
      userId,
      address,
      isAdmin,
      authenticated: true
    });
    
  } catch (error) {
    logger.error('[wallet] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during wallet authentication' 
    });
  }
});

// Обработчик для связывания гостевых сообщений с пользователем
router.post('/link-guest-messages', requireAuth, async (req, res) => {
  try {
    const { userId } = req.session;
    
    logger.info(`[link-guest-messages] Request for user ${userId}`);
    
    // Получаем все идентификаторы пользователя
    const userIdentitiesResult = await db.query(
      `SELECT provider, provider_id FROM user_identities WHERE user_id = $1`,
      [userId]
    );
    
    const userIdentities = userIdentitiesResult.rows;
    logger.info(`[link-guest-messages] Found ${userIdentities.length} identities for user ${userId}`);
    userIdentities.forEach(identity => {
      logger.info(`[link-guest-messages] - ${identity.provider}:${identity.provider_id}`);
    });
    
    // Собираем все guestId, связанные с идентификаторами пользователя
    let guestIds = [];
    
    // Добавляем текущий guestId из сессии
    if (req.session.guestId) {
      guestIds.push(req.session.guestId);
      logger.info(`[link-guest-messages] Added session guestId: ${req.session.guestId}`);
    }
    
    // Добавляем guestId из тела запроса, если есть
    if (req.body.guestId) {
      guestIds.push(req.body.guestId);
      logger.info(`[link-guest-messages] Added request body guestId: ${req.body.guestId}`);
    }
    
    // Добавляем массив guestIds из тела запроса, если есть
    if (req.body.guestIds && Array.isArray(req.body.guestIds)) {
      logger.info(`[link-guest-messages] Adding ${req.body.guestIds.length} guestIds from request body`);
      guestIds = [...guestIds, ...req.body.guestIds];
    }
    
    // Добавляем guestId из идентификаторов пользователя
    const guestIdentities = userIdentities.filter(identity => identity.provider === 'guest');
    if (guestIdentities.length > 0) {
      logger.info(`[link-guest-messages] Adding ${guestIdentities.length} guest identities from user_identities`);
      guestIds = [...guestIds, ...guestIdentities.map(identity => identity.provider_id)];
    }
    
    // Убираем дубликаты
    guestIds = [...new Set(guestIds)];
    
    logger.info(`[link-guest-messages] Final list of unique guestIds to process: ${guestIds.length}`);
    guestIds.forEach(id => logger.info(`[link-guest-messages] - ${id}`));
    
    if (guestIds.length === 0) {
      logger.info('[link-guest-messages] No guest IDs found for user');
      return res.json({ success: true, message: 'No guest messages to link' });
    }
    
    const results = [];
    
    // Обрабатываем каждый guestId
    for (const guestId of guestIds) {
      // Пропускаем пустые или невалидные ID
      if (!guestId || typeof guestId !== 'string') {
        logger.warn(`[link-guest-messages] Skipping invalid guest ID: ${guestId}`);
        continue;
      }
      
      // Проверяем, не обрабатывали ли мы уже этот ID
      if (req.session.processedGuestIds && req.session.processedGuestIds.includes(guestId)) {
        logger.info(`[link-guest-messages] Guest ID ${guestId} already processed, skipping`);
        results.push({ guestId, result: { success: true, message: 'Already processed' } });
        continue;
      }
      
      // Проверяем наличие гостевых сообщений
      try {
        const guestMessagesCheck = await db.query(
          'SELECT EXISTS(SELECT 1 FROM guest_messages WHERE guest_id = $1)',
          [guestId]
        );
        
        if (guestMessagesCheck.rows[0].exists) {
          logger.info(`[link-guest-messages] Found messages for guest ID ${guestId}, processing`);
          try {
            // Используем обертку с правильным порядком аргументов
            const result = await processGuestMessagesWrapper(guestId, userId);
            results.push({ guestId, result });
            logger.info(`[link-guest-messages] Successfully processed guest ID ${guestId}`);
          } catch (error) {
            logger.error(`[link-guest-messages] Error processing guest ID ${guestId}:`, error);
            results.push({ guestId, error: error.message });
          }
        } else {
          logger.info(`[link-guest-messages] No guest messages found for guest ID ${guestId}`);
          results.push({ guestId, result: { success: true, message: 'No messages found' } });
        }
      } catch (error) {
        logger.error(`[link-guest-messages] Error checking guest messages for ${guestId}:`, error);
        results.push({ guestId, error: error.message });
      }
    }
    
    // Сохраняем все обработанные guestId, чтобы не обрабатывать их снова
    if (!req.session.processedGuestIds) {
      req.session.processedGuestIds = [];
    }
    
    // Добавляем только успешно обработанные ID
    const successfulGuestIds = results
      .filter(r => r.result && r.result.success)
      .map(r => r.guestId);
    
    req.session.processedGuestIds = [...new Set([...req.session.processedGuestIds, ...successfulGuestIds])];
    logger.info(`[link-guest-messages] Updated processed guest IDs: ${req.session.processedGuestIds.join(', ')}`);
    
    // Очищаем текущий guestId из сессии
    req.session.guestId = null;
    await req.session.save();
    logger.info('[link-guest-messages] Session updated, guestId cleared');
    
    return res.json({
      success: true,
      message: `Processed ${results.length} guest IDs`,
      results
    });
  } catch (error) {
    logger.error('[link-guest-messages] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Маршрут для проверки и инициализации сессии гостя
router.get('/check-session', async (req, res) => {
  try {
    // Если у пользователя нет guestId, создаем его
    if (!req.session.guestId && !req.session.authenticated) {
      req.session.guestId = crypto.randomBytes(16).toString('hex');
      await req.session.save();
      logger.info('Created new guestId:', req.session.guestId);
    }
    
    res.json({
      success: true,
      guestId: req.session.guestId,
      isAuthenticated: req.session.authenticated || false
    });
  } catch (error) {
    logger.error('Error checking session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;