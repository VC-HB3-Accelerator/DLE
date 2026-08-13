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

const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiAssistant = require('../services/ai-assistant');
const db = require('../db');
const encryptedDb = require('../services/encryptedDatabaseService');
const logger = require('../utils/logger');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS, hasPermission } = require('../shared/permissions');
const aiAssistantSettingsService = require('../services/aiAssistantSettingsService');
const aiAssistantRulesService = require('../services/aiAssistantRulesService');
const botManager = require('../services/botManager');
const consentService = require('../services/consentService');
const { DOCUMENT_CONSENT_MAP } = consentService;
const {
  MEDIA_MAX_BYTES,
  chatUploadMiddleware,
  prepareChatAttachment,
  attachmentMetaFromRow,
  mediaTooLargePayload,
  byteaToBuffer
} = require('../utils/chatMedia');
const chatRoleCapabilitiesService = require('../services/chatRoleCapabilitiesService');
const { getUserRole } = require('../middleware/permissions');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: MEDIA_MAX_BYTES,
    files: 1
  }
});
const chatUpload = chatUploadMiddleware(upload.array('attachments', 1));

// Функция processGuestMessages заменена на UniversalGuestService.migrateToUser()

// Обработчик для гостевых сообщений (НОВАЯ ВЕРСИЯ)
router.post('/guest-message', chatUpload, async (req, res) => {
  try {
    // Frontend отправляет FormData, поэтому читаем из req.body
    const content = req.body.message;
    const guestId = req.body.guestId;
    const files = req.files || [];
    let assignTags = [];
    if (req.body.assign_tags) {
      try {
        const parsed = typeof req.body.assign_tags === 'string'
          ? JSON.parse(req.body.assign_tags)
          : req.body.assign_tags;
        if (Array.isArray(parsed)) assignTags = parsed.map((t) => String(t).trim()).filter(Boolean);
      } catch (_) {
        assignTags = String(req.body.assign_tags).split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    logger.info('[Chat] Получен guest-message запрос:', { 
      content: content?.substring(0, 50), 
      guestId, 
      hasFiles: files.length > 0,
      assignTags,
      bodyKeys: Object.keys(req.body)
    });

    // Проверяем, что есть либо текст, либо файлы
    if (!content && (!files || files.length === 0)) {
      logger.warn('[Chat] Гостевое сообщение без content и файлов:', req.body);
      return res.status(400).json({
        success: false,
        error: 'Текст сообщения или файлы обязательны'
      });
    }

    // Проверяем готовность системы
    if (!botManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Система ботов не готова. Попробуйте позже.'
      });
    }

    if (await chatRoleCapabilitiesService.rejectIfChatCapDenied(
      res,
      'guest',
      chatRoleCapabilitiesService.payloadFromUpload(req)
    )) {
      return;
    }

    const universalGuestService = require('../services/UniversalGuestService');
    const unifiedMessageProcessor = require('../services/unifiedMessageProcessor');

    // Создаем или используем существующий гостевой ID
    const webGuestId = guestId || universalGuestService.generateWebGuestId();
    const identifier = universalGuestService.createIdentifier('web', webGuestId);

    // Синхронизируем session.guestId с localStorage guestId — иначе /verify мигрирует не тот id
    if (req.session && webGuestId) {
      req.session.guestId = webGuestId;
      try {
        const sessionService = require('../services/session-service');
        await sessionService.saveSession(req.session, 'guest-message');
      } catch (sessionErr) {
        logger.warn('[Chat] Не удалось сохранить guestId в сессию:', sessionErr.message);
      }
    }

    let attachments = [];
    let messageContent = content;
    try {
      if (files && files.length > 0) {
        const prepared = prepareChatAttachment(files[0], req.body.attachment_kind);
        attachments = [prepared];
        if (!String(messageContent || '').trim()) {
          messageContent = prepared.placeholder;
        }
      }
    } catch (prepErr) {
      if (prepErr.code === 'MEDIA_TOO_LARGE') {
        return res.status(413).json(prepErr.payload || mediaTooLargePayload(files[0]?.originalname, files[0]?.size));
      }
      throw prepErr;
    }

    const messageData = {
      identifier: identifier,
      content: messageContent,
      channel: 'web',
      attachments,
      assign_tags: assignTags,
      metadata: attachments[0] ? { attachment_kind: attachments[0].kind } : {}
    };

    // Обработка через unified processor
    // Системное сообщение о согласиях будет добавлено к ответу ИИ внутри процессора
    const result = await unifiedMessageProcessor.processMessage(messageData);

    logger.info('[Chat] Результат обработки:', {
      success: result.success,
      hasAiResponse: !!result.aiResponse,
      aiResponseType: typeof result.aiResponse?.response
    });

    // Формируем ответ
    // Системное сообщение уже включено в ответ ИИ (если нужно)
    const response = {
      success: true,
      guestId: webGuestId,
      userMessage: result.userMessage || null,
      aiResponse: result.aiResponse ? {
        response: result.aiResponse.response,
        suggestWalletLogin: Boolean(result.aiResponse.suggestWalletLogin || result.suggestWalletLogin),
        attachments: result.aiResponse.attachments || null
      } : null
    };

    if (result.suggestWalletLogin || result.aiResponse?.suggestWalletLogin) {
      response.suggestWalletLogin = true;
    }

    // Добавляем информацию о согласиях из результата (если есть)
    if (result.consentRequired) {
      response.consentRequired = result.consentRequired;
      response.missingConsents = result.missingConsents;
      response.consentDocuments = result.consentDocuments;
      response.autoConsentOnReply = result.autoConsentOnReply;
    }

    res.json(response);

  } catch (error) {
    logger.error('[Chat] Ошибка обработки гостевого сообщения:', error);
    res.status(500).json({
      success: false,
      error: 'Внутренняя ошибка сервера'
    });
  }
});

