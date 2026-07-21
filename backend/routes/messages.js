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
const db = require('../db');
const logger = require('../utils/logger');
const { broadcastMessagesUpdate } = require('../wsHub');
const botManager = require('../services/botManager');
const universalGuestService = require('../services/UniversalGuestService');
const { isUserBlocked } = require('../utils/userUtils');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
// НОВАЯ СИСТЕМА РОЛЕЙ: используем shared/permissions.js
const { hasPermission, ROLES, PERMISSIONS } = require('/app/shared/permissions');
const broadcastService = require('../services/broadcastService');
const broadcastQueueService = require('../services/broadcastQueueService');
const broadcastSendService = require('../services/broadcastSendService');
const broadcastAiAgentService = require('../services/broadcastAiAgentService');
const broadcastDraftService = require('../services/broadcastDraftService');
const emailTrackingService = require('../services/emailTrackingService');

const broadcastUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 }
});

async function saveBroadcastOutgoingMessage({
  conversationId,
  senderId,
  recipientUserId,
  content,
  channel,
  encryptionKey
}) {
  await db.getQuery()(
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
    )`,
    [
      conversationId,
      senderId,
      'editor',
      content,
      channel,
      'editor',
      'outgoing',
      'user_chat',
      recipientUserId,
      'user',
      'outgoing',
      encryptionKey
    ]
  );
}

async function getOrCreateConversation(recipientUserId) {
  const conversationResult = await db.getQuery()(
    'SELECT id, user_id, created_at, updated_at, title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
    [recipientUserId]
  );

  if (conversationResult.rows.length > 0) {
    return conversationResult.rows[0];
  }

  const title = `Чат с пользователем ${recipientUserId}`;
  const newConv = await db.getQuery()(
    'INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
    [recipientUserId, title]
  );
  return newConv.rows[0];
}

// GET /api/messages/public?userId=123 - получить публичные сообщения пользователя
router.get('/public', requireAuth, async (req, res) => {
  const userId = req.query.userId;
  const currentUserId = req.user.id;
  
  // Параметры пагинации
  const limit = parseInt(req.query.limit, 10) || 30;
  const offset = parseInt(req.query.offset, 10) || 0;
  const countOnly = req.query.count_only === 'true';

  // Получаем ключ шифрования
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  const parseMetadata = (rawMetadata) => {
    if (!rawMetadata) {
      return {};
    }

    if (typeof rawMetadata === 'object') {
      return rawMetadata;
    }

    try {
      return JSON.parse(rawMetadata);
    } catch (error) {
      logger.warn('[messages/public] Не удалось распарсить metadata гостевого сообщения:', error?.message);
      return {};
    }
  };

  try {
    // Публичные сообщения видны на главной странице пользователя
    const targetUserId = userId || currentUserId;
    const isGuestContact = typeof targetUserId === 'string' && targetUserId.startsWith('guest_');

    if (isGuestContact) {
      const guestId = parseInt(targetUserId.replace('guest_', ''), 10);

      if (Number.isNaN(guestId)) {
        return res.status(400).json({ error: 'Invalid guest ID format' });
      }

      const guestIdentifierResult = await db.getQuery()(
        `WITH decrypted_guest AS (
           SELECT 
             id,
             decrypt_text(identifier_encrypted, $2) AS guest_identifier,
             channel
           FROM unified_guest_messages
           WHERE user_id IS NULL
         )
         SELECT guest_identifier, channel
         FROM decrypted_guest
         GROUP BY guest_identifier, channel
         HAVING MIN(id) = $1
         LIMIT 1`,
        [guestId, encryptionKey]
      );

      if (guestIdentifierResult.rows.length === 0) {
        return res.json({
          success: true,
          messages: [],
          total: 0,
          limit,
          offset,
          hasMore: false
        });
      }

      const guestIdentifier = guestIdentifierResult.rows[0].guest_identifier;
      const guestChannel = guestIdentifierResult.rows[0].channel;

      if (countOnly) {
        const countResult = await db.getQuery()(
          `SELECT COUNT(*) 
             FROM unified_guest_messages 
             WHERE decrypt_text(identifier_encrypted, $2) = $1`,
          [guestIdentifier, encryptionKey]
        );
        const totalCount = parseInt(countResult.rows[0].count, 10);
        return res.json({ success: true, count: totalCount, total: totalCount });
      }

      const messagesResult = await db.getQuery()(
        `SELECT 
           id,
           decrypt_text(content_encrypted, $3) AS content,
           is_ai,
           metadata,
           channel,
           created_at,
           decrypt_text(attachment_filename_encrypted, $3) AS attachment_filename,
           decrypt_text(attachment_mimetype_encrypted, $3) AS attachment_mimetype,
           attachment_size
         FROM unified_guest_messages
         WHERE decrypt_text(identifier_encrypted, $3) = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $4`,
        [guestIdentifier, limit, encryptionKey, offset]
      );

      const countResult = await db.getQuery()(
        `SELECT COUNT(*) 
           FROM unified_guest_messages 
           WHERE decrypt_text(identifier_encrypted, $2) = $1`,
        [guestIdentifier, encryptionKey]
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);

      const mappedMessages = messagesResult.rows.map((row) => {
        const metadata = parseMetadata(row.metadata);
        const baseMessage = {
          id: row.id,
          user_id: targetUserId,
          sender_id: row.is_ai ? null : targetUserId,
          sender_type: row.is_ai ? 'assistant' : 'user',
          content: row.content,
          channel: row.channel || guestChannel,
          role: row.is_ai ? 'assistant' : 'user',
          direction: row.is_ai ? 'out' : 'in',
          created_at: row.created_at,
          message_type: 'public',
          is_ai: row.is_ai,
          metadata,
          last_read_at: null
        };

        if (row.attachment_filename || row.attachment_mimetype || row.attachment_size) {
          baseMessage.attachments = [
            {
              filename: row.attachment_filename,
              mimetype: row.attachment_mimetype,
              size: row.attachment_size
            }
          ];
        }

        if (metadata.consentRequired !== undefined) {
          baseMessage.consentRequired = metadata.consentRequired;
        }
        if (metadata.consentDocuments) {
          baseMessage.consentDocuments = metadata.consentDocuments;
        }
        if (metadata.autoConsentOnReply !== undefined) {
          baseMessage.autoConsentOnReply = metadata.autoConsentOnReply;
        }
        if (metadata.telegramBotUrl) {
          baseMessage.telegramBotUrl = metadata.telegramBotUrl;
        }
        if (metadata.supportEmail) {
          baseMessage.supportEmail = metadata.supportEmail;
        }

        return baseMessage;
      });

      const orderedMessages = mappedMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      return res.json({
        success: true,
        messages: orderedMessages,
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        guest: {
          identifier: guestIdentifier,
          channel: guestChannel
        }
      });
    }

    // Если нужен только подсчет
    if (countOnly) {
      const countResult = await db.getQuery()(
        `SELECT COUNT(*) FROM messages 
         WHERE (
           (message_type = 'public' AND ((user_id = $1 AND sender_id = $2) OR (user_id = $2 AND sender_id = $1)))
           OR (message_type = 'user_chat' AND user_id = $1)
         )`,
        [targetUserId, currentUserId]
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);
      return res.json({ success: true, count: totalCount, total: totalCount });
    }
    
    // Загружаем публичные сообщения между пользователями И личные сообщения с ИИ целевого пользователя
    const result = await db.getQuery()(
      `SELECT m.id, m.user_id, m.sender_id, decrypt_text(m.sender_type_encrypted, $2) as sender_type, 
              decrypt_text(m.content_encrypted, $2) as content, 
              decrypt_text(m.channel_encrypted, $2) as channel, 
              decrypt_text(m.role_encrypted, $2) as role, 
              decrypt_text(m.direction_encrypted, $2) as direction, 
              m.created_at, m.message_type,
              arm.last_read_at
       FROM messages m
       LEFT JOIN admin_read_messages arm ON arm.user_id = m.user_id AND arm.admin_id = $5
       WHERE (
         (m.message_type = 'public' AND ((m.user_id = $1 AND m.sender_id = $5) OR (m.user_id = $5 AND m.sender_id = $1)))
         OR (m.message_type = 'user_chat' AND m.user_id = $1)
       )
       ORDER BY m.created_at ASC
       LIMIT $3 OFFSET $4`,
      [targetUserId, encryptionKey, limit, offset, currentUserId]
    );
    
    // Получаем общее количество для пагинации
    const countResult = await db.getQuery()(
      `SELECT COUNT(*) FROM messages 
       WHERE (
         (message_type = 'public' AND ((user_id = $1 AND sender_id = $2) OR (user_id = $2 AND sender_id = $1)))
         OR (message_type = 'user_chat' AND user_id = $1)
       )`,
      [targetUserId, currentUserId]
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);
    
    res.json({
      success: true,
      messages: result.rows,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount
    });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// GET /api/messages/private - получить приватные сообщения текущего пользователя
router.get('/private', requireAuth, async (req, res) => {
  const currentUserId = req.user.id;
  
  // Параметры пагинации
  const limit = parseInt(req.query.limit, 10) || 30;
  const offset = parseInt(req.query.offset, 10) || 0;
  const countOnly = req.query.count_only === 'true';

  // Получаем ключ шифрования
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    // Если нужен только подсчет
    if (countOnly) {
      const countResult = await db.getQuery()(
        `SELECT COUNT(*) FROM messages WHERE user_id = $1 AND message_type = 'admin_chat'`,
        [currentUserId]
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);
      return res.json({ success: true, count: totalCount, total: totalCount });
    }
    
    // Приватные сообщения видны только в личных сообщениях
    const result = await db.getQuery()(
      `SELECT m.id, m.user_id, decrypt_text(m.sender_type_encrypted, $2) as sender_type, 
              decrypt_text(m.content_encrypted, $2) as content, 
              decrypt_text(m.channel_encrypted, $2) as channel, 
              decrypt_text(m.role_encrypted, $2) as role, 
              decrypt_text(m.direction_encrypted, $2) as direction, 
              m.created_at, m.message_type,
              arm.last_read_at
       FROM messages m
       LEFT JOIN admin_read_messages arm ON arm.user_id = m.user_id AND arm.admin_id = $5
       WHERE m.user_id = $1 AND m.message_type = 'admin_chat'
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [currentUserId, encryptionKey, limit, offset, currentUserId]
    );
    
    // Получаем общее количество для пагинации
      const countResult = await db.getQuery()(
        `SELECT COUNT(*) FROM messages WHERE user_id = $1 AND message_type = 'admin_chat'`,
        [currentUserId]
      );
    const totalCount = parseInt(countResult.rows[0].count, 10);
    
    res.json({
      success: true,
      messages: result.rows,
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount
    });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});



