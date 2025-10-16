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
const adminLogicService = require('./adminLogicService');
const universalGuestService = require('./UniversalGuestService');
const identityService = require('./identity-service');
const { broadcastMessagesUpdate } = require('../wsHub');
// НОВАЯ СИСТЕМА РОЛЕЙ: используем shared/permissions.js
const { hasPermission, ROLES, PERMISSIONS } = require('/app/shared/permissions');

/**
 * Унифицированный процессор сообщений для всех каналов
 * Обрабатывает сообщения из web, telegram, email
 * НОВАЯ ВЕРСИЯ с поддержкой универсальной гостевой системы
 */

/**
 * Обработать сообщение (гость или пользователь)
 * @param {Object} messageData - Данные сообщения
 * @param {string} messageData.identifier - Универсальный идентификатор
 * @param {string} messageData.content - Текст сообщения
 * @param {string} messageData.channel - Канал (web/telegram/email)
 * @param {Array} messageData.attachments - Вложения
 * @param {number} messageData.conversationId - ID беседы (опционально)
 * @param {number} messageData.recipientId - ID получателя (для админов)
 * @returns {Promise<Object>}
 */
async function processMessage(messageData) {
  try {
    const {
      identifier,
      content,
      channel = 'web',
      attachments = [],
      conversationId: inputConversationId,
      recipientId,
      metadata = {}
    } = messageData;

    logger.info('[UnifiedMessageProcessor] Обработка сообщения:', {
      identifier,
      channel,
      contentLength: content?.length,
      hasAttachments: attachments.length > 0
    });

    // 1. Определяем: гость или пользователь?
    const isGuestIdentifier = await checkIfGuest(identifier);

    if (isGuestIdentifier) {
      // ГОСТЬ: обработка через UniversalGuestService
      logger.info('[UnifiedMessageProcessor] Обработка гостевого сообщения');
      return await universalGuestService.processMessage({
        identifier,
        content,
        channel,
        metadata,
        ...messageData
      });
    }

    // 2. ПОЛЬЗОВАТЕЛЬ: ищем user_id
    const [provider, providerId] = identifier.split(':');
    const user = await identityService.findUserByIdentity(provider, providerId);

    if (!user) {
      throw new Error(`User not found for identifier: ${identifier}`);
    }

    const userId = user.id;
    const userRole = user.role || 'user';

    logger.info('[UnifiedMessageProcessor] Обработка сообщения пользователя:', {
      userId,
      role: userRole
    });

    // НОВАЯ СИСТЕМА РОЛЕЙ: определяем права через новую систему
    const isAdmin = userRole === ROLES.EDITOR || userRole === ROLES.READONLY;

    // 4. Определяем нужно ли генерировать AI ответ
    const shouldGenerateAi = adminLogicService.shouldGenerateAiReply({
      senderType: isAdmin ? 'editor' : 'user',
      userId: userId,
      recipientId: recipientId || userId,
      channel: channel
    });

    logger.info('[UnifiedMessageProcessor] Генерация AI:', { shouldGenerateAi, userRole, isAdmin });

    // 5. Получаем или создаем беседу
    let conversation;
    if (inputConversationId) {
      conversation = await conversationService.getConversationById(inputConversationId);
    }
    
    if (!conversation) {
      conversation = await conversationService.getOrCreateConversation(userId, 'Беседа');
    }

    const conversationId = conversation.id;

    // 6. Обработка вложений
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

    // 7. Сохраняем входящее сообщение пользователя
    const encryptionKey = encryptionUtils.getEncryptionKey();

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
        message_type,
        created_at
      ) VALUES (
        $1, $2,
        encrypt_text($3, $13),
        encrypt_text($4, $13),
        encrypt_text($5, $13),
        encrypt_text($6, $13),
        encrypt_text($7, $13),
        encrypt_text($8, $13),
        encrypt_text($9, $13),
        $10, $11, $12,
        NOW()
      ) RETURNING id`,
      [
        userId,
        conversationId,
        isAdmin ? 'editor' : 'user',
        content,
        channel,
        'user',
        'incoming',
        attachment_filename,
        attachment_mimetype,
        attachment_size,
        attachment_data,
        'user_chat', // message_type
        encryptionKey
      ]
    );
    
    const userMessageId = rows[0].id;
    logger.info('[UnifiedMessageProcessor] Сообщение пользователя сохранено:', userMessageId);

    // 8. Генерируем AI ответ (если нужно)
    let aiResponse = null;

    if (shouldGenerateAi) {
      // Загружаем историю беседы
      const { rows: historyRows } = await db.getQuery()(
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
      
      const conversationHistory = historyRows.map(row => ({
        role: row.role,
        content: row.content
      }));

      logger.info('[UnifiedMessageProcessor] Генерация AI ответа...');
      
      aiResponse = await aiAssistant.generateResponse({
        channel,
        messageId: userMessageId,
        userId: userId,
        userQuestion: content,
        conversationHistory,
        conversationId,
        metadata: {
          hasAttachments: attachments.length > 0,
          channel,
          isAdmin
        }
      });

      if (aiResponse && aiResponse.success && aiResponse.response) {
        // Сохраняем ответ AI
        const { rows: aiMessageRows } = await db.getQuery()(
          `INSERT INTO messages (
            user_id,
            conversation_id,
            sender_type_encrypted,
            content_encrypted,
            channel_encrypted,
            role_encrypted,
            direction_encrypted,
            message_type,
            created_at
          ) VALUES (
            $1, $2,
            encrypt_text($3, $9),
            encrypt_text($4, $9),
            encrypt_text($5, $9),
            encrypt_text($6, $9),
            encrypt_text($7, $9),
            $8,
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
            'user_chat',
            encryptionKey
          ]
        );

        logger.info('[UnifiedMessageProcessor] Ответ AI сохранен:', aiMessageRows[0].id);
      } else {
        logger.warn('[UnifiedMessageProcessor] AI не вернул ответ:', aiResponse?.reason);
      }
    } else {
      logger.info('[UnifiedMessageProcessor] AI ответ не требуется (админ → пользователь)');
    }

    // 9. Обновляем время беседы
    await conversationService.touchConversation(conversationId);

    // 10. Отправляем уведомление через WebSocket
    try {
      broadcastMessagesUpdate(userId);
    } catch (wsError) {
      logger.warn('[UnifiedMessageProcessor] Ошибка отправки WebSocket:', wsError.message);
    }

    // 11. Возвращаем результат
    return {
      success: true,
      userMessageId,
      conversationId,
      aiResponse: aiResponse && aiResponse.success ? {
        response: aiResponse.response,
        ragData: aiResponse.ragData
      } : null,
      noAiResponse: !shouldGenerateAi
    };

  } catch (error) {
    logger.error('[UnifiedMessageProcessor] Ошибка обработки сообщения:', error);
    throw error;
  }
}

