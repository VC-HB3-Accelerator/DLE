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
const { EmailBotService } = require('../services/emailBot');
const { verificationCodes } = require('../services/telegramBot');
const { checkTokensAndUpdateRole } = require('../services/auth-service');
const { ethers } = require('ethers');
const { initTelegramAuth } = require('../services/telegramBot');
const { initEmailAuth, verifyEmailCode } = require('../services/emailBot');
const { getBot } = require('../services/telegramBot');
const emailAuth = require('../services/emailAuth');
const verificationService = require('../services/verification-service');

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
    
    // Проверяем подпись
    const isValid = await authService.verifySignature(message, signature, address);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }
    
    // Проверяем nonce
    const nonceResult = await db.query('SELECT nonce FROM nonces WHERE identity_value = $1', [address.toLowerCase()]);
    if (nonceResult.rows.length === 0 || nonceResult.rows[0].nonce !== message.match(/Nonce: ([^\n]+)/)[1]) {
      return res.status(401).json({ success: false, error: 'Invalid nonce' });
    }
    
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
        
        // Добавляем идентификатор кошелька к существующему пользователю
        await db.query(
          'INSERT INTO user_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
          [userId, 'wallet', address.toLowerCase()]
        );
      } else {
        // Создаем нового пользователя
        const newUserResult = await db.query(
          'INSERT INTO users (role) VALUES ($1) RETURNING id',
          ['user']
        );
        
        userId = newUserResult.rows[0].id;
        isAdmin = false;
        
        // Добавляем идентификатор кошелька
        await db.query(
          'INSERT INTO user_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
          [userId, 'wallet', address.toLowerCase()]
        );
        
        // Добавляем идентификатор гостя
        await db.query(
          'INSERT INTO user_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
          [userId, 'guest', req.session.guestId]
        );
      }
    } else {
      // Создаем нового пользователя без гостевого ID
      const newUserResult = await db.query(
        'INSERT INTO users (role) VALUES ($1) RETURNING id',
        ['user']
      );
      
      userId = newUserResult.rows[0].id;
      isAdmin = false;
      
      // Добавляем идентификатор кошелька
      await db.query(
        'INSERT INTO user_identities (user_id, provider, provider_id) VALUES ($1, $2, $3)',
        [userId, 'wallet', address.toLowerCase()]
      );
    }
    
    // Обновляем сессию
    req.session.userId = userId;
    req.session.authenticated = true;
    req.session.authType = 'wallet';
    req.session.isAdmin = isAdmin;
    req.session.address = address.toLowerCase();
    
    // Сохраняем сессию
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    // Возвращаем успешный ответ
    return res.json({
      success: true,
      userId,
      address,
      isAdmin,
      authenticated: true
    });
    
  } catch (error) {
    console.error('Error in /verify:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Аутентификация через Telegram
router.post('/telegram', async (req, res) => {
  try {
    const { telegramId, authData } = req.body;
    
    // Здесь должна быть проверка данных от Telegram
    
    // Получаем или создаем пользователя
    let userId = await authService.getUserIdByIdentity('telegram', telegramId);
    
    if (!userId) {
      // Создаем нового пользователя
      const userResult = await db.query(
        'INSERT INTO users (created_at, role_id) VALUES (NOW(), (SELECT id FROM roles WHERE name = $1)) RETURNING id',
        ['user']
      );
      
      userId = userResult.rows[0].id;
      
      // Добавляем идентификатор Telegram
      await db.query(
        'INSERT INTO user_identities (user_id, identity_type, identity_value, created_at) VALUES ($1, $2, $3, NOW())',
        [userId, 'telegram', telegramId]
      );
    }
    
    // Проверяем связанные аккаунты
    const identitiesResult = await db.query(`
      SELECT identity_type, identity_value
      FROM user_identities ui
      WHERE user_id = $1
    `, [userId]);
    const identities = identitiesResult.rows;
    
    // Если есть связанный кошелек, проверяем токены
    if (identities.wallet) {
      await authService.checkTokensAndUpdateRole(identities.wallet);
    }
    
    // Получаем текущую роль
    const isAdmin = await authService.isAdmin(userId);
    
    // Устанавливаем сессию
    req.session.userId = userId;
    req.session.telegramId = telegramId;
    req.session.authType = 'telegram';
    req.session.authenticated = true;
    
    res.json({
      authenticated: true,
      userId,
      isAdmin,
      authType: 'telegram',
      identities
    });
  } catch (error) {
    logger.error(`Telegram auth error: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера' });
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
    const emailBot = new EmailBotService(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD);
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
       (user_id, provider, provider_id, created_at) 
       VALUES ($1, $2, $3, NOW()) 
       ON CONFLICT (provider, provider_id) 
       DO UPDATE SET user_id = $1`,
      [userId, 'email', email.toLowerCase()]
    );
    
    // Связываем гостевой ID с пользователем, если его еще нет
    if (req.session.guestId) {
      const guestIdentity = await db.query(
        `SELECT * FROM user_identities 
         WHERE user_id = $1 AND provider = 'guest' AND provider_id = $2`,
        [userId, req.session.guestId]
      );
      
      if (guestIdentity.rows.length === 0) {
        await db.query(
          `INSERT INTO user_identities 
           (user_id, provider, provider_id, created_at) 
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1`,
          [userId, 'guest', req.session.guestId]
        );
      }
    }
    
    // Связываем все гостевые сообщения с пользователем
    if (req.session.guestId) {
      try {
        await db.query('SELECT link_guest_messages($1, $2)', [userId, req.session.guestId]);
        logger.info(`Messages linked successfully for user ${userId} and guest ${req.session.guestId}`);
      } catch (linkError) {
        logger.error(`Error linking messages: ${linkError.message}`);
      }
    }
    
    // Устанавливаем аутентификацию пользователя
    req.session.authenticated = true;
    req.session.userId = userId;
    req.session.email = email.toLowerCase();
    req.session.authType = 'email';
    
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
          logger.info('Session saved successfully');
          resolve();
        }
      });
    });
    
    return res.json({
      success: true,
      userId,
      email: email.toLowerCase(),
      message: 'Аутентификация успешна'
    });
    
  } catch (error) {
    logger.error('Error in email verification:', error);
    res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
  }
});