// УДАЛЕНО: GET /api/messages - УСТАРЕВШИЙ эндпоинт (используйте /api/messages/public или /api/messages/private)
// УДАЛЕНО: POST /api/messages - УСТАРЕВШИЙ эндпоинт (используйте /api/messages/send или /api/chat/message)

// POST /api/messages/mark-read
router.post('/mark-read', async (req, res) => {
  try {
    // console.log('[DEBUG] /mark-read req.user:', req.user);
    // console.log('[DEBUG] /mark-read req.body:', req.body);
    // НОВАЯ СИСТЕМА РОЛЕЙ: определяем adminId через новую систему
    let adminId = req.user?.id;
    
    // Если нет авторизованного пользователя, используем fallback
    if (!adminId) {
      const result = await db.query('SELECT id FROM users LIMIT 1');
      adminId = result.rows[0]?.id || 1;
    }
    
    const { userId, lastReadAt } = req.body;
    if (!userId || !lastReadAt) {
      // console.error('[ERROR] /mark-read: userId or lastReadAt missing');
      return res.status(400).json({ error: 'userId and lastReadAt required' });
    }
    await db.query(`
      INSERT INTO admin_read_messages (admin_id, user_id, last_read_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (admin_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `, [adminId, userId, lastReadAt]);
    res.json({ success: true });
  } catch (e) {
    // console.error('[ERROR] /mark-read:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/messages/read-status
router.get('/read-status', async (req, res) => {
  try {
    // console.log('[DEBUG] /read-status req.user:', req.user);
    // console.log('[DEBUG] /read-status req.session:', req.session);
    // console.log('[DEBUG] /read-status req.session.userId:', req.session && req.session.userId);
    // НОВАЯ СИСТЕМА РОЛЕЙ: определяем adminId через новую систему
    let adminId = req.user?.id;
    
    // Если нет авторизованного пользователя, используем fallback
    if (!adminId) {
      const result = await db.query('SELECT id FROM users LIMIT 1');
      adminId = result.rows[0]?.id || 1;
    }
    const result = await db.query('SELECT user_id, last_read_at FROM admin_read_messages WHERE admin_id = $1', [adminId]);
    // console.log('[DEBUG] /read-status SQL result:', result.rows);
    const map = {};
    for (const row of result.rows) {
      map[row.user_id] = row.last_read_at;
    }
    res.json(map);
  } catch (e) {
    // console.error('[ERROR] /read-status:', e);
    res.status(500).json({ error: e.message });
  }
});

// УДАЛЕНО: Дублирующиеся endpoint'ы перенесены ниже

function ensureBroadcastEditorAccess(req, res) {
  const adminLogicService = require('../services/adminLogicService');
  const editorRole = req.userRole || ROLES.USER;
  const canBroadcast = adminLogicService.canPerformAdminAction({
    role: editorRole,
    action: 'broadcast_message'
  });

  if (!canBroadcast) {
    return {
      allowed: false,
      response: res.status(403).json({
        error: 'Только редакторы (editor) могут делать массовую рассылку'
      })
    };
  }

  return { allowed: true };
}

router.get('/broadcast/recipients-summary', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const rawIds = String(req.query.ids || '')
    .split(',')
    .map(id => Number(id.trim()))
    .filter(id => Number.isInteger(id) && id > 0);
  const recipientIds = [...new Set(rawIds)];

  if (!recipientIds.length) {
    return res.status(400).json({ error: 'ids обязателен' });
  }

  try {
    const summary = await broadcastService.getRecipientsSummary(recipientIds);
    res.json({ success: true, summary });
  } catch (error) {
    logger.error('[Messages] Broadcast recipients summary error:', error);
    res.status(500).json({ error: 'Ошибка проверки получателей', details: error.message });
  }
});

router.get('/broadcast/ai-agent/settings', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  try {
    const settings = await broadcastAiAgentService.getSettings();
    const defaults = broadcastAiAgentService.getDefaults();
    res.json({ success: true, settings, defaults });
  } catch (error) {
    logger.error('[Messages] Broadcast AI agent settings get error:', error);
    res.status(500).json({ error: 'Ошибка получения настроек AI-агента', details: error.message });
  }
});

router.get('/broadcast/ai-agent/history', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const drafts = await broadcastDraftService.listRecentGeneratedDrafts({ limit });
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, drafts });
  } catch (error) {
    logger.error('[Messages] Broadcast AI agent history error:', error);
    res.status(500).json({ error: 'Ошибка получения истории генераций', details: error.message });
  }
});

