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
        WHERE ui.user_id = u.id AND ui.provider = $${idx++}
      )`);
      params.push(contactType);
    }

    // Фильтр по поиску
    if (search) {
      where.push(`(
        LOWER(u.first_name) LIKE $${idx} OR
        LOWER(u.last_name) LIKE $${idx} OR
        EXISTS (SELECT 1 FROM user_identities ui WHERE ui.user_id = u.id AND LOWER(ui.provider_id) LIKE $${idx})
      )`);
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }

    // Фильтр по блокировке
    if (blocked === 'blocked') {
      where.push(`u.is_blocked = true`);
    } else if (blocked === 'unblocked') {
      where.push(`u.is_blocked = false`);
    }

    // --- Основной SQL ---
    let sql = `
      SELECT u.id, u.first_name, u.last_name, u.created_at, u.preferred_language, u.is_blocked,
        (SELECT provider_id FROM user_identities WHERE user_id = u.id AND provider = 'email' LIMIT 1) AS email,
        (SELECT provider_id FROM user_identities WHERE user_id = u.id AND provider = 'telegram' LIMIT 1) AS telegram,
        (SELECT provider_id FROM user_identities WHERE user_id = u.id AND provider = 'wallet' LIMIT 1) AS wallet
      FROM users u
    `;

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
    const { first_name, last_name, preferred_language, is_blocked } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    if (first_name !== undefined) { fields.push(`first_name = $${idx++}`); values.push(first_name); }
    if (last_name !== undefined) { fields.push(`last_name = $${idx++}`); values.push(last_name); }
    if (preferred_language !== undefined) { fields.push(`preferred_language = $${idx++}`); values.push(JSON.stringify(preferred_language)); }
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
    res.json({ success: true, message: 'Пользователь обновлен' });
  } catch (e) {
    logger.error('Ошибка обновления пользователя:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/users/:id — удалить контакт и все связанные данные
router.delete('/:id', async (req, res) => {
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
  try {
    const query = db.getQuery();
    // Получаем пользователя
    const userResult = await query('SELECT id, first_name, last_name, created_at, preferred_language, is_blocked FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];
    // Получаем идентификаторы
    const identitiesResult = await query('SELECT provider, provider_id FROM user_identities WHERE user_id = $1', [userId]);
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
  try {
    const result = await db.getQuery()(
      `INSERT INTO users (first_name, last_name, preferred_language, created_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [first_name, last_name, JSON.stringify(preferred_language || [])]
    );
    broadcastContactsUpdate();
    res.json({ success: true, user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// Массовый импорт контактов
router.post('/import', requireAuth, async (req, res) => {
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
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider = $1 AND provider_id = $2', ['email', c.email.toLowerCase()]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (!foundUser && c.telegram) {
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider = $1 AND provider_id = $2', ['telegram', c.telegram]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (!foundUser && c.wallet) {
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider = $1 AND provider_id = $2', ['wallet', c.wallet]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (foundUser) {
          userId = foundUser;
          updated++;
          // Обновляем имя, если нужно
          if (first_name || last_name) {
            await dbq('UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name) WHERE id = $3', [first_name, last_name, userId]);
          }
        } else {
          // Создаём нового пользователя
          const ins = await dbq('INSERT INTO users (first_name, last_name, created_at) VALUES ($1, $2, NOW()) RETURNING id', [first_name, last_name]);
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

// --- Работа с тегами пользователя через user_tag_links ---
// PATCH /api/users/:id/tags — установить теги пользователю
router.patch('/:id/tags', async (req, res) => {
  const userId = Number(req.params.id);
  const { tags } = req.body; // массив tagIds (id строк из таблицы тегов)
  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: 'tags должен быть массивом' });
  }
  try {
    // Удаляем старые связи
    await db.getQuery()('DELETE FROM user_tag_links WHERE user_id = $1', [userId]);
    // Добавляем новые связи
    for (const tagId of tags) {
      await db.getQuery()(
        'INSERT INTO user_tag_links (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, tagId]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/users/:id/tags — получить все теги пользователя
router.get('/:id/tags', async (req, res) => {
  const userId = Number(req.params.id);
  try {
    const result = await db.getQuery()(
      'SELECT tag_id FROM user_tag_links WHERE user_id = $1',
      [userId]
    );
    res.json({ tags: result.rows.map(r => r.tag_id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/users/:id/tags/:tagId — удалить тег у пользователя
router.delete('/:id/tags/:tagId', async (req, res) => {
  const userId = Number(req.params.id);
  const tagId = Number(req.params.tagId);
  try {
    await db.getQuery()(
      'DELETE FROM user_tag_links WHERE user_id = $1 AND tag_id = $2',
      [userId, tagId]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
