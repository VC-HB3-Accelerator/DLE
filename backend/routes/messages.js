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

// GET /api/messages?userId=123
router.get('/', async (req, res) => {
  const userId = req.query.userId;
  const conversationId = req.query.conversationId;

  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    // Проверяем, это гостевой идентификатор (формат: channel:rawId)
    if (userId && userId.includes(':')) {
      const guestResult = await db.getQuery()(
        `SELECT 
          id,
          decrypt_text(identifier_encrypted, $2) as user_id,
          channel,
          decrypt_text(content_encrypted, $2) as content,
          content_type,
          attachments,
          media_metadata,
          is_ai,
          created_at
        FROM unified_guest_messages
        WHERE decrypt_text(identifier_encrypted, $2) = $1
        ORDER BY created_at ASC`,
        [userId, encryptionKey]
      );

      // Преобразуем формат для совместимости с фронтендом
      const messages = guestResult.rows.map(msg => ({
        id: msg.id,
        user_id: msg.user_id,
        sender_type: msg.is_ai ? 'bot' : 'user',
        content: msg.content,
        channel: msg.channel,
        role: 'guest',
        direction: msg.is_ai ? 'incoming' : 'outgoing',
        created_at: msg.created_at,
        attachment_filename: null,
        attachment_mimetype: null,
        attachment_size: null,
        attachment_data: null,
        // Дополнительные поля для медиа
        content_type: msg.content_type,
        attachments: msg.attachments,
        media_metadata: msg.media_metadata
      }));

      return res.json(messages);
    }

    // Стандартная логика для зарегистрированных пользователей
    let result;
    if (conversationId) {
      result = await db.getQuery()(
        `SELECT id, user_id, decrypt_text(sender_type_encrypted, $2) as sender_type, decrypt_text(content_encrypted, $2) as content, decrypt_text(channel_encrypted, $2) as channel, decrypt_text(role_encrypted, $2) as role, decrypt_text(direction_encrypted, $2) as direction, created_at, decrypt_text(attachment_filename_encrypted, $2) as attachment_filename, decrypt_text(attachment_mimetype_encrypted, $2) as attachment_mimetype, attachment_size, attachment_data
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId, encryptionKey]
      );
    } else if (userId) {
      result = await db.getQuery()(
        `SELECT id, user_id, decrypt_text(sender_type_encrypted, $2) as sender_type, decrypt_text(content_encrypted, $2) as content, decrypt_text(channel_encrypted, $2) as channel, decrypt_text(role_encrypted, $2) as role, decrypt_text(direction_encrypted, $2) as direction, created_at, decrypt_text(attachment_filename_encrypted, $2) as attachment_filename, decrypt_text(attachment_mimetype_encrypted, $2) as attachment_mimetype, attachment_size, attachment_data
         FROM messages
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [userId, encryptionKey]
      );
    } else {
      result = await db.getQuery()(
        `SELECT id, user_id, decrypt_text(sender_type_encrypted, $1) as sender_type, decrypt_text(content_encrypted, $1) as content, decrypt_text(channel_encrypted, $1) as channel, decrypt_text(role_encrypted, $1) as role, decrypt_text(direction_encrypted, $1) as direction, created_at, decrypt_text(attachment_filename_encrypted, $1) as attachment_filename, decrypt_text(attachment_mimetype_encrypted, $1) as attachment_mimetype, attachment_size, attachment_data
         FROM messages
         ORDER BY created_at ASC`,
        [encryptionKey]
      );
    }
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// POST /api/messages
router.post('/', async (req, res) => {
  const { user_id, sender_type, content, channel, role, direction, attachment_filename, attachment_mimetype, attachment_size, attachment_data } = req.body;

  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    // Проверка блокировки пользователя
    if (await isUserBlocked(user_id)) {
      return res.status(403).json({ error: 'Пользователь заблокирован. Сообщение не принимается.' });
    }
    // Проверка наличия идентификатора для выбранного канала
    if (channel === 'email') {
      const emailIdentity = await db.getQuery()(
        'SELECT decrypt_text(provider_id_encrypted, $3) as provider_id FROM user_identities WHERE user_id = $1 AND provider_encrypted = encrypt_text($2, $3) LIMIT 1',
        [user_id, 'email', encryptionKey]
      );
      if (emailIdentity.rows.length === 0) {
        return res.status(400).json({ error: 'У пользователя не указан email. Сообщение не отправлено.' });
      }
    }
    if (channel === 'telegram') {
      const tgIdentity = await db.getQuery()(
        'SELECT decrypt_text(provider_id_encrypted, $3) as provider_id FROM user_identities WHERE user_id = $1 AND provider_encrypted = encrypt_text($2, $3) LIMIT 1',
        [user_id, 'telegram', encryptionKey]
      );
      if (tgIdentity.rows.length === 0) {
        return res.status(400).json({ error: 'У пользователя не привязан Telegram. Сообщение не отправлено.' });
      }
    }
    if (channel === 'wallet' || channel === 'web3' || channel === 'web') {
      const walletIdentity = await db.getQuery()(
        'SELECT decrypt_text(provider_id_encrypted, $3) as provider_id FROM user_identities WHERE user_id = $1 AND provider_encrypted = encrypt_text($2, $3) LIMIT 1',
        [user_id, 'wallet', encryptionKey]
      );
      if (walletIdentity.rows.length === 0) {
        return res.status(400).json({ error: 'У пользователя не привязан кошелёк. Сообщение не отправлено.' });
      }
    }
    // 1. Проверяем, есть ли беседа для user_id
    let conversationResult = await db.getQuery()(
      'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $2) as title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [user_id, encryptionKey]
    );
    let conversation;
    if (conversationResult.rows.length === 0) {
      // 2. Если нет — создаём новую беседу
      const title = `Чат с пользователем ${user_id}`;
      const newConv = await db.getQuery()(
        'INSERT INTO conversations (user_id, title_encrypted, created_at, updated_at) VALUES ($1, encrypt_text($2, $3), NOW(), NOW()) RETURNING *',
        [user_id, title, encryptionKey]
      );
      conversation = newConv.rows[0];
    } else {
      conversation = conversationResult.rows[0];
    }
    // 3. Сохраняем сообщение с conversation_id
    const result = await db.getQuery()(
      `INSERT INTO messages (user_id, conversation_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, created_at, attachment_filename_encrypted, attachment_mimetype_encrypted, attachment_size, attachment_data)
       VALUES ($1,$2,encrypt_text($3,$12),encrypt_text($4,$12),encrypt_text($5,$12),encrypt_text($6,$12),encrypt_text($7,$12),NOW(),encrypt_text($8,$12),encrypt_text($9,$12),$10,$11) RETURNING *`,
      [user_id, conversation.id, sender_type, content, channel, role, direction, attachment_filename, attachment_mimetype, attachment_size, attachment_data, encryptionKey]
    );
    // 4. Если это исходящее сообщение для Telegram — отправляем через бота
    if (channel === 'telegram' && direction === 'out') {
      try {
        // console.log(`[messages.js] Попытка отправки сообщения в Telegram для user_id=${user_id}`);
        // Получаем Telegram ID пользователя
        const tgIdentity = await db.getQuery()(
          'SELECT decrypt_text(provider_id_encrypted, $3) as provider_id FROM user_identities WHERE user_id = $1 AND provider_encrypted = encrypt_text($2, $3) LIMIT 1',
          [user_id, 'telegram', encryptionKey]
        );
        // console.log(`[messages.js] Результат поиска Telegram ID:`, tgIdentity.rows);
        if (tgIdentity.rows.length > 0) {
          const telegramId = tgIdentity.rows[0].provider_id;
          // console.log(`[messages.js] Отправка сообщения в Telegram ID: ${telegramId}, текст: ${content}`);
          try {
            const telegramBot = botManager.getBot('telegram');
            if (telegramBot && telegramBot.isInitialized) {
              const bot = telegramBot.getBot();
              const sendResult = await bot.telegram.sendMessage(telegramId, content);
              // console.log(`[messages.js] Результат отправки в Telegram:`, sendResult);
            } else {
              logger.warn('[messages.js] Telegram Bot не инициализирован');
            }
          } catch (sendErr) {
            // console.error(`[messages.js] Ошибка при отправке в Telegram:`, sendErr);
          }
        } else {
          // console.warn(`[messages.js] Не найден Telegram ID для user_id=${user_id}`);
        }
      } catch (err) {
        // console.error('[messages.js] Ошибка отправки сообщения в Telegram:', err);
      }
    }
    // 5. Если это исходящее сообщение для Email — отправляем email
    if (channel === 'email' && direction === 'out') {
      try {
        // Получаем email пользователя
        const emailIdentity = await db.getQuery()(
          'SELECT decrypt_text(provider_id_encrypted, $3) as provider_id FROM user_identities WHERE user_id = $1 AND provider_encrypted = encrypt_text($2, $3) LIMIT 1',
          [user_id, 'email', encryptionKey]
        );
        if (emailIdentity.rows.length > 0) {
          const email = emailIdentity.rows[0].provider_id;
          const emailBot = botManager.getBot('email');
          if (emailBot && emailBot.isInitialized) {
            await emailBot.sendEmail(email, 'Новое сообщение', content);
          } else {
            logger.warn('[messages.js] Email Bot не инициализирован для отправки');
          }
        }
      } catch (err) {
        // console.error('[messages.js] Ошибка отправки email:', err);
      }
    }
    broadcastMessagesUpdate();
    res.json({ success: true, message: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// POST /api/messages/mark-read
router.post('/mark-read', async (req, res) => {
  try {
    // console.log('[DEBUG] /mark-read req.user:', req.user);
    // console.log('[DEBUG] /mark-read req.body:', req.body);
    const adminId = req.user && req.user.id;
    const { userId, lastReadAt } = req.body;
    if (!adminId) {
      // console.error('[ERROR] /mark-read: adminId (req.user.id) is missing');
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
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
    const adminId = req.user && req.user.id;
    if (!adminId) {
      // console.error('[ERROR] /read-status: adminId (req.user.id) is missing');
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
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

// GET /api/conversations?userId=123
router.get('/conversations', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const result = await db.getQuery()(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// POST /api/conversations - создать беседу для пользователя
router.post('/conversations', async (req, res) => {
  const { userId, title } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    const conversationTitle = title || `Чат с пользователем ${userId}`;
    const result = await db.getQuery()(
      'INSERT INTO conversations (user_id, title_encrypted, created_at, updated_at) VALUES ($1, encrypt_text($2, $3), NOW(), NOW()) RETURNING *',
      [userId, conversationTitle, encryptionKey]
    );
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// Массовая рассылка сообщения во все каналы пользователя
router.post('/broadcast', async (req, res) => {
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
    logger.warn(`[Messages] Пользователь ${req.session.userId} (роль: ${userRole}) пытался сделать broadcast без прав`);
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
      'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $2) as title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [user_id, encryptionKey]
    );
    let conversation;
    if (conversationResult.rows.length === 0) {
      const title = `Чат с пользователем ${user_id}`;
      const newConv = await db.getQuery()(
        'INSERT INTO conversations (user_id, title_encrypted, created_at, updated_at) VALUES ($1, encrypt_text($2, $3), NOW(), NOW()) RETURNING *',
        [user_id, title, encryptionKey]
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
            `INSERT INTO messages (user_id, conversation_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, created_at)
             VALUES ($1, $2, encrypt_text($3, $8), encrypt_text($4, $8), encrypt_text($5, $8), encrypt_text($6, $8), encrypt_text($7, $8), $9, NOW())`,
            [user_id, conversation.id, 'admin', content, 'email', 'user', 'out', encryptionKey, 'user_chat']
          );
          results.push({ channel: 'email', status: 'sent' });
          sent = true;
        } else {
          logger.warn('[messages.js] Email Bot не инициализирован');
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
            `INSERT INTO messages (user_id, conversation_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, created_at)
             VALUES ($1, $2, encrypt_text($3, $8), encrypt_text($4, $8), encrypt_text($5, $8), encrypt_text($6, $8), encrypt_text($7, $8), $9, NOW())`,
            [user_id, conversation.id, 'admin', content, 'telegram', 'user', 'out', encryptionKey, 'user_chat']
          );
          results.push({ channel: 'telegram', status: 'sent' });
          sent = true;
        } else {
          logger.warn('[messages.js] Telegram Bot не инициализирован');
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
        `INSERT INTO messages (user_id, conversation_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, created_at)
         VALUES ($1, $2, encrypt_text($3, $8), encrypt_text($4, $8), encrypt_text($5, $8), encrypt_text($6, $8), encrypt_text($7, $8), NOW())`,
        [user_id, conversation.id, 'admin', content, 'wallet', 'user', 'out', encryptionKey]
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

// DELETE /api/messages/history/:userId - удалить историю сообщений пользователя
router.delete('/history/:userId', async (req, res) => {
  const userId = req.params.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  
  try {
    // Проверяем права администратора
    if (!req.user || !req.user.isAdmin) {
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