router.put('/broadcast/ai-agent/settings', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  try {
    const actorId = req.user?.id || req.session?.userId || null;
    const settings = await broadcastAiAgentService.saveSettings(req.body || {}, actorId);
    const defaults = broadcastAiAgentService.getDefaults();
    res.json({ success: true, settings, defaults });
  } catch (error) {
    logger.error('[Messages] Broadcast AI agent settings save error:', error);
    res.status(400).json({ error: error.message || 'Ошибка сохранения настроек AI-агента' });
  }
});

router.get('/broadcast/ai-agent/models', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  try {
    const models = await broadcastAiAgentService.listAvailableModels();
    const provider = String(req.query?.provider || '').trim().toLowerCase();
    const filtered = provider
      ? models.filter((item) => String(item.provider || '').toLowerCase() === provider)
      : models;
    res.json({ success: true, models: filtered });
  } catch (error) {
    logger.error('[Messages] Broadcast AI agent models error:', error);
    res.status(500).json({ error: 'Ошибка получения моделей', details: error.message });
  }
});

router.post('/broadcast/ai-agent/preview', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const userId = Number(req.body?.userId);
  const subject = String(req.body?.subject || '').trim();
  const greeting = String(req.body?.greeting || '').trim();
  const body = String(req.body?.body || '').trim();
  const signature = String(req.body?.signature || '').trim();
  const legalFooter = String(req.body?.legal_footer || '').trim();

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'userId обязателен' });
  }
  if (!subject && !body && !greeting) {
    return res.status(400).json({ error: 'subject, greeting или body обязательны' });
  }

  try {
    const result = await broadcastAiAgentService.personalizeForRecipient({
      userId,
      subject,
      greeting,
      body,
      signature,
      legalFooter,
      fallbackOnError: false
    });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('[Messages] Broadcast AI agent preview error:', error);
    res.status(400).json({ error: error.message || 'Ошибка персонализации' });
  }
});

router.get('/broadcast/templates', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  try {
    const templates = await broadcastService.listTemplates();
    res.json({ success: true, templates });
  } catch (error) {
    logger.error('[Messages] Broadcast templates list error:', error);
    res.status(500).json({ error: 'Ошибка получения шаблонов', details: error.message });
  }
});

router.post('/broadcast/templates', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const senderId = req.user?.id || req.session?.userId;
  const name = String(req.body?.name || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  const greeting = String(req.body?.greeting || '').trim();
  const signature = String(req.body?.signature || '').trim();
  const legalFooter = String(req.body?.legal_footer || '').trim();

  if (!name) {
    return res.status(400).json({ error: 'name обязателен' });
  }

  if (!subject || !body) {
    return res.status(400).json({ error: 'subject и body обязательны' });
  }

  try {
    const template = await broadcastService.createTemplate({
      name,
      subject,
      body,
      greeting,
      signature,
      legalFooter,
      createdBy: senderId
    });
    res.status(201).json({ success: true, template });
  } catch (error) {
    logger.error('[Messages] Broadcast template create error:', error);
    res.status(500).json({ error: 'Ошибка сохранения шаблона', details: error.message });
  }
});

router.put('/broadcast/templates/:id', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const templateId = parseInt(req.params.id, 10);
  if (!templateId || Number.isNaN(templateId)) {
    return res.status(400).json({ error: 'Некорректный ID шаблона' });
  }

  const name = String(req.body?.name || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  const greeting = String(req.body?.greeting || '').trim();
  const signature = String(req.body?.signature || '').trim();
  const legalFooter = String(req.body?.legal_footer || '').trim();

  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'name, subject и body обязательны' });
  }

  try {
    const template = await broadcastService.updateTemplate(templateId, {
      name,
      subject,
      body,
      greeting,
      signature,
      legalFooter
    });
    if (!template) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    res.json({ success: true, template });
  } catch (error) {
    logger.error(`[Messages] Broadcast template ${templateId} update error:`, error);
    res.status(500).json({ error: 'Ошибка обновления шаблона', details: error.message });
  }
});

router.delete('/broadcast/templates/:id', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const templateId = parseInt(req.params.id, 10);
  if (!templateId || Number.isNaN(templateId)) {
    return res.status(400).json({ error: 'Некорректный ID шаблона' });
  }

  try {
    const deleted = await broadcastService.deleteTemplate(templateId);
    if (!deleted) {
      return res.status(404).json({ error: 'Шаблон не найден' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error(`[Messages] Broadcast template ${templateId} delete error:`, error);
    res.status(500).json({ error: 'Ошибка удаления шаблона', details: error.message });
  }
});

router.get('/broadcast/history', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const dateFrom = String(req.query.dateFrom || '').trim();
    const dateTo = String(req.query.dateTo || '').trim();
    const history = await broadcastService.getHistory({ limit, offset, dateFrom, dateTo });
    res.json({ success: true, ...history });
  } catch (error) {
    logger.error('[Messages] Broadcast history error:', error);
    res.status(500).json({ error: 'Ошибка получения истории рассылок', details: error.message });
  }
});

router.delete('/broadcast/campaigns', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignIds = Array.isArray(req.body?.ids) ? req.body.ids : [];

  if (!campaignIds.length) {
    return res.status(400).json({ error: 'ids обязателен' });
  }

  try {
    const result = await broadcastService.deleteCampaigns(campaignIds);
    if (!result.deleted) {
      return res.status(404).json({ error: 'Рассылки не найдены' });
    }

    res.json({ success: true, deleted: result.deleted });
  } catch (error) {
    logger.error('[Messages] Broadcast campaigns delete error:', error);
    res.status(500).json({ error: 'Ошибка удаления рассылок', details: error.message });
  }
});

router.get('/broadcast/analytics', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  try {
    const analytics = await broadcastService.getAnalytics();
    res.json({ success: true, analytics });
  } catch (error) {
    logger.error('[Messages] Broadcast analytics error:', error);
    res.status(500).json({ error: 'Ошибка получения аналитики рассылок', details: error.message });
  }
});

