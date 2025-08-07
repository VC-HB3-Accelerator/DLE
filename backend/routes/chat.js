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

const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiAssistant = require('../services/ai-assistant');
const aiQueueService = require('../services/ai-queue'); // Добавляем импорт AI Queue сервиса
const db = require('../db');
const encryptedDb = require('../services/encryptedDatabaseService');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const crypto = require('crypto');
const aiAssistantSettingsService = require('../services/aiAssistantSettingsService');
const aiAssistantRulesService = require('../services/aiAssistantRulesService');
const { isUserBlocked } = require('../utils/userUtils');
const { broadcastChatMessage, broadcastConversationUpdate } = require('../wsHub');

// Настройка multer для обработки файлов в памяти
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Функция для обработки гостевых сообщений после аутентификации
async function processGuestMessages(userId, guestId) {
  try {
    logger.info(`Processing guest messages for user ${userId} with guest ID ${guestId}`);

    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }

    // Проверяем, обрабатывались ли уже эти сообщения
    const mappingCheck = await db.getQuery()(
      'SELECT processed FROM guest_user_mapping WHERE guest_id_encrypted = encrypt_text($1, $2)',
      [guestId, encryptionKey]
    );

    // Если сообщения уже обработаны, пропускаем
    if (mappingCheck.rows.length > 0 && mappingCheck.rows[0].processed) {
      logger.info(`Guest messages for guest ID ${guestId} were already processed.`);
      return { success: true, message: 'Guest messages already processed' };
    }

    // Проверяем наличие mapping записи и создаем если нет
    if (mappingCheck.rows.length === 0) {
      await db.getQuery()(
        'INSERT INTO guest_user_mapping (user_id, guest_id_encrypted) VALUES ($1, encrypt_text($2, $3)) ON CONFLICT (guest_id_encrypted) DO UPDATE SET user_id = $1',
        [userId, guestId, encryptionKey]
      );
      logger.info(`Created mapping for guest ID ${guestId} to user ${userId}`);
    }

    // Получаем все гостевые сообщения со всеми новыми полями
    const guestMessagesResult = await db.getQuery()(
      `SELECT
         id, decrypt_text(guest_id_encrypted, $2) as guest_id, decrypt_text(content_encrypted, $2) as content, decrypt_text(language_encrypted, $2) as language, is_ai, created_at,
         decrypt_text(attachment_filename_encrypted, $2) as attachment_filename, decrypt_text(attachment_mimetype_encrypted, $2) as attachment_mimetype, attachment_size, attachment_data
       FROM guest_messages WHERE guest_id_encrypted = encrypt_text($1, $2) ORDER BY created_at ASC`,
      [guestId, encryptionKey]
    );

    if (guestMessagesResult.rows.length === 0) {
      logger.info(`No guest messages found for guest ID ${guestId}`);
      const checkResult = await db.getQuery()('SELECT 1 FROM guest_user_mapping WHERE guest_id_encrypted = encrypt_text($1, $2)', [guestId, encryptionKey]);
      if (checkResult.rows.length > 0) {
        await db.getQuery()('UPDATE guest_user_mapping SET processed = true WHERE guest_id_encrypted = encrypt_text($1, $2)', [guestId, encryptionKey]);
        logger.info(`Marked guest mapping as processed (no messages found) for guest ID ${guestId}`);
      } else {
        logger.warn(`Attempted to mark non-existent guest mapping as processed for guest ID ${guestId}`);
      }
      return { success: true, message: 'No guest messages found' };
    }

    const guestMessages = guestMessagesResult.rows;
    logger.info(`Found ${guestMessages.length} guest messages for guest ID ${guestId}`);

    // --- Новый порядок: ищем последний диалог пользователя ---
    let conversation = null;
    const lastConvResult = await db.getQuery()(
      'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $2) as title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [userId, encryptionKey]
    );
    if (lastConvResult.rows.length > 0) {
      conversation = lastConvResult.rows[0];
    } else {
      // Если нет ни одного диалога, создаём новый
    const firstMessage = guestMessages[0];
    const title = firstMessage.content && firstMessage.content.trim()
      ? (firstMessage.content.trim().length > 30 ? `${firstMessage.content.trim().substring(0, 30)}...` : firstMessage.content.trim())
      : (firstMessage.attachment_filename ? `Файл: ${firstMessage.attachment_filename}` : 'Новый диалог');
    const newConversationResult = await db.getQuery()(
      'INSERT INTO conversations (user_id, title_encrypted) VALUES ($1, encrypt_text($2, $3)) RETURNING *',
      [userId, title, encryptionKey]
    );
      conversation = newConversationResult.rows[0];
    logger.info(`Created new conversation ${conversation.id} for guest messages`);
    }
    // --- КОНЕЦ блока поиска/создания диалога ---

    // Отслеживаем успешные сохранения сообщений
    const savedMessageIds = [];

    // Обрабатываем каждое гостевое сообщение
    for (const guestMessage of guestMessages) {
      logger.info(`Processing guest message ID ${guestMessage.id}: ${guestMessage.content || guestMessage.attachment_filename || '(empty)'}`);
      try {
        // Сохраняем сообщение пользователя в таблицу messages, включая данные файла
        const userMessageResult = await db.getQuery()(
          `INSERT INTO messages
            (conversation_id, content_encrypted, sender_type_encrypted, role_encrypted, channel_encrypted, created_at, user_id,
             attachment_filename_encrypted, attachment_mimetype_encrypted, attachment_size, attachment_data)
           VALUES
            ($1, encrypt_text($2, $9), encrypt_text('user', $9), encrypt_text('user', $9), encrypt_text('web', $9), $3, $4,
             encrypt_text($5, $9), encrypt_text($6, $9), $7, $8)
           RETURNING *`,
          [
            conversation.id,
            guestMessage.content, // Текст (может быть NULL)
            guestMessage.created_at,
            userId,
            guestMessage.attachment_filename, // Метаданные и данные файла
            guestMessage.attachment_mimetype,
            guestMessage.attachment_size,
            guestMessage.attachment_data, // BYTEA
            encryptionKey
          ]
        );
        const savedUserMessage = userMessageResult.rows[0];
        logger.info(`Saved user message with ID ${savedUserMessage.id}`);
        savedMessageIds.push(guestMessage.id);
        // --- Генерируем ответ ИИ на гостевое сообщение, если это текст ---
        if (guestMessage.content) {
          // Проверяем, что на это сообщение ещё нет ответа ассистента
          const aiReplyExists = await db.getQuery()(
            `SELECT 1 FROM messages WHERE conversation_id = $1 AND sender_type_encrypted = encrypt_text('assistant', $3) AND created_at > $2 LIMIT 1`,
            [conversation.id, guestMessage.created_at, encryptionKey]
          );
          if (!aiReplyExists.rows.length) {
            try {
              // Получаем настройки ассистента
              const aiSettings = await aiAssistantSettingsService.getSettings();
              let rules = null;
              if (aiSettings && aiSettings.rules_id) {
                rules = await aiAssistantRulesService.getRuleById(aiSettings.rules_id);
              }
              // Получаем историю сообщений до этого guestMessage (до created_at)
              const historyResult = await db.getQuery()(
                'SELECT decrypt_text(sender_type_encrypted, $3) as sender_type, decrypt_text(content_encrypted, $3) as content FROM messages WHERE conversation_id = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT 10',
                [conversation.id, guestMessage.created_at, encryptionKey]
              );
              const history = historyResult.rows.reverse().map(msg => ({
                role: msg.sender_type === 'user' ? 'user' : 'assistant',
                content: msg.content
              }));
              logger.info('Getting AI response for guest message:', guestMessage.content);
              const aiResponseContent = await aiAssistant.getResponse(
                guestMessage.content,
                history,
                aiSettings ? aiSettings.system_prompt : '',
                rules ? rules.rules : null
              );
              logger.info('AI response for guest message received' + (aiResponseContent ? '' : ' (empty)'), { conversationId: conversation.id });
          if (aiResponseContent) {
                await db.getQuery()(
                `INSERT INTO messages
                     (conversation_id, user_id, content_encrypted, sender_type_encrypted, role_encrypted, channel_encrypted)
                   VALUES ($1, $2, encrypt_text($3, $4), encrypt_text('assistant', $4), encrypt_text('assistant', $4), encrypt_text('web', $4))`,
                  [conversation.id, userId, aiResponseContent, encryptionKey]
              );
                logger.info('AI response for guest message saved', { conversationId: conversation.id });
          }
            } catch (aiError) {
              logger.error('Error getting or saving AI response for guest message:', aiError);
        }
          }
        }
        // --- конец блока генерации ответа ИИ ---
      } catch (error) {
        logger.error(`Error processing guest message ${guestMessage.id}: ${error.message}`, { stack: error.stack });
        // Продолжаем с другими сообщениями в случае ошибки
      }
    }

    // Удаляем только успешно обработанные гостевые сообщения
    if (savedMessageIds.length > 0) {
      await db.getQuery()('DELETE FROM guest_messages WHERE id = ANY($1::int[])', [savedMessageIds]);
      logger.info(
        `Deleted ${savedMessageIds.length} processed guest messages for guest ID ${guestId}`
      );

      // Помечаем гостевой ID как обработанный
      await db.getQuery()('UPDATE guest_user_mapping SET processed = true WHERE guest_id_encrypted = encrypt_text($1, $2)', [
        guestId, encryptionKey
      ]);
      logger.info(`Marked guest mapping as processed for guest ID ${guestId}`);
    } else {
      logger.warn(`No guest messages were successfully processed, skipping deletion for guest ID ${guestId}`);
      // Если не было успешных, все равно пометим как обработанные, чтобы не пытаться снова
      await db.getQuery()('UPDATE guest_user_mapping SET processed = true WHERE guest_id_encrypted = encrypt_text($1, $2)', [guestId, encryptionKey]);
      logger.info(`Marked guest mapping as processed (no successful messages) for guest ID ${guestId}`);
    }

    return {
      success: true,
      message: `Processed ${savedMessageIds.length} of ${guestMessages.length} guest messages`,
      conversationId: conversation.id,
    };
  } catch (error) {
    logger.error(`Error in processGuestMessages for guest ID ${guestId}: ${error.message}`, { stack: error.stack });
    // Не пробрасываем ошибку дальше, чтобы не прерывать основной поток, но логируем ее
    return { success: false, error: 'Internal error during guest message processing' };
  }
}

