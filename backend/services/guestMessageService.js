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
const guestService = require('./guestService');

/**
 * Сервис для переноса гостевых сообщений в зарегистрированный аккаунт
 * Используется при регистрации/входе пользователя, который был гостем
 */

/**
 * Перенести гостевые сообщения в аккаунт пользователя
 * @param {string} guestId - ID гостя
 * @param {number} userId - ID зарегистрированного пользователя
 * @returns {Promise<Object>}
 */
async function migrateGuestMessages(guestId, userId) {
  try {
    logger.info(`[GuestMessageService] Перенос сообщений с ${guestId} на user ${userId}`);

    // Получаем гостевые сообщения
    const guestMessages = await guestService.getGuestMessages(guestId);

    if (guestMessages.length === 0) {
      logger.info('[GuestMessageService] Нет сообщений для переноса');
      return { migrated: 0, skipped: 0 };
    }

    const encryptionKey = encryptionUtils.getEncryptionKey();
    let migrated = 0;
    let skipped = 0;

    // Переносим каждое сообщение
    for (const msg of guestMessages) {
      try {
        // Вставляем в таблицу messages
        await db.getQuery()(
          `INSERT INTO messages (
            user_id,
            sender_type_encrypted,
            content_encrypted,
            channel_encrypted,
            role_encrypted,
            direction_encrypted,
            created_at
          ) VALUES (
            $1,
            encrypt_text($2, $7),
            encrypt_text($3, $7),
            encrypt_text($4, $7),
            encrypt_text($5, $7),
            encrypt_text($6, $7),
            $8
          )`,
          [
            userId,
            'user',
            msg.content,
            msg.channel || 'web',
            'user',
            'incoming',
            encryptionKey,
            msg.created_at
          ]
        );

        migrated++;
        
      } catch (error) {
        logger.error('[GuestMessageService] Ошибка переноса сообщения:', error);
        skipped++;
      }
    }

    // Удаляем гостевые сообщения после успешного переноса
    if (migrated > 0) {
      await guestService.deleteGuestMessages(guestId);
    }

    logger.info(`[GuestMessageService] Перенесено: ${migrated}, пропущено: ${skipped}`);
    
    return { migrated, skipped, total: guestMessages.length };
    
  } catch (error) {
    logger.error('[GuestMessageService] Ошибка миграции сообщений:', error);
    throw error;
  }
}

/**
 * Проверить, есть ли гостевые сообщения для переноса
 * @param {string} guestId - ID гостя
 * @returns {Promise<boolean>}
 */
async function hasGuestMessages(guestId) {
  try {
    const messages = await guestService.getGuestMessages(guestId);
    return messages.length > 0;
  } catch (error) {
    logger.error('[GuestMessageService] Ошибка проверки гостевых сообщений:', error);
    return false;
  }
}

/**
 * Получить количество гостевых сообщений
 * @param {string} guestId - ID гостя
 * @returns {Promise<number>}
 */
async function getGuestMessageCount(guestId) {
  try {
    const messages = await guestService.getGuestMessages(guestId);
    return messages.length;
  } catch (error) {
    logger.error('[GuestMessageService] Ошибка подсчета гостевых сообщений:', error);
    return 0;
  }
}

/**
 * Очистить старые гостевые сообщения (старше N дней)
 * @param {number} daysOld - Возраст в днях
 * @returns {Promise<number>}
 */
async function cleanupOldGuestMessages(daysOld = 30) {
  try {
    const { rowCount } = await db.getQuery()(
      `DELETE FROM guest_messages 
       WHERE created_at < NOW() - INTERVAL '${daysOld} days'`
    );

    logger.info(`[GuestMessageService] Очищено ${rowCount} старых гостевых сообщений`);
    return rowCount;
    
  } catch (error) {
    logger.error('[GuestMessageService] Ошибка очистки старых сообщений:', error);
    throw error;
  }
}

module.exports = {
  migrateGuestMessages,
  hasGuestMessages,
  getGuestMessageCount,
  cleanupOldGuestMessages
};

