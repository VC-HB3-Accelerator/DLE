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
const aiAssistant = require('./ai-assistant');
const conversationService = require('./conversationService');
const { broadcastMessagesUpdate } = require('../wsHub');

/**
 * Унифицированный процессор сообщений для всех каналов
 * Обрабатывает сообщения из web, telegram, email
 */

/**
 * Обработать сообщение от пользователя
 * @param {Object} messageData - Данные сообщения
 * @param {number} messageData.userId - ID пользователя
 * @param {string} messageData.content - Текст сообщения
 * @param {string} messageData.channel - Канал (web/telegram/email)
 * @param {Array} messageData.attachments - Вложения
 * @param {number} messageData.conversationId - ID беседы (опционально)
 * @returns {Promise<Object>}
 */
async function processMessage(messageData) {
  try {
    const {
      userId,
      content,
      channel = 'web',
      attachments = [],
      conversationId: inputConversationId,
      guestId
    } = messageData;

    logger.info('[UnifiedMessageProcessor] Обработка сообщения:', {
      userId,
      channel,
      contentLength: content?.length,
      hasAttachments: attachments.length > 0
    });

    const encryptionKey = encryptionUtils.getEncryptionKey();

    // 1. Получаем или создаем беседу
    let conversation;
    if (inputConversationId) {
      conversation = await conversationService.getConversationById(inputConversationId);
    }
    
    if (!conversation && userId) {
      conversation = await conversationService.getOrCreateConversation(userId, 'Беседа');
    }

    const conversationId = conversation?.id || null;

    // 2. Сохраняем входящее сообщение пользователя
    let userMessage;
    
    // Обработка вложений
    let attachment_filename = null;
    let attachment_mimetype = null;
    let attachment_size = null;
    let attachment_data = null;

    if (attachments && attachments.length > 0) {
      const firstAttachment = attachments[0];
      attachment_filename = firstAttachment.filename;
      attachment_mimetype = firstAttachment.mimetype;
      attachment_size = firstAttachment.size;
      attachment_data = firstAttachment.data;
    }

    if (userId) {
      const { rows } = await db.getQuery()(
        `INSERT INTO messages (
          user_id,
          conversation_id,
          sender_type_encrypted,
          content_encrypted,
          channel_encrypted,
          role_encrypted,
          direction_encrypted,
          attachment_filename_encrypted,
          attachment_mimetype_encrypted,
          attachment_size,
          attachment_data,
          created_at
        ) VALUES (
          $1, $2,
          encrypt_text($3, $12),
          encrypt_text($4, $12),
          encrypt_text($5, $12),
          encrypt_text($6, $12),
          encrypt_text($7, $12),
          encrypt_text($8, $12),
          encrypt_text($9, $12),
          $10, $11,
          NOW()
        ) RETURNING id`,
        [
          userId,
          conversationId,
          'user',
          content,
          channel,
          'user',
          'incoming',
          attachment_filename,
          attachment_mimetype,
          attachment_size,
          attachment_data,
          encryptionKey
        ]
      );
      
      userMessage = rows[0];
      logger.info('[UnifiedMessageProcessor] Сообщение пользователя сохранено:', userMessage.id);
    }

    // 3. Получаем историю беседы для контекста
    let conversationHistory = [];
    if (conversationId && userId) {
      const { rows } = await db.getQuery()(
        `SELECT 
          decrypt_text(role_encrypted, $2) as role,
          decrypt_text(content_encrypted, $2) as content,
          created_at
         FROM messages
         WHERE conversation_id = $1 AND user_id = $3
         ORDER BY created_at ASC
         LIMIT 20`,
        [conversationId, encryptionKey, userId]
      );
      
      conversationHistory = rows.map(row => ({
        role: row.role,
        content: row.content
      }));
    }

    // 4. Генерируем AI ответ
    logger.info('[UnifiedMessageProcessor] Генерация AI ответа...');
    
    const aiResponse = await aiAssistant.generateResponse({
      channel,
      messageId: userMessage?.id || `guest_${Date.now()}`,
      userId: userId || guestId,
      userQuestion: content,
      conversationHistory,
      conversationId,
      metadata: {
        hasAttachments: attachments.length > 0,
        channel
      }
    });

    if (!aiResponse || !aiResponse.success) {
      logger.warn('[UnifiedMessageProcessor] AI не вернул ответ или ошибка:', aiResponse?.reason);
      
      // Возвращаем результат без AI ответа
      return {
        success: true,
        userMessageId: userMessage?.id,
        conversationId,
        noAiResponse: true,
        reason: aiResponse?.reason
      };
    }

    // 5. Сохраняем ответ AI
    if (userId && aiResponse.response) {
      const { rows: aiMessageRows } = await db.getQuery()(
        `INSERT INTO messages (
          user_id,
          conversation_id,
          sender_type_encrypted,
          content_encrypted,
          channel_encrypted,
          role_encrypted,
          direction_encrypted,
          created_at
        ) VALUES (
          $1, $2,
          encrypt_text($3, $8),
          encrypt_text($4, $8),
          encrypt_text($5, $8),
          encrypt_text($6, $8),
          encrypt_text($7, $8),
          NOW()
        ) RETURNING id`,
        [
          userId,
          conversationId,
          'assistant',
          aiResponse.response,
          channel,
          'assistant',
          'outgoing',
          encryptionKey
        ]
      );

      logger.info('[UnifiedMessageProcessor] Ответ AI сохранен:', aiMessageRows[0].id);

      // 6. Обновляем время беседы
      if (conversationId) {
        await conversationService.touchConversation(conversationId);
      }

      // 7. Отправляем уведомление через WebSocket
      try {
        broadcastMessagesUpdate(userId);
      } catch (wsError) {
        logger.warn('[UnifiedMessageProcessor] Ошибка отправки WebSocket:', wsError.message);
      }
    }

    // 8. Возвращаем результат
    return {
      success: true,
      userMessageId: userMessage?.id,
      conversationId,
      aiResponse: {
        response: aiResponse.response,
        ragData: aiResponse.ragData
      }
    };

  } catch (error) {
    logger.error('[UnifiedMessageProcessor] Ошибка обработки сообщения:', error);
    throw error;
  }
}

/**
 * Обработать сообщение от гостя
 * @param {Object} messageData - Данные сообщения
 * @returns {Promise<Object>}
 */
async function processGuestMessage(messageData) {
  try {
    const guestService = require('./guestService');
    
    // Создаем guest ID если нет
    const guestId = messageData.guestId || guestService.createGuestId();
    
    // Сохраняем гостевое сообщение
    await guestService.saveGuestMessage({
      guestId,
      content: messageData.content,
      channel: messageData.channel || 'web'
    });

    // Генерируем AI ответ для гостя (без сохранения в messages)
    const aiResponse = await aiAssistant.generateResponse({
      channel: messageData.channel || 'web',
      messageId: `guest_${guestId}_${Date.now()}`,
      userId: guestId,
      userQuestion: messageData.content,
      conversationHistory: [],
      metadata: { isGuest: true }
    });

    return {
      success: true,
      guestId,
      aiResponse: aiResponse?.success ? {
        response: aiResponse.response
      } : null
    };

  } catch (error) {
    logger.error('[UnifiedMessageProcessor] Ошибка обработки гостевого сообщения:', error);
    throw error;
  }
}

module.exports = {
  processMessage,
  processGuestMessage
};

