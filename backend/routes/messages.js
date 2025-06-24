const express = require('express');
const router = express.Router();
const db = require('../db');
const { broadcastMessagesUpdate } = require('../wsHub');
const telegramBot = require('../services/telegramBot');
const emailBot = new (require('../services/emailBot'))();

// GET /api/messages?userId=123
router.get('/', async (req, res) => {
  const userId = req.query.userId;
  const conversationId = req.query.conversationId;
  try {
    let result;
    if (conversationId) {
      result = await db.getQuery()(
        `SELECT id, user_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId]
      );
    } else if (userId) {
      result = await db.getQuery()(
        `SELECT id, user_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata
         FROM messages
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [userId]
      );
    } else {
      result = await db.getQuery()(
        `SELECT id, user_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata
         FROM messages
         ORDER BY created_at ASC`
      );
    }
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// POST /api/messages
router.post('/', async (req, res) => {
  const { user_id, sender_type, content, channel, role, direction, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata } = req.body;
  try {
    // Проверка наличия идентификатора для выбранного канала
    if (channel === 'email') {
      const emailIdentity = await db.getQuery()(
        'SELECT provider_id FROM user_identities WHERE user_id = $1 AND provider = $2 LIMIT 1',
        [user_id, 'email']
      );
      if (emailIdentity.rows.length === 0) {
        return res.status(400).json({ error: 'У пользователя не указан email. Сообщение не отправлено.' });
      }
    }
    if (channel === 'telegram') {
      const tgIdentity = await db.getQuery()(
        'SELECT provider_id FROM user_identities WHERE user_id = $1 AND provider = $2 LIMIT 1',
        [user_id, 'telegram']
      );
      if (tgIdentity.rows.length === 0) {
        return res.status(400).json({ error: 'У пользователя не привязан Telegram. Сообщение не отправлено.' });
      }
    }
    if (channel === 'wallet' || channel === 'web3' || channel === 'web') {
      const walletIdentity = await db.getQuery()(
        'SELECT provider_id FROM user_identities WHERE user_id = $1 AND provider = $2 LIMIT 1',
        [user_id, 'wallet']
      );
      if (walletIdentity.rows.length === 0) {
        return res.status(400).json({ error: 'У пользователя не привязан кошелёк. Сообщение не отправлено.' });
      }
    }
    // 1. Проверяем, есть ли беседа для user_id
    let conversationResult = await db.getQuery()(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [user_id]
    );
    let conversation;
    if (conversationResult.rows.length === 0) {
      // 2. Если нет — создаём новую беседу
      const title = `Чат с пользователем ${user_id}`;
      const newConv = await db.getQuery()(
        'INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING *',
        [user_id, title]
      );
      conversation = newConv.rows[0];
    } else {
      conversation = conversationResult.rows[0];
    }
    // 3. Сохраняем сообщение с conversation_id
    const result = await db.getQuery()(
      `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),$8,$9,$10,$11,$12) RETURNING *`,
      [user_id, conversation.id, sender_type, content, channel, role, direction, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata]
    );
    // 4. Если это исходящее сообщение для Telegram — отправляем через бота
    if (channel === 'telegram' && direction === 'out') {
      try {
        console.log(`[messages.js] Попытка отправки сообщения в Telegram для user_id=${user_id}`);
        // Получаем Telegram ID пользователя
        const tgIdentity = await db.getQuery()(
          'SELECT provider_id FROM user_identities WHERE user_id = $1 AND provider = $2 LIMIT 1',
          [user_id, 'telegram']
        );
        console.log(`[messages.js] Результат поиска Telegram ID:`, tgIdentity.rows);
        if (tgIdentity.rows.length > 0) {
          const telegramId = tgIdentity.rows[0].provider_id;
          console.log(`[messages.js] Отправка сообщения в Telegram ID: ${telegramId}, текст: ${content}`);
          const bot = await telegramBot.getBot();
          try {
            const sendResult = await bot.telegram.sendMessage(telegramId, content);
            console.log(`[messages.js] Результат отправки в Telegram:`, sendResult);
          } catch (sendErr) {
            console.error(`[messages.js] Ошибка при отправке в Telegram:`, sendErr);
          }
        } else {
          console.warn(`[messages.js] Не найден Telegram ID для user_id=${user_id}`);
        }
      } catch (err) {
        console.error('[messages.js] Ошибка отправки сообщения в Telegram:', err);
      }
    }
    // 5. Если это исходящее сообщение для Email — отправляем email
    if (channel === 'email' && direction === 'out') {
      try {
        // Получаем email пользователя
        const emailIdentity = await db.getQuery()(
          'SELECT provider_id FROM user_identities WHERE user_id = $1 AND provider = $2 LIMIT 1',
          [user_id, 'email']
        );
        if (emailIdentity.rows.length > 0) {
          const email = emailIdentity.rows[0].provider_id;
          await emailBot.sendEmail(email, 'Новое сообщение', content);
        }
      } catch (err) {
        console.error('[messages.js] Ошибка отправки email:', err);
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
    console.log('[DEBUG] /mark-read req.user:', req.user);
    console.log('[DEBUG] /mark-read req.body:', req.body);
    const adminId = req.user && req.user.id;
    const { userId, lastReadAt } = req.body;
    if (!adminId) {
      console.error('[ERROR] /mark-read: adminId (req.user.id) is missing');
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
    if (!userId || !lastReadAt) {
      console.error('[ERROR] /mark-read: userId or lastReadAt missing');
      return res.status(400).json({ error: 'userId and lastReadAt required' });
    }
    await db.query(`
      INSERT INTO admin_read_messages (admin_id, user_id, last_read_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (admin_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `, [adminId, userId, lastReadAt]);
    res.json({ success: true });
  } catch (e) {
    console.error('[ERROR] /mark-read:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/messages/read-status
router.get('/read-status', async (req, res) => {
  try {
    console.log('[DEBUG] /read-status req.user:', req.user);
    console.log('[DEBUG] /read-status req.session:', req.session);
    console.log('[DEBUG] /read-status req.session.userId:', req.session && req.session.userId);
    const adminId = req.user && req.user.id;
    if (!adminId) {
      console.error('[ERROR] /read-status: adminId (req.user.id) is missing');
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
    const result = await db.query('SELECT user_id, last_read_at FROM admin_read_messages WHERE admin_id = $1', [adminId]);
    console.log('[DEBUG] /read-status SQL result:', result.rows);
    const map = {};
    for (const row of result.rows) {
      map[row.user_id] = row.last_read_at;
    }
    res.json(map);
  } catch (e) {
    console.error('[ERROR] /read-status:', e);
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

// Массовая рассылка сообщения во все каналы пользователя
router.post('/broadcast', async (req, res) => {
  const { user_id, content } = req.body;
  if (!user_id || !content) {
    return res.status(400).json({ error: 'user_id и content обязательны' });
  }
  try {
    // Получаем все идентификаторы пользователя
    const identitiesRes = await db.getQuery()(
      'SELECT provider, provider_id FROM user_identities WHERE user_id = $1',
      [user_id]
    );
    const identities = identitiesRes.rows;
    // --- Найти или создать беседу (conversation) ---
    let conversationResult = await db.getQuery()(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [user_id]
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
        await emailBot.sendEmail(email, 'Новое сообщение', content);
        // Сохраняем в messages с conversation_id
        await db.getQuery()(
          `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [user_id, conversation.id, 'admin', content, 'email', 'user', 'out', JSON.stringify({ broadcast: true })]
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
          `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [user_id, conversation.id, 'admin', content, 'telegram', 'user', 'out', JSON.stringify({ broadcast: true })]
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
        `INSERT INTO messages (user_id, conversation_id, sender_type, content, channel, role, direction, created_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
        [user_id, conversation.id, 'admin', content, 'wallet', 'user', 'out', JSON.stringify({ broadcast: true })]
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

module.exports = router; 