// Старая логика удалена - используется guestService.js);

// Обработчик для сообщений аутентифицированных пользователей (НОВАЯ ВЕРСИЯ)
router.post('/message', requireAuth, chatUpload, async (req, res) => {
  try {
    // Frontend отправляет FormData, поэтому читаем из req.body
    const content = req.body.message;
    const { conversationId } = req.body;
    const recipientId = req.body.recipientId || req.body.toUserId;
    const userId = req.session.userId;
    const files = req.files || [];
    let assignTags = [];
    if (req.body.assign_tags) {
      try {
        const parsed = typeof req.body.assign_tags === 'string'
          ? JSON.parse(req.body.assign_tags)
          : req.body.assign_tags;
        if (Array.isArray(parsed)) assignTags = parsed.map((t) => String(t).trim()).filter(Boolean);
      } catch (_) {
        assignTags = String(req.body.assign_tags).split(',').map((t) => t.trim()).filter(Boolean);
      }
    }

    if (!String(content || '').trim() && (!files || files.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Текст сообщения или файлы обязательны',
        code: 'EMPTY_MESSAGE'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Пользователь не авторизован'
      });
    }

    // Проверяем готовность системы
    if (!botManager.isReady()) {
      return res.status(503).json({
        success: false,
        error: 'Система ботов не готова. Попробуйте позже.'
      });
    }

    const senderRole = req.session.userAccessLevel?.level || 'user';
    if (await chatRoleCapabilitiesService.rejectIfChatCapDenied(
      res,
      senderRole,
      chatRoleCapabilitiesService.payloadFromUpload(req)
    )) {
      return;
    }

    const encryptedDb = require('../services/encryptedDatabaseService');
    const unifiedMessageProcessor = require('../services/unifiedMessageProcessor');
    const identityService = require('../services/identity-service');

    // Получаем информацию о пользователе
    const users = await encryptedDb.getData('users', { id: userId }, 1);
    
    // ✨ Используем централизованную проверку прав
    const { canSendMessage } = require('/app/shared/permissions');
    const sessionUserId = req.session.userId;
    const targetUserId = userId;
    const userRole = req.session.userAccessLevel?.level || 'user';
    
    // Получаем роль получателя
    const recipientUser = users[0];
    const recipientRole = recipientUser.role || 'user';
    
    const permissionCheck = canSendMessage(userRole, recipientRole, sessionUserId, targetUserId);
    
    if (!permissionCheck.canSend) {
      logger.warn(`[Chat] Пользователь ${sessionUserId} (${userRole}) пытался писать в беседу ${targetUserId} (${recipientRole}) без прав: ${permissionCheck.errorMessage}`);
      return res.status(403).json({ 
        success: false, 
        error: permissionCheck.errorMessage || 'Недостаточно прав для отправки сообщений' 
      });
    }
    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Пользователь не найден'
      });
    }

    const user = users[0];

    // Находим wallet идентификатор пользователя
    const walletIdentity = await identityService.findIdentity(userId, 'wallet');
    
    if (!walletIdentity) {
      return res.status(403).json({
        success: false,
        error: 'Требуется подключение кошелька'
      });
    }

    // Создаем identifier для пользователя
    const identifier = `wallet:${walletIdentity.provider_id}`;

    let attachments = [];
    let messageContent = content;
    try {
      if (files && files.length > 0) {
        const prepared = prepareChatAttachment(files[0], req.body.attachment_kind);
        attachments = [prepared];
        if (!String(messageContent || '').trim()) {
          messageContent = prepared.placeholder;
        }
      }
    } catch (prepErr) {
      if (prepErr.code === 'MEDIA_TOO_LARGE') {
        return res.status(413).json(prepErr.payload || mediaTooLargePayload(files[0]?.originalname, files[0]?.size));
      }
      throw prepErr;
    }

    const messageData = {
      identifier: identifier,
      content: messageContent,
      channel: 'web',
      attachments,
      conversationId: conversationId || null,
      recipientId: recipientId || null,
      userId: userId,
      assign_tags: assignTags,
      metadata: attachments[0] ? { attachment_kind: attachments[0].kind } : {}
    };

    // Обработка через unified processor
    // Системное сообщение о согласиях будет добавлено к ответу ИИ внутри процессора
    const result = await unifiedMessageProcessor.processMessage(messageData);

    // Формируем ответ с информацией о согласиях
    const response = {
      success: true,
      userMessageId: result.userMessageId,
      conversationId: result.conversationId,
      userMessage: result.userMessage || null,
      aiResponse: result.aiResponse ? {
        response: result.aiResponse.response,
        attachments: result.aiResponse.attachments || null
      } : null,
      noAiResponse: result.noAiResponse
    };

    // Добавляем информацию о согласиях из результата (если есть)
    if (result.consentRequired) {
      response.consentRequired = result.consentRequired;
      response.missingConsents = result.missingConsents;
      response.consentDocuments = result.consentDocuments;
      response.autoConsentOnReply = result.autoConsentOnReply;
    }

    res.json(response);

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

