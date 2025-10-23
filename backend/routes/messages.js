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
const db = require('../db');
const { broadcastMessagesUpdate } = require('../wsHub');
const botManager = require('../services/botManager');
const { isUserBlocked } = require('../utils/userUtils');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
// НОВАЯ СИСТЕМА РОЛЕЙ: используем shared/permissions.js
const { hasPermission, ROLES, PERMISSIONS } = require('/app/shared/permissions');

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

  try {
    // Публичные сообщения видны на главной странице пользователя
    const targetUserId = userId || currentUserId;
    
    
    // Если нужен только подсчет
    if (countOnly) {
      const countResult = await db.getQuery()(
        `SELECT COUNT(*) FROM messages WHERE message_type = 'public' 
           AND ((user_id = $1 AND sender_id = $2) OR (user_id = $2 AND sender_id = $1))`,
        [targetUserId, currentUserId]
      );
      const totalCount = parseInt(countResult.rows[0].count, 10);
      return res.json({ success: true, count: totalCount, total: totalCount });
    }
    
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
       WHERE m.message_type = 'public' 
         AND ((m.user_id = $1 AND m.sender_id = $5) OR (m.user_id = $5 AND m.sender_id = $1))
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [targetUserId, encryptionKey, limit, offset, currentUserId]
    );
    
    // Получаем общее количество для пагинации
    const countResult = await db.getQuery()(
      `SELECT COUNT(*) FROM messages WHERE message_type = 'public' 
         AND ((user_id = $1 AND sender_id = $2) OR (user_id = $2 AND sender_id = $1))`,
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

// Массовая рассылка сообщения во все каналы пользователя
// Массовая рассылка сообщений
router.post('/broadcast', requireAuth, requirePermission(PERMISSIONS.BROADCAST), async (req, res) => {
  const { user_id, content } = req.body;
  if (!user_id || !content) {
    return res.status(400).json({ error: 'user_id и content обязательны' });
  }

  // ✨ Проверка прав через adminLogicService (только editor может делать рассылку!)
  const encryptedDb = require('../services/encryptedDatabaseService');
  const users = await encryptedDb.getData('users', { id: req.session.userId }, 1);
  const userRole = users && users.length > 0 ? users[0].role : 'user';
  
  const adminLogicService = require('../services/adminLogicService');
  const canBroadcast = adminLogicService.canPerformAdminAction({
    role: userRole,  // Передаем точную роль ('editor', 'readonly', 'user')
    action: 'broadcast_message'
  });

  if (!canBroadcast) {
    console.warn(`[Messages] Пользователь ${req.session.userId} (роль: ${userRole}) пытался сделать broadcast без прав`);
    return res.status(403).json({ 
      error: 'Только редакторы (editor) могут делать массовую рассылку' 
    });
  }

  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    // Получаем все идентификаторы пользователя
    const identitiesRes = await db.getQuery()(
      'SELECT decrypt_text(provider_encrypted, $2) as provider, decrypt_text(provider_id_encrypted, $2) as provider_id FROM user_identities WHERE user_id = $1',
      [user_id, encryptionKey]
    );
    const identities = identitiesRes.rows;
    // --- Найти или создать беседу (conversation) ---
    let conversationResult = await db.getQuery()(
      'SELECT id, user_id, created_at, updated_at, title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [user_id, encryptionKey]
    );
    let conversation;
    if (conversationResult.rows.length === 0) {
      const title = `Чат с пользователем ${user_id}`;
      const newConv = await db.getQuery()(
        'INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
        [user_id, title]
      );
      conversation = newConv.rows[0];
    } else {
      conversation = conversationResult.rows[0];
    }
    const results = [];
    let sent = false;
    // Email
    const email = identities.find(i => i.provider === 'email')?.provider_id;
    if (email) {
      try {
        const emailBot = botManager.getBot('email');
        if (emailBot && emailBot.isInitialized) {
          await emailBot.sendEmail(email, 'Новое сообщение', content);
          // Сохраняем в messages с conversation_id
          await db.getQuery()(
            `INSERT INTO messages (conversation_id, sender_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, user_id, role, direction, created_at)
             VALUES ($1, $2, encrypt_text($3, $12), encrypt_text($4, $12), encrypt_text($5, $12), encrypt_text($6, $12), encrypt_text($7, $12), $8, $9, $10, $11, NOW())`,
            [conversation.id, req.session.userId, 'editor', content, 'email', 'user', 'out', 'user_chat', user_id, 'user', 'out', encryptionKey]
          );
          results.push({ channel: 'email', status: 'sent' });
          sent = true;
        } else {
          console.warn('[messages.js] Email Bot не инициализирован');
          results.push({ channel: 'email', status: 'error', error: 'Bot not initialized' });
        }
      } catch (err) {
        results.push({ channel: 'email', status: 'error', error: err.message });
      }
    }
    // Telegram
    const telegram = identities.find(i => i.provider === 'telegram')?.provider_id;
    if (telegram) {
      try {
        const telegramBot = botManager.getBot('telegram');
        if (telegramBot && telegramBot.isInitialized) {
          const bot = telegramBot.getBot();
          await bot.telegram.sendMessage(telegram, content);
          await db.getQuery()(
            `INSERT INTO messages (conversation_id, sender_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, user_id, role, direction, created_at)
             VALUES ($1, $2, encrypt_text($3, $12), encrypt_text($4, $12), encrypt_text($5, $12), encrypt_text($6, $12), encrypt_text($7, $12), $8, $9, $10, $11, NOW())`,
            [conversation.id, req.session.userId, 'editor', content, 'telegram', 'user', 'out', 'user_chat', user_id, 'user', 'out', encryptionKey]
          );
          results.push({ channel: 'telegram', status: 'sent' });
          sent = true;
        } else {
          console.warn('[messages.js] Telegram Bot не инициализирован');
          results.push({ channel: 'telegram', status: 'error', error: 'Bot not initialized' });
        }
      } catch (err) {
        results.push({ channel: 'telegram', status: 'error', error: err.message });
      }
    }
    // Wallet/web3
    const wallet = identities.find(i => i.provider === 'wallet')?.provider_id;
    if (wallet) {
      // Здесь можно реализовать отправку через web3, если нужно
      await db.getQuery()(
        `INSERT INTO messages (conversation_id, sender_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, user_id, role, direction, created_at)
         VALUES ($1, $2, encrypt_text($3, $12), encrypt_text($4, $12), encrypt_text($5, $12), encrypt_text($6, $12), encrypt_text($7, $12), $8, $9, $10, $11, NOW())`,
        [conversation.id, req.session.userId, 'editor', content, 'wallet', 'user', 'out', 'user_chat', user_id, 'user', 'out', encryptionKey]
      );
      results.push({ channel: 'wallet', status: 'saved' });
      sent = true;
    }
    if (!sent) {
      return res.status(400).json({ error: 'У пользователя нет ни одного канала для рассылки.' });
    }
    res.json({ success: true, results });
  } catch (e) {
    res.status(500).json({ error: 'Broadcast error', details: e.message });
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
  
  // Определяем recipientId в зависимости от типа сообщения
  let recipientIdNum;
  if (messageType === 'private') {
    // Приватные сообщения всегда идут к редактору (ID = 1)
    recipientIdNum = 1;
  } else {
    // Конвертируем recipientId в число для публичных сообщений
    recipientIdNum = parseInt(recipientId);
    if (isNaN(recipientIdNum)) {
      return res.status(400).json({ error: 'recipientId должен быть числом' });
    }
  }
  
  try {
    const senderId = req.user.id;
    const senderRole = req.user.role || req.user.userAccessLevel?.level || 'user';
    
    console.log('[DEBUG] /messages/send: senderId:', senderId, 'senderRole:', senderRole);
    
    // Получаем информацию о получателе
    const recipientResult = await db.getQuery()(
      'SELECT id, role FROM users WHERE id = $1',
      [recipientIdNum]
    );
    
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Получатель не найден' });
    }
    
    const recipientRole = recipientResult.rows[0].role;
    console.log('[DEBUG] /messages/send: recipientId:', recipientIdNum, 'recipientRole:', recipientRole);
    
    // Используем централизованную проверку прав
    const { canSendMessage } = require('/app/shared/permissions');
    const permissionCheck = canSendMessage(senderRole, recipientRole, senderId, recipientIdNum);
    
    console.log('[DEBUG] /messages/send: canSend:', permissionCheck.canSend, 'senderRole:', senderRole, 'recipientRole:', recipientRole, 'error:', permissionCheck.errorMessage);
    
    if (!permissionCheck.canSend) {
      return res.status(403).json({ 
        error: permissionCheck.errorMessage || 'Недостаточно прав для отправки сообщения этому получателю' 
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
    const result = await unifiedMessageProcessor.processMessage({
      identifier: identifier,
      content: content,
      channel: 'web',
      attachments: [],
      conversationId: null, // unifiedMessageProcessor сам найдет/создаст беседу
      recipientId: recipientIdNum,
      userId: senderId,
      metadata: {
        messageType: messageType,
        markAsRead: markAsRead
      }
    });
    
    // Если нужно отметить как прочитанное
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
        // Не прерываем выполнение, если mark-read не удался
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
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC',
      [userId]
    );
    res.json({ success: true, conversations: result.rows });
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