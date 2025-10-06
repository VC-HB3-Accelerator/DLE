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
const telegramBot = require('../services/telegramBot');
const emailBot = new (require('../services/emailBot'))();
const { isUserBlocked } = require('../utils/userUtils');

// GET /api/messages?userId=123
router.get('/', async (req, res) => {
  const userId = req.query.userId;
  const conversationId = req.query.conversationId;

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
    let result;
    if (conversationId) {
      result = await db.getQuery()(
        `SELECT id, user_id, decrypt_text(sender_type_encrypted, $2) as sender_type, decrypt_text(content_encrypted, $2) as content, decrypt_text(channel_encrypted, $2) as channel, decrypt_text(role_encrypted, $2) as role, decrypt_text(direction_encrypted, $2) as direction, created_at, decrypt_text(attachment_filename_encrypted, $2) as attachment_filename, decrypt_text(attachment_mimetype_encrypted, $2) as attachment_mimetype, attachment_size, attachment_data, message_type
         FROM messages
         WHERE conversation_id = $1 AND message_type = 'user_chat'
         ORDER BY created_at ASC`,
        [conversationId, encryptionKey]
      );
    } else if (userId) {
      result = await db.getQuery()(
        `SELECT id, user_id, decrypt_text(sender_type_encrypted, $2) as sender_type, decrypt_text(content_encrypted, $2) as content, decrypt_text(channel_encrypted, $2) as channel, decrypt_text(role_encrypted, $2) as role, decrypt_text(direction_encrypted, $2) as direction, created_at, decrypt_text(attachment_filename_encrypted, $2) as attachment_filename, decrypt_text(attachment_mimetype_encrypted, $2) as attachment_mimetype, attachment_size, attachment_data, message_type
         FROM messages
         WHERE user_id = $1 AND message_type = 'user_chat'
         ORDER BY created_at ASC`,
        [userId, encryptionKey]
      );
    } else {
      result = await db.getQuery()(
        `SELECT id, user_id, decrypt_text(sender_type_encrypted, $1) as sender_type, decrypt_text(content_encrypted, $1) as content, decrypt_text(channel_encrypted, $1) as channel, decrypt_text(role_encrypted, $1) as role, decrypt_text(direction_encrypted, $1) as direction, created_at, decrypt_text(attachment_filename_encrypted, $1) as attachment_filename, decrypt_text(attachment_mimetype_encrypted, $1) as attachment_mimetype, attachment_size, attachment_data, message_type
         FROM messages
         WHERE message_type = 'user_chat'
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
  
  // Определяем тип сообщения
  const senderId = req.user && req.user.id;
  let messageType = 'user_chat'; // по умолчанию для публичных сообщений
  
  if (senderId) {
    // Проверяем, является ли отправитель админом
    const senderCheck = await db.getQuery()(
      'SELECT role FROM users WHERE id = $1',
      [senderId]
    );
    
    if (senderCheck.rows.length > 0 && (senderCheck.rows[0].role === 'editor' || senderCheck.rows[0].role === 'readonly')) {
      // Если отправитель админ, проверяем получателя
      const recipientCheck = await db.getQuery()(
        'SELECT role FROM users WHERE id = $1',
        [user_id]
      );
      
      // Если получатель тоже админ, то это приватное сообщение
      if (recipientCheck.rows.length > 0 && (recipientCheck.rows[0].role === 'editor' || recipientCheck.rows[0].role === 'readonly')) {
        messageType = 'admin_chat';
      } else {
        // Если получатель обычный пользователь, то это публичное сообщение
        messageType = 'user_chat';
      }
    }
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
    let conversation;
    
    if (messageType === 'admin_chat') {
      // Для админских сообщений ищем приватную беседу через conversation_participants
      let conversationResult = await db.getQuery()(`
        SELECT c.id 
        FROM conversations c
        INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
        INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
        WHERE c.conversation_type = 'admin_chat'
        LIMIT 1
      `, [senderId, user_id]);
      
      if (conversationResult.rows.length === 0) {
        // Создаем новую приватную беседу между админами
        const title = `Приватная беседа ${senderId} - ${user_id}`;
        const newConv = await db.getQuery()(
          'INSERT INTO conversations (user_id, title_encrypted, conversation_type, created_at, updated_at) VALUES ($1, encrypt_text($2, $3), $4, NOW(), NOW()) RETURNING *',
          [user_id, title, encryptionKey, 'admin_chat']
        );
        conversation = newConv.rows[0];
        
        // Добавляем участников в беседу
        await db.getQuery()(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
          [conversation.id, senderId, user_id]
        );
      } else {
        conversation = { id: conversationResult.rows[0].id };
      }
    } else {
      // Для обычных пользовательских сообщений используем старую логику с user_id
      let conversationResult = await db.getQuery()(
        'SELECT id, user_id, created_at, updated_at, decrypt_text(title_encrypted, $2) as title FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
        [user_id, encryptionKey]
      );
      
      if (conversationResult.rows.length === 0) {
        // Создаем новую беседу
        const title = `Чат с пользователем ${user_id}`;
        const newConv = await db.getQuery()(
          'INSERT INTO conversations (user_id, title_encrypted, conversation_type, created_at, updated_at) VALUES ($1, encrypt_text($2, $3), $4, NOW(), NOW()) RETURNING *',
          [user_id, title, encryptionKey, 'user_chat']
        );
        conversation = newConv.rows[0];
      } else {
        conversation = conversationResult.rows[0];
      }
    }
    // 3. Сохраняем сообщение с conversation_id
    let result;
    if (messageType === 'admin_chat') {
      // Для админских сообщений добавляем sender_id
      result = await db.getQuery()(
        `INSERT INTO messages (conversation_id, user_id, sender_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, created_at, attachment_filename_encrypted, attachment_mimetype_encrypted, attachment_size, attachment_data)
         VALUES ($1,$2,$3,encrypt_text($4,$13),encrypt_text($5,$13),encrypt_text($6,$13),encrypt_text($7,$13),encrypt_text($8,$13),$9,NOW(),encrypt_text($10,$13),encrypt_text($11,$13),$12,$14) RETURNING *`,
        [conversation.id, user_id, senderId, sender_type, content, channel, role, direction, messageType, attachment_filename, attachment_mimetype, attachment_size, attachment_data, encryptionKey]
      );
    } else {
      // Для обычных сообщений без sender_id
      result = await db.getQuery()(
        `INSERT INTO messages (user_id, conversation_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, created_at, attachment_filename_encrypted, attachment_mimetype_encrypted, attachment_size, attachment_data)
         VALUES ($1,$2,encrypt_text($3,$12),encrypt_text($4,$12),encrypt_text($5,$12),encrypt_text($6,$12),encrypt_text($7,$12),$13,NOW(),encrypt_text($8,$12),encrypt_text($9,$12),$10,$11) RETURNING *`,
        [user_id, conversation.id, sender_type, content, channel, role, direction, messageType, attachment_filename, attachment_mimetype, attachment_size, attachment_data, encryptionKey]
      );
    }
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
          const bot = await telegramBot.getBot();
          try {
            const sendResult = await bot.telegram.sendMessage(telegramId, content);
            // console.log(`[messages.js] Результат отправки в Telegram:`, sendResult);
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
          await emailBot.sendEmail(email, 'Новое сообщение', content);
        }
      } catch (err) {
        // console.error('[messages.js] Ошибка отправки email:', err);
      }
    }
    
    // Отправляем WebSocket уведомления
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
    const { userId, lastReadAt, messageType = 'user_chat' } = req.body;
    
    if (!adminId) {
      // console.error('[ERROR] /mark-read: adminId (req.user.id) is missing');
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
    if (!userId || !lastReadAt) {
      // console.error('[ERROR] /mark-read: userId or lastReadAt missing');
      return res.status(400).json({ error: 'userId and lastReadAt required' });
    }

    // Логика зависит от типа сообщения
    if (messageType === 'user_chat') {
      // Обновляем глобальный статус для всех админов
      await db.query(`
        INSERT INTO global_read_status (user_id, last_read_at, updated_by_admin_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET 
          last_read_at = EXCLUDED.last_read_at,
          updated_by_admin_id = EXCLUDED.updated_by_admin_id,
          updated_at = NOW()
      `, [userId, lastReadAt, adminId]);
    } else if (messageType === 'admin_chat') {
      // Обновляем персональный статус для админских сообщений
      await db.query(`
        INSERT INTO admin_read_messages (admin_id, user_id, last_read_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (admin_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
      `, [adminId, userId, lastReadAt]);
    } else {
      return res.status(400).json({ error: 'Invalid messageType. Must be "user_chat" or "admin_chat"' });
    }

    res.json({ success: true, messageType });
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
    const { messageType = 'user_chat' } = req.query;
    
    if (!adminId) {
      // console.error('[ERROR] /read-status: adminId (req.user.id) is missing');
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }

    let result;
    if (messageType === 'user_chat') {
      // Возвращаем глобальный статус для сообщений с пользователями
      result = await db.query('SELECT user_id, last_read_at FROM global_read_status');
    } else if (messageType === 'admin_chat') {
      // Возвращаем персональный статус для админских сообщений
      result = await db.query('SELECT user_id, last_read_at FROM admin_read_messages WHERE admin_id = $1', [adminId]);
    } else {
      return res.status(400).json({ error: 'Invalid messageType. Must be "user_chat" or "admin_chat"' });
    }

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
        await emailBot.sendEmail(email, 'Новое сообщение', content);
        // Сохраняем в messages с conversation_id
        await db.getQuery()(
          `INSERT INTO messages (user_id, conversation_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, created_at)
           VALUES ($1, $2, encrypt_text($3, $8), encrypt_text($4, $8), encrypt_text($5, $8), encrypt_text($6, $8), encrypt_text($7, $8), $9, NOW())`,
          [user_id, conversation.id, 'admin', content, 'email', 'user', 'out', 'user_chat', encryptionKey]
        );
        results.push({ channel: 'email', status: 'sent' });
        sent = true;
      } catch (err) {
        results.push({ channel: 'email', status: 'error', error: err.message });
      }
    }
    // Telegram
    const telegram = identities.find(i => i.provider === 'telegram')?.provider_id;
    if (telegram) {
      try {
        const bot = await telegramBot.getBot();
        await bot.telegram.sendMessage(telegram, content);
        await db.getQuery()(
          `INSERT INTO messages (user_id, conversation_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, created_at)
           VALUES ($1, $2, encrypt_text($3, $8), encrypt_text($4, $8), encrypt_text($5, $8), encrypt_text($6, $8), encrypt_text($7, $8), $9, NOW())`,
          [user_id, conversation.id, 'admin', content, 'telegram', 'user', 'out', 'user_chat', encryptionKey]
        );
        results.push({ channel: 'telegram', status: 'sent' });
        sent = true;
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
    
    // Удаляем беседы пользователя (если есть)
    const conversationResult = await db.getQuery()(
      'DELETE FROM conversations WHERE user_id = $1 RETURNING id',
      [userId]
    );
    
    console.log(`[messages.js] Deleted ${result.rowCount} messages and ${conversationResult.rowCount} conversations for user ${userId}`);
    
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

// POST /api/messages/admin/send - отправка сообщения админу
router.post('/admin/send', async (req, res) => {
  try {
    const adminId = req.user && req.user.id;
    const { recipientAdminId, content } = req.body;
    
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
    if (!recipientAdminId || !content) {
      return res.status(400).json({ error: 'recipientAdminId and content required' });
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

    // Ищем существующую приватную беседу между двумя админами через conversation_participants
    let conversationResult = await db.getQuery()(`
      SELECT c.id 
      FROM conversations c
      INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
      INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
      WHERE c.conversation_type = 'admin_chat'
      LIMIT 1
    `, [adminId, recipientAdminId]);
    
    let conversationId;
    if (conversationResult.rows.length === 0) {
      // Создаем новую приватную беседу между админами
      const title = `Приватная беседа ${adminId} - ${recipientAdminId}`;
      const newConv = await db.getQuery()(
        'INSERT INTO conversations (user_id, title_encrypted, conversation_type, created_at, updated_at) VALUES ($1, encrypt_text($2, $3), $4, NOW(), NOW()) RETURNING id',
        [recipientAdminId, title, encryptionKey, 'admin_chat']
      );
      conversationId = newConv.rows[0].id;
      
      // Добавляем участников в беседу
      await db.getQuery()(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [conversationId, adminId, recipientAdminId]
      );
      
      console.log(`[admin/send] Создана новая беседа ${conversationId} между ${adminId} и ${recipientAdminId}`);
    } else {
      conversationId = conversationResult.rows[0].id;
      console.log(`[admin/send] Найдена существующая беседа ${conversationId} между ${adminId} и ${recipientAdminId}`);
    }

    // Сохраняем сообщение с типом 'admin_chat'
    const result = await db.getQuery()(
      `INSERT INTO messages (conversation_id, user_id, sender_id, sender_type_encrypted, content_encrypted, channel_encrypted, role_encrypted, direction_encrypted, message_type, created_at)
       VALUES ($1, $2, $3, encrypt_text($4, $9), encrypt_text($5, $9), encrypt_text($6, $9), encrypt_text($7, $9), encrypt_text($8, $9), $10, NOW()) RETURNING id`,
      [conversationId, recipientAdminId, adminId, 'admin', content, 'web', 'admin', 'out', encryptionKey, 'admin_chat']
    );

    // Отправляем WebSocket уведомления
    broadcastMessagesUpdate();
    
    res.json({ 
      success: true, 
      messageId: result.rows[0].id,
      conversationId,
      messageType: 'admin_chat'
    });
  } catch (e) {
    console.error('[ERROR] /admin/send:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/messages/admin/conversations - получить личные чаты админа
router.get('/admin/conversations', async (req, res) => {
  try {
    const adminId = req.user && req.user.id;
    
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }

    // Получаем список админов, с которыми есть переписка
    const conversations = await db.query(`
      SELECT DISTINCT 
        CASE 
          WHEN sender_type = 'admin' AND user_id != $1 THEN user_id
          ELSE sender_id 
        END as admin_id,
        MAX(created_at) as last_message_at
      FROM messages 
      WHERE message_type = 'admin_chat' 
        AND (user_id = $1 OR sender_id = $1)
      GROUP BY admin_id
      ORDER BY last_message_at DESC
    `, [adminId]);

    res.json({ 
      success: true, 
      conversations: conversations.rows 
    });
  } catch (e) {
    console.error('[ERROR] /admin/conversations:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/messages/admin/contacts - получить админов для приватного чата
router.get('/admin/contacts', async (req, res) => {
  try {
    const adminId = req.user && req.user.id;
    
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
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

    // Получаем всех пользователей, с которыми есть приватные беседы через conversation_participants
    const adminContacts = await db.getQuery()(`
      SELECT DISTINCT
        other_user.id,
        COALESCE(
          decrypt_text(other_user.first_name_encrypted, $2), 
          decrypt_text(other_user.username_encrypted, $2),
          'Пользователь ' || other_user.id
        ) as name,
        'admin@system' as email,
        CASE 
          WHEN other_user.role = 'editor' THEN 'admin'
          WHEN other_user.role = 'readonly' THEN 'admin'
          ELSE 'user'
        END as contact_type,
        MAX(m.created_at) as last_message_at,
        COUNT(m.id) as message_count
      FROM conversations c
      INNER JOIN conversation_participants cp_current ON cp_current.conversation_id = c.id AND cp_current.user_id = $1
      INNER JOIN conversation_participants cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id != $1
      INNER JOIN users other_user ON other_user.id = cp_other.user_id
      LEFT JOIN messages m ON m.conversation_id = c.id AND m.message_type = 'admin_chat'
      WHERE c.conversation_type = 'admin_chat'
      GROUP BY 
        other_user.id,
        other_user.first_name_encrypted,
        other_user.username_encrypted,
        other_user.role
      ORDER BY MAX(m.created_at) DESC
    `, [adminId, encryptionKey]);

    res.json({ 
      success: true, 
      contacts: adminContacts.rows.map(contact => ({
        ...contact,
        created_at: contact.last_message_at, // Используем время последнего сообщения как время создания для сортировки
        telegram: null,
        wallet: null
      }))
    });
  } catch (e) {
    console.error('[ERROR] /admin/contacts:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/messages/admin/:adminId - получить сообщения с конкретным админом
router.get('/admin/:adminId', async (req, res) => {
  try {
    const currentAdminId = req.user && req.user.id;
    const { adminId } = req.params;
    
    if (!currentAdminId) {
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
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

    // Получаем сообщения из приватной беседы между админами через conversation_participants
    const result = await db.getQuery()(
      `SELECT m.id, m.user_id, m.sender_id,
              decrypt_text(m.sender_type_encrypted, $3) as sender_type, 
              decrypt_text(m.content_encrypted, $3) as content, 
              decrypt_text(m.channel_encrypted, $3) as channel, 
              decrypt_text(m.role_encrypted, $3) as role, 
              decrypt_text(m.direction_encrypted, $3) as direction, 
              m.created_at, m.message_type,
              -- Получаем wallet адреса отправителей (расшифровываем provider_id_encrypted)
              CASE 
                WHEN sender_ui.provider_encrypted = encrypt_text('wallet', $3) 
                THEN decrypt_text(sender_ui.provider_id_encrypted, $3)
                ELSE 'Админ'
              END as sender_wallet,
              CASE 
                WHEN recipient_ui.provider_encrypted = encrypt_text('wallet', $3) 
                THEN decrypt_text(recipient_ui.provider_id_encrypted, $3)
                ELSE 'Админ'
              END as recipient_wallet
       FROM messages m
       INNER JOIN conversations c ON c.id = m.conversation_id
       INNER JOIN conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = $1
       INNER JOIN conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = $2
       LEFT JOIN user_identities sender_ui ON sender_ui.user_id = m.sender_id
       LEFT JOIN user_identities recipient_ui ON recipient_ui.user_id = m.user_id
       WHERE m.message_type = 'admin_chat' AND c.conversation_type = 'admin_chat'
       ORDER BY m.created_at ASC`,
      [currentAdminId, adminId, encryptionKey]
    );

    res.json({ 
      success: true, 
      messages: result.rows,
      messageType: 'admin_chat'
    });
  } catch (e) {
    console.error('[ERROR] /admin/:adminId:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router; 