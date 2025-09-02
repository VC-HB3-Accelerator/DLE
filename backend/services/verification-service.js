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

const encryptedDb = require('./encryptedDatabaseService');
const logger = require('../utils/logger');

class VerificationService {
  constructor() {
    this.codeLength = 6;
    this.expirationMinutes = 15;
  }

  // Генерация кода
  generateCode() {
    const code = Math.random()
      .toString(36)
      .substring(2, 2 + this.codeLength)
      .toUpperCase();
    logger.info(`Generated verification code: ${code}`);
    return code;
  }

  // Создание кода верификации
  async createVerificationCode(provider, providerId, userId) {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.expirationMinutes * 60 * 1000);

    try {
      logger.info(
        `Creating verification code for ${provider}:${providerId}, userId: ${userId || 'null'}`
      );

      const data = {
        code: code,
        provider: provider,
        provider_id: providerId,
        expires_at: expiresAt,
        used: false
      };

      // Если userId указан, добавляем его
      if (userId !== null && userId !== undefined) {
        data.user_id = userId;
      }

      await encryptedDb.saveData('verification_codes', data);

      logger.info(`Verification code created successfully for ${provider}:${providerId}`);
      return code;
    } catch (error) {
      logger.error('Error creating verification code:', {
        error: error.message,
        provider,
        providerId,
        userId,
      });
      throw error;
    }
  }

  // Проверка кода
  async verifyCode(code, provider, providerId) {
    try {
      logger.info(`Verifying code for ${provider}:${providerId}`);

      // Преобразуем код в верхний регистр для сравнения
      const normalizedCode = code.toUpperCase();
      logger.info(`Normalized code: ${normalizedCode}`);

      // Проверим, есть ли такой код в базе (для отладки)
      const checkResult = await encryptedDb.getData('verification_codes', {
        provider: provider,
        provider_id: providerId,
        used: false
      });

      if (checkResult.length > 0) {
        logger.info(
          `Found codes for ${provider}:${providerId}: ${JSON.stringify(checkResult.map((r) => r.code))}`
        );
      } else {
        logger.warn(`No active codes found for ${provider}:${providerId}`);
      }

      const result = await encryptedDb.getData('verification_codes', {
        code: normalizedCode,
        provider: provider,
        provider_id: providerId,
        used: false
      }, 1);

      if (result.length === 0) {
        logger.warn(`No valid verification code found for ${provider}:${providerId}`);
        return { valid: false, message: 'Invalid or expired code' };
      }

      const verificationCode = result[0];

      // Проверяем срок действия
      if (new Date(verificationCode.expires_at) < new Date()) {
        logger.warn(`Verification code expired for ${provider}:${providerId}`);
        return { valid: false, message: 'Code has expired' };
      }

      // Отмечаем код как использованный
      await encryptedDb.saveData('verification_codes', {
        used: true
      }, {
        id: verificationCode.id
      });

      logger.info(`Verification code verified successfully for ${provider}:${providerId}`);
      return {
        valid: true,
        userId: verificationCode.user_id,
        message: 'Code verified successfully'
      };
    } catch (error) {
      logger.error('Error verifying code:', {
        error: error.message,
        code,
        provider,
        providerId,
      });
      throw error;
    }
  }

  // Очистка истекших кодов
  async cleanupExpiredCodes() {
    try {
      // Удаляем истекшие коды
      const expiredCodes = await encryptedDb.getData('verification_codes', { expires_at: { $lt: new Date() } });
      
      if (expiredCodes.length > 0) {
        for (const expiredCode of expiredCodes) {
          await encryptedDb.deleteData('verification_codes', { id: expiredCode.id });
        }
        // logger.info(`Cleaned up ${expiredCodes.length} expired verification codes`); // Убрано избыточное логирование
      }
    } catch (error) {
      logger.error('Error cleaning up expired codes:', error);
    }
  }
}

module.exports = new VerificationService();
