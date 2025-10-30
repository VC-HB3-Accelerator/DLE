/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const { pool } = require('../db');
const verificationService = require('./verification-service');
const logger = require('../utils/logger');
const encryptedDb = require('./encryptedDatabaseService');
const authService = require('./auth-service');
const { broadcastContactsUpdate } = require('../wsHub');
const nodemailer = require('nodemailer');
const db = require('../db');

class EmailAuth {
  constructor() {
    // Убрали зависимость от старого EmailBot
  }

  /**
   * Отправка кода верификации на email
   * Создает временный transporter для отправки
   */
  async sendVerificationCode(email, code) {
    try {
      // Получаем настройки email из БД
      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();
      
      const { rows } = await db.getQuery()(
        'SELECT decrypt_text(smtp_host_encrypted, $1) as smtp_host, ' +
        'decrypt_text(smtp_user_encrypted, $1) as smtp_user, ' +
        'decrypt_text(smtp_password_encrypted, $1) as smtp_password, ' +
        'decrypt_text(from_email_encrypted, $1) as from_email ' +
        'FROM email_settings ORDER BY id LIMIT 1',
        [encryptionKey]
      );
      
      if (!rows.length) {
        throw new Error('Email settings not found');
      }
      
      const settings = rows[0];
      
      // Создаем временный transporter
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: 465,
        secure: true,
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_password,
        },
        tls: { rejectUnauthorized: false }
      });
      
      // Отправляем письмо
      await transporter.sendMail({
        from: settings.from_email,
        to: email,
        subject: 'Код подтверждения',
        text: `Ваш код подтверждения: ${code}\n\nКод действителен в течение 15 минут.`,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Код подтверждения</h2>
          <p style="font-size: 16px; color: #666;">Ваш код подтверждения:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #333;">${code}</span>
          </div>
          <p style="font-size: 14px; color: #999;">Код действителен в течение 15 минут.</p>
        </div>`
      });
      
      transporter.close();
      logger.info('[EmailAuth] Verification code sent successfully');
      
    } catch (error) {
      logger.error('[EmailAuth] Error sending verification code:', error);
      throw error;
    }
  }

  async initEmailAuth(session, email) {
    try {
      if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        throw new Error('Некорректный формат email');
      }

      // Проверяем, существует ли пользователь с таким email
      const existingEmailUsers = await encryptedDb.getData('user_identities', {
        provider: 'email',
        provider_id: email.toLowerCase()
      }, 1);

      // Создаем или получаем ID пользователя
      let userId;

      if (session.authenticated && session.userId) {
        // Если пользователь уже аутентифицирован, используем его ID
        userId = session.userId;
        logger.info(
          `[initEmailAuth] Using existing authenticated user ${userId} for email ${email}`
        );
      } else if (existingEmailUsers.length > 0) {
        // Если найден пользователь с таким email, используем его ID
        userId = existingEmailUsers[0].user_id;
        logger.info(`[initEmailAuth] Found existing user ${userId} with email ${email}`);
      } else {
        // Создаем временного пользователя, если нужно будет создать нового
        const { ROLES } = require('/app/shared/permissions');
        const newUser = await encryptedDb.saveData('users', {
          role: ROLES.USER
        });
        userId = newUser.id;
        session.tempUserId = userId;
        logger.info(`[initEmailAuth] Created temporary user ${userId} for email ${email}`);
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
      await this.sendVerificationCode(email, verificationCode);

      logger.info(
        `Generated verification code for Email auth for ${email} and sent to user's email`
      );

      // После каждого успешного создания пользователя:
      broadcastContactsUpdate();

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

      const email = session.pendingEmail.toLowerCase();
      let finalUserId;

      // Если пользователь уже авторизован, используем его ID
      if (session.authenticated && session.userId) {
        finalUserId = session.userId;
        logger.info(`[checkEmailVerification] Using existing authenticated user ${finalUserId}`);

        // Связываем email с существующим пользователем
        await authService.linkIdentity(finalUserId, 'email', email);

        // Очищаем временные данные
        delete session.pendingEmail;

        return {
          verified: true,
          userId: finalUserId,
          email: email,
        };
      }

      // Если пользователь не авторизован, ищем всех пользователей с похожими идентификаторами
      const identities = {
        email: email,
        guest: session.guestId,
      };

      const relatedUsers = await authService.identityService.findRelatedUsers(identities);
      logger.info(
        `[checkEmailVerification] Found ${relatedUsers.length} related users for identities:`,
        identities
      );

      if (relatedUsers.length > 0) {
        // Берем первого найденного пользователя как основного
        finalUserId = relatedUsers[0];
        logger.info(`[checkEmailVerification] Using existing user ${finalUserId} as primary`);

        // Мигрируем данные от остальных пользователей к основному
        for (const userId of relatedUsers.slice(1)) {
          await authService.identityService.migrateUserData(userId, finalUserId);
          logger.info(
            `[checkEmailVerification] Migrated data from user ${userId} to ${finalUserId}`
          );
        }

        // Если у нас есть временный пользователь, мигрируем его данные тоже
        if (session.tempUserId && !relatedUsers.includes(session.tempUserId)) {
          await authService.identityService.migrateUserData(session.tempUserId, finalUserId);
          logger.info(
            `[checkEmailVerification] Migrated temporary user ${session.tempUserId} to ${finalUserId}`
          );
        }
      } else {
        // Если связанных пользователей нет, используем временного или создаем нового
        if (session.tempUserId) {
          finalUserId = session.tempUserId;
          logger.info(`[checkEmailVerification] Using temporary user ${finalUserId}`);
        } else {
          const newUserResult = await encryptedDb.saveData('users', {
            role: 'user'
          });
          finalUserId = newUserResult.id;
          logger.info(`[checkEmailVerification] Created new user ${finalUserId}`);
        }
      }

      // Добавляем email в базу данных
      await authService.identityService.saveIdentity(finalUserId, 'email', email, true);
      logger.info(`[checkEmailVerification] Added email identity ${email} for user ${finalUserId}`);

      // ----> НАЧАЛО: Проверка роли на основе привязанного кошелька
      let userRole = 'user'; // Роль по умолчанию
      try {
        const linkedWallet = await authService.getLinkedWallet(finalUserId);
        if (linkedWallet) {
          logger.info(`[checkEmailVerification] Found linked wallet ${linkedWallet} for user ${finalUserId}. Checking user role...`);
          const authService = require('./auth-service');
          const userAccessLevel = await authService.getUserAccessLevel(linkedWallet);
          const { ROLES } = require('/app/shared/permissions');
          // Используем роль из userAccessLevel, которая уже правильно определена с учетом порогов
          userRole = userAccessLevel.level;
          logger.info(`[checkEmailVerification] Role for user ${finalUserId} determined as: ${userRole}`);

          // Опционально: Обновить роль в таблице users, если она отличается
          const currentUser = await encryptedDb.getData('users', { id: finalUserId }, 1);
          if (currentUser.length > 0 && currentUser[0].role !== userRole) {
            await encryptedDb.saveData('users', { role: userRole, id: finalUserId });
            logger.info(`[checkEmailVerification] Updated user role in DB to ${userRole}`);
          }
        } else {
          logger.info(`[checkEmailVerification] No linked wallet found for user ${finalUserId}. Role remains 'user'.`);
        }
      } catch (roleCheckError) {
        logger.error(`[checkEmailVerification] Error checking user role for user ${finalUserId}:`, roleCheckError);
        // В случае ошибки оставляем роль 'user'
      }
      // ----> КОНЕЦ: Проверка роли

      // Если есть гостевой ID, добавляем его тоже
      if (session.guestId) {
        await authService.identityService.saveIdentity(finalUserId, 'guest', session.guestId, true);
        logger.info(
          `[checkEmailVerification] Added guest identity ${session.guestId} for user ${finalUserId}`
        );
      }

      // Очищаем временные данные
      delete session.pendingEmail;
      if (session.tempUserId) {
        delete session.tempUserId;
      }

      // После каждого успешного создания пользователя:
      broadcastContactsUpdate();

      return {
        verified: true,
        userId: finalUserId,
        email: email,
        role: userRole,
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