router.get('/broadcast/campaigns/:id', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const details = await broadcastService.getCampaignDetails(campaignId);
    if (!details) {
      return res.status(404).json({ error: 'Рассылка не найдена' });
    }

    res.json({ success: true, ...details });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} details error:`, error);
    res.status(500).json({ error: 'Ошибка получения деталей рассылки', details: error.message });
  }
});

router.post('/broadcast/campaigns', requireAuth, requirePermission(PERMISSIONS.BROADCAST), broadcastUpload.array('attachments'), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const senderId = req.user?.id || req.session?.userId;
  if (!senderId) {
    return res.status(401).json({ error: 'Не удалось определить отправителя' });
  }

  const recipientIds = broadcastService.parseRecipientIds(req.body?.recipient_ids);
  const subject = String(req.body?.subject || '').trim();
  const message = String(req.body?.message || '').trim();
  const greeting = String(req.body?.greeting || '').trim();
  const signature = String(req.body?.signature || '').trim();
  const legalFooter = String(req.body?.legal_footer || '').trim();
  const warmupMode = req.body?.warmup_mode === true || req.body?.warmup_mode === 'true';
  const delaySeconds = Number(req.body?.delay_seconds) || 0;
  const maxRecipients = Number(req.body?.max_recipients) || 0;
  const autoPrepare = req.body?.auto_prepare !== false && req.body?.auto_prepare !== 'false';
  const aiPersonalize = req.body?.ai_personalize === true || req.body?.ai_personalize === 'true';
  const scheduleDays = broadcastDraftService.normalizeScheduleDays(
    typeof req.body?.schedule_days === 'string'
      ? (() => { try { return JSON.parse(req.body.schedule_days); } catch { return []; } })()
      : req.body?.schedule_days
  );
  const scheduleHourStart = Number(req.body?.schedule_hour_start);
  const scheduleHourEnd = Number(req.body?.schedule_hour_end);
  const scheduleTimezone = String(req.body?.schedule_timezone || 'Europe/Moscow').trim();
  const attachments = req.files || [];

  if (!recipientIds.length) {
    return res.status(400).json({ error: 'recipient_ids обязателен' });
  }

  if (!message) {
    return res.status(400).json({ error: 'message обязателен' });
  }

  try {
    let campaign = await broadcastService.createCampaign({
      senderId,
      subject,
      message,
      greeting,
      signature,
      legalFooter,
      recipientIds,
      warmupMode,
      delaySeconds,
      maxRecipients,
      attachmentsCount: attachments.length,
      aiPersonalize,
      scheduleDays,
      scheduleHourStart,
      scheduleHourEnd,
      scheduleTimezone
    });

    if (attachments.length) {
      await broadcastService.saveCampaignAttachments(campaign.id, attachments);
    }

    let prepareResult = null;
    if (autoPrepare) {
      // Важно: prepare не держим в HTTP-запросе.
      // Иначе браузер/nginx рвут соединение (499), а Ollama продолжает работу впустую.
      const campaignId = campaign.id;
      const useAi = aiPersonalize;
      setImmediate(() => {
        broadcastDraftService.prepareCampaignDrafts({
          campaignId,
          useAi
        }).then((result) => {
          logger.info(
            `[Messages] Broadcast campaign ${campaignId} drafts prepared async: `
            + `${result.prepared}/${result.total}, errors=${result.errors?.length || 0}`
          );
        }).catch(async (error) => {
          logger.error(`[Messages] Broadcast campaign ${campaignId} async prepare failed:`, error);
          try {
            await broadcastService.interruptCampaign({
              campaignId,
              reason: error?.message || 'Ошибка подготовки черновиков'
            });
          } catch (interruptError) {
            logger.error(
              `[Messages] Failed to interrupt campaign ${campaignId} after prepare error:`,
              interruptError
            );
          }
        });
      });
      prepareResult = {
        async: true,
        prepared: 0,
        total: Number(campaign.planned_recipients || recipientIds.length) || 0,
        errors: []
      };
    }

    res.status(201).json({
      success: true,
      campaign,
      prepare: prepareResult
    });
  } catch (error) {
    logger.error('[Messages] Broadcast campaign create error:', error);
    res.status(500).json({ error: 'Ошибка создания рассылки', details: error.message });
  }
});

router.post('/broadcast/campaigns/:id/prepare', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  const useAi = req.body?.use_ai !== false && req.body?.use_ai !== 'false';
  const wait = req.body?.wait === true || req.body?.wait === 'true';

  try {
    if (!wait) {
      setImmediate(() => {
        broadcastDraftService.prepareCampaignDrafts({
          campaignId,
          useAi
        }).then((result) => {
          logger.info(
            `[Messages] Broadcast campaign ${campaignId} drafts prepared async: `
            + `${result.prepared}/${result.total}, errors=${result.errors?.length || 0}`
          );
        }).catch(async (error) => {
          logger.error(`[Messages] Broadcast campaign ${campaignId} async prepare failed:`, error);
          try {
            await broadcastService.interruptCampaign({
              campaignId,
              reason: error?.message || 'Ошибка подготовки черновиков'
            });
          } catch (interruptError) {
            logger.error(
              `[Messages] Failed to interrupt campaign ${campaignId} after prepare error:`,
              interruptError
            );
          }
        });
      });
      const campaign = await broadcastService.getCampaignById(campaignId);
      return res.json({
        success: true,
        async: true,
        prepare: { async: true },
        campaign
      });
    }

    const result = await broadcastDraftService.prepareCampaignDrafts({
      campaignId,
      useAi
    });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} prepare error:`, error);
    res.status(400).json({ error: error.message || 'Ошибка подготовки черновиков' });
  }
});

router.get('/broadcast/campaigns/:id/drafts', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const drafts = await broadcastDraftService.listDrafts(campaignId);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, drafts });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} drafts error:`, error);
    res.status(500).json({ error: 'Ошибка получения черновиков', details: error.message });
  }
});

router.get('/broadcast/campaigns/:id/drafts/:userId', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  if (!campaignId || Number.isNaN(campaignId) || !userId || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Некорректные параметры' });
  }

  try {
    const draft = await broadcastDraftService.getDraft({ campaignId, recipientUserId: userId });
    if (!draft) {
      return res.status(404).json({ error: 'Черновик не найден' });
    }
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, draft });
  } catch (error) {
    logger.error(`[Messages] Broadcast draft get error:`, error);
    res.status(500).json({ error: 'Ошибка получения черновика', details: error.message });
  }
});

router.put('/broadcast/campaigns/:id/drafts/:userId', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  const userId = parseInt(req.params.userId, 10);
  if (!campaignId || Number.isNaN(campaignId) || !userId || Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Некорректные параметры' });
  }

  try {
    const draft = await broadcastDraftService.updateDraftContent({
      campaignId,
      recipientUserId: userId,
      subject: req.body?.subject,
      body: req.body?.body
    });
    res.json({ success: true, draft });
  } catch (error) {
    logger.error(`[Messages] Broadcast draft update error:`, error);
    res.status(400).json({ error: error.message || 'Ошибка сохранения черновика' });
  }
});

router.get('/broadcast/campaigns/:id/status', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const status = await broadcastService.getCampaignProgress(campaignId);
    if (!status) {
      return res.status(404).json({ error: 'Рассылка не найдена' });
    }

    const events = await broadcastService.getCampaignEvents(campaignId, { limit: 20 });
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      ...status,
      events
    });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} status error:`, error);
    res.status(500).json({ error: 'Ошибка получения статуса рассылки', details: error.message });
  }
});

router.post('/broadcast/campaigns/:id/start', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  const actorId = req.user?.id || req.session?.userId;

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const campaign = await broadcastService.startCampaign({ campaignId, actorId });
    broadcastQueueService.enqueue(campaignId);
    res.json({ success: true, campaign });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} start error:`, error);
    res.status(400).json({ error: 'Не удалось запустить рассылку', details: error.message });
  }
});

router.post('/broadcast/campaigns/:id/pause', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  const actorId = req.user?.id || req.session?.userId;
  const reason = String(req.body?.reason || '').trim();

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const campaign = await broadcastService.pauseCampaign({ campaignId, actorId, reason });
    if (!campaign) {
      return res.status(400).json({ error: 'Рассылка не находится в процессе отправки' });
    }

    res.json({ success: true, campaign });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} pause error:`, error);
    res.status(500).json({ error: 'Ошибка паузы рассылки', details: error.message });
  }
});

router.post('/broadcast/campaigns/:id/resume', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  const actorId = req.user?.id || req.session?.userId;

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const campaign = await broadcastService.startCampaign({ campaignId, actorId });
    broadcastQueueService.enqueue(campaignId);
    res.json({ success: true, campaign });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} resume error:`, error);
    res.status(400).json({ error: 'Не удалось возобновить рассылку', details: error.message });
  }
});

router.post('/broadcast/campaigns/:id/interrupt', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  const actorId = req.user?.id || req.session?.userId;
  const reason = String(req.body?.reason || '').trim();

  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const campaign = await broadcastService.interruptCampaign({ campaignId, actorId, reason });
    if (!campaign) {
      return res.status(400).json({ error: 'Рассылку нельзя остановить в текущем статусе' });
    }

    res.json({ success: true, campaign });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} interrupt error:`, error);
    res.status(500).json({ error: 'Ошибка остановки рассылки', details: error.message });
  }
});

