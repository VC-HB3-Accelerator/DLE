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
const aiAssistant = require('./ai-assistant');
const conversationService = require('./conversationService');
const adminLogicService = require('./adminLogicService');
const universalGuestService = require('./UniversalGuestService');
const identityService = require('./identity-service');

/**
 * Определить тип сообщения по контексту
 * @param {number|null} recipientId - ID получателя
 * @param {number} userId - ID отправителя
 * @param {boolean} isAdminSender - Является ли отправитель админом
 * @returns {string} - Тип сообщения: 'user_chat', 'admin_chat', 'public'
 */
function determineMessageType(recipientId, userId, isAdminSender) {
  // 1. Личный чат с ИИ (recipientId не указан или равен userId)
  if (!recipientId || recipientId === userId) {
    return 'user_chat';
  }
  
  // 2. Приватное сообщение к редактору (recipientId = 1)
  if (recipientId === 1) {
    return 'admin_chat';
  }
  
  // 3. Публичное сообщение между пользователями
  return 'public';
}

/**
 * Определить тип беседы
 * @param {string} messageType - Тип сообщения
 * @param {number|null} recipientId - ID получателя
 * @param {number} userId - ID отправителя
 * @returns {string} - Тип беседы: 'user_chat', 'private', 'public'
 */
function determineConversationType(messageType, recipientId, userId) {
  switch (messageType) {
    case 'user_chat':
      return 'user_chat'; // Личная беседа с ИИ
    case 'admin_chat':
      return 'private'; // Приватная беседа с редактором
    case 'public':
      return 'public_chat'; // Публичная беседа между пользователями
    default:
      return 'user_chat';
  }
}

/**
 * Определить, нужно ли генерировать AI ответ
 * @param {string} messageType - Тип сообщения
 * @param {number|null} recipientId - ID получателя
 * @param {number} userId - ID отправителя
 * @returns {boolean}
 */
