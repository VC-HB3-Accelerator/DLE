const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiAssistant = require('../services/ai-assistant');
const db = require('../db');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const crypto = require('crypto');
const aiAssistantSettingsService = require('../services/aiAssistantSettingsService');
const aiAssistantRulesService = require('../services/aiAssistantRulesService');

// Настройка multer для обработки файлов в памяти
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Функция для обработки гостевых сообщений после аутентификации
async function processGuestMessages(userId, guestId) {
  try {
    logger.info(`Processing guest messages for user ${userId} with guest ID ${guestId}`);

    // Проверяем, обрабатывались ли уже эти сообщения
    const mappingCheck = await db.getQuery()(
      'SELECT processed FROM guest_user_mapping WHERE guest_id = $1',
      [guestId]
    );

    // Если сообщения уже обработаны, пропускаем
    if (mappingCheck.rows.length > 0 && mappingCheck.rows[0].processed) {
      logger.info(`Guest messages for guest ID ${guestId} were already processed.`);
      return { success: true, message: 'Guest messages already processed' };
    }

    // Проверяем наличие mapping записи и создаем если нет
    if (mappingCheck.rows.length === 0) {
      await db.getQuery()(
        'INSERT INTO guest_user_mapping (user_id, guest_id) VALUES ($1, $2) ON CONFLICT (guest_id) DO UPDATE SET user_id = $1',
        [userId, guestId]
      );
      logger.info(`Created mapping for guest ID ${guestId} to user ${userId}`);
    }

    // Получаем все гостевые сообщения со всеми новыми полями
    const guestMessagesResult = await db.getQuery()(
      `SELECT
         id, guest_id, content, language, is_ai, created_at,
         attachment_filename, attachment_mimetype, attachment_size, attachment_data
       FROM guest_messages WHERE guest_id = $1 ORDER BY created_at ASC`,
      [guestId]
    );

    if (guestMessagesResult.rows.length === 0) {
      logger.info(`No guest messages found for guest ID ${guestId}`);
      const checkResult = await db.getQuery()('SELECT 1 FROM guest_user_mapping WHERE guest_id = $1', [guestId]);
      if (checkResult.rows.length > 0) {
        await db.getQuery()('UPDATE guest_user_mapping SET processed = true WHERE guest_id = $1', [guestId]);
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
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [userId]
    );
    if (lastConvResult.rows.length > 0) {
      conversation = lastConvResult.rows[0];
    } else {
      // Если нет ни одного диалога, создаём новый
    const firstMessage = guestMessages[0];
    const title = firstMessage.content
      ? (firstMessage.content.length > 30 ? `${firstMessage.content.substring(0, 30)}...` : firstMessage.content)
      : (firstMessage.attachment_filename ? `Файл: ${firstMessage.attachment_filename}` : 'Новый диалог');
    const newConversationResult = await db.getQuery()(
      'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
      [userId, title]
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
            (conversation_id, content, sender_type, role, channel, created_at, user_id,
             attachment_filename, attachment_mimetype, attachment_size, attachment_data)
           VALUES
            ($1, $2, 'user', 'user', 'web', $3, $4,
             $5, $6, $7, $8)
           RETURNING *`,
          [
            conversation.id,
            guestMessage.content, // Текст (может быть NULL)
            guestMessage.created_at,
            userId,
            guestMessage.attachment_filename, // Метаданные и данные файла
            guestMessage.attachment_mimetype,
            guestMessage.attachment_size,
            guestMessage.attachment_data // BYTEA
          ]
        );
        const savedUserMessage = userMessageResult.rows[0];
        logger.info(`Saved user message with ID ${savedUserMessage.id}`);
        savedMessageIds.push(guestMessage.id);
        // --- Генерируем ответ ИИ на гостевое сообщение, если это текст ---
        if (guestMessage.content) {
          // Проверяем, что на это сообщение ещё нет ответа ассистента
          const aiReplyExists = await db.getQuery()(
            `SELECT 1 FROM messages WHERE conversation_id = $1 AND sender_type = 'assistant' AND created_at > $2 LIMIT 1`,
            [conversation.id, guestMessage.created_at]
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
                'SELECT sender_type, content FROM messages WHERE conversation_id = $1 AND created_at < $2 ORDER BY created_at DESC LIMIT 10',
                [conversation.id, guestMessage.created_at]
              );
              const history = historyResult.rows.reverse().map(msg => ({
                role: msg.sender_type === 'user' ? 'user' : 'assistant',
                content: msg.content
              }));
              // Язык guestMessage.language или auto
              const detectedLanguage = guestMessage.language === 'auto' ? aiAssistant.detectLanguage(guestMessage.content) : guestMessage.language;
              logger.info('Getting AI response for guest message:', guestMessage.content);
              const aiResponseContent = await aiAssistant.getResponse(
                guestMessage.content,
                detectedLanguage,
                history,
                aiSettings ? aiSettings.system_prompt : '',
                rules ? rules.rules : null
              );
              logger.info('AI response for guest message received' + (aiResponseContent ? '' : ' (empty)'), { conversationId: conversation.id });
          if (aiResponseContent) {
                await db.getQuery()(
                `INSERT INTO messages
                     (conversation_id, user_id, content, sender_type, role, channel)
                   VALUES ($1, $2, $3, 'assistant', 'assistant', 'web')`,
                  [conversation.id, userId, aiResponseContent]
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
      await db.getQuery()('UPDATE guest_user_mapping SET processed = true WHERE guest_id = $1', [
        guestId,
      ]);
      logger.info(`Marked guest mapping as processed for guest ID ${guestId}`);
    } else {
      logger.warn(`No guest messages were successfully processed, skipping deletion for guest ID ${guestId}`);
      // Если не было успешных, все равно пометим как обработанные, чтобы не пытаться снова
      await db.getQuery()('UPDATE guest_user_mapping SET processed = true WHERE guest_id = $1', [guestId]);
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
    const messageContent = message || ''; // Текст или ПУСТАЯ СТРОКА, если есть файл
    const attachmentFilename = file ? file.originalname : null;
    const attachmentMimetype = file ? file.mimetype : null;
    const attachmentSize = file ? file.size : null;
    const attachmentData = file ? file.buffer : null; // Сам буфер файла

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
        (guest_id, content, language, is_ai,
         attachment_filename, attachment_mimetype, attachment_size, attachment_data)
       VALUES ($1, $2, $3, false, $4, $5, $6, $7) RETURNING id`,
      [
        guestId,
        messageContent, // Текст сообщения или NULL
        language || 'auto',
        attachmentFilename,
        attachmentMimetype,
        attachmentSize,
        attachmentData // BYTEA данные файла или NULL
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
          'SELECT * FROM conversations WHERE id = $1',
          [conversationId]
        );
      } else {
        // Обычный пользователь — только в свой диалог
        convResult = await db.getQuery()(
          'SELECT * FROM conversations WHERE id = $1 AND user_id = $2',
          [conversationId, userId]
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
        'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
        [userId]
      );
      if (lastConvResult.rows.length > 0) {
        conversation = lastConvResult.rows[0];
        conversationId = conversation.id;
      } else {
        // Создаем новый диалог, если нет ни одного
      const title = message
        ? (message.length > 50 ? `${message.substring(0, 50)}...` : message)
        : (file ? `Файл: ${file.originalname}` : 'Новый диалог');
      const newConvResult = await db.getQuery()(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING *',
        [userId, title]
      );
      conversation = newConvResult.rows[0];
      conversationId = conversation.id;
      logger.info('Created new conversation', { conversationId, userId });
      }
    }

    // Подготавливаем данные для вставки сообщения пользователя
    const messageContent = message || ''; // Текст или ПУСТАЯ СТРОКА, если есть файл
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

    // Сохраняем сообщение
    const userMessageResult = await db.getQuery()(
      `INSERT INTO messages
         (conversation_id, user_id, content, sender_type, role, channel,
          attachment_filename, attachment_mimetype, attachment_size, attachment_data)
       VALUES ($1, $2, $3, $4, $5, 'web', $6, $7, $8, $9)
       RETURNING *`,
      [
        conversationId,
        recipientId, // user_id контакта
        messageContent,
        senderType,
        role,
        attachmentFilename,
        attachmentMimetype,
        attachmentSize,
        attachmentData
      ]
    );
    const userMessage = userMessageResult.rows[0];
    logger.info('User message saved', { messageId: userMessage.id, conversationId });

    // Получаем ответ от ИИ, только если это было текстовое сообщение
    let aiMessage = null;
    // --- Новая логика автоответа ИИ ---
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
        logger.info('AI System Prompt:', aiSettings ? aiSettings.system_prompt : 'not set');
        logger.info('AI Rules:', rules ? JSON.stringify(rules.rules) : 'not set');
        // Получаем последние 10 сообщений из диалога для истории (до текущего сообщения)
        const historyResult = await db.getQuery()(
          'SELECT sender_type, content FROM messages WHERE conversation_id = $1 AND id < $2 ORDER BY created_at DESC LIMIT 10',
          [conversationId, userMessage.id]
        );
        const history = historyResult.rows.reverse().map(msg => ({
          role: msg.sender_type === 'user' ? 'user' : 'assistant',
          content: msg.content
        }));
        const detectedLanguage = language === 'auto' ? aiAssistant.detectLanguage(messageContent) : language;
        logger.info('Getting AI response for:', messageContent);
        const aiResponseContent = await aiAssistant.getResponse(
          messageContent,
          detectedLanguage,
          history,
          aiSettings ? aiSettings.system_prompt : '',
          rules ? rules.rules : null
        );
        logger.info('AI response received' + (aiResponseContent ? '' : ' (empty)'), { conversationId });

        if (aiResponseContent) {
          const aiMessageResult = await db.getQuery()(
            `INSERT INTO messages
               (conversation_id, user_id, content, sender_type, role, channel)
             VALUES ($1, $2, $3, 'assistant', 'assistant', 'web')
             RETURNING *`,
            [conversationId, userId, aiResponseContent]
          );
          aiMessage = aiMessageResult.rows[0];
          logger.info('AI response saved', { messageId: aiMessage.id, conversationId });
        }
      } catch (aiError) {
        logger.error('Error getting or saving AI response:', aiError);
        // Не прерываем основной ответ, но логируем ошибку
      }
    }

    // Форматируем ответ для фронтенда
    const formatMessageForFrontend = (msg) => {
      if (!msg) return null;
      const formatted = {
        id: msg.id,
        conversation_id: msg.conversation_id,
        user_id: msg.user_id,
        content: msg.content,
        sender_type: msg.sender_type,
        role: msg.role,
        channel: msg.channel,
        created_at: msg.created_at,
        attachments: null // Инициализируем как null
      };
      // Добавляем информацию о файле, если она есть
      if (msg.attachment_filename) {
        formatted.attachments = [{
          originalname: msg.attachment_filename,
          mimetype: msg.attachment_mimetype,
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

    res.json({
      success: true,
      conversationId: conversationId,
      userMessage: formatMessageForFrontend(userMessage),
      aiMessage: formatMessageForFrontend(aiMessage),
    });
  } catch (error) {
    logger.error('Error processing authenticated message:', error);
    res.status(500).json({ success: false, error: 'Ошибка обработки сообщения' });
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

    // Формируем основной запрос
    let query = `
      SELECT
        id,
        conversation_id,
        user_id,
        content,
        sender_type,
        role,
        channel,
        created_at,
        attachment_filename,
        attachment_mimetype,
        attachment_size,
        attachment_data -- Выбираем и данные файла
      FROM messages
      WHERE user_id = $1
    `;
    const params = [userId];

    // Добавляем фильтр по диалогу, если нужно
    if (conversationId) {
      query += ' AND conversation_id = $2';
      params.push(conversationId);
    }

    // Добавляем сортировку и пагинацию
    query += ' ORDER BY created_at ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit);
    params.push(offset);

    logger.debug('Executing history query:', { query, params });

    const result = await db.getQuery()(query, params);

    // Обрабатываем результаты для фронтенда
    const messages = result.rows.map(msg => {
      const formatted = {
        id: msg.id,
        conversation_id: msg.conversation_id,
        user_id: msg.user_id,
        content: msg.content,
        sender_type: msg.sender_type,
        role: msg.role,
        channel: msg.channel,
        created_at: msg.created_at,
        attachments: null // Инициализируем
      };

      // Если есть данные файла, добавляем их в attachments
      if (msg.attachment_data) {
        formatted.attachments = [{
          originalname: msg.attachment_filename,
          mimetype: msg.attachment_mimetype,
          size: msg.attachment_size,
          // Кодируем Buffer в Base64 для передачи на фронтенд
          data_base64: msg.attachment_data.toString('base64')
        }];
      }
      // Не забываем удалить поле attachment_data из итогового объекта,
      // так как оно уже обработано и не нужно в сыром виде на фронте
      // (хотя map и так создает новый объект, это для ясности)
      delete formatted.attachment_data;

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

    logger.info(`Returning message history for user ${userId}`, { count: messages.length, offset, limit, total: totalMessages });

    res.json({
      success: true,
      messages: messages,
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
      'SELECT sender_type, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10',
      [conversationId]
    );
    const history = historyResult.rows.reverse().map(msg => ({
      role: msg.sender_type === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
    const detectedLanguage = language === 'auto' ? aiAssistant.detectLanguage(promptText) : language;
    const aiResponseContent = await aiAssistant.getResponse(
      promptText,
      detectedLanguage,
      history,
      aiSettings ? aiSettings.system_prompt : '',
      rules ? rules.rules : null
    );
    res.json({ success: true, aiMessage: aiResponseContent });
  } catch (error) {
    logger.error('Error generating AI draft:', error);
    res.status(500).json({ success: false, error: 'Ошибка генерации черновика' });
  }
});

// Экспортируем маршрутизатор и функцию processGuestMessages отдельно
module.exports = router;
module.exports.processGuestMessages = processGuestMessages;