// Обработчик для гостевых сообщений
router.post('/guest-message', upload.array('attachments'), async (req, res) => {
  // Логируем полученные данные
  logger.info('Received /guest-message request');
  logger.debug('Request Body:', req.body);
  logger.debug('Request Files:', req.files); // Файлы будут здесь

  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  let encryptionKey = 'default-key';
  
  try {
    const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
  } catch (keyError) {
    console.error('Error reading encryption key:', keyError);
  }

  try {
    // Извлекаем данные из req.body (текстовые поля)
    const { message, language, guestId: requestGuestId } = req.body;
    const files = req.files; // Файлы извлекаем из req.files
    const file = files && files.length > 0 ? files[0] : null; // Берем только первый файл

    // Валидация: должно быть либо сообщение, либо файл
    if (!message && !file) {
      logger.warn('Guest message attempt without content or file.', { guestId: requestGuestId });
      return res.status(400).json({ success: false, error: 'Требуется текст сообщения или файл.' });
    }
    // Запрещаем и текст, и файл одновременно (согласно новым требованиям)
    if (message && file) {
        logger.warn('Guest message attempt with both text and file.', { guestId: requestGuestId });
        return res.status(400).json({ success: false, error: 'Нельзя отправить текст и файл одновременно.' });
    }

    // Используем гостевой ID из запроса или из сессии, или генерируем новый
    const guestId = requestGuestId || req.session.guestId || crypto.randomBytes(16).toString('hex');

    // Сохраняем/обновляем ID гостя в сессии
    if (req.session.guestId !== guestId) {
      req.session.guestId = guestId;
    }

    // Подготавливаем данные для вставки
    const messageContent = message && message.trim() ? message.trim() : null; // Текст или NULL, если пустой
    const attachmentFilename = file ? file.originalname : null;
    const attachmentMimetype = file ? file.mimetype : null;
    const attachmentSize = file ? file.size : null;
    const attachmentData = file ? file.buffer : null; // Сам буфер файла

    // Проверяем, что есть контент для сохранения
    if (!messageContent && !attachmentData) {
      logger.warn('Guest message attempt without content or file');
      return res.status(400).json({ success: false, error: 'Требуется текст сообщения или файл.' });
    }

    logger.info('Saving guest message:', {
      guestId,
      message: messageContent,
      file: attachmentFilename,
      mimetype: attachmentMimetype,
      size: attachmentSize
    });

    // Сохраняем сообщение пользователя с текстом или файлом
    const result = await db.getQuery()(
      `INSERT INTO guest_messages
        (guest_id_encrypted, content_encrypted, language_encrypted, is_ai,
         attachment_filename_encrypted, attachment_mimetype_encrypted, attachment_size, attachment_data)
       VALUES (encrypt_text($1, $8), ${messageContent ? 'encrypt_text($2, $8)' : 'NULL'}, encrypt_text($3, $8), false, ${attachmentFilename ? 'encrypt_text($4, $8)' : 'NULL'}, ${attachmentMimetype ? 'encrypt_text($5, $8)' : 'NULL'}, $6, $7) RETURNING id`,
      [
        guestId,
        messageContent, // Текст сообщения или NULL
        'ru', // Устанавливаем русский язык по умолчанию
        attachmentFilename,
        attachmentMimetype,
        attachmentSize,
        attachmentData, // BYTEA данные файла или NULL
        encryptionKey
      ]
    );

    const savedMessageId = result.rows[0].id;
    logger.info('Guest message saved with ID:', savedMessageId);

    // Сохраняем сессию после успешной операции с БД
    try {
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) return reject(err);
          resolve();
        });
      });
      logger.info('Session saved after guest message');
    } catch (sessionError) {
      logger.error('Error saving session after guest message:', sessionError);
      // Не прерываем ответ пользователю из-за ошибки сессии
    }

    // Получаем настройки ассистента для systemMessage
    let telegramBotUrl = null;
    let supportEmailAddr = null;
    try {
      const aiSettings = await aiAssistantSettingsService.getSettings();
      if (aiSettings && aiSettings.telegramBot && aiSettings.telegramBot.bot_username) {
        telegramBotUrl = `https://t.me/${aiSettings.telegramBot.bot_username}`;
      }
      if (aiSettings && aiSettings.supportEmail && aiSettings.supportEmail.from_email) {
        supportEmailAddr = aiSettings.supportEmail.from_email;
      }
    } catch (e) {
      logger.error('Ошибка получения настроек ассистента для systemMessage:', e);
    }

    res.json({
      success: true,
      messageId: savedMessageId, // Возвращаем ID сохраненного сообщения
      guestId: guestId, // Возвращаем использованный guestId
      systemMessage: 'Для продолжения диалога авторизуйтесь: подключите кошелек, перейдите в чат-бот Telegram или отправьте письмо на email.',
      telegramBotUrl,
      supportEmail: supportEmailAddr
    });
  } catch (error) {
    logger.error('Error saving guest message:', error);
    res.status(500).json({ success: false, error: 'Ошибка сохранения гостевого сообщения' });
  }
});

