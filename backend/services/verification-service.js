/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const crypto = require('crypto');
const encryptedDb = require('./encryptedDatabaseService');
const logger = require('../utils/logger');

function maskProviderId(providerId) {
  const raw = String(providerId || '');
  if (!raw) return '(empty)';
  const at = raw.indexOf('@');
  if (at > 0) {
    const local = raw.slice(0, at);
    const domain = raw.slice(at + 1);
    const head = local.slice(0, 1);
    return `${head}***@${domain}`;
  }
  if (raw.length <= 4) return '***';
  return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
}

class VerificationService {
  constructor() {
    this.codeLength = 6;
    this.expirationMinutes = 15;
  }

  /** 6 цифр, crypto.randomInt — без Math.random и без лога самого кода */
  generateCode() {
    const max = 10 ** this.codeLength;
    return String(crypto.randomInt(0, max)).padStart(this.codeLength, '0');
  }

  async createVerificationCode(provider, providerId, userId) {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.expirationMinutes * 60 * 1000);
    const masked = maskProviderId(providerId);

    try {
      logger.info(
        `Creating verification code for ${provider}:${masked}, userId: ${userId || 'null'}`
      );

      const data = {
        code: code,
        provider: provider,
        provider_id: providerId,
        expires_at: expiresAt,
        used: false
      };

      if (userId !== null && userId !== undefined) {
        data.user_id = userId;
      }

      await encryptedDb.saveData('verification_codes', data);

      logger.info(`Verification code created for ${provider}:${masked}`);
      return code;
    } catch (error) {
      logger.error('Error creating verification code:', {
        error: error.message,
        provider,
        providerId: masked,
        userId,
      });
      throw error;
    }
  }

  async verifyCode(code, provider, providerId) {
    const masked = maskProviderId(providerId);
    try {
      logger.info(`Verifying code for ${provider}:${masked}`);

      const normalizedCode = String(code || '').trim().toUpperCase();
      if (!/^[0-9A-Z]{4,12}$/.test(normalizedCode)) {
        return { valid: false, message: 'Invalid or expired code' };
      }

      const result = await encryptedDb.getData('verification_codes', {
        code: normalizedCode,
        provider: provider,
        provider_id: providerId,
        used: false
      }, 1);

      if (result.length === 0) {
        logger.warn(`No valid verification code for ${provider}:${masked}`);
        return { valid: false, message: 'Invalid or expired code' };
      }

      const verificationCode = result[0];

      if (new Date(verificationCode.expires_at) < new Date()) {
        logger.warn(`Verification code expired for ${provider}:${masked}`);
        return { valid: false, message: 'Code has expired' };
      }

      await encryptedDb.saveData('verification_codes', {
        used: true
      }, {
        id: verificationCode.id
      });

      logger.info(`Verification code OK for ${provider}:${masked}`);
      return {
        valid: true,
        userId: verificationCode.user_id,
        message: 'Code verified successfully'
      };
    } catch (error) {
      logger.error('Error verifying code:', {
        error: error.message,
        provider,
        providerId: masked,
      });
      throw error;
    }
  }

  async cleanupExpiredCodes() {
    try {
      const expiredCodes = await encryptedDb.getData('verification_codes', { expires_at: { $lt: new Date() } });
      
      if (expiredCodes.length > 0) {
        for (const expiredCode of expiredCodes) {
          await encryptedDb.deleteData('verification_codes', { id: expiredCode.id });
        }
      }
    } catch (error) {
      logger.error('Error cleaning up expired codes:', error);
    }
  }
}

module.exports = new VerificationService();
