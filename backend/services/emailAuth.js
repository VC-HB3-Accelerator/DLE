const { pool } = require('../db');
const verificationService = require('./verification-service');
const logger = require('../utils/logger');
const emailBot = require('./emailBot');
const db = require('../db');
const authService = require('./auth-service');

class EmailAuth {
  constructor() {
    this.emailBot = emailBot;
  }

  async initEmailAuth(session, email) {
    try {
      if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        throw new Error('Некорректный формат email');
      }
      
      // Создаем или получаем ID пользователя
      let userId;
      
      if (session.authenticated && session.userId) {
        userId = session.userId;
      } else {
        const userResult = await db.query(
          'INSERT INTO users (role) VALUES ($1) RETURNING id',
          ['user']
        );
        userId = userResult.rows[0].id;
        session.tempUserId = userId;
      }
      
      // Сохраняем email в сессии
      session.pendingEmail = email.toLowerCase();
      
      // Создаем код через сервис верификации
      const verificationCode = await verificationService.createVerificationCode(
        'email',
        email.toLowerCase(),
        userId
      );
      
      // Отправляем код на email
      await this.emailBot.sendVerificationCode(email, verificationCode);
      
      logger.info(`Generated verification code for Email auth for ${email} and sent to user's email`);
      
      return { success: true, verificationCode };
    } catch (error) {
      logger.error('Error in email auth initialization:', error);
      throw error;
    }
  }

  async checkEmailVerification(code, session) {
    try {
      if (!code) {
        return { verified: false, message: 'Код верификации не предоставлен' };
      }

      if (!session.pendingEmail) {
        return { verified: false, message: 'Email не найден в сессии' };
      }

      // Проверяем код через сервис верификации
      const result = await verificationService.verifyCode(code, 'email', session.pendingEmail);
      
      if (!result.success) {
        // Используем сообщение об ошибке из сервиса верификации
        return { verified: false, message: result.error || 'Неверный код верификации' };
      }

      const userId = result.userId || session.tempUserId;
      const email = session.pendingEmail;

      // Проверяем, существует ли уже этот email в user_identities
      const existingUserQuery = await db.query(
        `SELECT user_id FROM user_identities 
         WHERE provider = 'email' AND provider_id = $1`,
        [email.toLowerCase()]
      );

      let finalUserId = userId;
      
      // Если email уже связан с другим пользователем
      if (existingUserQuery.rows.length > 0) {
        finalUserId = existingUserQuery.rows[0].user_id;
        logger.info(`Using existing user ID ${finalUserId} for email ${email}`);
        
        // Обновляем идентификатор пользователя в сессии
        if (userId !== finalUserId) {
          logger.info(`Changing user ID from ${userId} to ${finalUserId} based on existing email identity`);
        }
      } else {
        // Добавляем email в базу данных для нового пользователя
        await db.query(
          `INSERT INTO user_identities 
           (user_id, provider, provider_id) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (provider, provider_id) 
           DO UPDATE SET user_id = $1`,
          [finalUserId, 'email', email.toLowerCase()]
        );
        logger.info(`Added new email identity ${email} for user ${finalUserId}`);
      }

      // Очищаем временные данные
      delete session.pendingEmail;
      if (session.tempUserId) {
        delete session.tempUserId;
      }

      return {
        verified: true,
        userId: finalUserId,
        email: email.toLowerCase()
      };
    } catch (error) {
      logger.error('Error checking email verification:', error);
      return { verified: false, message: 'Ошибка при проверке кода верификации' };
    }
  }
}

// Создаем и экспортируем единственный экземпляр
const emailAuth = new EmailAuth();
module.exports = emailAuth; 