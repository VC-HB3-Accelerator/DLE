const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const crypto = require('crypto');
const db = require('../db');
const logger = require('../utils/logger');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Создайте лимитер для попыток аутентификации
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20, // Увеличьте лимит с 5 до 20
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток аутентификации. Попробуйте позже.' }
});

// Маршрут для получения nonce для подписи
router.get('/nonce', async (req, res) => {
  try {
    const { address } = req.query;
    
    // Удалите или закомментируйте эти логи
    // console.log('Nonce request:', {
    //   address,
    //   sessionID: req.sessionID,
    //   session: req.session
    // });
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }
    
    // Генерируем случайный nonce
    const nonce = crypto.randomBytes(32).toString('hex');
    
    // Создаем сообщение для подписи
    const message = `Sign this message to authenticate with DApp for Business. Nonce: ${nonce}`;
    
    // Сохраняем nonce в сессии
    req.session.nonce = nonce;
    req.session.pendingAddress = address;
    
    // Получаем IP-адрес клиента
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Сохраняем IP-адрес в сессии при генерации nonce
    req.session.clientIP = clientIP;
    
    // Явно сохраняем сессию
    req.session.save((err) => {
      if (err) {
        // Удалите или закомментируйте эти логи
        // console.error('Error saving session:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      
      // Удалите или закомментируйте
      // console.log('Nonce saved in session:', {
      //   nonce,
      //   pendingAddress: address,
      //   sessionID: req.sessionID
      // });
      
      res.json({ message });
    });
  } catch (error) {
    // Удалите или закомментируйте эти логи
    // console.error('Error generating nonce:', error);
    logger.error('Error generating nonce:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

// Маршрут для верификации подписи
router.post('/verify', authLimiter, async (req, res) => {
  try {
    const { address, signature } = req.body;
    
    if (!address || !signature) {
      return res.status(400).json({ error: 'Address and signature are required' });
    }
    
    // Удалите или закомментируйте эти логи
    // console.log('Verify request:', {
    //   address,
    //   signature,
    //   sessionID: req.sessionID,
    //   session: {
    //     nonce: req.session.nonce,
    //     pendingAddress: req.session.pendingAddress
    //   }
    // });
    
    // Получаем nonce из сессии
    const nonce = req.session.nonce;
    const pendingAddress = req.session.pendingAddress;
    
    if (!nonce || !pendingAddress) {
      return res.status(400).json({ error: 'No pending authentication request' });
    }
    
    // Получаем IP-адрес клиента
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    // Проверяем, что IP-адрес совпадает
    if (req.session.clientIP !== clientIP) {
      return res.status(400).json({ error: 'IP address mismatch' });
    }
    
    // Проверяем, что адрес совпадает с тем, для которого был сгенерирован nonce
    if (pendingAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({ error: 'Address mismatch' });
    }
    
    // Создаем сообщение для проверки подписи
    const message = `Sign this message to authenticate with DApp for Business. Nonce: ${nonce}`;
    
    // Восстанавливаем адрес из подписи
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    // Проверяем, что восстановленный адрес совпадает с предоставленным
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    
    // Проверяем, существует ли пользователь в базе данных
    const user = await db.query('SELECT * FROM users WHERE address = $1', [address]);
    
    let userId;
    let isAdmin = false;
    
    if (user.rows.length === 0) {
      // Если пользователь не существует, создаем его
      const newUser = await db.query(
        'INSERT INTO users (address, created_at) VALUES ($1, NOW()) RETURNING id',
        [address]
      );
      userId = newUser.rows[0].id;
    } else {
      userId = user.rows[0].id;
      isAdmin = user.rows[0].is_admin || false;
    }
    
    // Устанавливаем состояние аутентификации в сессии
    req.session.authenticated = true;
    req.session.address = address;
    req.session.isAdmin = isAdmin;
    req.session.authType = 'wallet';
    req.session.userId = userId;
    
    // Удаляем nonce из сессии
    delete req.session.nonce;
    delete req.session.pendingAddress;
    
    // Явно сохраняем сессию
    req.session.save((err) => {
      if (err) {
        // Удалите или закомментируйте эти логи
        // console.error('Error saving session:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      
      // Удалите или закомментируйте
      // console.log('Authentication successful:', {
      //   address,
      //   isAdmin,
      //   sessionID: req.sessionID
      // });
      
      res.json({
        authenticated: true,
        address,
        isAdmin,
        authType: 'wallet'
      });
    });
  } catch (error) {
    console.error('Error verifying signature:', error);
    
    // Более подробная обработка ошибок
    if (error.message.includes('invalid signature')) {
      return res.status(400).json({
        error: 'Недействительная подпись',
        message: 'Подпись не соответствует адресу. Пожалуйста, попробуйте снова.'
      });
    }
    
    if (error.message.includes('invalid address')) {
      return res.status(400).json({
        error: 'Недействительный адрес',
        message: 'Указанный адрес имеет неверный формат.'
      });
    }
    
    res.status(500).json({
      error: 'Ошибка верификации подписи',
      message: 'Не удалось проверить подпись. Пожалуйста, попробуйте снова позже.'
    });
  }
});

// Маршрут для проверки состояния аутентификации
router.get('/check', (req, res) => {
  // Удалите или закомментируйте эти логи
  // console.log('Session check:', {
  //   session: req.session,
  //   authenticated: req.session.authenticated
  // });
  
  if (req.session.authenticated) {
    res.json({
      authenticated: true,
      address: req.session.address,
      isAdmin: req.session.isAdmin,
      authType: req.session.authType
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

// Маршрут для выхода из системы
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      // Удалите или закомментируйте эти логи
      // console.error('Error destroying session:', err);
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
      authType: 'email'
    });
  } catch (error) {
    // Удалите или закомментируйте эти логи
    // console.error('Error verifying email code:', error);
    logger.error('Error verifying email code:', error);
    res.status(500).json({ error: 'Failed to verify email code' });
  }
});

module.exports = { router }; 