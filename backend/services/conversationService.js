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

    // Только личный чат с ИИ — не брать public_chat / private чужой переписки
    const { rows: existing } = await db.getQuery()(
      `SELECT id, user_id, title, created_at, updated_at, conversation_type
       FROM conversations
       WHERE user_id = $1
         AND (conversation_type IS NULL OR conversation_type = 'user_chat')
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // Создаем новую беседу
    const { rows: newConv } = await db.getQuery()(
      `INSERT INTO conversations (user_id, title, conversation_type)
       VALUES ($1, $2, 'user_chat')
       RETURNING id, user_id, title, created_at, updated_at, conversation_type`,
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
    const id1 = Number(userId1);
    const id2 = Number(userId2);
    if (!Number.isInteger(id1) || !Number.isInteger(id2) || id1 <= 0 || id2 <= 0) {
      throw new Error('Некорректные id для публичной беседы');
    }

    // Ищем существующую публичную беседу между этими пользователями
    const { rows: existing } = await db.getQuery()(
      `SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at, c.conversation_type
       FROM conversations c
       INNER JOIN conversation_participants cp1
         ON c.id = cp1.conversation_id AND cp1.user_id = $1
       INNER JOIN conversation_participants cp2
         ON c.id = cp2.conversation_id AND cp2.user_id = $2
       WHERE c.conversation_type = 'public_chat'
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [id1, id2]
    );

    if (existing.length > 0) {
      return existing[0];
    }

    // Создаем новую публичную беседу
    const { rows: newConv } = await db.getQuery()(
      `INSERT INTO conversations (user_id, title, conversation_type)
       VALUES ($1, $2, 'public_chat')
       RETURNING id, user_id, title, created_at, updated_at, conversation_type`,
      [id1, `Публичная беседа ${id1}-${id2}`]
    );

    const conversation = newConv[0];

    // Один user_id — одна строка (вопрос с своей карточки: id1 === id2)
    await db.getQuery()(
      `INSERT INTO conversation_participants (conversation_id, user_id)
       SELECT $1, x FROM unnest(ARRAY[$2::int, $3::int]) AS x
       WHERE NOT EXISTS (
         SELECT 1 FROM conversation_participants
         WHERE conversation_id = $1 AND user_id = x
       )`,
      [conversation.id, id1, id2]
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
      `SELECT id, user_id, title, created_at, updated_at, conversation_type
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

/**
 * Приватная беседа 1:1 (любые два участника).
 * Ищем по обоим participants; host user_id = min(id) для стабильности.
 */
async function getOrCreatePrivateConversation(userIdA, userIdB) {
  const a = Number(userIdA);
  const b = Number(userIdB);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a === b) {
    throw new Error('Некорректные id для приватной беседы');
  }

  const { rows: existing } = await db.getQuery()(
    `SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at, c.conversation_type
     FROM conversations c
     INNER JOIN conversation_participants cp1
       ON cp1.conversation_id = c.id AND cp1.user_id = $1
     INNER JOIN conversation_participants cp2
       ON cp2.conversation_id = c.id AND cp2.user_id = $2
     WHERE c.conversation_type = 'private'
     ORDER BY c.updated_at DESC
     LIMIT 1`,
    [a, b]
  );
  if (existing.length) return existing[0];

  const hostId = Math.min(a, b);
  const partId = Math.max(a, b);

  let title = `Чат ${hostId}-${partId}`;
  try {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    const { rows: nameRows } = await db.getQuery()(
      `SELECT id,
         CASE WHEN first_name_encrypted IS NULL OR first_name_encrypted = '' THEN NULL
              ELSE decrypt_text(first_name_encrypted, $2) END AS first_name,
         CASE WHEN last_name_encrypted IS NULL OR last_name_encrypted = '' THEN NULL
              ELSE decrypt_text(last_name_encrypted, $2) END AS last_name
       FROM users WHERE id = ANY($1::int[])`,
      [[a, b], encryptionKey]
    );
    const nameOf = (id) => {
      const row = nameRows.find((r) => Number(r.id) === Number(id));
      if (!row) return null;
      return [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || null;
    };
    const na = nameOf(a);
    const nb = nameOf(b);
    if (na && nb) title = `${na} · ${nb}`;
    else if (na || nb) title = na || nb;
  } catch (e) {
    logger.warn('[ConversationService] Не удалось собрать имя для private title:', e.message);
  }

  const { rows: created } = await db.getQuery()(
    `INSERT INTO conversations (user_id, title, conversation_type)
     VALUES ($1, $2, 'private')
     RETURNING id, user_id, title, created_at, updated_at, conversation_type`,
    [hostId, title]
  );
  const conversation = created[0];

  await db.getQuery()(
    `INSERT INTO conversation_participants (conversation_id, user_id)
     SELECT $1, x FROM unnest(ARRAY[$2::int, $3::int]) AS x
     WHERE NOT EXISTS (
       SELECT 1 FROM conversation_participants
       WHERE conversation_id = $1 AND user_id = x
     )`,
    [conversation.id, hostId, partId]
  );

  logger.info('[ConversationService] Создана private беседа:', conversation.id);
  return conversation;
}

module.exports = {
  getOrCreateConversation,
  getOrCreatePublicConversation,
  getOrCreatePrivateConversation,
  getConversationById,
  getUserConversations,
  touchConversation,
  deleteConversation,
  updateConversationTitle
};

