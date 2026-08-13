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
const crypto = require('crypto');
const universalMediaProcessor = require('./UniversalMediaProcessor');

/**
 * Универсальный сервис для обработки гостевых сообщений
 * Работает со всеми каналами: web, telegram, email
 */
class UniversalGuestService {
  /**
   * Создать унифицированный идентификатор
   * @param {string} channel - 'web', 'telegram', 'email'
   * @param {string} rawId - Исходный ID
   * @returns {string} - "channel:rawId"
   */
  createIdentifier(channel, rawId) {
    if (!channel || !rawId) {
      throw new Error('Channel and rawId are required');
    }
    return `${channel}:${rawId}`;
  }

  /**
   * Сгенерировать гостевой ID для Web
   * @returns {string} - "guest_abc123..."
   */
  generateWebGuestId() {
    return `guest_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Разобрать идентификатор на части
   * @param {string} identifier - "channel:id"
   * @returns {Object} - {channel, id}
   */
  parseIdentifier(identifier) {
    const parts = identifier.split(':');
    if (parts.length < 2) {
      throw new Error(`Invalid identifier format: ${identifier}`);
    }
    return {
      channel: parts[0],
      id: parts.slice(1).join(':') // На случай если в ID есть двоеточие (email)
    };
  }

  /**
   * Проверить, является ли идентификатор гостевым
   * @param {string} identifier
   * @returns {boolean}
   */
  isGuest(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return true; // По умолчанию считаем гостем
    }

    // Если нет user_id в БД - это гость
    // Для упрощения: любой identifier без wallet в user_identities = гость
    return true; // Пока всегда true, позже добавим проверку через БД
  }

  /**
   * Сохранить сообщение гостя
   * @param {Object} messageData
   * @returns {Promise<Object>}
   */
  async saveMessage(messageData) {
    try {
      const {
        identifier,
        content,
        channel,
        metadata = {},
        contentData = null
      } = messageData;

      const firstAtt = Array.isArray(messageData.attachments) ? messageData.attachments[0] : null;
      const attachment_filename = firstAtt?.filename || messageData.attachment_filename || null;
      const attachment_mimetype = firstAtt?.mimetype || messageData.attachment_mimetype || null;
      const attachment_size = firstAtt?.size || messageData.attachment_size || null;
      const attachment_data = firstAtt?.data || messageData.attachment_data || null;
      const attachmentKind = firstAtt?.kind || metadata.attachment_kind || null;

      const { mediaPlaceholder, contentTypeForKind } = require('../utils/chatMedia');
      const encryptionKey = encryptionUtils.getEncryptionKey();

      let processedContent = null;
      let finalContent = content;
      let finalMetadata = { ...metadata };
      if (attachmentKind) {
        finalMetadata.attachment_kind = attachmentKind;
      }

      if (attachment_data) {
        if (!String(finalContent || '').trim()) {
          finalContent = mediaPlaceholder(attachmentKind || 'document');
        }
      } else if (contentData) {
        processedContent = await universalMediaProcessor.processCombinedContent(contentData);
        if (content && processedContent.summary) {
          finalContent = `${content}\n\n[Прикрепленные файлы: ${processedContent.summary}]`;
        } else if (processedContent.summary) {
          finalContent = processedContent.summary;
        }
        finalMetadata.mediaSummary = processedContent.summary;
      }

      const dbContentType = processedContent
        ? processedContent.type
        : contentTypeForKind(attachmentKind);

      const { rows } = await db.getQuery()(
        `INSERT INTO unified_guest_messages (
          identifier_encrypted,
          channel,
          content_encrypted,
          is_ai,
          metadata,
          attachment_filename_encrypted,
          attachment_mimetype_encrypted,
          attachment_size,
          attachment_data,
          content_type,
          attachments,
          media_metadata,
          created_at
        ) VALUES (
          encrypt_text($1, $12),
          $2,
          encrypt_text($3, $12),
          $4,
          $5,
          encrypt_text($6, $12),
          encrypt_text($7, $12),
          $8,
          $9,
          $10,
          $11,
          $13,
          NOW()
        ) RETURNING id, created_at`,
        [
          identifier,
          channel,
          finalContent,
          false, // is_ai = false (это сообщение от гостя)
          JSON.stringify(finalMetadata),
          attachment_filename || null,
          attachment_mimetype || null,
          attachment_size || null,
          attachment_data || null,
          processedContent ? processedContent.type : dbContentType,
          processedContent ? JSON.stringify(processedContent.parts) : null,
          encryptionKey,
          JSON.stringify(finalMetadata)
        ]
      );

      const messageId = rows[0].id;
      
      // Если есть медиа-файлы, сохраняем их метаданные
      if (processedContent && processedContent.type === 'combined') {
        await this.saveMediaFiles(messageId, processedContent.parts, identifier, channel);
      }
      
      logger.info(`[UniversalGuestService] Сохранено сообщение гостя: ${identifier}, id: ${messageId}, тип: ${processedContent ? processedContent.type : 'text'}`);

      return {
        success: true,
        messageId: messageId,
        identifier,
        created_at: rows[0].created_at,
        processedContent
      };

    } catch (error) {
      logger.error('[UniversalGuestService] Ошибка сохранения сообщения гостя:', error);
      throw error;
    }
  }

  /**
   * Сохраняет метаданные медиа-файлов
   */
  async saveMediaFiles(messageId, contentParts, identifier, channel) {
    try {
      for (const part of contentParts) {
        if (part.type !== 'text' && part.file) {
          await db.getQuery()(
            `INSERT INTO media_files 
             (message_id, file_name, original_name, file_path, file_size, file_type, 
              mime_type, identifier, channel, metadata) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              messageId,
              part.file.savedName,
              part.file.originalName,
              part.file.path,
              part.file.size,
              part.type,
              part.metadata?.mimeType || null, // Сохраняем реальный MIME-тип
              identifier,
              channel,
              JSON.stringify(part.metadata)
            ]
          );
        }
      }
      logger.info(`[UniversalGuestService] Сохранены метаданные медиа-файлов для сообщения ${messageId}`);
    } catch (error) {
      logger.error(`[UniversalGuestService] Ошибка сохранения метаданных медиа:`, error);
    }
  }

  /**
   * Сохранить AI ответ гостю
   * @param {Object} responseData
   * @returns {Promise<Object>}
   */
  async saveAiResponse(responseData) {
    try {
      const {
        identifier,
        content,
        channel,
        metadata = {},
        attachments = []
      } = responseData;

      const firstAtt = attachments[0] || null;
      const encryptionKey = encryptionUtils.getEncryptionKey();
      const { contentTypeForKind } = require('../utils/chatMedia');

      const { rows } = await db.getQuery()(
        `INSERT INTO unified_guest_messages (
          identifier_encrypted,
          channel,
          content_encrypted,
          is_ai,
          metadata,
          attachment_filename_encrypted,
          attachment_mimetype_encrypted,
          attachment_size,
          attachment_data,
          content_type,
          created_at
        ) VALUES (
          encrypt_text($1, $11),
          $2,
          encrypt_text($3, $11),
          $4,
          $5,
          encrypt_text($6, $11),
          encrypt_text($7, $11),
          $8,
          $9,
          $10,
          NOW()
        ) RETURNING id, created_at`,
        [
          identifier,
          channel,
          content,
          true,
          JSON.stringify(metadata),
          firstAtt?.filename || null,
          firstAtt?.mimetype || null,
          firstAtt?.buffer?.length || firstAtt?.size || null,
          firstAtt?.buffer || firstAtt?.data || null,
          firstAtt ? contentTypeForKind(firstAtt.kind) : 'text',
          encryptionKey
        ]
      );

      logger.info(`[UniversalGuestService] Сохранен AI ответ для гостя: ${identifier}, id: ${rows[0].id}`);

      return {
        success: true,
        messageId: rows[0].id,
        identifier,
        created_at: rows[0].created_at
      };

    } catch (error) {
      logger.error('[UniversalGuestService] Ошибка сохранения AI ответа:', error);
      throw error;
    }
  }

  /**
   * Получить историю сообщений гостя
   * @param {string} identifier - "channel:id"
   * @returns {Promise<Array>} - [{role: 'user'/'assistant', content}]
   */
  async getHistory(identifier) {
    try {
      const encryptionKey = encryptionUtils.getEncryptionKey();

      const { rows } = await db.getQuery()(
        `SELECT 
          decrypt_text(content_encrypted, $2) as content,
          is_ai,
          created_at
         FROM unified_guest_messages
         WHERE decrypt_text(identifier_encrypted, $2) = $1
         ORDER BY created_at ASC`,
        [identifier, encryptionKey]
      );

      // Преобразуем в формат для AI
      const history = rows.map(row => ({
        role: row.is_ai ? 'assistant' : 'user',
        content: row.content
      }));

      logger.info(`[UniversalGuestService] Загружена история для ${identifier}: ${history.length} сообщений`);

      return history;

    } catch (error) {
      logger.error('[UniversalGuestService] Ошибка получения истории:', error);
      throw error;
    }
  }

  /**
   * Извлечь имя гостя из текста сообщения через ИИ и сохранить в metadata
   * @param {string} identifier - Идентификатор гостя
   * @param {string} content - Текст сообщения
   * @param {string} channel - Канал
   * @returns {Promise<void>}
   */
  async extractAndSaveGuestName(identifier, content, channel) {
    try {
      if (!content || !content.trim()) {
        return; // Нет текста для анализа
      }

      const encryptionKey = encryptionUtils.getEncryptionKey();

      // Находим первое сообщение гостя
      const firstMessageResult = await db.getQuery()(
        `WITH decrypted_guest AS (
          SELECT 
            id,
            decrypt_text(identifier_encrypted, $2) as guest_identifier,
            channel,
            metadata
          FROM unified_guest_messages
          WHERE user_id IS NULL
        )
        SELECT 
          id as first_message_id,
          metadata
        FROM decrypted_guest
        WHERE guest_identifier = $1 AND channel = $3
        ORDER BY id ASC
        LIMIT 1`,
        [identifier, encryptionKey, channel]
      );

      if (firstMessageResult.rows.length === 0) {
        return; // Гость не найден
      }

      const firstMessage = firstMessageResult.rows[0];
      let metadata = firstMessage.metadata || {};

      // Если metadata - строка, парсим её
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }

      // Если уже есть кастомное имя, не извлекаем заново
      if (metadata.custom_name) {
        logger.info(`[UniversalGuestService] У гостя ${identifier} уже есть кастомное имя: ${metadata.custom_name}`);
        return;
      }

      // Для гостя — только явные «меня зовут …» без LLM (не блокируем чат и не ловим FP)
      const { detectNameHint, normalizePersonName } = require('../utils/assistantTextSanitizer');
      const hint = detectNameHint(content);
      if (!hint.strong) {
        return;
      }
      const extractedName = normalizePersonName(hint.candidate);
      if (!extractedName) {
        logger.info(`[UniversalGuestService] Имя не найдено в сообщении гостя ${identifier}`);
        return;
      }

      // Разбиваем имя на части
      const nameParts = extractedName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Сохраняем имя в metadata
      metadata.custom_name = extractedName;
      metadata.custom_first_name = firstName;
      metadata.custom_last_name = lastName;

      // Обновляем metadata первого сообщения гостя
      await db.getQuery()(
        `UPDATE unified_guest_messages 
         SET metadata = $1 
         WHERE id = $2`,
        [JSON.stringify(metadata), firstMessage.first_message_id]
      );

      logger.info(`[UniversalGuestService] Имя гостя ${identifier} извлечено и сохранено: ${extractedName}`);

    } catch (error) {
      logger.error('[UniversalGuestService] Ошибка извлечения имени гостя:', error);
      throw error;
    }
  }

  /**
   * Обработать сообщение гостя (сохранить + получить AI ответ)
   * @param {Object} messageData
   * @returns {Promise<Object>}
   */
  async processMessage(messageData) {
    try {
      const { identifier, content, channel, contentData, assign_tags: assignTags = [] } = messageData;

      logger.info(`[UniversalGuestService] Обработка сообщения гостя: ${identifier}`);

      // 0.5. Проверяем, нужно ли автоматически подписать согласие при ответе
      // Загружаем историю для проверки последнего сообщения
      const previousHistory = await this.getHistory(identifier);
      
      // Если в истории есть системное сообщение о согласиях, автоматически подписываем при ответе
      if (previousHistory.length > 0) {
        const consentService = require('./consentService');
        const [provider, providerId] = identifier?.split(':') || [];
        let walletAddress = null;
        
        if (provider === 'web' && providerId?.startsWith('guest_')) {
          walletAddress = providerId;
        }
        
        // Проверяем, было ли последнее сообщение системным с согласием
        const lastMessage = previousHistory[previousHistory.length - 1];
        const hasConsentSystemMessage = lastMessage && 
          (lastMessage.role === 'system' || lastMessage.consentRequired);
        
        if (hasConsentSystemMessage) {
          // Проверяем текущие согласия
          const consentCheck = await consentService.checkConsents({
            userId: null,
            walletAddress
          });
          
          // Если согласия нужны, автоматически подписываем
          if (consentCheck.needsConsent) {
            logger.info(`[UniversalGuestService] Автоматическое подписание согласий при ответе гостя ${identifier}`);
            
            const consentDocuments = await consentService.getConsentDocuments(consentCheck.missingConsents);
            const documentIds = consentDocuments.map(doc => doc.id);
            const consentTypes = consentDocuments.map(doc => doc.consentType).filter(type => type);
            
            if (documentIds.length > 0 && consentTypes.length > 0) {
              const db = require('../db');
              try {
                // Для гостей используем wallet_address в формате guest_ID
                await db.getQuery()(
                  `INSERT INTO consent_logs (wallet_address, document_id, document_title, consent_type, status, signed_at, channel, ip_address, created_at, updated_at)
                   SELECT $1, unnest($2::int[]), unnest($3::text[]), unnest($4::text[]), 'granted', NOW(), 'web', NULL, NOW(), NOW()
                   ON CONFLICT (wallet_address, consent_type, document_id) 
                   DO UPDATE SET 
                     status = 'granted',
                     signed_at = NOW(),
                     revoked_at = NULL,
                     updated_at = NOW()
                   WHERE consent_logs.wallet_address = $1 AND consent_logs.consent_type = EXCLUDED.consent_type`,
                  [
                    walletAddress,
                    documentIds,
                    consentDocuments.map(doc => doc.title),
                    consentTypes
                  ]
                );
                logger.info(`[UniversalGuestService] Согласия автоматически подписаны для гостя ${identifier}`);
              } catch (consentError) {
                logger.error(`[UniversalGuestService] Ошибка автоматического подписания согласий:`, consentError);
              }
            }
          }
        }
      }

      // 1. Сохраняем сообщение гостя
      const saveResult = await this.saveMessage(messageData);
      const processedContent = saveResult.processedContent;
      const firstAtt = Array.isArray(messageData.attachments) ? messageData.attachments[0] : null;

      // 1.5. Имя гостя — в фоне, не блокируем первый ответ ИИ
      this.extractAndSaveGuestName(identifier, content, channel).catch(error => {
        logger.warn(`[UniversalGuestService] Ошибка извлечения имени гостя:`, error);
      });

      // 2. Загружаем историю для контекста (заново, так как могли добавиться сообщения)
      const conversationHistory = await this.getHistory(identifier);

      // 3. Генерируем AI ответ
      const aiAssistant = require('./ai-assistant');
      const { mediaPlaceholder } = require('../utils/chatMedia');

      let fullMessageContent = content;
      if (firstAtt?.kind && !String(content || '').trim()) {
        fullMessageContent = mediaPlaceholder(firstAtt.kind);
      } else if (processedContent && processedContent.summary) {
        fullMessageContent = content ? `${content}\n\n[Прикрепленные файлы: ${processedContent.summary}]` : processedContent.summary;
      }

      let aiResponse;
      try {
        aiResponse = await aiAssistant.generateResponse({
          channel: channel,
          messageId: `guest_${identifier}_${Date.now()}`,
          userId: null,
          userQuestion: fullMessageContent,
          conversationHistory: conversationHistory,
          media: firstAtt ? {
            kind: firstAtt.kind,
            mimetype: firstAtt.mimetype,
            data: firstAtt.data,
            filename: firstAtt.filename,
            size: firstAtt.size
          } : null,
          metadata: {
            isGuest: true,
            hasMedia: Boolean(firstAtt || processedContent),
            mediaSummary: processedContent?.summary,
            guestIdentifier: identifier,
            assign_tags: Array.isArray(assignTags) ? assignTags : [],
            attachment_kind: firstAtt?.kind || null
          }
        });
      } catch (aiErr) {
        logger.error(`[UniversalGuestService] AI после сохранения сообщения:`, aiErr);
        aiResponse = null;
      }

      if (aiResponse && (aiResponse.disabled || aiResponse.reason === 'accept_input_skipped')) {
        logger.info(`[UniversalGuestService] AI ассистент пропущен для ${identifier}: ${aiResponse.reason}`);
        return {
          success: true,
          identifier,
          userMessage: {
            id: saveResult.messageId,
            created_at: saveResult.created_at,
            attachments: firstAtt ? [{
              originalname: firstAtt.filename,
              mimetype: firstAtt.mimetype,
              size: firstAtt.size,
              kind: firstAtt.kind,
              url: `/api/chat/guest-attachment/${saveResult.messageId}`
            }] : null
          },
          aiResponse: null,
          assistantDisabled: Boolean(aiResponse.disabled),
          ingestSkipped: aiResponse.reason === 'accept_input_skipped'
        };
      }

      if (!aiResponse || !aiResponse.success) {
        logger.warn(`[UniversalGuestService] AI не вернул ответ для ${identifier}`);
        const { fallbackGuestCopy } = require('./chatMultimodalService');
        aiResponse = {
          success: true,
          response: fallbackGuestCopy(),
          multimodalUsed: false,
          multimodalReason: aiResponse?.reason || 'no_ai_response'
        };
      }

      // 4. Сохраняем AI ответ
      let finalAiResponse = aiResponse.response;
      // Первый ответ ассистента гостю в web — мягко предложить вход через кошелёк
      const hadAiReply = previousHistory.some((m) => m.role === 'assistant');
      const suggestWalletLogin = channel === 'web' && !hadAiReply;

      const aiSave = await this.saveAiResponse({
        identifier,
        content: typeof finalAiResponse === 'string' ? finalAiResponse : (finalAiResponse?.text || ''),
        channel,
        attachments: aiResponse.media ? [aiResponse.media] : [],
        metadata: {
          ...(messageData.metadata || {}),
          ...(suggestWalletLogin ? { suggestWalletLogin: true } : {}),
          ...(aiResponse.multimodalUsed === false ? { multimodalUsed: false, multimodalReason: aiResponse.multimodalReason } : {}),
          ...(aiResponse.media ? { attachment_kind: aiResponse.media.kind } : {})
        }
      }).catch((aiSaveErr) => {
        logger.error('[UniversalGuestService] Не удалось сохранить ответ AI:', aiSaveErr);
        return { messageId: null };
      });

      logger.info(`[UniversalGuestService] Сообщение гостя ${identifier} обработано успешно`);

      const userAttachment = firstAtt
        ? [{
          originalname: firstAtt.filename,
          mimetype: firstAtt.mimetype,
          size: firstAtt.size,
          kind: firstAtt.kind,
          url: `/api/chat/guest-attachment/${saveResult.messageId}`
        }]
        : null;

      const result = {
        success: true,
        identifier,
        suggestWalletLogin,
        userMessage: {
          id: saveResult.messageId,
          created_at: saveResult.created_at,
          attachments: userAttachment
        },
        aiResponse: {
          response: typeof finalAiResponse === 'string' ? finalAiResponse : (finalAiResponse?.text || ''),
          ragData: aiResponse.ragData,
          suggestWalletLogin,
          attachments: aiResponse.media
            ? [{
              originalname: aiResponse.media.filename,
              mimetype: aiResponse.media.mimetype,
              size: aiResponse.media.buffer?.length || aiResponse.media.size,
              kind: aiResponse.media.kind,
              url: `/api/chat/guest-attachment/${aiSave.messageId}`
            }]
            : null
        },
        aiMedia: aiResponse.media || null
      };

      return result;

    } catch (error) {
      logger.error('[UniversalGuestService] Ошибка обработки сообщения гостя:', error);
      throw error;
    }
  }

  /**
   * Мигрировать историю гостя в user_id
   * @param {string} identifier - "channel:id"
   * @param {number} userId
   * @returns {Promise<Object>}
   */
  async migrateToUser(identifier, userId) {
    try {
      logger.info(`[UniversalGuestService] Миграция истории ${identifier} → user ${userId}`);

      try {
        const conversationMemoryService = require('./conversationMemoryService');
        await conversationMemoryService.migrateGuestToUser(identifier, userId);
      } catch (memErr) {
        logger.warn('[UniversalGuestService] Миграция памяти диалога:', memErr.message);
      }

      const encryptionKey = encryptionUtils.getEncryptionKey();

      // 1. Получаем все сообщения гостя
      const { rows: messages } = await db.getQuery()(
        `SELECT 
          decrypt_text(identifier_encrypted, $2) as identifier,
          channel,
          decrypt_text(content_encrypted, $2) as content,
          is_ai,
          metadata,
          decrypt_text(attachment_filename_encrypted, $2) as attachment_filename,
          decrypt_text(attachment_mimetype_encrypted, $2) as attachment_mimetype,
          attachment_size,
          attachment_data,
          created_at
         FROM unified_guest_messages
         WHERE decrypt_text(identifier_encrypted, $2) = $1
         ORDER BY created_at ASC`,
        [identifier, encryptionKey]
      );

      if (messages.length === 0) {
        logger.info(`[UniversalGuestService] Нет сообщений для миграции`);
        return { success: true, migrated: 0, skipped: 0, conversationId: null };
      }

      // 2. Создаем беседу для пользователя
      const conversationService = require('./conversationService');
      const conversation = await conversationService.getOrCreateConversation(
        userId,
        'Перенесенная беседа'
      );
      const conversationId = conversation.id;

      let migrated = 0;
      let skipped = 0;

      // 3. Переносим каждое сообщение
      for (const msg of messages) {
        try {
          const senderType = msg.is_ai ? 'assistant' : 'user';
          const role = msg.is_ai ? 'assistant' : 'user';
          const direction = msg.is_ai ? 'outgoing' : 'incoming';

          await db.getQuery()(
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
              encrypt_text($3, $17),
              encrypt_text($4, $17),
              encrypt_text($5, $17),
              encrypt_text($6, $17),
              encrypt_text($7, $17),
              $8, $9, $10, $11,
              $12, $13, $14, $15,
              $16
            )`,
            [
              conversationId,
              userId, // sender_id
              senderType,
              msg.content,
              msg.channel,
              role,
              direction,
              msg.attachment_filename,
              msg.attachment_mimetype,
              msg.attachment_size,
              msg.attachment_data,
              'user_chat', // message_type для мигрированных сообщений (личный чат с ИИ)
              userId, // user_id
              role, // role (незашифрованное)
              direction, // direction (незашифрованное)
              msg.created_at,
              encryptionKey
            ]
          );

          migrated++;

        } catch (error) {
          logger.error('[UniversalGuestService] Ошибка переноса сообщения:', error);
          skipped++;
        }
      }

      // 4. Удаляем гостевые сообщения после успешного переноса
      if (migrated > 0) {
        await db.getQuery()(
          `DELETE FROM unified_guest_messages
           WHERE decrypt_text(identifier_encrypted, $2) = $1`,
          [identifier, encryptionKey]
        );

        // Сохраняем маппинг
        const { channel } = this.parseIdentifier(identifier);
        await db.getQuery()(
          `INSERT INTO unified_guest_mapping (
            user_id,
            identifier_encrypted,
            channel,
            processed,
            processed_at
          ) VALUES (
            $1,
            encrypt_text($2, $4),
            $3,
            true,
            NOW()
          )
          ON CONFLICT (identifier_encrypted, channel) DO NOTHING`,
          [userId, identifier, channel, encryptionKey]
        );
      }

      // 5. Переносим согласия гостя на пользователя, если они есть
      // Согласия могут быть связаны с гостевой сессией через wallet_address = "guest_${guestId}"
      // Только для web-гостей (формат: web:guest_xxx)
      try {
        const [channel, guestId] = identifier.split(':');
        
        // Мигрируем согласия только для web-гостей
        if (channel !== 'web' || !guestId?.startsWith('guest_')) {
          logger.info(`[UniversalGuestService] Пропуск миграции согласий для ${identifier} (не web-гость)`);
          return { migrated, skipped };
        }
        
        // Ищем согласия по гостевому идентификатору в формате "guest_${guestId}"
        const guestWalletAddress = guestId; // Уже в формате "guest_xxx"
        
        const { rows: guestConsents } = await db.getQuery()(`
          SELECT id, consent_type, document_id, document_title, status, signed_at, ip_address, user_agent, channel as consent_channel
          FROM consent_logs
          WHERE wallet_address = $1
            AND status = 'granted'
            AND (user_id IS NULL OR user_id = $2)
        `, [guestWalletAddress, userId]);
        
        if (guestConsents.length > 0) {
          logger.info(`[UniversalGuestService] Найдено ${guestConsents.length} согласий для переноса`);
          
          // Переносим согласия на пользователя
          // Обновляем wallet_address на нормализованный адрес кошелька пользователя, если он есть
          const identityService = require('./identity-service');
          const walletIdentity = await identityService.findIdentity(userId, 'wallet');
          const normalizedWalletAddress = walletIdentity?.provider_id || null;
          
          for (const consent of guestConsents) {
            await db.getQuery()(`
              UPDATE consent_logs
              SET user_id = $1,
                  wallet_address = COALESCE($2, wallet_address),
                  updated_at = NOW()
              WHERE id = $3
            `, [userId, normalizedWalletAddress, consent.id]);
          }
          
          logger.info(`[UniversalGuestService] Перенесено ${guestConsents.length} согласий на user ${userId}`);
        }
      } catch (consentError) {
        // Не критично, если не удалось перенести согласия - просто логируем
        logger.warn(`[UniversalGuestService] Ошибка переноса согласий (не критично):`, consentError);
      }

      logger.info(`[UniversalGuestService] Миграция завершена: ${migrated} перенесено, ${skipped} пропущено`);

      return {
        success: true,
        migrated,
        skipped,
        total: messages.length,
        conversationId
      };

    } catch (error) {
      logger.error('[UniversalGuestService] Ошибка миграции истории:', error);
      throw error;
    }
  }

  /**
   * Получить статистику по гостям
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const { rows } = await db.getQuery()(
        `SELECT 
          COUNT(DISTINCT identifier_encrypted) as unique_guests,
          COUNT(*) FILTER (WHERE is_ai = false) as user_messages,
          COUNT(*) FILTER (WHERE is_ai = true) as ai_responses,
          MAX(created_at) as last_activity
         FROM unified_guest_messages`
      );

      return rows[0];

    } catch (error) {
      logger.error('[UniversalGuestService] Ошибка получения статистики:', error);
      throw error;
    }
  }
}

module.exports = new UniversalGuestService();