// Аутентификация через Email
router.post('/email', async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    
    // Здесь должна быть проверка кода подтверждения
    
    // Получаем или создаем пользователя
    let userId = await authService.getUserIdByIdentity('email', email);
    
    if (!userId) {
      // Создаем нового пользователя
      const userResult = await db.query(
        'INSERT INTO users (created_at, role_id) VALUES (NOW(), (SELECT id FROM roles WHERE name = $1)) RETURNING id',
        ['user']
      );
      
      userId = userResult.rows[0].id;
      
      // Добавляем идентификатор Email
      await db.query(
        'INSERT INTO user_identities (user_id, identity_type, identity_value, created_at) VALUES ($1, $2, $3, NOW())',
        [userId, 'email', email]
      );
    }
    
    // Получаем связанные идентификаторы
    const identitiesResult = await db.query(`
      SELECT identity_type, identity_value 
      FROM user_identities ui
      WHERE ui.user_id = $1
    `, [userId]);
    
    const identities = identitiesResult.rows;
    
    // Формируем объект с идентификаторами по типам
    const identitiesMap = {};
    for (const identity of identities) {
      identitiesMap[identity.identity_type] = identity.identity_value;
    }
    
    // Проверяем, есть ли связанный кошелек
    let isAdmin = false;
    if (identitiesMap.wallet) {
      // Если есть связанный кошелек, проверяем токены
      const walletAddress = identitiesMap.wallet;
      isAdmin = await authService.checkAdminTokens(walletAddress);
      
      // Обновляем статус администратора в БД, если необходимо
      await db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, userId]);
    } else {
      // Если нет связанного кошелька, проверяем текущий статус администратора
      isAdmin = await authService.isAdmin(userId);
    }
    
    // Устанавливаем сессию
    req.session.userId = userId;
    req.session.email = email;
    req.session.authType = 'email';
    req.session.authenticated = true;
    req.session.isAdmin = isAdmin;
    
    if (identitiesMap.wallet) {
      req.session.address = identitiesMap.wallet;
    }
    
    // Сохраняем сессию перед отправкой ответа
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          console.error('Error saving session:', err);
          reject(err);
        } else {
          console.log('Session saved successfully');
          resolve();
        }
      });
    });
      
    res.json({ 
      authenticated: true, 
      userId,
      isAdmin,
      authType: 'email',
      identities: identitiesMap
    });
  } catch (error) {
    logger.error(`Email auth error: ${error.message}`);
    res.status(500).json({ error: 'Ошибка сервера' });
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
router.get('/check', (req, res) => {
  try {
    console.log('Сессия при проверке:', req.session);
    
    const authenticated = req.session.authenticated || req.session.isAuthenticated || false;
    const userId = req.session.userId;
    const authType = req.session.authType;
    const address = req.session.address;
    const telegramId = req.session.telegramId;
    const email = req.session.email;
    
    // Проверяем, является ли пользователь администратором
    const isAdmin = req.session.userRole === 'admin';
    
    res.json({
      authenticated,
      userId,
      isAdmin,
      authType,
      address,
      telegramId,
      email
    });
  } catch (error) {
    console.error('Error checking auth:', error);
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

// Маршрут для верификации Telegram
router.post('/telegram/verify', async (req, res) => {
  try {
    const { code } = req.body;
    
    // Проверяем код через сервис верификации
    const result = await verificationService.verifyCode(code, 'telegram', req.session.guestId || 'temp');
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        error: result.error || 'Неверный код подтверждения' 
      });
    }
    
    const userId = result.userId;
    const telegramId = result.providerId;
    
    // Добавляем Telegram идентификатор в базу данных
    await db.query(
      'INSERT INTO user_identities (user_id, identity_type, identity_value, verified, created_at) ' +
      'VALUES ($1, $2, $3, true, NOW()) ' +
      'ON CONFLICT (identity_type, identity_value) ' +
      'DO UPDATE SET user_id = $1, verified = true',
      [userId, 'telegram', telegramId]
    );
    
    // Устанавливаем аутентификацию пользователя
    req.session.authenticated = true;
    req.session.userId = userId;
    req.session.telegramId = telegramId;
    req.session.authType = 'telegram';
    
    // Если был временный ID, удаляем его
    if (req.session.tempUserId) {
      delete req.session.tempUserId;
    }
    
    // Если есть подключенный кошелек, проверяем баланс токенов
    if (req.session.address) {
      const isAdmin = await checkTokenBalance(req.session.address);
      req.session.isAdmin = isAdmin;
    }
    
    return res.json({
      success: true,
      userId,
      telegramId,
      isAdmin: req.session.isAdmin || false,
      authenticated: true
    });
    
  } catch (error) {
    logger.error('Error in telegram verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

    // Проверяем код через сервис верификации
    const result = await verificationService.verifyCode(code, 'email', email.toLowerCase());
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false, 
        error: result.error || 'Неверный код подтверждения' 
      });
    }
    
    const userId = result.userId;
    
    // Добавляем email в базу данных
    await db.query(
      'INSERT INTO user_identities (user_id, identity_type, identity_value, verified, created_at) ' +
      'VALUES ($1, $2, $3, true, NOW()) ' +
      'ON CONFLICT (identity_type, identity_value) ' +
      'DO UPDATE SET user_id = $1, verified = true',
      [userId, 'email', email.toLowerCase()]
    );
    
    // Устанавливаем аутентификацию пользователя
    req.session.authenticated = true;
    req.session.userId = userId;
    req.session.email = email.toLowerCase();
    req.session.authType = 'email';
    
    // Если был временный ID, удаляем его
    if (req.session.tempUserId) {
      delete req.session.tempUserId;
    }
    
    return res.json({
      success: true,
      userId,
      email: email.toLowerCase(),
      message: 'Аутентификация успешна'
    });
    
  } catch (error) {
    logger.error('Error verifying email code:', error);
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
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email не указан' 
      });
    }
    
    const result = await emailAuth.initEmailAuth(req.session, email);
    
    return res.json({ 
      success: true,
      message: 'Код верификации отправлен на указанный email'
    });
  } catch (error) {
    logger.error('Error initializing email auth:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Ошибка при инициализации email аутентификации' 
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
router.get('/check-email-verification', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ 
        verified: false, 
        message: 'Код верификации не предоставлен' 
      });
    }
    
    // Проверяем код через сервис верификации
    const result = await emailAuth.checkEmailVerification(code, req.session);
    
    if (!result.verified) {
      return res.json(result);
    }
    
    // Код верный, обновляем сессию
    req.session.authenticated = true;
    req.session.userId = result.userId;
    req.session.authType = 'email';
    req.session.email = result.email;
    
    // Получаем роль пользователя
    const roleResult = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [result.userId]
    );
    
    if (roleResult.rows.length > 0) {
      req.session.userRole = roleResult.rows[0].role || 'user';
    } else {
      req.session.userRole = 'user';
    }
    
    // Сохраняем сессию
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) {
          logger.error('Error saving session:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    return res.json({
      verified: true,
      userId: result.userId,
      email: result.email
    });
  } catch (error) {
    logger.error('Error checking email verification:', error);
    return res.status(500).json({ 
      verified: false, 
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

module.exports = router;