function shouldGenerateAiReply(messageType, recipientId, userId) {
  // ИИ отвечает только в личных чатах
  return messageType === 'user_chat';
}
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

    // 4. Определяем тип сообщения по контексту
    const messageType = determineMessageType(recipientId, userId, isAdmin);
    
    // 5. Определяем нужно ли генерировать AI ответ
    const shouldGenerateAi = shouldGenerateAiReply(messageType, recipientId, userId);

    logger.info('[UnifiedMessageProcessor] Генерация AI:', { shouldGenerateAi, userRole, isAdmin });

    // 6. Получаем или создаем беседу с правильным типом
    let conversation;
    const conversationType = determineConversationType(messageType, recipientId, userId);
    
    if (inputConversationId) {
      conversation = await conversationService.getConversationById(inputConversationId);
    }
    
    if (!conversation) {
      // Для публичных сообщений создаем беседу между пользователями
      if (messageType === 'public') {
        conversation = await conversationService.getOrCreatePublicConversation(userId, recipientId);
      } else {
        // Для личных и админских чатов используем стандартную логику
        conversation = await conversationService.getOrCreateConversation(userId, 'Беседа');
      }
      
      // Обновляем тип беседы в БД, если он не соответствует
      if (conversation.conversation_type !== conversationType) {
        await db.getQuery()(
          'UPDATE conversations SET conversation_type = $1 WHERE id = $2',
          [conversationType, conversation.id]
        );
        conversation.conversation_type = conversationType;
      }
    }

    const conversationId = conversation.id;

    // Получаем ключ шифрования (будет использоваться далее)
    const encryptionKey = encryptionUtils.getEncryptionKey();

    // 5.5. Проверяем, нужно ли автоматически подписать согласие при ответе
    // Ищем последнее сообщение от ассистента или системное сообщение с согласием
    const consentService = require('./consentService');
    
    const { rows: lastMessages } = await db.getQuery()(
      `SELECT 
        decrypt_text(role_encrypted, $2) as role,
        decrypt_text(content_encrypted, $2) as content,
        message_type
      FROM messages
      WHERE conversation_id = $1 
        AND user_id = $3
        AND (
          decrypt_text(role_encrypted, $2) = 'assistant' 
          OR message_type = 'system_consent'
        )
      ORDER BY created_at DESC
      LIMIT 1`,
      [conversationId, encryptionKey, userId]
    );
    
    // Если последнее сообщение было от ассистента, проверяем наличие системного сообщения о согласиях
    if (lastMessages.length > 0) {
      // Проверяем согласия пользователя
      const walletIdentity = await identityService.findIdentity(userId, 'wallet');
      const consentCheck = await consentService.checkConsents({
        userId,
        walletAddress: walletIdentity?.provider_id || null
      });
      
      // Если согласия нужны, но пользователь отвечает на сообщение, автоматически подписываем
      if (consentCheck.needsConsent) {
        logger.info(`[UnifiedMessageProcessor] Автоматическое подписание согласий при ответе пользователя ${userId}`);
        
        // Получаем документы для подписания
        const consentDocuments = await consentService.getConsentDocuments(consentCheck.missingConsents);
        const documentIds = consentDocuments.map(doc => doc.id);
        const consentTypes = consentDocuments.map(doc => doc.consentType).filter(type => type);
        
        // Автоматически подписываем согласие
        if (documentIds.length > 0 && consentTypes.length > 0) {
          const consentRoutes = require('../routes/consent');
          // Вызываем логику подписания напрямую через сервис или API
          try {
            await db.getQuery()(
              `INSERT INTO consent_logs (user_id, wallet_address, document_id, document_title, consent_type, status, signed_at, channel, ip_address, created_at, updated_at)
               SELECT $1, $2, unnest($3::int[]), unnest($4::text[]), unnest($5::text[]), 'granted', NOW(), 'web', NULL, NOW(), NOW()
               ON CONFLICT (user_id, consent_type, document_id) 
               DO UPDATE SET 
                 status = 'granted',
                 signed_at = NOW(),
                 revoked_at = NULL,
                 updated_at = NOW()
               WHERE consent_logs.user_id = $1 AND consent_logs.consent_type = EXCLUDED.consent_type`,
              [
                userId,
                walletIdentity?.provider_id || null,
                documentIds,
                consentDocuments.map(doc => doc.title),
                consentTypes
              ]
            );
            logger.info(`[UnifiedMessageProcessor] Согласия автоматически подписаны для пользователя ${userId}`);
          } catch (consentError) {
            logger.error(`[UnifiedMessageProcessor] Ошибка автоматического подписания согласий:`, consentError);
            // Не блокируем обработку сообщения при ошибке подписания
          }
        }
      }
    }

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
    // encryptionKey уже объявлен выше

    const { rows } = await db.getQuery()(
      `INSERT INTO messages (
        conversation_id,
        sender_id,
        sender_type_encrypted,
        content_encrypted,
        channel_encrypted,
        role_encrypted,
        direction_encrypted,
        attachment_filename,
        attachment_mimetype,
        attachment_size,
        attachment_data,
        message_type,
        user_id,
        role,
        direction,
        created_at
      ) VALUES (
        $1, $2,
        encrypt_text($3, $16),
        encrypt_text($4, $16),
        encrypt_text($5, $16),
        encrypt_text($6, $16),
        encrypt_text($7, $16),
        $8,
        $9,
        $10, $11, $12,
        $13, $14, $15,
        NOW()
      ) RETURNING id`,
      [
        conversationId,
        userId, // sender_id
        isAdmin ? 'editor' : 'user',
        content,
        channel,
        'user',
        'incoming',
        attachment_filename,
        attachment_mimetype,
        attachment_size,
        attachment_data,
        messageType, // message_type
        recipientId || userId, // user_id (получатель для публичных сообщений)
        'user', // role (незашифрованное)
        'incoming', // direction (незашифрованное)
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
        // Проверяем согласия и добавляем системное сообщение к ответу ИИ
        const walletIdentity = await identityService.findIdentity(userId, 'wallet');
        const consentSystemMessage = await consentService.getConsentSystemMessage({
          userId,
          walletAddress: walletIdentity?.provider_id || null,
          channel: channel === 'web' ? 'web' : channel,
          baseUrl: process.env.BASE_URL || 'http://localhost:9000'
        });

        // Формируем финальный ответ ИИ с системным сообщением, если нужно
        let finalAiResponse = aiResponse.response;
        if (consentSystemMessage && consentSystemMessage.consentRequired) {
          // Добавляем системное сообщение к ответу ИИ
          finalAiResponse = `${aiResponse.response}\n\n---\n\n${consentSystemMessage.content}`;
          
          // Сохраняем информацию о согласиях в метаданные ответа
          aiResponse.consentInfo = {
            consentRequired: true,
            missingConsents: consentSystemMessage.missingConsents,
            consentDocuments: consentSystemMessage.consentDocuments,
            autoConsentOnReply: consentSystemMessage.autoConsentOnReply
          };
        }

        // Сохраняем ответ AI с добавленным системным сообщением
        const { rows: aiMessageRows } = await db.getQuery()(
          `INSERT INTO messages (
            conversation_id,
            sender_id,
            sender_type_encrypted,
            content_encrypted,
            channel_encrypted,
            role_encrypted,
            direction_encrypted,
            message_type,
            user_id,
            role,
            direction,
            created_at
          ) VALUES (
            $1, $2,
            encrypt_text($3, $12),
            encrypt_text($4, $12),
            encrypt_text($5, $12),
            encrypt_text($6, $12),
            encrypt_text($7, $12),
            $8, $9, $10, $11,
            NOW()
          ) RETURNING id`,
          [
            conversationId,
            userId, // sender_id
            'assistant',
            finalAiResponse,
            channel,
            'assistant',
            'outgoing',
            messageType,
            userId, // user_id
            'assistant', // role (незашифрованное)
            'outgoing', // direction (незашифрованное)
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
    const result = {
      success: true,
      userMessageId,
      conversationId,
      aiResponse: aiResponse && aiResponse.success ? {
        response: finalAiResponse || aiResponse.response,
        ragData: aiResponse.ragData
      } : null,
      noAiResponse: !shouldGenerateAi
    };

    // Если есть информация о согласиях, добавляем её в результат
    if (aiResponse && aiResponse.success && aiResponse.consentInfo) {
      result.consentRequired = aiResponse.consentInfo.consentRequired;
      result.missingConsents = aiResponse.consentInfo.missingConsents;
      result.consentDocuments = aiResponse.consentInfo.consentDocuments;
      result.autoConsentOnReply = aiResponse.consentInfo.autoConsentOnReply;
    }

    return result;

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