/**
 * Проверить, является ли идентификатор гостевым
 * @param {string} identifier
 * @returns {Promise<boolean>}
 */
async function checkIfGuest(identifier) {
  try {
    if (!identifier || typeof identifier !== 'string') {
      return true; // По умолчанию гость
    }

    // Разбираем идентификатор
    const [provider, providerId] = identifier.split(':');

    // Проверяем что это не web:guest_*
    if (provider === 'web' && providerId.startsWith('guest_')) {
      return true; // Это web гость
    }

    // Проверяем есть ли пользователь с wallet
    const user = await identityService.findUserByIdentity(provider, providerId);
    
    if (!user) {
      return true; // Пользователь не найден - это гость
    }

    // Проверяем есть ли у пользователя wallet
    const walletIdentity = await identityService.findIdentity(user.id, 'wallet');
    
    if (!walletIdentity) {
      // Нет кошелька - это временный пользователь, считаем гостем
      return true;
    }

    // Есть кошелек - полноценный пользователь
    return false;

  } catch (error) {
    logger.error('[UnifiedMessageProcessor] Ошибка проверки гостя:', error);
    return true; // В случае ошибки считаем гостем для безопасности
  }
}

/**
 * DEPRECATED: Используйте processMessage()
 * Обработать сообщение от гостя
 * @param {Object} messageData - Данные сообщения
 * @returns {Promise<Object>}
 */
async function processGuestMessage(messageData) {
  logger.warn('[UnifiedMessageProcessor] processGuestMessage() устарел, используйте processMessage()');
  
  // Для обратной совместимости
  const { guestId, content, channel } = messageData;
  const identifier = universalGuestService.createIdentifier(channel || 'web', guestId);
  
  return processMessage({
    identifier,
    content,
    channel: channel || 'web',
    ...messageData
  });
}

module.exports = {
  processMessage,
  processGuestMessage, // deprecated
  checkIfGuest
};