router.get('/capabilities', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const role = await getUserRole(req);
    const caps = await chatRoleCapabilitiesService.getCapsForUi(role);
    res.json({
      success: true,
      data: {
        role: chatRoleCapabilitiesService.roleKeyForChatCaps(role),
        ...caps
      }
    });
  } catch (error) {
    logger.warn('[Chat] capabilities fallback defaults:', error.message);
    const caps = await chatRoleCapabilitiesService.getCapsForUi('guest');
    res.json({
      success: true,
      data: {
        role: chatRoleCapabilitiesService.roleKeyForChatCaps('guest'),
        ...caps
      }
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
  const limit = parseInt(req.query.limit, 10) || 30;
  const offset = parseInt(req.query.offset, 10) || 0;
  const countOnly = req.query.count_only === 'true';
  const conversationId = req.query.conversation_id;

  const encryptionUtils = require('../utils/encryptionUtils');
  const {
    buildPersonalHistoryWhere,
    buildDecryptSelectParams
  } = require('../utils/chatHistoryQuery');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    const { whereSql, params: filterParams } = buildPersonalHistoryWhere(
      { userId, conversationId },
      { tableAlias: '' }
    );

    if (countOnly) {
      const countResult = await db.getQuery()(
        `SELECT COUNT(*) FROM messages ${whereSql}`,
        filterParams
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);
      // count + total: фронт historically читает data.total
      return res.json({ success: true, count: totalCount, total: totalCount });
    }

    const { whereSql: listWhere, params: pageParams, limitSql, limit: safeLimit, offset: safeOffset } =
      buildDecryptSelectParams({
        userId,
        conversationId,
        encryptionKey,
        limit,
        offset
      });

    const result = await db.getQuery()(
      `SELECT m.id, m.user_id, m.sender_id, m.conversation_id,
              decrypt_text(m.sender_type_encrypted, $2) as sender_type,
              decrypt_text(m.content_encrypted, $2) as content,
              decrypt_text(m.channel_encrypted, $2) as channel,
              decrypt_text(m.role_encrypted, $2) as role,
              decrypt_text(m.direction_encrypted, $2) as direction,
              m.message_type, m.created_at,
              m.attachment_filename, m.attachment_mimetype, m.attachment_size,
              m.metadata
       FROM messages m
       ${listWhere}
       ORDER BY m.created_at DESC
       ${limitSql}`,
      pageParams
    );

    const messages = result.rows;
    messages.reverse();

    const formattedMessages = messages.map(msg => {
      const formatted = {
        id: msg.id,
        conversation_id: msg.conversation_id,
        user_id: msg.user_id,
        content: msg.content,
        sender_type: msg.sender_type,
        role: msg.role,
        channel: msg.channel,
        created_at: msg.created_at,
        attachments: null
      };

      if (msg.attachment_filename || msg.attachment_mimetype || Number(msg.attachment_size) > 0) {
        const meta = attachmentMetaFromRow(msg, { guest: false });
        formatted.attachments = meta ? [meta] : null;
      }

      return formatted;
    });

    const totalCountResult = await db.getQuery()(
      `SELECT COUNT(*) FROM messages ${whereSql}`,
      filterParams
    );
    const totalMessages = parseInt(totalCountResult.rows[0].count, 10);

    logger.info(`Returning message history for user ${userId}`, {
      count: formattedMessages.length,
      offset: safeOffset,
      limit: safeLimit,
      total: totalMessages
    });

    res.json({
      success: true,
      messages: formattedMessages,
      offset: safeOffset,
      limit: safeLimit,
      total: totalMessages,
      count: totalMessages
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
    const universalGuestService = require('../services/UniversalGuestService');
    const identifier = `web:${guestId}`; // Старые гости всегда из web
    const result = await universalGuestService.migrateToUser(identifier, userId);

    // Успех даже при 0 сообщений (гость без истории / уже мигрирован)
    return res.json({
      success: true,
      conversationId: result?.conversationId || null,
      migratedMessages: result?.migrated || 0,
      skipped: result?.skipped || 0
    });
  } catch (error) {
    logger.error('Error in /chat/process-guest:', error);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// POST /api/chat/ai-draft — генерация черновика ответа ИИ
// Генерация AI-черновика ответа (только для админов-редакторов)
router.post('/ai-draft', requireAuth, requirePermission(PERMISSIONS.GENERATE_AI_REPLIES), async (req, res) => {
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
    let rules = { byTags: [], global: null };
    if (aiSettings) {
      rules = await aiAssistantRulesService.resolveRulesForUser({
        rulesId: aiSettings.rules_id || null,
        tagIds: []
      });
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
      rules
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

async function streamMessageAttachment({ table, id, userFilterSql, userFilterParams, res, guest = false }) {
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  let sql;
  let params;
  if (table === 'messages') {
    sql = `SELECT id, attachment_filename, attachment_mimetype, attachment_size, attachment_data
           FROM messages WHERE id = $1 ${userFilterSql || ''}`;
    params = [id, ...(userFilterParams || [])];
  } else {
    sql = `SELECT id, attachment_size, attachment_data,
                   decrypt_text(identifier_encrypted, $2) as identifier,
                   decrypt_text(attachment_filename_encrypted, $2) as attachment_filename,
                   decrypt_text(attachment_mimetype_encrypted, $2) as attachment_mimetype
            FROM unified_guest_messages
            WHERE id = $1`;
    params = [id, encryptionKey];
  }
  const { rows } = await db.getQuery()(sql, params);
  const row = rows[0];
  if (!row || !row.attachment_data) {
    return res.status(404).json({ success: false, error: 'Вложение не найдено', code: 'ATTACHMENT_NOT_FOUND' });
  }
  if (guest) {
    const expected = userFilterParams?.[0];
    if (!expected || row.identifier !== expected) {
      return res.status(403).json({ success: false, error: 'Нет доступа', code: 'ATTACHMENT_FORBIDDEN' });
    }
  }
  const buf = byteaToBuffer(row.attachment_data);
  if (!buf || !buf.length) {
    return res.status(404).json({ success: false, error: 'Вложение не найдено', code: 'ATTACHMENT_NOT_FOUND' });
  }
  const filename = row.attachment_filename || 'attachment';
  const mime = row.attachment_mimetype || 'application/octet-stream';
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.setHeader('Content-Length', String(buf.length));
  return res.end(buf);
}

router.get('/attachment/:messageId', requireAuth, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const userId = req.session.userId;
    if (!messageId || !userId) {
      return res.status(400).json({ success: false, error: 'Некорректный запрос' });
    }
    await streamMessageAttachment({
      table: 'messages',
      id: messageId,
      userFilterSql: 'AND (user_id = $2 OR sender_id = $2)',
      userFilterParams: [userId],
      res
    });
  } catch (error) {
    logger.error('[Chat] attachment GET:', error);
    res.status(500).json({ success: false, error: 'Ошибка чтения вложения' });
  }
});

router.get('/guest-attachment/:messageId', async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    if (!messageId) {
      return res.status(400).json({ success: false, error: 'Некорректный запрос' });
    }
    const role = await getUserRole(req);
    if (req.session?.userId && hasPermission(role, PERMISSIONS.SEND_TO_USERS)) {
      await streamMessageAttachment({
        table: 'unified_guest_messages',
        id: messageId,
        res,
        guest: false
      });
      return;
    }
    const guestId = String(req.query.guestId || req.session?.guestId || '').trim();
    if (!guestId) {
      return res.status(400).json({ success: false, error: 'guestId обязателен', code: 'GUEST_ID_REQUIRED' });
    }
    const universalGuestService = require('../services/UniversalGuestService');
    const identifier = universalGuestService.createIdentifier('web', guestId);
    await streamMessageAttachment({
      table: 'unified_guest_messages',
      id: messageId,
      userFilterParams: [identifier],
      res,
      guest: true
    });
  } catch (error) {
    logger.error('[Chat] guest-attachment GET:', error);
    res.status(500).json({ success: false, error: 'Ошибка чтения вложения' });
  }
});

// Экспортируем маршрутизатор
module.exports = router;
