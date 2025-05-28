const express = require('express');
const router = express.Router();
const db = require('../db');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
// const userService = require('../services/userService');

// Получение списка пользователей
// router.get('/', (req, res) => {
//   res.json({ message: 'Users API endpoint' });
// });

// Получение информации о пользователе
router.get('/:address', (req, res) => {
  const { address } = req.params;
  res.json({
    address,
    message: 'User details endpoint',
  });
});

// Маршрут для обновления языка пользователя
router.post('/update-language', requireAuth, async (req, res, next) => {
  try {
    const { language } = req.body;
    const userId = req.session.userId;
    const validLanguages = ['ru', 'en'];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({ error: 'Неподдерживаемый язык' });
    }
    await db.getQuery()('UPDATE users SET preferred_language = $1 WHERE id = $2', [language, userId]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating language:', error);
    next(error);
  }
});

// Маршрут для обновления имени и фамилии пользователя
router.post('/update-profile', requireAuth, async (req, res, next) => {
  try {
    const { firstName, lastName } = req.body;
    const userId = req.session.userId;
    if (firstName && firstName.length > 255) {
      return res.status(400).json({ error: 'Имя слишком длинное (максимум 255 символов)' });
    }
    if (lastName && lastName.length > 255) {
      return res.status(400).json({ error: 'Фамилия слишком длинная (максимум 255 символов)' });
    }
    await db.getQuery()('UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3', [
      firstName || null,
      lastName || null,
      userId,
    ]);
    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    next(error);
  }
});

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
    const usersResult = await db.getQuery()('SELECT id, first_name, last_name, created_at FROM users ORDER BY id');
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
      created_at: u.created_at
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

module.exports = router;
