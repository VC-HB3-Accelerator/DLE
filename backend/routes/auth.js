const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { checkIfAdmin } = require('../utils/access-check');
const { checkRole, requireAuth } = require('../middleware/auth');
const { pool } = require('../db');
const { verifySignature, checkAccess, findOrCreateUser } = require('../utils/auth');

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

    // Генерируем nonce
    const nonce = crypto.randomBytes(16).toString('hex');

    // Сохраняем nonce в сессии
    req.session.authNonce = nonce;
    req.session.pendingAddress = address.toLowerCase();

    console.log('Сгенерирован nonce для адреса:', address);
    console.log('Сессия после генерации nonce:', req.session);

    // Сохраняем сессию и ждем завершения
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Ошибка при сохранении сессии:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    // Проверяем, что nonce сохранился
    console.log('Сессия после сохранения:', req.session);

    return res.json({ nonce });
  } catch (error) {
    console.error('Ошибка при генерации nonce:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Функция для проверки роли пользователя
async function checkUserRole(address, req) {
  try {
    const lowerCaseAddress = address.toLowerCase();

    // Проверяем наличие токена доступа в базе данных
    const result = await db.query(
      'SELECT role FROM access_tokens WHERE LOWER(wallet_address) = $1 AND expires_at > NOW()',
      [lowerCaseAddress]
    );

    if (result.rows.length > 0) {
      // Если есть активный токен, проверяем роль
      const role = result.rows[0].role;
      return role === 'ADMIN';
    }

    // Если нет токена, проверяем адрес администратора из переменных окружения
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '')
      .split(',')
      .map((a) => a.toLowerCase());
    return adminAddresses.includes(lowerCaseAddress);
  } catch (error) {
    console.error('Ошибка при проверке роли пользователя:', error);
    return false;
  }
}

// Верификация подписи
router.post('/verify', async (req, res) => {
  try {
    const { address, signature, message, nonce } = req.body;
    
    console.log('Верификация подписи:', { address, signature, message });
    console.log('Сессия при верификации:', req.session);
    
    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'Address, signature and message are required' });
    }

    // Проверяем наличие nonce в сессии
    if (!req.session.authNonce || !req.session.pendingAddress) {
      console.error('Сессия не содержит nonce или pendingAddress:', req.session);

      // Проверяем наличие nonce в заголовке
      const headerNonce = req.headers['x-auth-nonce'];
      if (headerNonce) {
        console.log('Найден nonce в заголовке:', headerNonce);
        req.session.authNonce = headerNonce;
        req.session.pendingAddress = address.toLowerCase();
      }

      // Если в запросе есть nonce в сообщении, извлекаем его
      let extractedNonce = null;
      if (message) {
        const match = message.match(/nonce: ([a-f0-9]+)/);
        if (match && match[1]) {
          extractedNonce = match[1];
          console.log('Извлечен nonce из сообщения:', extractedNonce);

          // Устанавливаем nonce в сессию
          req.session.authNonce = extractedNonce;
          req.session.pendingAddress = address.toLowerCase();

          // Сохраняем сессию
          await new Promise((resolve) => {
            req.session.save((err) => {
              if (err) console.error('Ошибка при сохранении сессии:', err);
              resolve();
            });
          });
        }
      }
    }

    // Формируем ожидаемое сообщение
    const expectedMessage = `Подтвердите вход в DApp for Business с nonce: ${req.session.authNonce}`;

    // Проверяем, что адрес совпадает с ожидаемым
    if (req.session.pendingAddress && req.session.pendingAddress.toLowerCase() !== address.toLowerCase()) {
      console.error('Адрес не совпадает с ожидаемым:', {
        expected: req.session.pendingAddress,
        received: address,
      });
      return res.status(400).json({ error: 'Invalid address' });
    }

    let verified = false;
    try {
      // Проверяем подпись с использованием ethers.js
      const recoveredAddress = ethers.verifyMessage(expectedMessage, signature);

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        console.error('Неверная подпись:', {
          expected: address.toLowerCase(),
          recovered: recoveredAddress.toLowerCase(),
        });
        return res.status(400).json({ error: 'Invalid signature' });
      }

      verified = true;
      console.log('Подпись успешно проверена');
    } catch (error) {
      console.error('Ошибка при проверке подписи:', error);
      return res.status(400).json({ error: 'Invalid signature format' });
    }

    // Если подпись верна, аутентифицируем пользователя
    if (verified) {
      // Найдем или создадим пользователя
      const user = await findOrCreateUser(address, 'wallet');
      
      // Обновляем сессию
      req.session.authenticated = true;
      req.session.address = address;
      req.session.userId = user.id;
      req.session.authType = 'wallet';
      req.session.isAdmin = user.is_admin;
      req.session.role = user.role;
      req.session.authChannel = 'web';
      req.session.language = req.body.language || 'en';
      
      // Удаляем временные данные
      delete req.session.authNonce;
      delete req.session.pendingAddress;
      
      // Сохраняем сессию
      await new Promise((resolve, reject) => {
        req.session.save(err => {
          if (err) {
            console.error('Ошибка при сохранении сессии:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      console.log('Аутентификация успешна:', { 
        address, 
        isAdmin: user.is_admin,
        userId: user.id,
        role: user.role
      });
      
      res.json({ 
        authenticated: true, 
        address, 
        isAdmin: user.is_admin,
        role: user.role
      });
    } else {
      res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Проверка текущей сессии
router.get('/check', (req, res) => {
  console.log('Сессия при проверке:', req.session);
  
  // Если сессия существует и пользователь аутентифицирован
  if (req.session && req.session.authenticated) {
    res.json({
      authenticated: true,
      address: req.session.address,
      isAdmin: req.session.isAdmin || false,
      role: req.session.role || 'USER'
    });
  } else {
    res.json({
      authenticated: false,
      address: null,
      isAdmin: false,
      authType: null
    });
  }
});

// Обработчик выхода из системы
router.post('/logout', (req, res) => {
  try {
    // Сохраняем sessionID перед удалением сессии
    const sessionID = req.sessionID;
    
    // Удаляем сессию из хранилища
    req.session.destroy(async (err) => {
      if (err) {
        console.error('Ошибка при удалении сессии:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      
      try {
        // Удаляем запись из базы данных
        await db.query('DELETE FROM sessions WHERE sid = $1', [sessionID]);
        console.log(`Сессия ${sessionID} удалена из базы данных`);
      } catch (dbErr) {
        console.error('Ошибка при удалении сессии из базы данных:', dbErr);
      }
      
      // Очищаем cookie
      res.clearCookie('dapp.sid');
      res.json({ success: true });
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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

// Маршрут для авторизации через Email
router.post('/email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Генерируем код подтверждения
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Сохраняем код в сессии
    req.session.emailVerificationCode = verificationCode;
    req.session.pendingEmail = email;

    // В реальном приложении здесь нужно отправить email с кодом подтверждения
    // Удалите или закомментируйте эти логи
    // console.log(`Verification code for ${email}: ${verificationCode}`);

    res.json({ success: true, message: 'Verification code sent' });
  } catch (error) {
    // Удалите или закомментируйте эти логи
    // console.error('Error sending verification code:', error);
    logger.error('Error sending verification code:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Маршрут для проверки кода подтверждения Email
router.post('/email/verify', async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    // Получаем код из сессии
    const verificationCode = req.session.emailVerificationCode;
    const pendingEmail = req.session.pendingEmail;

    if (!verificationCode || !pendingEmail) {
      return res.status(400).json({ error: 'No pending verification' });
    }

    // Проверяем, что email совпадает с тем, для которого был сгенерирован код
    if (pendingEmail !== email) {
      return res.status(400).json({ error: 'Email mismatch' });
    }

    // Проверяем код
    if (verificationCode !== code) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Проверяем, существует ли пользователь в базе данных
    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);

    let userId;
    let isAdmin = false;

    if (user.rows.length === 0) {
      // Если пользователь не существует, создаем его
      const newUser = await db.query(
        'INSERT INTO users (email, created_at) VALUES ($1, NOW()) RETURNING id',
        [email]
      );
      userId = newUser.rows[0].id;
    } else {
      userId = user.rows[0].id;
      isAdmin = user.rows[0].is_admin || false;
    }

    // Устанавливаем состояние аутентификации в сессии
    req.session.isAuthenticated = true;
    req.session.authenticated = true;
    req.session.address = email;
    req.session.userId = userId;
    req.session.isAdmin = isAdmin;
    req.session.authType = 'email';

    // Удаляем код из сессии
    delete req.session.emailVerificationCode;
    delete req.session.pendingEmail;

    res.json({
      authenticated: true,
      address: email,
      isAdmin,
      authType: 'email',
    });
  } catch (error) {
    // Удалите или закомментируйте эти логи
    // console.error('Error verifying email code:', error);
    logger.error('Error verifying email code:', error);
    res.status(500).json({ error: 'Failed to verify email code' });
  }
});

// Добавляем маршрут для проверки прав доступа
router.get('/check-access', requireAuth, (req, res) => {
  try {
    // Получаем информацию о пользователе
    const userData = {
      address: req.session.address,
      isAdmin: req.session.isAdmin || false,
      roles: req.session.roles || [],
      authenticated: true,
    };

    // Проверяем доступ к различным разделам
    const access = {
      dashboard: true, // Все аутентифицированные пользователи имеют доступ к панели управления
      admin: userData.isAdmin, // Только администраторы имеют доступ к админке
      contracts: userData.roles.includes('CONTRACT_MANAGER') || userData.isAdmin,
      users: userData.roles.includes('USER_MANAGER') || userData.isAdmin,
    };

    res.json({
      user: userData,
      access: access,
    });
  } catch (error) {
    console.error('Ошибка при проверке прав доступа:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Упрощенный маршрут для обновления сессии
router.post('/refresh-session', async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ success: false, message: 'Адрес не указан' });
    }

    console.log(`Получен запрос на обновление сессии для адреса: ${address}`);

    // Проверяем, существует ли пользователь в базе данных
    const userResult = await pool.query('SELECT * FROM users WHERE address = $1', [
      address.toLowerCase(),
    ]);

    let user = null;

    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
      console.log(`Найден пользователь: ${user.id}`);
    } else {
      console.log(`Пользователь с адресом ${address} не найден`);
    }

    // Обновляем сессию
    req.session.authenticated = true;
    req.session.address = address.toLowerCase();

    if (user) {
      req.session.userId = user.id;
      req.session.isAdmin = user.is_admin || false;
      req.session.role = user.is_admin ? 'ADMIN' : 'USER';
    } else {
      // Если пользователь не найден в базе, проверяем через переменные окружения
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '')
        .split(',')
        .map((a) => a.toLowerCase());
      const isAdmin = adminAddresses.includes(address.toLowerCase());
      req.session.isAdmin = isAdmin;
      req.session.role = isAdmin ? 'ADMIN' : 'USER';
    }

    // Сохраняем сессию
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('Ошибка при сохранении сессии:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    console.log('Сессия обновлена:', req.session);

    return res.json({
      success: true,
      message: 'Сессия обновлена',
      user: {
        id: user ? user.id : null,
        address: address.toLowerCase(),
        isAdmin: req.session.isAdmin,
        role: req.session.role,
      },
    });
  } catch (error) {
    console.error('Ошибка при обновлении сессии:', error);
    return res.status(500).json({ success: false, message: 'Ошибка сервера' });
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
        `Обновлен статус администратора для пользователя с адресом ${address} на ${isAdmin}`
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при обновлении статуса администратора:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Маршрут для проверки структуры таблицы users
router.get('/check-db-structure', async (req, res) => {
  try {
    // Получаем информацию о таблице users
    const tableInfo = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `);

    res.json({
      tableStructure: tableInfo.rows,
    });
  } catch (error) {
    console.error('Ошибка при получении структуры базы данных:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Добавьте обработку ошибок
router.use((err, req, res, next) => {
  console.error('Auth route error:', err);
  res.status(500).json({ success: false, message: 'Ошибка сервера' });
});

module.exports = { router };
