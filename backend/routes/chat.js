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
const db = require('../db');
const logger = require('../utils/logger');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const aiAssistantSettingsService = require('../services/aiAssistantSettingsService');
const aiAssistantRulesService = require('../services/aiAssistantRulesService');
const botManager = require('../services/botManager');

// Настройка multer для обработки файлов в памяти
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Функция processGuestMessages перенесена в services/guestMessageService.js

// Обработчик для гостевых сообщений
router.post('/guest-message', upload.array('attachments'), async (req, res) => {
  try {
    // Проверяем готовность системы
    if (!botManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Система ботов не готова. Попробуйте позже.'
      });
    }

    // Получаем WebBot
    const webBot = botManager.getBot('web');
    if (!webBot || !webBot.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Web Bot не инициализирован'
      });
    }

    // Обрабатываем сообщение через новую архитектуру
    await webBot.handleMessage(req, res, async (messageData) => {
      return await botManager.processMessage(messageData);
    });

  } catch (error) {
    logger.error('[Chat] Ошибка обработки гостевого сообщения:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Старая логика удалена - используется guestService.js);

// Обработчик для сообщений аутентифицированных пользователей
router.post('/message', requireAuth, upload.array('attachments'), async (req, res) => {
  try {
    // Проверяем готовность системы
    if (!botManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Система ботов не готова. Попробуйте позже.'
      });
    }

    // Получаем WebBot
    const webBot = botManager.getBot('web');
    if (!webBot || !webBot.isInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Web Bot не инициализирован'
      });
    }

    // Обрабатываем сообщение через новую архитектуру
    await webBot.handleMessage(req, res, async (messageData) => {
      return await botManager.processMessage(messageData);
    });

  } catch (error) {
    logger.error('[Chat] Ошибка обработки сообщения:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Старая логика полностью удалена - используется только BotManager
// Маршрут /message-queued удален - дублировал логику и не использовал централизованные сервисы

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
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    // Если нужен только подсчет
    if (countOnly) {
      let countQuery = 'SELECT COUNT(*) FROM messages WHERE user_id = $1 AND message_type = $2';
      let countParams = [userId, 'user_chat'];
      if (conversationId) {
        countQuery += ' AND conversation_id = $3';
        countParams.push(conversationId);
      }
      const countResult = await db.getQuery()(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count, 10);
      return res.json({ success: true, count: totalCount });
    }

    // Загружаем сообщения через encryptedDb
    const whereConditions = { 
      user_id: userId,
      message_type: 'user_chat' // Фильтруем только публичные сообщения
    };
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
    const guestMessageService = require('../services/guestMessageService');
    const result = await guestMessageService.processGuestMessages(userId, guestId);
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
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
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

// Перезапуск конкретного бота (только для админов)
router.post('/restart-bot', requireAdmin, async (req, res) => {
  try {
    const { botName } = req.body;

    if (!botName || !['web', 'telegram', 'email'].includes(botName)) {
      return res.status(400).json({
        success: false,
        error: 'Некорректное имя бота. Допустимые значения: web, telegram, email'
      });
    }

    logger.info(`[Chat] Запрос на перезапуск ${botName} бота`);

    const result = await botManager.restartBot(botName);
    
    if (result.success) {
      res.json({
        success: true,
        message: `${botName} бот успешно перезапущен`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('[Chat] Ошибка перезапуска бота:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка перезапуска бота'
    });
  }
});

// Экспортируем маршрутизатор
module.exports = router;
