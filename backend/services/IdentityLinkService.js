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

const db = require('../db');
const logger = require('../utils/logger');
const encryptionUtils = require('../utils/encryptionUtils');
const crypto = require('crypto');

/**
 * Сервис для создания и управления токенами связывания идентификаторов
 * Используется для привязки Telegram/Email к Web3 кошелькам
 */
class IdentityLinkService {
  constructor() {
    this.DEFAULT_TTL_HOURS = 1; // Токен действителен 1 час
    this.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  /**
   * Сгенерировать токен для связывания
   * @param {string} provider - 'telegram', 'email'
   * @param {string} identifier - ID пользователя (Telegram ID или email)
   * @param {Object} options - Дополнительные опции
   * @returns {Promise<Object>} - {token, linkUrl, expiresAt}
   */
  async generateLinkToken(provider, identifier, options = {}) {
    try {
      if (!provider || !identifier) {
        throw new Error('Provider and identifier are required');
      }

      if (!['telegram', 'email'].includes(provider)) {
        throw new Error(`Invalid provider: ${provider}. Must be 'telegram' or 'email'`);
      }

      // Генерируем уникальный токен
      const token = crypto.randomBytes(32).toString('hex');

      // Вычисляем время истечения
      const ttlHours = options.ttlHours || this.DEFAULT_TTL_HOURS;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + ttlHours);

      const encryptionKey = encryptionUtils.getEncryptionKey();

      // Сохраняем токен в БД
      await db.getQuery()(
        `INSERT INTO identity_link_tokens (
          token,
          source_provider,
          source_identifier_encrypted,
          user_id,
          expires_at,
          created_at
        ) VALUES (
          $1, $2,
          encrypt_text($3, $4),
          $5,
          $6,
          NOW()
        )`,
        [
          token,
          provider,
          identifier,
          encryptionKey,
          options.userId || null,
          expiresAt
        ]
      );

      const linkUrl = `${this.FRONTEND_URL}/connect-wallet?token=${token}`;

      logger.info(`[IdentityLinkService] Создан токен связывания для ${provider}:${identifier}`);

      return {
        success: true,
        token,
        linkUrl,
        expiresAt: expiresAt.toISOString(),
        provider,
        identifier
      };

    } catch (error) {
      logger.error('[IdentityLinkService] Ошибка генерации токена:', error);
      throw error;
    }
  }

  /**
   * Проверить токен и получить данные
   * @param {string} token
   * @returns {Promise<Object|null>}
   */
  async verifyLinkToken(token) {
    try {
      if (!token) {
        return null;
      }

      const encryptionKey = encryptionUtils.getEncryptionKey();

      const { rows } = await db.getQuery()(
        `SELECT 
          id,
          source_provider,
          decrypt_text(source_identifier_encrypted, $2) as source_identifier,
          user_id,
          is_used,
          used_at,
          linked_wallet,
          expires_at,
          created_at
         FROM identity_link_tokens
         WHERE token = $1`,
        [token, encryptionKey]
      );

      if (rows.length === 0) {
        logger.warn(`[IdentityLinkService] Токен не найден: ${token}`);
        return null;
      }

      const tokenData = rows[0];

      // Проверяем срок действия
      if (new Date() > new Date(tokenData.expires_at)) {
        logger.warn(`[IdentityLinkService] Токен истек: ${token}`);
        return null;
      }

      // Проверяем использование
      if (tokenData.is_used) {
        logger.warn(`[IdentityLinkService] Токен уже использован: ${token}`);
        return null;
      }

      return tokenData;

    } catch (error) {
      logger.error('[IdentityLinkService] Ошибка проверки токена:', error);
      throw error;
    }
  }

  /**
   * Использовать токен (связать с кошельком)
   * @param {string} token
   * @param {string} walletAddress
   * @returns {Promise<Object>}
   */
  async useLinkToken(token, walletAddress) {
    try {
      // 1. Проверяем токен
      const tokenData = await this.verifyLinkToken(token);

      if (!tokenData) {
        return {
          success: false,
          error: 'Токен недействителен или истек'
        };
      }

      const encryptionKey = encryptionUtils.getEncryptionKey();

      // 2. Создаем пользователя если нужно
      let userId = tokenData.user_id;

      if (!userId) {
        // Создаем нового пользователя
        const { rows: userRows } = await db.getQuery()(
          `INSERT INTO users (role) VALUES ($1) RETURNING id`,
          ['user']
        );
        userId = userRows[0].id;

        logger.info(`[IdentityLinkService] Создан новый пользователь: ${userId}`);
      }

      // 3. Сохраняем wallet идентификатор
      const identityService = require('./identity-service');
      await identityService.saveIdentity(userId, 'wallet', walletAddress);

      // 4. Сохраняем Telegram/Email идентификатор
      await identityService.saveIdentity(
        userId,
        tokenData.source_provider,
        tokenData.source_identifier
      );

      // 5. Помечаем токен как использованный
      await db.getQuery()(
        `UPDATE identity_link_tokens
         SET is_used = true,
             used_at = NOW(),
             user_id = $2,
             linked_wallet = $3
         WHERE token = $1`,
        [token, userId, walletAddress]
      );

      // 6. Проверяем админские права
      const { checkAdminRole } = require('./admin-role');
      const isAdmin = await checkAdminRole(walletAddress);

      if (isAdmin) {
        await db.getQuery()(
          `UPDATE users SET role = $1 WHERE id = $2`,
          ['editor', userId]
        );
        logger.info(`[IdentityLinkService] Пользователь ${userId} получил роль admin`);
      }

      // 7. Создаем identifier для миграции
      const universalGuestService = require('./UniversalGuestService');
      const identifier = universalGuestService.createIdentifier(
        tokenData.source_provider,
        tokenData.source_identifier
      );

      logger.info(`[IdentityLinkService] Токен успешно использован. UserId: ${userId}`);

      return {
        success: true,
        userId,
        identifier,
        provider: tokenData.source_provider,
        role: isAdmin ? 'admin' : 'user'
      };

    } catch (error) {
      logger.error('[IdentityLinkService] Ошибка использования токена:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Очистить истекшие токены
   * @returns {Promise<number>} - Количество удаленных
   */
  async cleanupExpiredTokens() {
    try {
      const { rowCount } = await db.getQuery()(
        `DELETE FROM identity_link_tokens
         WHERE expires_at < NOW()
           OR (is_used = true AND used_at < NOW() - INTERVAL '7 days')`
      );

      logger.info(`[IdentityLinkService] Очищено истекших токенов: ${rowCount}`);

      return rowCount;

    } catch (error) {
      logger.error('[IdentityLinkService] Ошибка очистки токенов:', error);
      throw error;
    }
  }

  /**
   * Получить статистику по токенам
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const { rows } = await db.getQuery()(
        `SELECT 
          COUNT(*) as total_tokens,
          COUNT(*) FILTER (WHERE is_used = true) as used_tokens,
          COUNT(*) FILTER (WHERE is_used = false AND expires_at > NOW()) as active_tokens,
          COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_tokens
         FROM identity_link_tokens`
      );

      return rows[0];

    } catch (error) {
      logger.error('[IdentityLinkService] Ошибка получения статистики:', error);
      throw error;
    }
  }
}

module.exports = new IdentityLinkService();