router.get('/broadcast/campaigns/:id/events', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const campaign = await broadcastService.getCampaignById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Рассылка не найдена' });
    }

    const events = await broadcastService.getCampaignEvents(campaignId, {
      limit: parseInt(req.query.limit, 10) || 50
    });
    res.json({ success: true, events });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} events error:`, error);
    res.status(500).json({ error: 'Ошибка получения событий рассылки', details: error.message });
  }
});

router.post('/broadcast/campaigns/:id/complete', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  if (!campaignId || Number.isNaN(campaignId)) {
    return res.status(400).json({ error: 'Некорректный ID рассылки' });
  }

  try {
    const existingCampaign = await broadcastService.getCampaignById(campaignId);
    if (!existingCampaign) {
      return res.status(404).json({ error: 'Рассылка не найдена' });
    }

    const campaign = await broadcastService.completeCampaign({
      campaignId,
      skippedCount: req.body?.skipped_count
    });

    res.json({ success: true, campaign });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} complete error:`, error);
    res.status(500).json({ error: 'Ошибка завершения рассылки', details: error.message });
  }
});

router.post('/broadcast/campaigns/:id/deliveries', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const access = ensureBroadcastEditorAccess(req, res);
  if (!access.allowed) {
    return;
  }

  const campaignId = parseInt(req.params.id, 10);
  const recipientUserId = parseInt(req.body?.recipient_user_id, 10);
  const errorMessage = String(req.body?.error_message || '').trim();

  if (!campaignId || Number.isNaN(campaignId) || !recipientUserId || Number.isNaN(recipientUserId)) {
    return res.status(400).json({ error: 'recipient_user_id обязателен' });
  }

  try {
    const existingCampaign = await broadcastService.getCampaignById(campaignId);
    if (!existingCampaign) {
      return res.status(404).json({ error: 'Рассылка не найдена' });
    }

    await broadcastService.recordDelivery({
      campaignId,
      recipientUserId,
      status: 'error',
      channelResults: req.body?.channel_results || [],
      errorMessage: errorMessage || 'Ошибка отправки'
    });

    res.json({ success: true });
  } catch (error) {
    logger.error(`[Messages] Broadcast campaign ${campaignId} delivery error:`, error);
    res.status(500).json({ error: 'Ошибка записи доставки', details: error.message });
  }
});

// Массовая рассылка сообщения во все каналы пользователя
router.post('/broadcast', requireAuth, requirePermission(PERMISSIONS.BROADCAST), broadcastUpload.array('attachments'), async (req, res) => {
  const { content } = req.body;
  const subject = String(req.body.subject || 'Новое сообщение').trim() || 'Новое сообщение';
  const recipientUserId = parseInt(req.body.user_id, 10);
  const campaignId = parseInt(req.body.campaign_id, 10);
  const senderId = req.user?.id || req.session?.userId;
  const attachments = (req.files || []).map(file => ({
    filename: file.originalname,
    content: file.buffer,
    contentType: file.mimetype
  }));

  if (!recipientUserId || Number.isNaN(recipientUserId) || !String(content || '').trim()) {
    return res.status(400).json({ error: 'user_id и content обязательны' });
  }

  const adminLogicService = require('../services/adminLogicService');
  const editorRole = req.userRole || ROLES.USER;
  const canBroadcast = adminLogicService.canPerformAdminAction({
    role: editorRole,
    action: 'broadcast_message'
  });

  if (!canBroadcast) {
    logger.warn(`[Messages] Пользователь ${senderId} (роль: ${editorRole}) пытался сделать broadcast без прав`);
    return res.status(403).json({
      error: 'Только редакторы (editor) могут делать массовую рассылку'
    });
  }

  if (!senderId) {
    return res.status(401).json({ error: 'Не удалось определить отправителя' });
  }

  const encryptionUtils = require('../utils/encryptionUtils');

  try {
    encryptionUtils.getEncryptionKey();
  } catch (keyError) {
    logger.error('[Messages] Broadcast: ключ шифрования недоступен:', keyError);
    return res.status(500).json({
      error: 'Ошибка рассылки',
      details: 'Ключ шифрования недоступен'
    });
  }

  try {
    if (campaignId && !Number.isNaN(campaignId)) {
      const campaign = await broadcastService.getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Рассылка не найдена' });
      }
      if (['completed', 'interrupted'].includes(campaign.status)) {
        return res.status(400).json({ error: 'Рассылка уже завершена' });
      }
    }

    const sendResult = await broadcastSendService.sendToRecipient({
      recipientUserId,
      senderId,
      subject,
      content,
      attachments,
      campaignId: Number.isNaN(campaignId) ? null : campaignId
    });

    if (!sendResult.success) {
      return res.status(sendResult.statusCode || 400).json({
        error: sendResult.error,
        results: sendResult.results || []
      });
    }

    res.json({ success: true, results: sendResult.results });
  } catch (e) {
    logger.error(`[messages.js] Broadcast error for user ${recipientUserId}:`, e);

    if (campaignId && !Number.isNaN(campaignId) && !res.headersSent) {
      try {
        await broadcastService.recordDelivery({
          campaignId,
          recipientUserId,
          status: 'error',
          channelResults: [],
          errorMessage: e.message || 'Ошибка рассылки'
        });
      } catch (recordError) {
        logger.error(`[messages.js] Broadcast delivery record error for user ${recipientUserId}:`, recordError);
      }
    }

    if (!res.headersSent) {
      res.status(500).json({ error: 'Ошибка рассылки', details: e.message });
    }
  }
});