// Обработчик для сообщений аутентифицированных пользователей
router.post('/message', requireAuth, upload.array('attachments'), async (req, res) => {
  logger.info('Received /message request');
  logger.debug('Request Body:', req.body);
  logger.debug('Request Files:', req.files);

  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  let encryptionKey = 'default-key';
  
  try {
    const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
  } catch (keyError) {
    console.error('Error reading encryption key:', keyError);
  }

  const userId = req.session.userId;
  const { message, language, conversationId: convIdFromRequest } = req.body;
  const files = req.files;
  const file = files && files.length > 0 ? files[0] : null;

  // Валидация: должно быть либо сообщение, либо файл
  if (!message && !file) {
    logger.warn('Authenticated message attempt without content or file.', { userId });
    return res.status(400).json({ success: false, error: 'Требуется текст сообщения или файл.' });
  }
  // Запрещаем и текст, и файл одновременно
  if (message && file) {
      logger.warn('Authenticated message attempt with both text and file.', { userId });
      return res.status(400).json({ success: false, error: 'Нельзя отправить текст и файл одновременно.' });
  }

  let conversationId = convIdFromRequest;
  let conversation = null;

  try {
    // Найти или создать диалог
    if (conversationId) {
      let convResult;
      if (req.session.isAdmin) {
        // Админ может писать в любой диалог
        convResult = await db.getQuery()(
          'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $2) as title FROM conversations WHERE id = $1',
          [conversationId, encryptionKey]
        );
      } else {
        // Обычный пользователь — только в свой диалог
        convResult = await db.getQuery()(
        'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $3) as title FROM conversations WHERE id = $1 AND user_id = $2',
        [conversationId, userId, encryptionKey]
      );
      }
      if (convResult.rows.length === 0) {
        logger.warn('Conversation not found or access denied', { conversationId, userId });
        return res.status(404).json({ success: false, error: 'Диалог не найден или доступ запрещен' });
      }
      conversation = convResult.rows[0];
    } else {
      // Ищем последний диалог пользователя
      const lastConvResult = await db.getQuery()(
        'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $2) as title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
        [userId, encryptionKey]
      );
      if (lastConvResult.rows.length > 0) {
        conversation = lastConvResult.rows[0];
        conversationId = conversation.id;
      } else {
        // Создаем новый диалог, если нет ни одного
      const title = message && message.trim()
        ? (message.trim().length > 50 ? `${message.trim().substring(0, 50)}...` : message.trim())
        : (file ? `Файл: ${file.originalname}` : 'Новый диалог');
      const newConvResult = await db.getQuery()(
        'INSERT INTO conversations (user_id, title_encrypted) VALUES ($1, encrypt_text($2, $3)) RETURNING *',
        [userId, title, encryptionKey]
      );
      conversation = newConvResult.rows[0];
      conversationId = conversation.id;
      logger.info('Created new conversation', { conversationId, userId });
      }
    }

    // Подготавливаем данные для вставки сообщения пользователя
    const messageContent = message && message.trim() ? message.trim() : null; // Текст или NULL, если пустой
    const attachmentFilename = file ? file.originalname : null;
    const attachmentMimetype = file ? file.mimetype : null;
    const attachmentSize = file ? file.size : null;
    const attachmentData = file ? file.buffer : null;

    // Определяем user_id для сообщения: всегда user_id диалога (контакта)
    const recipientId = conversation.user_id;
    // Определяем sender_type
    let senderType = 'user';
    let role = 'user';
    if (req.session.isAdmin) {
      senderType = 'admin';
      role = 'admin';
    }

    // Сохраняем сообщение через encryptedDb
    const userMessage = await encryptedDb.saveData('messages', {
      conversation_id: conversationId,
      user_id: recipientId, // user_id контакта
      content: messageContent,
      sender_type: senderType,
      role: role,
      channel: 'web',
      attachment_filename: attachmentFilename,
      attachment_mimetype: attachmentMimetype,
      attachment_size: attachmentSize,
      attachment_data: attachmentData
    });
    
    // Проверяем, что сообщение было сохранено
    if (!userMessage) {
      logger.warn('Message not saved - all content was empty');
      return res.status(400).json({ error: 'Message content cannot be empty' });
    }
    
    logger.info('User message saved', { messageId: userMessage.id, conversationId });

    if (await isUserBlocked(userId)) {
      logger.info(`[Chat] Пользователь ${userId} заблокирован — ответ ИИ не отправляется.`);
      return;
    }

    // --- Новая логика автоответа ИИ по RAG ---
    let aiMessage = null;
    let shouldGenerateAiReply = true;
    if (senderType === 'admin') {
      // Если админ пишет не себе, не отвечаем
      if (userId !== recipientId) {
        shouldGenerateAiReply = false;
      }
    }
    if (messageContent && shouldGenerateAiReply) { // Только для текстовых сообщений и если разрешено
      try {
        // Получаем настройки ассистента
        const aiSettings = await aiAssistantSettingsService.getSettings();
        let rules = null;
        if (aiSettings && aiSettings.rules_id) {
          rules = await aiAssistantRulesService.getRuleById(aiSettings.rules_id);
        }
        // --- RAG автоответ с поддержкой беседы ---
        // Пример работы:
        // 1. Пользователь: "Как подключить кошелек?"
        //    RAG: находит точный ответ → возвращает его
        // 2. Пользователь: "А какие документы нужны?"
        //    RAG: анализирует контекст предыдущего ответа → ищет информацию о документах
        // 3. Пользователь: "Сколько это займет времени?"
        //    RAG: использует полный контекст беседы → дает уточненный ответ
        let ragTableId = null;
        if (aiSettings && aiSettings.selected_rag_tables) {
          ragTableId = Array.isArray(aiSettings.selected_rag_tables)
            ? aiSettings.selected_rag_tables[0]
            : aiSettings.selected_rag_tables;
        }
        let ragResult = null;
        if (ragTableId) {
          const { ragAnswerWithConversation, generateLLMResponse } = require('../services/ragService');
          const threshold = 200; // Увеличиваем threshold для более широкого поиска
          
          // Получаем историю беседы
          const historyResult = await db.getQuery()(
            'SELECT decrypt_text(sender_type_encrypted, $3) as sender_type, decrypt_text(content_encrypted, $3) as content FROM messages WHERE conversation_id = $1 AND id < $2 ORDER BY created_at DESC LIMIT 10',
            [conversationId, userMessage.id, encryptionKey]
          );
          const history = historyResult.rows.reverse().map(msg => ({
            role: msg.sender_type === 'user' ? 'user' : 'assistant',
            content: msg.content
          }));
          
          logger.info(`[RAG] Запуск поиска по RAG с беседой: tableId=${ragTableId}, вопрос="${messageContent}", threshold=${threshold}, historyLength=${history.length}`);
          const ragResult = await ragAnswerWithConversation({ 
            tableId: ragTableId, 
            userQuestion: messageContent, 
            threshold,
            history,
            conversationId
          });
          logger.info(`[RAG] Результат поиска по RAG:`, ragResult);
          logger.info(`[RAG] Score type: ${typeof ragResult.score}, value: ${ragResult.score}, threshold: ${threshold}, isFollowUp: ${ragResult.isFollowUp}`);
          if (ragResult && ragResult.answer && typeof ragResult.score === 'number' && Math.abs(ragResult.score) <= threshold) {
            logger.info(`[RAG] Найден confident-ответ (score=${ragResult.score}), отправляем ответ из базы.`);
            // Прямой ответ из RAG
            logger.info(`[RAG] Сохраняем AI сообщение с контентом: "${ragResult.answer}"`);
            aiMessage = await encryptedDb.saveData('messages', {
              conversation_id: conversationId,
              user_id: userId,
              content: ragResult.answer,
              sender_type: 'assistant',
              role: 'assistant',
              channel: 'web'
            });
            logger.info(`[RAG] AI сообщение сохранено:`, aiMessage);
            // Пушим новое сообщение через WebSocket
            broadcastChatMessage(aiMessage);
          } else if (ragResult) {
            logger.info(`[RAG] Нет confident-ответа (score=${ragResult.score}), переходим к генерации через LLM.`);
            // Генерация через LLM с подстановкой значений из RAG и историей беседы
            const llmResponse = await generateLLMResponse({
              userQuestion: messageContent,
              context: ragResult.context,
              answer: ragResult.answer,
              clarifyingAnswer: ragResult.clarifyingAnswer,
              objectionAnswer: ragResult.objectionAnswer,
              systemPrompt: aiSettings ? aiSettings.system_prompt : '',
              history: ragResult.conversationContext ? ragResult.conversationContext.conversationHistory : history,
              model: aiSettings ? aiSettings.model : undefined
            });
            if (llmResponse) {
              aiMessage = await encryptedDb.saveData('messages', {
                conversation_id: conversationId,
                user_id: userId,
                content: llmResponse,
                sender_type: 'assistant',
                role: 'assistant',
                channel: 'web'
              });
              // Пушим новое сообщение через WebSocket
              broadcastChatMessage(aiMessage);
            } else {
              logger.info(`[RAG] Нет ни одного результата, прошедшего порог (${threshold}).`);
            }
          }
        }
        // --- конец RAG автоответа ---
      } catch (aiError) {
        logger.error('Error getting or saving AI response (RAG):', aiError);
        // Не прерываем основной ответ, но логируем ошибку
      }
    }

    // Fallback: если AI не смог ответить, создаем fallback сообщение
    if (!aiMessage && messageContent && shouldGenerateAiReply) {
      try {
        logger.info('[Chat] Creating fallback AI response due to AI error');
        aiMessage = await encryptedDb.saveData('messages', {
          conversation_id: conversationId,
          user_id: userId,
          content: 'Извините, я не смог обработать ваш запрос. Пожалуйста, попробуйте позже.',
          sender_type: 'assistant',
          role: 'assistant',
          channel: 'web'
        });
        // Пушим новое сообщение через WebSocket
        broadcastChatMessage(aiMessage);
      } catch (fallbackError) {
        logger.error('Error creating fallback AI response:', fallbackError);
      }
    }

    // Форматируем ответ для фронтенда
    const formatMessageForFrontend = (msg) => {
      if (!msg) return null;
      console.log(`🔍 [formatMessageForFrontend] Форматируем сообщение:`, {
        id: msg.id,
        sender_type: msg.sender_type,
        role: msg.role,
        content: msg.content,
        // Добавляем все поля для диагностики
        allFields: Object.keys(msg),
        rawMsg: msg
      });
      const formatted = {
        id: msg.id,
        conversation_id: msg.conversation_id,
        user_id: msg.user_id,
        content: msg.content, // content уже расшифрован encryptedDb
        sender_type: msg.sender_type, // sender_type уже расшифрован encryptedDb
        role: msg.role, // role уже расшифрован encryptedDb
        channel: msg.channel, // channel уже расшифрован encryptedDb
        created_at: msg.created_at,
        attachments: null // Инициализируем как null
      };
      // Добавляем информацию о файле, если она есть
      if (msg.attachment_filename) {
        formatted.attachments = [{
          originalname: msg.attachment_filename, // attachment_filename уже расшифрован encryptedDb
          mimetype: msg.attachment_mimetype, // attachment_mimetype уже расшифрован encryptedDb
          size: msg.attachment_size,
          // НЕ передаем attachment_data обратно в ответе на POST
        }];
      }
      return formatted;
    };

    // Обновляем updated_at у диалога
    await db.getQuery()(
      'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
      [conversationId]
    );

    // Получаем расшифрованные данные для форматирования
    const decryptedUserMessage = userMessage ? await encryptedDb.getData('messages', { id: userMessage.id }, 1) : null;
    const decryptedAiMessage = aiMessage ? await encryptedDb.getData('messages', { id: aiMessage.id }, 1) : null;
    
    const response = {
      success: true,
      conversationId: conversationId,
      userMessage: formatMessageForFrontend(decryptedUserMessage ? decryptedUserMessage[0] : null),
      aiMessage: formatMessageForFrontend(decryptedAiMessage ? decryptedAiMessage[0] : null),
    };
    
    console.log(`📤 [Chat] Отправляем ответ на фронтенд:`, {
      userMessage: response.userMessage,
      aiMessage: response.aiMessage
    });
    
    // Отправляем WebSocket уведомления
    if (response.userMessage) {
      broadcastChatMessage(response.userMessage, userId);
    }
    if (response.aiMessage) {
      broadcastChatMessage(response.aiMessage, userId);
    }
    broadcastConversationUpdate(conversationId, userId);
    
    res.json(response);
  } catch (error) {
    logger.error('Error processing authenticated message:', error);
    res.status(500).json({ success: false, error: 'Ошибка обработки сообщения' });
  }
});

