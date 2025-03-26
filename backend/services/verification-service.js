const db = require('../db');
const logger = require('../utils/logger');

class VerificationService {
  constructor() {
    this.codeLength = 6;
    this.expirationMinutes = 15;
  }

  // Генерация кода
  generateCode() {
    return Math.random().toString(36).substring(2, 2 + this.codeLength).toUpperCase();
  }

  // Создание кода верификации
  async createVerificationCode(provider, providerId, userId) {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.expirationMinutes * 60 * 1000);

    try {
      await db.query(
        `INSERT INTO verification_codes 
         (code, provider, provider_id, user_id, expires_at) 
         VALUES ($1, $2, $3, $4, $5)`,
        [code, provider, providerId, userId, expiresAt]
      );

      return code;
    } catch (error) {
      logger.error('Error creating verification code:', error);
      throw error;
    }
  }

  // Проверка кода
  async verifyCode(code, provider, providerId) {
    try {
      const result = await db.query(
        `SELECT * FROM verification_codes 
         WHERE code = $1 
         AND provider = $2 
         AND provider_id = $3 
         AND used = false 
         AND expires_at > NOW()`,
        [code, provider, providerId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Неверный или истекший код' };
      }

      const verification = result.rows[0];

      // Отмечаем код как использованный
      await db.query(
        'UPDATE verification_codes SET used = true WHERE id = $1',
        [verification.id]
      );

      return {
        success: true,
        userId: verification.user_id,
        providerId: verification.provider_id
      };
    } catch (error) {
      logger.error('Error verifying code:', error);
      throw error;
    }
  }

  // Очистка истекших кодов
  async cleanupExpiredCodes() {
    try {
      await db.query(
        'DELETE FROM verification_codes WHERE expires_at <= NOW()'
      );
    } catch (error) {
      logger.error('Error cleaning up expired codes:', error);
    }
  }
}

module.exports = new VerificationService(); 