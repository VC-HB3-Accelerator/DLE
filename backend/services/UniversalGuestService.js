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
        attachment_filename,
        attachment_mimetype,
        attachment_size,
        attachment_data,
        contentData = null // Новый параметр для структурированного контента
      } = messageData;

      const encryptionKey = encryptionUtils.getEncryptionKey();

      // Обработка контента через UniversalMediaProcessor
      let processedContent = null;
      let finalContent = content;
      let finalMetadata = { ...metadata };

      if (contentData) {
        processedContent = await universalMediaProcessor.processCombinedContent(contentData);
        // Если есть и текст, и файлы - объединяем их
        if (content && processedContent.summary) {
          finalContent = `${content}\n\n[Прикрепленные файлы: ${processedContent.summary}]`;
        } else if (processedContent.summary) {
          // Только файлы без текста
          finalContent = processedContent.summary;
        }
        finalMetadata.mediaSummary = processedContent.summary;
      } else if (attachment_data) {
        // Если есть только одно вложение без contentData, обрабатываем его
        processedContent = await universalMediaProcessor.processFile(
          attachment_data,
          attachment_filename,
          {
            mimeType: attachment_mimetype,
            originalSize: attachment_size
          }
        );
        finalContent = content || processedContent.content;
        finalMetadata.mediaSummary = processedContent.content;
      }

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
          processedContent ? processedContent.type : 'text',
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
        metadata = {}
      } = responseData;

      const encryptionKey = encryptionUtils.getEncryptionKey();

      const { rows } = await db.getQuery()(
        `INSERT INTO unified_guest_messages (
          identifier_encrypted,
          channel,
          content_encrypted,
          is_ai,
          metadata,
          created_at
        ) VALUES (
          encrypt_text($1, $6),
          $2,
          encrypt_text($3, $6),
          $4,
          $5,
          NOW()
        ) RETURNING id, created_at`,
        [
          identifier,
          channel,
          content,
          true, // is_ai = true (это ответ AI)
          JSON.stringify(metadata),
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
   * Обработать сообщение гостя (сохранить + получить AI ответ)
   * @param {Object} messageData
   * @returns {Promise<Object>}
   */
  async processMessage(messageData) {
    try {
      const { identifier, content, channel, contentData } = messageData;

      logger.info(`[UniversalGuestService] Обработка сообщения гостя: ${identifier}`);

      // 1. Сохраняем сообщение гостя
      const saveResult = await this.saveMessage(messageData);
      const processedContent = saveResult.processedContent;

      // 2. Загружаем историю для контекста
      const conversationHistory = await this.getHistory(identifier);

      // 3. Генерируем AI ответ
      const aiAssistant = require('./ai-assistant');
      
      // Формируем полное описание сообщения для AI
      let fullMessageContent = content;
      if (processedContent && processedContent.summary) {
        // Если есть медиа, добавляем информацию о них
        fullMessageContent = content ? `${content}\n\n[Прикрепленные файлы: ${processedContent.summary}]` : processedContent.summary;
      }
      
      const aiResponse = await aiAssistant.generateResponse({
        channel: channel,
        messageId: `guest_${identifier}_${Date.now()}`,
        userId: identifier,
        userQuestion: fullMessageContent,
        conversationHistory: conversationHistory,
        metadata: { 
          isGuest: true,
          hasMedia: !!processedContent,
          mediaSummary: processedContent?.summary
        }
      });

      if (!aiResponse || !aiResponse.success) {
        logger.warn(`[UniversalGuestService] AI не вернул ответ для ${identifier}`);
        return {
          success: false,
          reason: aiResponse?.reason || 'no_ai_response'
        };
      }

      // 4. Сохраняем AI ответ
      await this.saveAiResponse({
        identifier,
        content: aiResponse.response,
        channel,
        metadata: messageData.metadata || {}
      });

      logger.info(`[UniversalGuestService] Сообщение гостя ${identifier} обработано успешно`);

      return {
        success: true,
        identifier,
        aiResponse: {
          response: aiResponse.response,
          ragData: aiResponse.ragData
        }
      };

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
        return { migrated: 0, skipped: 0, conversationId: null };
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

