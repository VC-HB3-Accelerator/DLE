/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const authService = require('../services/auth-service');
const logger = require('../utils/logger');
const db = require('../db');

// Получение всех идентификаторов пользователя
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const identities = await authService.getUserIdentities(userId);
    res.json({ success: true, identities });
  } catch (error) {
    logger.error('Error getting identities:', error);
    next(error);
  }
});

// Связывание нового идентификатора
router.post('/link', requireAuth, async (req, res, next) => {
  try {
    const { type, value } = req.body;
    const userId = req.session.userId;

    // Если тип - wallet, сначала проверим, не привязан ли он уже к другому пользователю
    if (type === 'wallet') {
      const normalizedWallet = value.toLowerCase();

      // Получаем ключ шифрования
      const fs = require('fs');
      const path = require('path');
      // Получаем ключ шифрования через унифицированную утилиту
      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();

      // Проверяем, существует ли уже такой кошелек
      const existingCheck = await db.getQuery()(
        `SELECT user_id FROM user_identities 
         WHERE provider_encrypted = encrypt_text('wallet', $2) AND provider_id_encrypted = encrypt_text($1, $2)`,
        [normalizedWallet, encryptionKey]
      );

      if (existingCheck.rows.length > 0) {
        const existingUserId = existingCheck.rows[0].user_id;
        if (existingUserId !== userId) {
          return res.status(400).json({
            success: false,
            error: `This wallet (${value}) is already linked to another account`,
          });
        }
      }
    }

    await authService.linkIdentity(userId, type, value);

    // Обновляем сессию
    if (type === 'wallet') {
      req.session.address = value;
      req.session.isAdmin = await authService.checkTokensAndUpdateRole(value);
    } else if (type === 'telegram') {
      req.session.telegramId = value;
    } else if (type === 'email') {
      req.session.email = value;
    }

    res.json({
      success: true,
      message: 'Identity linked successfully',
      isAdmin: req.session.isAdmin,
    });
  } catch (error) {
    logger.error('Error linking identity:', error);

    // Делаем более понятные сообщения об ошибках
    if (error.message && error.message.includes('already belongs to another user')) {
      return res.status(400).json({
        success: false,
        error: `This identity is already linked to another account`,
      });
    }

    next(error);
  }
});

// Получение балансов токенов
router.get('/token-balances', requireAuth, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Получаем связанный кошелек
    const wallet = await authService.getLinkedWallet(userId);
    if (!wallet) {
      return res.status(404).json({ error: 'No wallet linked' });
    }

    // Здесь логирование инициирования получения баланса может быть полезно
    logger.info(`Fetching token balances for user ${userId} with wallet ${wallet}`);

    // Получаем балансы токенов
    const balances = await authService.getTokenBalances(wallet);

    res.json({
      success: true,
      balances,
    });
  } catch (error) {
    logger.error('Error getting token balances:', error);
    next(error);
  }
});

// Удаление идентификатора пользователя
router.delete('/:provider/:providerId', requireAuth, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { provider, providerId } = req.params;
    const result = await require('../services/identity-service').deleteIdentity(userId, provider, providerId);
    if (result.success) {
      res.json({ success: true, deleted: result.deleted });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    logger.error('Error deleting identity:', error);
    next(error);
  }
});

// Дублирующиеся маршруты email/telegram-settings удалены - используются маршруты из settings.js

// Получение db-настроек
router.get('/db-settings', requireAuth, async (req, res, next) => {
  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    const { rows } = await db.getQuery()(
      'SELECT id, db_port, created_at, updated_at, decrypt_text(db_host_encrypted, $1) as db_host, decrypt_text(db_name_encrypted, $1) as db_name, decrypt_text(db_user_encrypted, $1) as db_user, decrypt_text(db_password_encrypted, $1) as db_password FROM db_settings ORDER BY id LIMIT 1',
      [encryptionKey]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Not found' });
    const settings = rows[0];
    delete settings.db_password; // не возвращаем пароль
    res.json({ success: true, settings });
  } catch (error) {
    logger.error('Error getting db settings:', error, error && error.stack);
    next(error);
  }
});

// Обновление db-настроек
router.put('/db-settings', requireAuth, async (req, res, next) => {
  try {
    const { db_host, db_port, db_name, db_user, db_password } = req.body;
    if (!db_host || !db_port || !db_name || !db_user) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const { rows } = await db.getQuery()('SELECT id FROM db_settings ORDER BY id LIMIT 1');
    if (rows.length) {
      // Обновляем существующую запись
      await db.getQuery()(
        `UPDATE db_settings SET db_host=$1, db_port=$2, db_name=$3, db_user=$4, db_password=COALESCE($5, db_password), updated_at=NOW() WHERE id=$6`,
        [db_host, db_port, db_name, db_user, db_password, rows[0].id]
      );
    } else {
      // Вставляем новую
      await db.getQuery()(
        `INSERT INTO db_settings (db_host, db_port, db_name, db_user, db_password) VALUES ($1,$2,$3,$4,$5)` ,
        [db_host, db_port, db_name, db_user, db_password]
      );
    }
    // Пересоздаём пул соединений с новыми настройками
    await db.reinitPoolFromDbSettings();
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating db settings:', error);
    next(error);
  }
});

/**
 * Проверка статуса токена связывания
 * Используется на странице /connect-wallet для валидации токена
 */
router.get('/link-status/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ 
        success: false,
        error: 'Токен не указан' 
      });
    }

    const identityLinkService = require('../services/IdentityLinkService');
    const tokenData = await identityLinkService.verifyLinkToken(token);

    if (!tokenData) {
      return res.json({ 
        valid: false, 
        error: 'Токен недействителен или истек' 
      });
    }

    res.json({
      valid: true,
      provider: tokenData.source_provider,
      expiresAt: tokenData.expires_at,
      isUsed: tokenData.is_used
    });

  } catch (error) {
    logger.error('[Identity] Ошибка проверки статуса токена:', error);
    res.status(500).json({ 
      success: false,
      error: 'Внутренняя ошибка сервера' 
    });
  }
});

module.exports = router;