// Новый маршрут для обработки сообщений через очередь
router.post('/message-queued', requireAuth, upload.array('attachments'), async (req, res) => {
  logger.info('Received /message-queued request');
  
  try {
    const userId = req.session.userId;
    const { message, language, conversationId: convIdFromRequest, type = 'chat' } = req.body;
    const files = req.files;
    const file = files && files.length > 0 ? files[0] : null;

    // Валидация
    if (!message && !file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Требуется текст сообщения или файл.' 
      });
    }

    if (message && file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Нельзя отправить текст и файл одновременно.' 
      });
    }

    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }

    let conversationId = convIdFromRequest;
    let conversation = null;

    // Найти или создать диалог
    if (conversationId) {
      let convResult;
      if (req.session.isAdmin) {
        convResult = await db.getQuery()(
          'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $2) as title FROM conversations WHERE id = $1',
          [conversationId, encryptionKey]
        );
      } else {
        convResult = await db.getQuery()(
          'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $3) as title FROM conversations WHERE id = $1 AND user_id = $2',
          [conversationId, userId, encryptionKey]
        );
      }
      if (convResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Диалог не найден или доступ запрещен' 
        });
      }
      conversation = convResult.rows[0];
    } else {
      // Ищем последний диалог пользователя
      const lastConvResult = await db.getQuery()(
        'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $2) as title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
        [userId, encryptionKey]
      );
      if (lastConvResult.rows.length > 0) {
        conversation = lastConvResult.rows[0];
        conversationId = conversation.id;
      } else {
        // Создаем новый диалог
        const title = message && message.trim()
          ? (message.trim().length > 50 ? `${message.trim().substring(0, 50)}...` : message.trim())
          : (file ? `Файл: ${file.originalname}` : 'Новый диалог');
        const newConvResult = await db.getQuery()(
          'INSERT INTO conversations (user_id, title_encrypted) VALUES ($1, encrypt_text($2, $3)) RETURNING *',
          [userId, title, encryptionKey]
        );
        conversation = newConvResult.rows[0];
        conversationId = conversation.id;
      }
    }

    // Сохраняем сообщение пользователя
    const messageContent = message && message.trim() ? message.trim() : null;
    const attachmentFilename = file ? file.originalname : null;
    const attachmentMimetype = file ? file.mimetype : null;
    const attachmentSize = file ? file.size : null;
    const attachmentData = file ? file.buffer : null;

    const recipientId = conversation.user_id;
    let senderType = 'user';
    let role = 'user';
    if (req.session.isAdmin) {
      senderType = 'admin';
      role = 'admin';
    }

    const userMessage = await encryptedDb.saveData('messages', {
      conversation_id: conversationId,
      user_id: recipientId,
      content: messageContent,
      sender_type: senderType,
      role: role,
      channel: 'web',
      attachment_filename: attachmentFilename,
      attachment_mimetype: attachmentMimetype,
      attachment_size: attachmentSize,
      attachment_data: attachmentData
    });

    // Проверяем, нужно ли генерировать AI ответ
    if (await isUserBlocked(userId)) {
      logger.info(`[Chat] Пользователь ${userId} заблокирован — ответ ИИ не отправляется.`);
      return res.json({ success: true, message: userMessage });
    }

    let shouldGenerateAiReply = true;
    if (senderType === 'admin' && userId !== recipientId) {
      shouldGenerateAiReply = false;
    }

    if (messageContent && shouldGenerateAiReply) {
      try {
        // Получаем историю сообщений
        const historyResult = await db.getQuery()(
          'SELECT decrypt_text(sender_type_encrypted, $3) as sender_type, decrypt_text(content_encrypted, $3) as content FROM messages WHERE conversation_id = $1 AND id < $2 ORDER BY created_at DESC LIMIT 10',
          [conversationId, userMessage.id, encryptionKey]
        );
        const history = historyResult.rows.reverse().map(msg => ({
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));

        // Получаем настройки AI
        const aiSettings = await aiAssistantSettingsService.getSettings();
        let rules = null;
        if (aiSettings && aiSettings.rules_id) {
          rules = await aiAssistantRulesService.getRuleById(aiSettings.rules_id);
        }

        // Добавляем задачу в очередь
        const taskData = {
          message: messageContent,
          history: history,
          systemPrompt: aiSettings ? aiSettings.system_prompt : '',
          rules: rules,
          type: type,
          userId: userId,
          userRole: req.session.isAdmin ? 'admin' : 'user',
          conversationId: conversationId,
          userMessageId: userMessage.id
        };

        const queueResult = await aiQueueService.addTask(taskData);

        res.json({
          success: true,
          message: userMessage,
          queueInfo: {
            taskId: queueResult.taskId,
            status: 'queued',
            estimatedWaitTime: aiQueueService.getStats().currentQueueSize * 30
          }
        });

      } catch (error) {
        logger.error('Error adding task to queue:', error);
        res.status(500).json({ 
          success: false, 
          error: 'Ошибка при добавлении задачи в очередь.' 
        });
      }
    } else {
      res.json({ success: true, message: userMessage });
    }

  } catch (error) {
    logger.error('Error processing queued message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Внутренняя ошибка сервера.' 
    });
  }
});

