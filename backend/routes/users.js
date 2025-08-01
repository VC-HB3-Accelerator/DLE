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
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { deleteUserById } = require('../services/userDeleteService');
const { broadcastContactsUpdate } = require('../wsHub');
// const userService = require('../services/userService');

console.log('[users.js] ROUTER LOADED');

router.use((req, res, next) => {
  console.log('[users.js] ROUTER REQUEST:', req.method, req.originalUrl);
  next();
});

// Получение списка пользователей
// router.get('/', (req, res) => {
//   res.json({ message: 'Users API endpoint' });
// });

// Получить профиль текущего пользователя
/*
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await userService.getUserProfile(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
*/

// Обновить профиль текущего пользователя
/*
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const profileData = req.body;
    const updatedUser = await userService.updateUserProfile(userId, profileData);
    res.json({ success: true, user: updatedUser, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating user profile:', error);
    // Можно добавить более специфичную обработку ошибок, например, если данные невалидны
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
*/

// Получение списка пользователей с фильтрацией
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const {
      tagIds = '',
      dateFrom = '',
      dateTo = '',
      contactType = 'all',
      search = '',
      newMessages = '',
      blocked = 'all'
    } = req.query;
    const adminId = req.user && req.user.id;

    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }

    // --- Формируем условия ---
    const where = [];
    const params = [];
    let idx = 1;

    // Фильтр по дате
    if (dateFrom) {
      where.push(`DATE(u.created_at) >= $${idx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push(`DATE(u.created_at) <= $${idx++}`);
      params.push(dateTo);
    }

    // Фильтр по типу контакта
    if (contactType !== 'all') {
      where.push(`EXISTS (
        SELECT 1 FROM user_identities ui
        WHERE ui.user_id = u.id AND ui.provider_encrypted = encrypt_text($${idx++}, $${idx++})
      )`);
      params.push(contactType);
      params.push(encryptionKey);
    }

    // Фильтр по поиску
    if (search) {
      where.push(`(
        LOWER(decrypt_text(u.first_name_encrypted, $${idx++})) LIKE $${idx++} OR
        LOWER(decrypt_text(u.last_name_encrypted, $${idx++})) LIKE $${idx++} OR
        EXISTS (SELECT 1 FROM user_identities ui WHERE ui.user_id = u.id AND LOWER(decrypt_text(ui.provider_id_encrypted, $${idx++})) LIKE $${idx++})
      )`);
      params.push(encryptionKey); // Для first_name_encrypted
      params.push(`%${search.toLowerCase()}%`);
      params.push(encryptionKey); // Для last_name_encrypted
      params.push(`%${search.toLowerCase()}%`);
      params.push(encryptionKey); // Для provider_id_encrypted
      params.push(`%${search.toLowerCase()}%`);
    }

    // Фильтр по блокировке
    if (blocked === 'blocked') {
      where.push(`u.is_blocked = true`);
    } else if (blocked === 'unblocked') {
      where.push(`u.is_blocked = false`);
    }

    // --- Основной SQL ---
    let sql = `
      SELECT u.id, 
        CASE 
          WHEN u.first_name_encrypted IS NULL OR u.first_name_encrypted = '' THEN NULL
          ELSE decrypt_text(u.first_name_encrypted, $${idx++})
        END as first_name,
        CASE 
          WHEN u.last_name_encrypted IS NULL OR u.last_name_encrypted = '' THEN NULL
          ELSE decrypt_text(u.last_name_encrypted, $${idx++})
        END as last_name,
        u.created_at, u.preferred_language, u.is_blocked,
        (SELECT decrypt_text(provider_id_encrypted, $${idx++}) FROM user_identities WHERE user_id = u.id AND provider_encrypted = encrypt_text('email', $${idx++}) LIMIT 1) AS email,
        (SELECT decrypt_text(provider_id_encrypted, $${idx++}) FROM user_identities WHERE user_id = u.id AND provider_encrypted = encrypt_text('telegram', $${idx++}) LIMIT 1) AS telegram,
        (SELECT decrypt_text(provider_id_encrypted, $${idx++}) FROM user_identities WHERE user_id = u.id AND provider_encrypted = encrypt_text('wallet', $${idx++}) LIMIT 1) AS wallet
      FROM users u
    `;
    params.push(encryptionKey, encryptionKey, encryptionKey, encryptionKey, encryptionKey, encryptionKey, encryptionKey, encryptionKey);

    // Фильтрация по тегам
    if (tagIds) {
      const tagIdArr = tagIds.split(',').map(Number).filter(Boolean);
      if (tagIdArr.length > 0) {
        sql += `
          JOIN user_tag_links utl ON utl.user_id = u.id
          WHERE utl.tag_id = ANY($${idx++})
          GROUP BY u.id
          HAVING COUNT(DISTINCT utl.tag_id) = $${idx++}
        `;
        params.push(tagIdArr);
        params.push(tagIdArr.length);
      }
    } else if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')} `;
    }

    if (!tagIds) {
      sql += ' ORDER BY u.id ';
    }

    // --- Выполняем запрос ---
    const usersResult = await db.getQuery()(sql, params);
    let users = usersResult.rows;

    // --- Фильтрация по новым сообщениям ---
    if (newMessages === 'yes' && adminId) {
      // Получаем время последнего прочтения для каждого пользователя
      const readRes = await db.getQuery()(
        'SELECT user_id, last_read_at FROM admin_read_messages WHERE admin_id = $1',
        [adminId]
      );
      const readMap = {};
      for (const row of readRes.rows) {
        readMap[row.user_id] = row.last_read_at;
      }
      // Получаем последнее сообщение для каждого пользователя
      const msgRes = await db.getQuery()(
        `SELECT user_id, MAX(created_at) as last_msg_at FROM messages GROUP BY user_id`
      );
      const msgMap = {};
      for (const row of msgRes.rows) {
        msgMap[row.user_id] = row.last_msg_at;
      }
      // Оставляем только тех, у кого есть новые сообщения
      users = users.filter(u => {
        const lastRead = readMap[u.id];
        const lastMsg = msgMap[u.id];
        return lastMsg && (!lastRead || new Date(lastMsg) > new Date(lastRead));
      });
    }

    // --- Формируем ответ ---
    const contacts = users.map(u => ({
      id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null,
      email: u.email || null,
      telegram: u.telegram || null,
      wallet: u.wallet || null,
      created_at: u.created_at,
      preferred_language: u.preferred_language || [],
      is_blocked: u.is_blocked || false
    }));

    res.json({ success: true, contacts });
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    next(error);
  }
});

