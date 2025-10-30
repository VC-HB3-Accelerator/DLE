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
      `SELECT id, user_id, title, created_at, updated_at
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // Создаем новую беседу
    const { rows: newConv } = await db.getQuery()(
      `INSERT INTO conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING id, user_id, title, created_at, updated_at`,
      [userId, title]
    );

    logger.info('[ConversationService] Создана новая беседа:', newConv[0].id);
    return newConv[0];
    
  } catch (error) {
    logger.error('[ConversationService] Ошибка получения/создания беседы:', error);
    throw error;
  }
}

/**
 * Получить или создать публичную беседу между двумя пользователями
 * @param {number} userId1 - ID первого пользователя
 * @param {number} userId2 - ID второго пользователя
 * @returns {Promise<Object>}
 */
async function getOrCreatePublicConversation(userId1, userId2) {
  try {
    // Ищем существующую публичную беседу между этими пользователями
    const { rows: existing } = await db.getQuery()(
      `SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at, c.conversation_type
       FROM conversations c
       INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
       INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
       WHERE c.conversation_type = 'public_chat'
         AND cp1.user_id = $1 AND cp2.user_id = $2
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [userId1, userId2]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // Создаем новую публичную беседу
    const { rows: newConv } = await db.getQuery()(
      `INSERT INTO conversations (user_id, title, conversation_type)
       VALUES ($1, $2, 'public_chat')
       RETURNING id, user_id, title, created_at, updated_at, conversation_type`,
      [userId1, `Публичная беседа ${userId1}-${userId2}`]
    );

    const conversation = newConv[0];

    // Добавляем участников
    await db.getQuery()(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)`,
      [conversation.id, userId1]
    );
    await db.getQuery()(
      `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)`,
      [conversation.id, userId2]
    );

    logger.info('[ConversationService] Создана публичная беседа:', conversation.id);
    return conversation;
    
  } catch (error) {
    logger.error('[ConversationService] Ошибка создания публичной беседы:', error);
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
      `SELECT id, user_id, title, created_at, updated_at
       FROM conversations
       WHERE id = $1`,
      [conversationId]
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
      `SELECT id, user_id, title, created_at, updated_at
       FROM conversations
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
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
       SET title = $3, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, title, created_at, updated_at`,
      [conversationId, userId, newTitle]
    );

    return rows.length > 0 ? rows[0] : null;
    
  } catch (error) {
    logger.error('[ConversationService] Ошибка обновления заголовка беседы:', error);
    throw error;
  }
}

module.exports = {
  getOrCreateConversation,
  getOrCreatePublicConversation,
  getConversationById,
  getUserConversations,
  touchConversation,
  deleteConversation,
  updateConversationTitle
};

