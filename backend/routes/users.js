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

// Получение списка пользователей с контактами
router.get('/', async (req, res, next) => {
  try {
    const usersResult = await db.getQuery()('SELECT id, first_name, last_name, created_at, preferred_language FROM users ORDER BY id');
    const users = usersResult.rows;
    // Получаем все user_identities разом
    const identitiesResult = await db.getQuery()('SELECT user_id, provider, provider_id FROM user_identities');
    const identities = identitiesResult.rows;
    // Группируем идентификаторы по user_id
    const identityMap = {};
    for (const id of identities) {
      if (!identityMap[id.user_id]) identityMap[id.user_id] = {};
      if (!identityMap[id.user_id][id.provider]) identityMap[id.user_id][id.provider] = id.provider_id;
    }
    // Собираем контакты
    const contacts = users.map(u => ({
      id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ') || null,
      email: identityMap[u.id]?.email || null,
      telegram: identityMap[u.id]?.telegram || null,
      wallet: identityMap[u.id]?.wallet || null,
      created_at: u.created_at,
      preferred_language: u.preferred_language || []
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

// PATCH /api/users/:id — обновить имя и язык
router.patch('/:id', async (req, res) => {
  const userId = req.params.id;
  const { name, language } = req.body;
  if (!name && !language) return res.status(400).json({ error: 'Nothing to update' });
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) {
      // Разделяем имя на first_name и last_name (по пробелу)
      const [firstName, ...lastNameArr] = name.split(' ');
      fields.push(`first_name = $${idx++}`);
      values.push(firstName);
      fields.push(`last_name = $${idx++}`);
      values.push(lastNameArr.join(' ') || null);
    }
    if (language !== undefined) {
      fields.push(`preferred_language = $${idx++}`);
      values.push(JSON.stringify(language));
    }
    values.push(userId);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const result = await db.getQuery()(sql, values);
    res.json(result.rows[0]);
  } catch (e) {
    logger.error('PATCH /api/users/:id error', { error: e, body: req.body, stack: e.stack });
    res.status(500).json({ error: 'DB error', details: e.message });
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
    const userResult = await query('SELECT id, first_name, last_name, created_at, preferred_language FROM users WHERE id = $1', [userId]);
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
      preferred_language: user.preferred_language || []
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