// GET /api/users - Получить список всех пользователей (пример, может требовать прав администратора)
// В текущей реализации этот маршрут не используется и закомментирован
/*
router.get('/', async (req, res) => {
  try {
    // const users = await userService.getAllUsers(); // Удаляем
    await userService.getAllUsers(); // Просто вызываем, если нужно действие, но результат не используется
    // res.json({ success: true, users });
    res.json({ success: true, message: "Users retrieved" }); // Пример ответа без данных
  } catch (error) {
    console.error('Error getting all users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
*/

// Получить просмотренные контакты
router.get('/read-contacts-status', async (req, res) => {
  try {
    const adminId = req.user && req.user.id;
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
    const result = await db.query(
      'SELECT contact_id FROM admin_read_contacts WHERE admin_id = $1',
      [adminId]
    );
    res.json(result.rows.map(r => r.contact_id));
  } catch (e) {
    console.error('[ERROR] /read-contacts-status:', e);
    res.status(500).json({ error: e.message });
  }
});

// Пометить контакт как просмотренный
router.post('/mark-contact-read', async (req, res) => {
  try {
    const adminId = req.user && req.user.id;
    const { contactId } = req.body;
    if (!adminId || !contactId) {
      return res.status(400).json({ error: 'adminId and contactId required' });
    }
    await db.query(
      'INSERT INTO admin_read_contacts (admin_id, contact_id, read_at) VALUES ($1, $2, NOW()) ON CONFLICT (admin_id, contact_id) DO UPDATE SET read_at = NOW()',
      [adminId, contactId]
    );
    res.json({ success: true });
  } catch (e) {
    console.error('[ERROR] /mark-contact-read:', e);
    res.status(500).json({ error: e.message });
  }
});

