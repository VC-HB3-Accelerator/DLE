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
const { sendEmail } = require('../services/emailBot');
const { verificationCodes } = require('../services/telegramBot');
const { checkTokensAndUpdateRole } = require('../services/auth-service');
const { ethers } = require('ethers');
const { initTelegramAuth } = require('../services/telegramBot');
const { initEmailAuth, verifyEmailCode } = require('../services/emailBot');
const { getBot } = require('../services/telegramBot');

// Создайте лимитер для попыток аутентификации
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20, // Увеличьте лимит с 5 до 20
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
      // Пользователь найден
      userId = userResult.rows[0].id;
      isAdmin = userResult.rows[0].role === 'admin';
      const address = userResult.rows[0].address;
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
router.post('/email/request', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Генерируем уникальный токен
    const token = crypto.randomBytes(20).toString('hex');
    
    // Создаем или получаем ID пользователя
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
    const EmailBotService = require('../services/emailBot');
    const emailBot = new EmailBotService(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD);
    
    // Используем новый метод sendVerificationCode вместо sendEmail
    const result = await emailBot.sendVerificationCode(email, token);
    
    if (result.success) {
      // Сохраняем email в сессии для последующей верификации
      req.session.pendingEmail = email;
      
      // Сохраняем сессию
      await new Promise((resolve, reject) => {
        req.session.save(err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      return res.json({
        success: true,
        message: 'Verification code sent to your email',
        verificationCode: result.code // НЕ ОСТАВЛЯЙТЕ В PRODUCTION - только для отладки
      });
    } else {
      return res.status(500).json({ error: 'Error sending email' });
    }
  } catch (error) {
    console.error('Error requesting email verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Маршрут для верификации email
router.post('/email/verify', async (req, res) => {
  try {
    const { code } = req.body;
    const verificationData = req.session.emailVerificationData;
    
    // Проверяем, что код существует и не истек
    if (!verificationData || 
        verificationData.code !== code || 
        Date.now() > verificationData.expires) {
      return res.status(400).json({
        success: false,
        error: 'Неверный или истекший код подтверждения'
      });
    }
    
    const email = verificationData.email;
    
    // Ищем или создаем пользователя с этим email
    const result = await db.query(
      'SELECT * FROM find_or_create_user_by_identity($1, $2)',
      ['email', email]
    );
    
    const userId = result.rows[0].user_id;
    const isNew = result.rows[0].is_new;
    
    // Проверяем, есть ли у пользователя связанный кошелек
    const walletResult = await db.query(`
      SELECT identity_value 
      FROM user_identities ui
      WHERE ui.user_id = $1 AND ui.identity_type = 'wallet'
    `, [userId]);
    
    const hasWallet = walletResult.rows.length > 0;
    let walletAddress = null;
    let isAdmin = false;
    
    // Если есть кошелек, проверяем наличие токенов
    if (hasWallet) {
      walletAddress = walletResult.rows[0].identity_value;
      const userResult = await db.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
      isAdmin = userResult.rows[0].is_admin;
    }
    
    // Устанавливаем сессию
    req.session.authenticated = true;
    req.session.userId = userId;
    req.session.authType = 'email';
    req.session.email = email;
    req.session.isAdmin = isAdmin;
    if (walletAddress) {
      req.session.address = walletAddress;
    }
    
    // Сохраняем сессию
    await new Promise((resolve, reject) => {
      req.session.save(err => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Очищаем данные верификации
    delete req.session.emailVerificationData;
    
    res.json({
      success: true,
      authenticated: true,
      userId,
      email,
      isAdmin,
      hasWallet,
      walletAddress,
      isNew
    });
  } catch (error) {
    logger.error(`Error in email verification: ${error.message}`);
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
router.get('/check', async (req, res) => {
  console.log('Сессия при проверке:', req.session);
  
  let telegramId = null;
  
  if (req.session.userId && req.session.authType === 'telegram') {
    // Проверяем, есть ли telegramId в сессии
    if (req.session.telegramId) {
      telegramId = req.session.telegramId;
      console.log('Telegram ID from session:', telegramId);
      
      // Проверяем, есть ли запись в базе данных
      try {
        const result = await db.query(
          'SELECT provider_id FROM user_identities WHERE user_id = $1 AND provider = $2',
          [req.session.userId, 'telegram']
        );
        
        console.log('Telegram ID query result:', result.rows);
        
        if (result.rows.length === 0) {
          // Если нет, добавляем запись
          try {
            await db.query(
              'INSERT INTO user_identities (user_id, provider, provider_id, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (provider, provider_id) DO NOTHING',
              [req.session.userId, 'telegram', telegramId]
            );
            console.log('Added Telegram ID to database:', telegramId);
          } catch (error) {
            console.error('Error adding Telegram ID to database:', error);
          }
        }
      } catch (error) {
        console.error('Error checking Telegram ID in database:', error);
      }
    } else {
      // Если нет, ищем в базе данных
      try {
        const result = await db.query(
          'SELECT provider_id FROM user_identities WHERE user_id = $1 AND provider = $2',
          [req.session.userId, 'telegram']
        );
        
        console.log('Telegram ID query result:', result.rows);
        
        if (result.rows.length > 0) {
          telegramId = result.rows[0].provider_id;
          console.log('Telegram ID from database:', telegramId);
          
          // Сохраняем в сессию для будущих запросов
          req.session.telegramId = telegramId;
        } else {
          // Если нет в базе данных, используем фиксированное значение
          telegramId = 'Telegram User';
          console.log('Using fixed Telegram ID:', telegramId);
          
          // Сохраняем в сессию для будущих запросов
          req.session.telegramId = telegramId;
          
          // Добавляем запись в базу данных
          try {
            await db.query(
              'INSERT INTO user_identities (user_id, provider, provider_id, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (provider, provider_id) DO NOTHING',
              [req.session.userId, 'telegram', telegramId]
            );
            console.log('Added Telegram ID to database:', telegramId);
          } catch (error) {
            console.error('Error adding Telegram ID to database:', error);
          }
        }
      } catch (error) {
        console.error('Error fetching Telegram ID:', error);
      }
    }
  }
  
  const response = {
    authenticated: !!req.session.authenticated,
    userId: req.session.userId,
    isAdmin: !!req.session.isAdmin,
    authType: req.session.authType,
    address: req.session.address,
    telegramId: telegramId
  };
  
  console.log('Auth check response:', response);
  
  res.json(response);
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
router.get('/telegram/code', async (req, res) => {
  try {
    // Генерируем код подтверждения (6 символов)
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Сохраняем код в сессии
    req.session.telegramVerificationData = {
      code: verificationCode,
      expires: Date.now() + 10 * 60 * 1000 // 10 минут
    };
    
    res.json({
      success: true,
      message: 'Отправьте этот код боту @' + process.env.TELEGRAM_BOT_USERNAME,
      code: verificationCode,
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

// Маршрут для верификации Telegram
router.post('/telegram/verify', async (req, res) => {
  console.log('Telegram verification request body:', req.body);
  
  const { code } = req.body;
  
  try {
    const telegramBot = getBot();
    const result = await telegramBot.verifyCode(code);
    
    console.log('Telegram verification result:', result);
    
    if (result.success) {
      // Проверяем, что у нас есть telegramId
      if (!result.telegramId) {
        return res.status(400).json({ error: 'Invalid Telegram ID' });
      }

      // Создаем или находим пользователя
      const userResult = await pool.query(
        `INSERT INTO users (created_at) 
         VALUES (NOW()) 
         RETURNING id`,
      );
      
      const userId = userResult.rows[0].id;

      // Добавляем Telegram идентификатор
      await pool.query(
        `INSERT INTO user_identities 
         (user_id, identity_type, identity_value, verified, created_at)
         VALUES ($1, 'telegram', $2, true, NOW())
         ON CONFLICT (identity_type, identity_value) 
         DO UPDATE SET verified = true
         RETURNING user_id`,
        [userId, result.telegramId]
      );
      
      // Обновляем сессию
      req.session.userId = userId;
      req.session.authenticated = true;
      req.session.authType = 'telegram';
      req.session.telegramId = result.telegramId;
      
      // Если есть подключенный кошелек, проверяем баланс токенов
      if (req.session.address) {
        const isAdmin = await checkTokenBalance(req.session.address);
        req.session.isAdmin = isAdmin;
      }

      // Сохраняем сессию
      await new Promise((resolve, reject) => {
        req.session.save(err => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log('Telegram ID saved in session:', req.session.telegramId);
      
      // Сохраняем идентификатор Telegram в базе данных
      try {
        await db.query(
          'INSERT INTO user_identities (user_id, provider, provider_id, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (provider, provider_id) DO UPDATE SET user_id = $1',
          [userId, 'telegram', result.telegramId]
        );
      } catch (error) {
        console.error('Error saving Telegram ID to database:', error);
      }
      
      return res.json({
        success: true,
        userId: userId,
        telegramId: result.telegramId,
        isAdmin: req.session.isAdmin || false,
        authenticated: true
      });
    }
    
    res.status(400).json({ error: result.error || 'Invalid verification code' });
  } catch (error) {
    console.error('Error in telegram verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

// Маршрут для проверки кода, введенного пользователем
router.post('/email/verify-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'Email и код обязательны' });
    }

    const EmailBotService = require('../services/emailBot');
    const emailBot = new EmailBotService(process.env.EMAIL_USER, process.env.EMAIL_PASSWORD);
    
    // Проверяем код из хранилища
    const verificationData = EmailBotService.verificationCodes.get(email.toLowerCase());
    
    if (!verificationData) {
      return res.status(400).json({ success: false, error: 'Код подтверждения не найден' });
    }
    
    if (Date.now() > verificationData.expires) {
      EmailBotService.verificationCodes.delete(email.toLowerCase());
      return res.status(400).json({ success: false, error: 'Срок действия кода истек' });
    }
    
    if (verificationData.code !== code) {
      return res.status(400).json({ success: false, error: 'Неверный код подтверждения' });
    }
    
    // Код верный, завершаем аутентификацию
    const token = verificationData.token;
    
    // Получаем информацию о токене
    const tokenResult = await db.query(
      'SELECT user_id FROM email_auth_tokens WHERE token = $1',
      [token]
    );
    
    if (tokenResult.rows.length === 0) {
      return res.status(500).json({ success: false, error: 'Токен не найден' });
    }
    
    const userId = tokenResult.rows[0].user_id;
    
    // Добавляем email в базу данных
    await db.query(
      'INSERT INTO user_identities (user_id, identity_type, identity_value, verified, created_at) ' +
      'VALUES ($1, $2, $3, true, NOW()) ' +
      'ON CONFLICT (identity_type, identity_value) ' +
      'DO UPDATE SET user_id = $1, verified = true',
      [userId, 'email', email.toLowerCase()]
    );
    
    // Отмечаем токен как использованный
    await db.query(
      'UPDATE email_auth_tokens SET used = true WHERE token = $1',
      [token]
    );
    
    // Устанавливаем аутентификацию пользователя
    req.session.authenticated = true;
    req.session.userId = userId;
    req.session.email = email.toLowerCase();
    req.session.authType = 'email';
    
    // Удаляем код из хранилища
    EmailBotService.verificationCodes.delete(email.toLowerCase());
    
    return res.json({
      success: true,
      userId,
      email: email.toLowerCase(),
      message: 'Аутентификация успешна'
    });
    
  } catch (error) {
    console.error('Error verifying email code:', error);
    return res.status(500).json({ success: false, error: 'Ошибка сервера' });
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
    // Проверяем, есть ли уже привязанный Telegram
    if (req.session?.userId) {
      const existingTelegram = await db.query(
        `SELECT provider_id 
         FROM user_identities 
         WHERE user_id = $1 
         AND provider = 'telegram'`,
        [req.session.userId]
      );
      
      if (existingTelegram.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Telegram already linked to this account' 
        });
      }
    }
    
    const { verificationCode, botLink } = await initTelegramAuth(req.session);
    res.json({ verificationCode, botLink });
  } catch (error) {
    console.error('Error initializing Telegram auth:', error);
    res.status(500).json({ error: 'Failed to initialize Telegram auth' });
  }
});

// Инициализация Email аутентификации
router.post('/email/init', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    await initEmailAuth(email);
    res.json({ success: true });
  } catch (error) {
    console.error('Error initializing email auth:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Проверка кода подтверждения email
router.post('/email/verify', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const result = await verifyEmailCode(code, req.session.userId);
    res.json(result);
  } catch (error) {
    console.error('Error verifying email code:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;