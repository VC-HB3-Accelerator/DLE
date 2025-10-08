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
 * Сервис для работы с гостевыми сообщениями
 * Обрабатывает сообщения от незарегистрированных пользователей
 */

/**
 * Создать гостевой идентификатор
 * @returns {string}
 */
function createGuestId() {
  return `guest_${crypto.randomBytes(16).toString('hex')}`;
}

/**
 * Сохранить гостевое сообщение
 * @param {Object} messageData - Данные сообщения
 * @returns {Promise<Object>}
 */
async function saveGuestMessage(messageData) {
  try {
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const guestId = messageData.guestId || createGuestId();

    const { rows } = await db.getQuery()(
      `INSERT INTO guest_messages (
        guest_id,
        content_encrypted,
        channel_encrypted,
        created_at
      ) VALUES (
        $1,
        encrypt_text($2, $3),
        encrypt_text($4, $3),
        NOW()
      ) RETURNING id, guest_id, created_at`,
      [guestId, messageData.content, encryptionKey, messageData.channel || 'web']
    );

    logger.info('[GuestService] Сохранено гостевое сообщение:', rows[0].id);
    
    return {
      ...rows[0],
      content: messageData.content,
      channel: messageData.channel || 'web'
    };
    
  } catch (error) {
    logger.error('[GuestService] Ошибка сохранения гостевого сообщения:', error);
    throw error;
  }
}

/**
 * Получить гостевые сообщения по guest_id
 * @param {string} guestId - ID гостя
 * @returns {Promise<Array>}
 */
async function getGuestMessages(guestId) {
  try {
    const encryptionKey = encryptionUtils.getEncryptionKey();

    const { rows } = await db.getQuery()(
      `SELECT 
        id,
        guest_id,
        decrypt_text(content_encrypted, $2) as content,
        decrypt_text(channel_encrypted, $2) as channel,
        created_at
       FROM guest_messages
       WHERE guest_id = $1
       ORDER BY created_at ASC`,
      [guestId, encryptionKey]
    );

    return rows;
    
  } catch (error) {
    logger.error('[GuestService] Ошибка получения гостевых сообщений:', error);
    throw error;
  }
}

/**
 * Удалить гостевые сообщения
 * @param {string} guestId - ID гостя
 * @returns {Promise<number>}
 */
async function deleteGuestMessages(guestId) {
  try {
    const { rowCount } = await db.getQuery()(
      `DELETE FROM guest_messages WHERE guest_id = $1`,
      [guestId]
    );

    logger.info(`[GuestService] Удалено ${rowCount} гостевых сообщений для ${guestId}`);
    return rowCount;
    
  } catch (error) {
    logger.error('[GuestService] Ошибка удаления гостевых сообщений:', error);
    throw error;
  }
}

/**
 * Проверить, является ли пользователь гостем
 * @param {string} identifier - Идентификатор
 * @returns {boolean}
 */
function isGuest(identifier) {
  return typeof identifier === 'string' && identifier.startsWith('guest_');
}

/**
 * Получить статистику гостевых сообщений
 * @returns {Promise<Object>}
 */
async function getGuestStats() {
  try {
    const { rows } = await db.getQuery()(
      `SELECT 
        COUNT(DISTINCT guest_id) as unique_guests,
        COUNT(*) as total_messages,
        MAX(created_at) as last_message_at
       FROM guest_messages`
    );

    return rows[0];
    
  } catch (error) {
    logger.error('[GuestService] Ошибка получения статистики:', error);
    throw error;
  }
}

module.exports = {
  createGuestId,
  saveGuestMessage,
  getGuestMessages,
  deleteGuestMessages,
  isGuest,
  getGuestStats
};