// POST /api/messages/send - новый эндпоинт для отправки сообщений с проверкой ролей
router.post('/send', requireAuth, async (req, res) => {
  const { recipientId, content, messageType = 'public', markAsRead = false } = req.body;
  
  if (!recipientId || !content) {
    return res.status(400).json({ error: 'recipientId и content обязательны' });
  }
  
  if (!['public', 'private'].includes(messageType)) {
    return res.status(400).json({ error: 'messageType должен быть "public" или "private"' });
  }

  const senderId = req.user.id;
  const senderRole = req.user.role || req.user.userAccessLevel?.level || 'user';
  const isGuestRecipient = typeof recipientId === 'string' && recipientId.startsWith('guest_');

  try {
    if (isGuestRecipient) {
      if (!hasPermission(senderRole, PERMISSIONS.SEND_TO_USERS)) {
        return res.status(403).json({ error: 'Недостаточно прав для отправки сообщений гостям' });
      }

      if (messageType !== 'public') {
        return res.status(400).json({ error: 'Гостям можно отправлять только публичные сообщения' });
      }

      const guestInternalId = parseInt(recipientId.replace('guest_', ''), 10);
      if (Number.isNaN(guestInternalId)) {
        return res.status(400).json({ error: 'Некорректный формат гостевого идентификатора' });
      }

      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();

      const guestIdentifierResult = await db.getQuery()(
        `WITH decrypted_guest AS (
           SELECT 
             id,
             decrypt_text(identifier_encrypted, $2) AS guest_identifier,
             channel
           FROM unified_guest_messages
           WHERE user_id IS NULL
         )
         SELECT guest_identifier, channel
         FROM decrypted_guest
         GROUP BY guest_identifier, channel
         HAVING MIN(id) = $1
         LIMIT 1`,
        [guestInternalId, encryptionKey]
      );

      if (guestIdentifierResult.rows.length === 0) {
        return res.status(404).json({ error: 'Гостевой контакт не найден' });
      }

      const guestIdentifier = guestIdentifierResult.rows[0].guest_identifier;
      const guestChannel = guestIdentifierResult.rows[0].channel;
      const deliveryMeta = {
        sentBy: 'admin_panel',
        senderId,
        senderRole,
        originalRecipientId: recipientId,
        messageType
      };

      let deliveryStatus = { success: true };

      try {
        if (guestChannel === 'telegram') {
          const telegramBot = botManager.getBot('telegram');
          if (telegramBot && telegramBot.isInitialized) {
            await telegramBot.getBot().telegram.sendMessage(guestIdentifier, content);
          } else {
            logger.warn('[messages/send] Telegram Bot не инициализирован, сообщение сохранено только в истории');
            deliveryStatus = { success: false, error: 'Telegram bot inactive' };
          }
        } else if (guestChannel === 'email') {
          const emailBot = botManager.getBot('email');
          if (emailBot && emailBot.isInitialized) {
            await emailBot.sendEmail(guestIdentifier, 'Ответ от администратора', content);
          } else {
            logger.warn('[messages/send] Email Bot не инициализирован, сообщение сохранено только в истории');
            deliveryStatus = { success: false, error: 'Email bot inactive' };
          }
        } else {
          logger.info(`[messages/send] Гость ${guestIdentifier} имеет канал ${guestChannel}, внешняя доставка не требуется`);
        }
      } catch (deliveryError) {
        logger.error('[messages/send] Ошибка отправки гостю через внешний канал:', deliveryError);
        deliveryStatus = { success: false, error: deliveryError.message };
      }

      const saveResult = await universalGuestService.saveAiResponse({
        identifier: guestIdentifier,
        channel: guestChannel,
        content,
        metadata: deliveryMeta
      });

      broadcastMessagesUpdate();

      return res.json({
        success: true,
        message: {
          id: saveResult.messageId,
          user_id: recipientId,
          sender_id: null,
          sender_type: 'assistant',
          content,
          channel: guestChannel,
          role: 'assistant',
          direction: 'out',
          created_at: saveResult.created_at,
          message_type: 'public',
          metadata: deliveryMeta
        },
        delivery: deliveryStatus
      });
    }

    // Работа с зарегистрированными пользователями
    let recipientIdNum;
    if (messageType === 'private') {
      recipientIdNum = 1;
    } else {
      recipientIdNum = parseInt(recipientId, 10);
      if (Number.isNaN(recipientIdNum)) {
        return res.status(400).json({ error: 'recipientId должен быть числом' });
      }
    }

    console.log('[DEBUG] /messages/send: senderId:', senderId, 'senderRole:', senderRole);

    const recipientResult = await db.getQuery()(
      'SELECT id, role FROM users WHERE id = $1',
      [recipientIdNum]
    );

    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }

    const recipientRole = recipientResult.rows[0].role;
    console.log('[DEBUG] /messages/send: recipientId:', recipientIdNum, 'recipientRole:', recipientRole);

    const { canSendMessage } = require('/app/shared/permissions');
    const permissionCheck = canSendMessage(senderRole, recipientRole, senderId, recipientIdNum);

    console.log('[DEBUG] /messages/send: canSend:', permissionCheck.canSend, 'senderRole:', senderRole, 'recipientRole:', recipientRole, 'error:', permissionCheck.errorMessage);

    if (!permissionCheck.canSend) {
      return res.status(403).json({
        error: permissionCheck.errorMessage || 'Недостаточно прав для отправки сообщения этому получателю'
      });
    }

    const unifiedMessageProcessor = require('../services/unifiedMessageProcessor');
    const identityService = require('../services/identity-service');

    const walletIdentity = await identityService.findIdentity(senderId, 'wallet');
    if (!walletIdentity) {
      return res.status(403).json({
        error: 'Требуется подключение кошелька'
      });
    }

    const identifier = `wallet:${walletIdentity.provider_id}`;

    const result = await unifiedMessageProcessor.processMessage({
      identifier,
      content,
      channel: 'web',
      attachments: [],
      conversationId: null,
      recipientId: recipientIdNum,
      userId: senderId,
      metadata: {
        messageType,
        markAsRead
      }
    });

    // Отправляем сообщение через Telegram/Email, если у получателя есть эти идентификаторы
    try {
      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();
      const botManager = require('../services/botManager');
      const FRONTEND_URL = process.env.FRONTEND_URL || 'https://xn--80aqc0am6d.xn--p1ai';
      
      // Получаем все идентификаторы получателя
      const identitiesRes = await db.getQuery()(
        'SELECT decrypt_text(provider_encrypted, $2) as provider, decrypt_text(provider_id_encrypted, $2) as provider_id FROM user_identities WHERE user_id = $1',
        [recipientIdNum, encryptionKey]
      );
      const identities = identitiesRes.rows;
      
      // Функция для добавления параметров к ссылкам на страницы контента
      // Редактор копирует URL из адресной строки и отправляет его в чат
      // Функция находит все ссылки на /content/page/ или /public/page/ и добавляет параметры авторизации
      // Best practice: используем встроенный URL API для надежной обработки
      const addAuthParamsToLinks = (text, telegramId, email) => {
        if (!text) return text;
        
        const params = {};
        if (telegramId) {
          params.telegramId = telegramId;
        }
        if (email) {
          params.email = email;
        }
        
        if (Object.keys(params).length === 0) return text;
        
        // Вспомогательная функция для добавления параметров к URL
        const addParamsToUrl = (urlString, baseUrl = null) => {
          try {
            // Парсим URL (полный или относительный)
            const url = baseUrl ? new URL(urlString, baseUrl) : new URL(urlString);
            
            // Проверяем, является ли это страницей контента
            const pathname = url.pathname;
            if (!pathname.match(/^\/content\/page\/\d+$/) && !pathname.match(/^\/public\/page\/\d+$/)) {
              return urlString; // Не страница контента, возвращаем как есть
            }
            
            // Проверяем, не добавлены ли уже параметры авторизации
            if (url.searchParams.has('telegramId') || url.searchParams.has('email')) {
              return urlString; // Параметры уже есть
            }
            
            // Добавляем параметры
            Object.entries(params).forEach(([key, value]) => {
              url.searchParams.set(key, value);
            });
            
            return url.toString();
          } catch (error) {
            // Если URL некорректный, возвращаем как есть
            return urlString;
          }
        };
        
        // Обрабатываем HTML-ссылки <a href="...">
        text = text.replace(/<a\s+([^>]*?)href=["']([^"']*)["']([^>]*)>/gi, (match, beforeAttrs, url, afterAttrs) => {
          if (!url) return match;
          
          const newUrl = addParamsToUrl(url, FRONTEND_URL);
          if (newUrl === url) return match; // URL не изменился
          
          return `<a ${beforeAttrs || ''}href="${newUrl}"${afterAttrs || ''}>`;
        });
        
        // Обрабатываем обычные текстовые ссылки (URL из адресной строки браузера)
        // Ищем все варианты: полные URL и относительные пути
        // Используем два отдельных паттерна для надежности
        
        // Паттерн для полных URL: https://domain.com/content/page/38
        const fullUrlPattern = /https?:\/\/[^\s<>"']+?(?:\/content\/page\/\d+|\/public\/page\/\d+)[^\s<>"']*/gi;
        
        text = text.replace(fullUrlPattern, (match, offset) => {
          // Проверяем, не находимся ли мы внутри HTML-тега
          const beforeMatch = text.substring(0, offset);
          const lastOpenTag = beforeMatch.lastIndexOf('<a');
          const lastCloseTag = beforeMatch.lastIndexOf('</a>');
          
          if (lastOpenTag > lastCloseTag) {
            // Мы внутри открытого тега <a>, пропускаем
            return match;
          }
          
          // Обрабатываем URL
          const newUrl = addParamsToUrl(match);
          return newUrl === match ? match : newUrl;
        });
        
        // Паттерн для относительных путей: /content/page/38
        const relativePathPattern = /\/content\/page\/\d+[^\s<>"']*|\/public\/page\/\d+[^\s<>"']*/g;
        
        text = text.replace(relativePathPattern, (match, offset) => {
          // Пропускаем, если это уже полный URL (начинается с http)
          if (offset > 0 && text.substring(Math.max(0, offset - 7), offset).match(/https?:\/\//i)) {
            return match;
          }
          
          // Проверяем, не находимся ли мы внутри HTML-тега
          const beforeMatch = text.substring(0, offset);
          const lastOpenTag = beforeMatch.lastIndexOf('<a');
          const lastCloseTag = beforeMatch.lastIndexOf('</a>');
          
          if (lastOpenTag > lastCloseTag) {
            // Мы внутри открытого тега <a>, пропускаем
            return match;
          }
          
          // Обрабатываем относительный путь
          const newUrl = addParamsToUrl(match, FRONTEND_URL);
          return newUrl === match ? match : newUrl;
        });
        
        return text;
      };
      
      // Отправка через Telegram
      const telegramIdentity = identities.find(i => i.provider === 'telegram');
      if (telegramIdentity && telegramIdentity.provider_id) {
        try {
          const telegramBot = botManager.getBot('telegram');
          if (telegramBot && telegramBot.isInitialized) {
            // Добавляем параметры к ссылкам для автоматической авторизации
            const contentWithLinks = addAuthParamsToLinks(content, telegramIdentity.provider_id, null);
            await telegramBot.getBot().telegram.sendMessage(telegramIdentity.provider_id, contentWithLinks);
            logger.info(`[messages/send] Сообщение отправлено через Telegram пользователю ${recipientIdNum}`);
          } else {
            logger.warn('[messages/send] Telegram Bot не инициализирован, сообщение сохранено только в истории');
          }
        } catch (telegramError) {
          logger.error('[messages/send] Ошибка отправки через Telegram:', telegramError);
        }
      }
      
      // Отправка через Email
      const emailIdentity = identities.find(i => i.provider === 'email');
      if (emailIdentity && emailIdentity.provider_id) {
        try {
          const emailBot = botManager.getBot('email');
          if (emailBot && emailBot.isInitialized) {
            // Добавляем параметры к ссылкам для автоматической авторизации
            const contentWithLinks = addAuthParamsToLinks(content, null, emailIdentity.provider_id);
            
            // Проверяем, содержит ли контент HTML-теги
            const isHtml = /<[a-z][\s\S]*>/i.test(contentWithLinks);
            
            if (isHtml) {
              // Если контент содержит HTML, отправляем как HTML с текстовой версией
              // Создаем текстовую версию (удаляем HTML-теги для простоты)
              const textVersion = contentWithLinks.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
              await emailBot.sendEmailWithHtml(emailIdentity.provider_id, 'Новое сообщение', textVersion, contentWithLinks);
            } else {
              // Если контент текстовый, отправляем как текст
              await emailBot.sendEmail(emailIdentity.provider_id, 'Новое сообщение', contentWithLinks);
            }
            logger.info(`[messages/send] Сообщение отправлено через Email пользователю ${recipientIdNum}`);
          } else {
            logger.warn('[messages/send] Email Bot не инициализирован, сообщение сохранено только в истории');
          }
        } catch (emailError) {
          logger.error('[messages/send] Ошибка отправки через Email:', emailError);
        }
      }
    } catch (deliveryError) {
      // Не критично, если не удалось отправить через внешние каналы - сообщение уже сохранено в БД
      logger.warn('[messages/send] Ошибка отправки через внешние каналы (не критично):', deliveryError);
    }

    if (markAsRead) {
      try {
        const lastReadAt = new Date().toISOString();
        await db.getQuery()(
          `INSERT INTO admin_read_messages (admin_id, user_id, last_read_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (admin_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
          [senderId, recipientIdNum, lastReadAt]
        );
      } catch (markError) {
        console.warn('[WARNING] /send mark-read error:', markError);
      }
    }

    res.json({ success: true, message: result });
  } catch (e) {
    console.error('[ERROR] /send:', e);
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// POST /api/messages/private/send - отправка приватного сообщения
router.post('/private/send', requireAuth, async (req, res) => {
  const { recipientId, content } = req.body;
  const senderId = req.user.id;
  
  if (!recipientId || !content) {
    return res.status(400).json({ error: 'recipientId и content обязательны' });
  }
  
  try {
    const senderRole = req.user.role || req.user.userAccessLevel?.level || 'user';
    
    // Получаем информацию о получателе
    const recipientResult = await db.getQuery()(
      'SELECT id, role FROM users WHERE id = $1',
      [recipientId]
    );
    
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }
    
    const recipientRole = recipientResult.rows[0].role;
    
    // Используем централизованную проверку прав
    const { canSendMessage } = require('/app/shared/permissions');
    const permissionCheck = canSendMessage(senderRole, recipientRole, senderId, recipientId);
    
    if (!permissionCheck.canSend) {
      return res.status(403).json({ 
        error: permissionCheck.errorMessage || 'Недостаточно прав для отправки приватного сообщения' 
      });
    }
    
    // ✨ Используем unifiedMessageProcessor для унификации
    const unifiedMessageProcessor = require('../services/unifiedMessageProcessor');
    const identityService = require('../services/identity-service');
    
    // Получаем wallet идентификатор отправителя
    const walletIdentity = await identityService.findIdentity(senderId, 'wallet');
    if (!walletIdentity) {
      return res.status(403).json({
        error: 'Требуется подключение кошелька'
      });
    }
    
    const identifier = `wallet:${walletIdentity.provider_id}`;
    
    // Обрабатываем через unifiedMessageProcessor
    // Для приватных сообщений recipientId всегда = 1 (редактор)
    const result = await unifiedMessageProcessor.processMessage({
      identifier: identifier,
      content: content,
      channel: 'web',
      attachments: [],
      conversationId: null, // unifiedMessageProcessor сам найдет/создаст беседу
      recipientId: 1, // Приватные сообщения всегда к редактору
      userId: senderId,
      metadata: {}
    });
    
    res.json({ 
      success: true, 
      message: result
    });
    
  } catch (error) {
    console.error('[ERROR] /messages/private/send:', error);
    res.status(500).json({ error: 'DB error', details: error.message });
  }
});

// GET /api/messages/private/conversations - получить приватные чаты пользователя
router.get('/private/conversations', requireAuth, async (req, res) => {
  const currentUserId = req.user.id;
  console.log('[DEBUG] /messages/private/conversations currentUserId:', currentUserId);
  
  try {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    // Получаем приватные чаты где пользователь является участником
    const result = await db.getQuery()(
      `SELECT DISTINCT 
         c.id as conversation_id,
         c.user_id,
         c.title,
         c.updated_at,
         COUNT(m.id) as message_count
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       LEFT JOIN messages m ON c.id = m.conversation_id AND m.message_type = 'admin_chat'
       WHERE cp.user_id = $1 AND c.conversation_type = 'private'
       GROUP BY c.id, c.user_id, c.title, c.updated_at
       ORDER BY c.updated_at DESC`,
      [currentUserId]
    );
    
    console.log('[DEBUG] /messages/private/conversations result:', result.rows);
    
    res.json({
      success: true,
      conversations: result.rows
    });
    
  } catch (error) {
    console.error('[ERROR] /messages/private/conversations:', error);
    res.status(500).json({ error: 'DB error', details: error.message });
  }
});

// GET /api/messages/private/unread-count - получить количество непрочитанных приватных сообщений
router.get('/private/unread-count', requireAuth, async (req, res) => {
  const currentUserId = req.user.id;
  
  try {
    // Подсчитываем непрочитанные приватные сообщения для текущего пользователя
    const result = await db.getQuery()(
      `SELECT COUNT(*) as unread_count
       FROM messages m
       INNER JOIN conversations c ON m.conversation_id = c.id
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       WHERE cp.user_id = $1 
         AND c.conversation_type = 'private'
         AND m.message_type = 'admin_chat'
         AND m.user_id = $1  -- сообщения адресованные текущему пользователю
         AND m.sender_id != $1  -- исключаем собственные сообщения
         AND NOT EXISTS (
           SELECT 1 FROM admin_read_messages arm 
           WHERE arm.admin_id = $1 
             AND arm.user_id = $1
             AND arm.last_read_at >= m.created_at
         )`,
      [currentUserId]
    );
    
    const unreadCount = parseInt(result.rows[0].unread_count) || 0;
    
    res.json({
      success: true,
      unreadCount: unreadCount
    });
    
  } catch (error) {
    console.error('[ERROR] /messages/private/unread-count:', error);
    res.status(500).json({ error: 'DB error', details: error.message });
  }
});

// POST /api/messages/private/mark-read - отметить приватные сообщения как прочитанные
router.post('/private/mark-read', requireAuth, async (req, res) => {
  const { conversationId } = req.body;
  const currentUserId = req.user.id;
  
  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId обязателен' });
  }
  
  try {
    // Проверяем, что пользователь является участником этого чата
    const participantCheck = await db.getQuery()(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, currentUserId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    // Отмечаем сообщения как прочитанные
    await db.getQuery()(
      `INSERT INTO admin_read_messages (admin_id, user_id, last_read_at)
       VALUES ($1, $1, NOW())
       ON CONFLICT (admin_id, user_id)
       DO UPDATE SET last_read_at = NOW()`,
      [currentUserId]
    );
    
    // Отправляем обновление через WebSocket
    broadcastMessagesUpdate();
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('[ERROR] /messages/private/mark-read:', error);
    res.status(500).json({ error: 'DB error', details: error.message });
  }
});

// GET /api/messages/private/:conversationId - получить историю приватного чата
router.get('/private/:conversationId', requireAuth, async (req, res) => {
  const conversationId = req.params.conversationId;
  const currentUserId = req.user.id;
  
  try {
    // Проверяем, что пользователь является участником этого чата
    const participantCheck = await db.getQuery()(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, currentUserId]
    );
    
    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Доступ запрещен' });
    }
    
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    // Получаем историю сообщений
    const result = await db.getQuery()(
      `SELECT 
         m.id,
         m.sender_id,
         m.user_id,
         decrypt_text(m.sender_type_encrypted, $2) as sender_type,
         decrypt_text(m.content_encrypted, $2) as content,
         decrypt_text(m.channel_encrypted, $2) as channel,
         decrypt_text(m.role_encrypted, $2) as role,
         decrypt_text(m.direction_encrypted, $2) as direction,
         m.message_type,
         m.created_at
       FROM messages m
       WHERE m.conversation_id = $1 AND m.message_type = 'admin_chat'
       ORDER BY m.created_at ASC`,
      [conversationId, encryptionKey]
    );
    
    res.json({
      success: true,
      messages: result.rows
    });
    
  } catch (error) {
    console.error('[ERROR] /messages/private/:conversationId:', error);
    res.status(500).json({ error: 'DB error', details: error.message });
  }
});

// GET /api/messages/conversations?userId=123 - получить диалоги пользователя
router.get('/conversations', requireAuth, async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  
  try {
    const result = await db.getQuery()(
      `SELECT DISTINCT c.*
       FROM conversations c
       LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE c.user_id = $1 OR cp.user_id = $1
       ORDER BY c.updated_at DESC, c.created_at DESC`,
      [userId]
    );
    res.json({ success: true, conversations: result.rows });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// GET /api/messages/conversations/:conversationId/messages - сообщения беседы
router.get('/conversations/:conversationId/messages', requireAuth, async (req, res) => {
  const conversationId = req.params.conversationId;
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const offset = parseInt(req.query.offset, 10) || 0;

  if (!conversationId) {
    return res.status(400).json({ error: 'conversationId required' });
  }

  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    const countResult = await db.getQuery()(
      'SELECT COUNT(*) FROM messages WHERE conversation_id = $1',
      [conversationId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await db.getQuery()(
      `SELECT m.id, m.user_id, m.sender_id, m.conversation_id,
              decrypt_text(m.sender_type_encrypted, $2) as sender_type,
              decrypt_text(m.content_encrypted, $2) as content,
              decrypt_text(m.channel_encrypted, $2) as channel,
              decrypt_text(m.role_encrypted, $2) as role,
              decrypt_text(m.direction_encrypted, $2) as direction,
              m.message_type, m.created_at
       FROM messages m
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $3 OFFSET $4`,
      [conversationId, encryptionKey, limit, offset]
    );

    res.json({
      success: true,
      messages: result.rows,
      total,
      limit,
      offset
    });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// POST /api/messages/conversations - создать диалог для пользователя
router.post('/conversations', requireAuth, async (req, res) => {
  const { userId, title } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  
  try {
    const result = await db.getQuery()(
      `INSERT INTO conversations (user_id, title, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW()) RETURNING *`,
      [userId, title || 'Новый диалог']
    );
    res.json({ success: true, conversation: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// DELETE /api/messages/delete-history/:userId - удалить историю сообщений пользователя (новый API)
router.delete('/delete-history/:userId', requireAuth, requirePermission(PERMISSIONS.DELETE_MESSAGES), async (req, res) => {
  const userId = req.params.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  
  try {
    // Проверяем права администратора
    if (!req.user || !req.user.userAccessLevel?.hasAccess) {
      return res.status(403).json({ error: 'Only administrators can delete message history' });
    }
    
    // Удаляем все сообщения пользователя
    const result = await db.getQuery()(
      'DELETE FROM messages WHERE user_id = $1 RETURNING id',
      [userId]
    );
    
    res.json({ 
      success: true, 
      deletedCount: result.rows.length,
      message: `Deleted ${result.rows.length} messages for user ${userId}`
    });
  } catch (e) {
    console.error('[ERROR] /delete-history/:userId:', e);
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// DELETE /api/messages/history/:userId - удалить историю сообщений пользователя
// Удаление истории сообщений пользователя
router.delete('/history/:userId', requireAuth, requirePermission(PERMISSIONS.DELETE_MESSAGES), async (req, res) => {
  const userId = req.params.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  
  try {
    // Проверяем права администратора
    if (!req.user || !req.user.userAccessLevel?.hasAccess) {
      return res.status(403).json({ error: 'Only administrators can delete message history' });
    }
    
    // Удаляем все сообщения пользователя
    const result = await db.getQuery()(
      'DELETE FROM messages WHERE user_id = $1 RETURNING id',
      [userId]
    );
    
    // Удаляем хеши дедупликации для этого пользователя
    const dedupResult = await db.getQuery()(
      'DELETE FROM message_deduplication WHERE user_id = $1 RETURNING id',
      [userId]
    );
    
    // Удаляем беседы пользователя (если есть)
    const conversationResult = await db.getQuery()(
      'DELETE FROM conversations WHERE user_id = $1 RETURNING id',
      [userId]
    );
    
    console.log(`[messages.js] Deleted ${result.rowCount} messages, ${dedupResult.rowCount} deduplication hashes, and ${conversationResult.rowCount} conversations for user ${userId}`);
    
    // Отправляем обновление через WebSocket
    broadcastMessagesUpdate();
    
    res.json({ 
      success: true, 
      deletedMessages: result.rowCount,
      deletedConversations: conversationResult.rowCount
    });
  } catch (e) {
    console.error('[ERROR] /history/:userId:', e);
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

module.exports = router; 