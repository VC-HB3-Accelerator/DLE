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

/**
 * Сервис для работы с беседами (conversations)
 */

/**
 * Получить или создать беседу для пользователя
 * @param {number} userId - ID пользователя
 * @param {string} title - Заголовок беседы
 * @returns {Promise<Object>}
 */
async function getOrCreateConversation(userId, title = 'Новая беседа') {
  try {
    const encryptionKey = encryptionUtils.getEncryptionKey();

    // Ищем существующую активную беседу
    const { rows: existing } = await db.getQuery()(
      `SELECT id, user_id, decrypt_text(title_encrypted, $2) as title, created_at, updated_at
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId, encryptionKey]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // Создаем новую беседу
    const { rows: newConv } = await db.getQuery()(
      `INSERT INTO conversations (user_id, title_encrypted)
       VALUES ($1, encrypt_text($2, $3))
       RETURNING id, user_id, decrypt_text(title_encrypted, $3) as title, created_at, updated_at`,
      [userId, title, encryptionKey]
    );

    logger.info('[ConversationService] Создана новая беседа:', newConv[0].id);
    return newConv[0];
    
  } catch (error) {
    logger.error('[ConversationService] Ошибка получения/создания беседы:', error);
    throw error;
  }
}

/**
 * Получить беседу по ID
 * @param {number} conversationId - ID беседы
 * @returns {Promise<Object|null>}
 */
async function getConversationById(conversationId) {
  try {
    const encryptionKey = encryptionUtils.getEncryptionKey();

    const { rows } = await db.getQuery()(
      `SELECT id, user_id, decrypt_text(title_encrypted, $2) as title, created_at, updated_at
       FROM conversations
       WHERE id = $1`,
      [conversationId, encryptionKey]
    );

    return rows.length > 0 ? rows[0] : null;
    
  } catch (error) {
    logger.error('[ConversationService] Ошибка получения беседы:', error);
    throw error;
  }
}

/**
 * Получить все беседы пользователя
 * @param {number} userId - ID пользователя
 * @returns {Promise<Array>}
 */
async function getUserConversations(userId) {
  try {
    const encryptionKey = encryptionUtils.getEncryptionKey();

    const { rows } = await db.getQuery()(
      `SELECT id, user_id, decrypt_text(title_encrypted, $2) as title, created_at, updated_at
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId, encryptionKey]
    );

    return rows;
    
  } catch (error) {
    logger.error('[ConversationService] Ошибка получения бесед пользователя:', error);
    throw error;
  }
}

/**
 * Обновить время последнего обновления беседы
 * @param {number} conversationId - ID беседы
 * @returns {Promise<void>}
 */
async function touchConversation(conversationId) {
  try {
    await db.getQuery()(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );
  } catch (error) {
    logger.error('[ConversationService] Ошибка обновления беседы:', error);
    // Не бросаем ошибку, это некритично
  }
}

/**
 * Удалить беседу
 * @param {number} conversationId - ID беседы
 * @param {number} userId - ID пользователя (для проверки прав)
 * @returns {Promise<boolean>}
 */
async function deleteConversation(conversationId, userId) {
  try {
    const { rowCount } = await db.getQuery()(
      `DELETE FROM conversations WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    if (rowCount > 0) {
      logger.info('[ConversationService] Удалена беседа:', conversationId);
      return true;
    }

    return false;
    
  } catch (error) {
    logger.error('[ConversationService] Ошибка удаления беседы:', error);
    throw error;
  }
}

/**
 * Обновить заголовок беседы
 * @param {number} conversationId - ID беседы
 * @param {number} userId - ID пользователя
 * @param {string} newTitle - Новый заголовок
 * @returns {Promise<Object|null>}
 */
async function updateConversationTitle(conversationId, userId, newTitle) {
  try {
    const encryptionKey = encryptionUtils.getEncryptionKey();

    const { rows } = await db.getQuery()(
      `UPDATE conversations 
       SET title_encrypted = encrypt_text($3, $4), updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, decrypt_text(title_encrypted, $4) as title, created_at, updated_at`,
      [conversationId, userId, newTitle, encryptionKey]
    );

    return rows.length > 0 ? rows[0] : null;
    
  } catch (error) {
    logger.error('[ConversationService] Ошибка обновления заголовка беседы:', error);
    throw error;
  }
}

module.exports = {
  getOrCreateConversation,
  getConversationById,
  getUserConversations,
  touchConversation,
  deleteConversation,
  updateConversationTitle
};