// Добавьте этот маршрут для проверки доступных моделей
router.get('/models', async (req, res) => {
  try {
    const models = await aiAssistant.getAvailableModels();

    res.json({
      success: true,
      models: models,
    });
  } catch (error) {
    console.error('Ошибка при получении списка моделей:', error);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Получение истории сообщений
router.get('/history', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  // Параметры пагинации
  const limit = parseInt(req.query.limit, 10) || 30;
  const offset = parseInt(req.query.offset, 10) || 0;
  // Флаг для запроса только количества
  const countOnly = req.query.count_only === 'true';
  // Опциональный ID диалога
  const conversationId = req.query.conversation_id;

  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  let encryptionKey = 'default-key';
  
  try {
    const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
  } catch (keyError) {
    console.error('Error reading encryption key:', keyError);
  }

  try {
    // Если нужен только подсчет
    if (countOnly) {
      let countQuery = 'SELECT COUNT(*) FROM messages WHERE user_id = $1';
      let countParams = [userId];
      if (conversationId) {
        countQuery += ' AND conversation_id = $2';
        countParams.push(conversationId);
      }
      const countResult = await db.getQuery()(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count, 10);
      return res.json({ success: true, count: totalCount });
    }

    // Загружаем сообщения через encryptedDb
    const whereConditions = { user_id: userId };
    if (conversationId) {
      whereConditions.conversation_id = conversationId;
    }

    // Изменяем логику: загружаем ПОСЛЕДНИЕ сообщения, а не с offset
    const messages = await encryptedDb.getData('messages', whereConditions, limit, 'created_at DESC', 0);
    // Переворачиваем массив для правильного порядка
    messages.reverse();

    // Обрабатываем результаты для фронтенда
    const formattedMessages = messages.map(msg => {
      const formatted = {
        id: msg.id,
        conversation_id: msg.conversation_id,
        user_id: msg.user_id,
        content: msg.content, // content уже расшифрован encryptedDb
        sender_type: msg.sender_type, // sender_type уже расшифрован encryptedDb
        role: msg.role, // role уже расшифрован encryptedDb
        channel: msg.channel, // channel уже расшифрован encryptedDb
        created_at: msg.created_at,
        attachments: null // Инициализируем
      };

      // Если есть данные файла, добавляем их в attachments
      if (msg.attachment_data) {
        formatted.attachments = [{
          originalname: msg.attachment_filename, // attachment_filename уже расшифрован encryptedDb
          mimetype: msg.attachment_mimetype, // attachment_mimetype уже расшифрован encryptedDb
          size: msg.attachment_size,
          // Кодируем Buffer в Base64 для передачи на фронтенд
          data_base64: msg.attachment_data.toString('base64')
        }];
      }

      return formatted;
    });

    // Получаем общее количество сообщений для пагинации (если не запрашивали только количество)
    let totalCountQuery = 'SELECT COUNT(*) FROM messages WHERE user_id = $1';
    let totalCountParams = [userId];
    if (conversationId) {
      totalCountQuery += ' AND conversation_id = $2';
      totalCountParams.push(conversationId);
    }
    const totalCountResult = await db.getQuery()(totalCountQuery, totalCountParams);
    const totalMessages = parseInt(totalCountResult.rows[0].count, 10);

    logger.info(`Returning message history for user ${userId}`, { count: formattedMessages.length, offset, limit, total: totalMessages });

    res.json({
      success: true,
      messages: formattedMessages,
      offset: offset,
      limit: limit,
      total: totalMessages
    });

  } catch (error) {
    logger.error(`Error fetching message history for user ${userId}: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, error: 'Ошибка получения истории сообщений' });
  }
});

// --- Новый роут для связывания гостя после аутентификации ---
router.post('/process-guest', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { guestId } = req.body;
  if (!guestId) {
    return res.status(400).json({ success: false, error: 'guestId is required' });
  }
  try {
    const result = await module.exports.processGuestMessages(userId, guestId);
    if (result && result.conversationId) {
      return res.json({ success: true, conversationId: result.conversationId });
    } else {
      return res.json({ success: false, error: result.error || 'No conversation created' });
    }
  } catch (error) {
    logger.error('Error in /process-guest:', error);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/chat/ai-draft — генерация черновика ответа ИИ
router.post('/ai-draft', requireAuth, async (req, res) => {
  const userId = req.session.userId;
  const { conversationId, messages, language } = req.body;

  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  let encryptionKey = 'default-key';
  
  try {
    const keyPath = path.join(__dirname, '../ssl/keys/full_db_encryption.key');
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
  } catch (keyError) {
    console.error('Error reading encryption key:', keyError);
  }
  if (!conversationId || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, error: 'conversationId и messages обязательны' });
  }
  try {
    // Получаем настройки ассистента
    const aiSettings = await aiAssistantSettingsService.getSettings();
    let rules = null;
    if (aiSettings && aiSettings.rules_id) {
      rules = await aiAssistantRulesService.getRuleById(aiSettings.rules_id);
    }
    // Формируем prompt из выбранных сообщений
    const promptText = messages.map(m => m.content).join('\n\n');
    // Получаем последние 10 сообщений из диалога для истории
    const historyResult = await db.getQuery()(
      'SELECT decrypt_text(sender_type_encrypted, $2) as sender_type, decrypt_text(content_encrypted, $2) as content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
      [conversationId, encryptionKey]
    );
    const history = historyResult.rows.reverse().map(msg => ({
      role: msg.sender_type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    // --- RAG draft ---
    let ragTableId = null;
    if (aiSettings && aiSettings.selected_rag_tables) {
      ragTableId = Array.isArray(aiSettings.selected_rag_tables)
        ? aiSettings.selected_rag_tables[0]
        : aiSettings.selected_rag_tables;
    }
    let ragResult = null;
    if (ragTableId) {
      const { ragAnswer } = require('../services/ragService');
      logger.info(`[RAG] [DRAFT] Запуск поиска по RAG: tableId=${ragTableId}, draft prompt="${promptText}"`);
      ragResult = await ragAnswer({ tableId: ragTableId, userQuestion: promptText });
      logger.info(`[RAG] [DRAFT] Результат поиска по RAG:`, ragResult);
    }
    const { generateLLMResponse } = require('../services/ragService');
    const aiResponseContent = await generateLLMResponse({
      userQuestion: promptText,
      context: ragResult && ragResult.context ? ragResult.context : '',
      answer: ragResult && ragResult.answer ? ragResult.answer : '',
      systemPrompt: aiSettings ? aiSettings.system_prompt : '',
      history,
      model: aiSettings ? aiSettings.model : undefined,
      rules: rules ? rules.rules : null
    });
    res.json({ success: true, aiMessage: aiResponseContent });
  } catch (error) {
    logger.error('Error generating AI draft:', error);
    res.status(500).json({ success: false, error: 'Ошибка генерации черновика' });
  }
});

// Экспортируем маршрутизатор и функцию processGuestMessages отдельно
module.exports = router;
module.exports.processGuestMessages = processGuestMessages;