// Заблокировать пользователя
router.patch('/:id/block', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    await db.query('UPDATE users SET is_blocked = true, blocked_at = NOW() WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Пользователь заблокирован' });
  } catch (e) {
    logger.error('Ошибка блокировки пользователя:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Разблокировать пользователя
router.patch('/:id/unblock', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    await db.query('UPDATE users SET is_blocked = false, blocked_at = NULL WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Пользователь разблокирован' });
  } catch (e) {
    logger.error('Ошибка разблокировки пользователя:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Обновить пользователя (в том числе is_blocked)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const { first_name, last_name, name, preferred_language, language, is_blocked } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    
    // Получаем ключ шифрования один раз
    const fs = require('fs');
    const path = require('path');
    let encryptionKey = 'default-key';
    try {
      const keyPath = '/app/ssl/keys/full_db_encryption.key';
      if (fs.existsSync(keyPath)) {
        encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
        console.log('Encryption key loaded:', encryptionKey.length, 'characters');
      }
    } catch (keyError) {
      console.error('Error reading encryption key:', keyError);
    }
    
    // Обработка поля name - разбиваем на first_name и last_name
    if (name !== undefined) {
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      fields.push(`first_name_encrypted = encrypt_text($${idx++}, $${idx++})`); 
      values.push(firstName);
      values.push(encryptionKey);
      fields.push(`last_name_encrypted = encrypt_text($${idx++}, $${idx++})`); 
      values.push(lastName);
      values.push(encryptionKey);
    } else {
      if (first_name !== undefined) { 
        fields.push(`first_name_encrypted = encrypt_text($${idx++}, $${idx++})`); 
        values.push(first_name);
        values.push(encryptionKey);
      }
      if (last_name !== undefined) { 
        fields.push(`last_name_encrypted = encrypt_text($${idx++}, $${idx++})`); 
        values.push(last_name);
        values.push(encryptionKey);
      }
    }
    
    // Обработка поля language (alias для preferred_language)
    const languageToUpdate = language !== undefined ? language : preferred_language;
    if (languageToUpdate !== undefined) { 
      fields.push(`preferred_language = $${idx++}`); 
      values.push(JSON.stringify(languageToUpdate)); 
    }
    if (is_blocked !== undefined) {
      fields.push(`is_blocked = $${idx++}`);
      values.push(is_blocked);
      if (is_blocked) {
        fields.push(`blocked_at = NOW()`);
      } else {
        fields.push(`blocked_at = NULL`);
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`;
    values.push(userId);
    await db.query(sql, values);
    broadcastContactsUpdate();
    res.json({ success: true, message: 'Пользователь обновлен' });
  } catch (e) {
    logger.error('Ошибка обновления пользователя:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/users/:id — удалить контакт и все связанные данные
router.delete('/:id', requireAuth, async (req, res) => {
  console.log('[users.js] DELETE HANDLER', req.params.id);
  const userId = Number(req.params.id);
  console.log('[ROUTER] Перед вызовом deleteUserById для userId:', userId);
  try {
    const deletedCount = await deleteUserById(userId);
    console.log('[ROUTER] deleteUserById вернул:', deletedCount);
    if (deletedCount === 0) {
      return res.status(404).json({ success: false, deleted: 0, error: 'User not found' });
    }
    broadcastContactsUpdate();
    res.json({ success: true, deleted: deletedCount });
  } catch (e) {
    console.error('[DELETE] Ошибка при удалении пользователя:', e);
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// Получить пользователя по id
router.get('/:id', async (req, res, next) => {
  const userId = req.params.id;

  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  let encryptionKey = 'default-key';
  
  try {
    const keyPath = '/app/ssl/keys/full_db_encryption.key';
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
  } catch (keyError) {
    console.error('Error reading encryption key:', keyError);
  }

  try {
    const query = db.getQuery();
    // Получаем пользователя
    const userResult = await query('SELECT id, decrypt_text(first_name_encrypted, $2) as first_name, decrypt_text(last_name_encrypted, $2) as last_name, created_at, preferred_language, is_blocked FROM users WHERE id = $1', [userId, encryptionKey]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];
    // Получаем идентификаторы
    const identitiesResult = await query('SELECT decrypt_text(provider_encrypted, $2) as provider, decrypt_text(provider_id_encrypted, $2) as provider_id FROM user_identities WHERE user_id = $1', [userId, encryptionKey]);
    const identityMap = {};
    for (const id of identitiesResult.rows) {
      identityMap[id.provider] = id.provider_id;
    }
    res.json({
      id: user.id,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || null,
      email: identityMap.email || null,
      telegram: identityMap.telegram || null,
      wallet: identityMap.wallet || null,
      created_at: user.created_at,
      preferred_language: user.preferred_language || [],
      is_blocked: user.is_blocked || false
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  const { first_name, last_name, preferred_language } = req.body;
  
  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  let encryptionKey = 'default-key';
  
  try {
    const keyPath = '/app/ssl/keys/full_db_encryption.key';
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
  } catch (keyError) {
    console.error('Error reading encryption key:', keyError);
  }

  try {
    const result = await db.getQuery()(
      `INSERT INTO users (first_name_encrypted, last_name_encrypted, preferred_language, created_at)
       VALUES (encrypt_text($1, $4), encrypt_text($2, $4), $3, NOW()) RETURNING *`,
      [first_name, last_name, JSON.stringify(preferred_language || []), encryptionKey]
    );
    broadcastContactsUpdate();
    res.json({ success: true, user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// Массовый импорт контактов
router.post('/import', requireAuth, async (req, res) => {
  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  let encryptionKey = 'default-key';
  
  try {
    const keyPath = '/app/ssl/keys/full_db_encryption.key';
    if (fs.existsSync(keyPath)) {
      encryptionKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
  } catch (keyError) {
    console.error('Error reading encryption key:', keyError);
  }

  try {
    const contacts = req.body;
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ success: false, error: 'Ожидается массив контактов' });
    }
    const dbq = db.getQuery();
    let added = 0, updated = 0, errors = [];
    for (const [i, c] of contacts.entries()) {
      try {
        // Имя
        let first_name = null, last_name = null;
        if (c.name) {
          const parts = c.name.trim().split(' ');
          first_name = parts[0] || null;
          last_name = parts.slice(1).join(' ') || null;
        }
        // Проверка на существование по email/telegram/wallet
        let userId = null;
        let foundUser = null;
        if (c.email) {
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider_encrypted = encrypt_text($1, $3) AND provider_id_encrypted = encrypt_text($2, $3)', ['email', c.email.toLowerCase(), encryptionKey]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (!foundUser && c.telegram) {
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider_encrypted = encrypt_text($1, $3) AND provider_id_encrypted = encrypt_text($2, $3)', ['telegram', c.telegram, encryptionKey]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (!foundUser && c.wallet) {
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider_encrypted = encrypt_text($1, $3) AND provider_id_encrypted = encrypt_text($2, $3)', ['wallet', c.wallet, encryptionKey]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (foundUser) {
          userId = foundUser;
          updated++;
          // Обновляем имя, если нужно
          if (first_name || last_name) {
            await dbq('UPDATE users SET first_name_encrypted = COALESCE(encrypt_text($1, $4), first_name_encrypted), last_name_encrypted = COALESCE(encrypt_text($2, $4), last_name_encrypted) WHERE id = $3', [first_name, last_name, userId, encryptionKey]);
          }
        } else {
          // Создаём нового пользователя
          const ins = await dbq('INSERT INTO users (first_name_encrypted, last_name_encrypted, created_at) VALUES (encrypt_text($1, $3), encrypt_text($2, $3), NOW()) RETURNING id', [first_name, last_name, encryptionKey]);
          userId = ins.rows[0].id;
          added++;
        }
        // Добавляем идентификаторы (email, telegram, wallet)
        const identities = [
          c.email ? { provider: 'email', provider_id: c.email.toLowerCase() } : null,
          c.telegram ? { provider: 'telegram', provider_id: c.telegram } : null,
          c.wallet ? { provider: 'wallet', provider_id: c.wallet } : null
        ].filter(Boolean);
        for (const idn of identities) {
          // Проверяем, есть ли уже такой идентификатор у пользователя
          const exists = await dbq('SELECT 1 FROM user_identities WHERE user_id = $1 AND provider = $2 AND provider_id = $3', [userId, idn.provider, idn.provider_id]);
          if (!exists.rows.length) {
            await dbq('INSERT INTO user_identities (user_id, provider, provider_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [userId, idn.provider, idn.provider_id]);
          }
        }
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }
    broadcastContactsUpdate();
    res.json({ success: true, added, updated, errors });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- Работа с тегами перенесена в /api/tags ---
// Используйте следующие endpoints:
// PATCH /api/tags/user/:id — установить теги пользователю
// GET /api/tags/user/:id — получить теги пользователя  
// DELETE /api/tags/user/:id/tag/:tagId — удалить тег у пользователя
// POST /api/tags/user/:id/multirelations — массовое обновление тегов

module.exports = router;
