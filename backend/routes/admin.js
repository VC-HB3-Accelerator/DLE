const express = require('express');
const router = express.Router();
const db = require('../db');
const { checkIfAdmin } = require('../utils/access-check');

// Middleware для проверки прав администратора
const requireAdmin = async (req, res, next) => {
  console.log('Проверка прав администратора:', {
    session: req.session
      ? {
          authenticated: req.session.authenticated,
          address: req.session.address,
          isAdmin: req.session.isAdmin,
        }
      : null,
    headers: {
      authorization: req.headers.authorization,
    },
  });

  // Проверка аутентификации через сессию
  if (req.session && req.session.authenticated && req.session.isAdmin) {
    console.log('Пользователь авторизован как администратор через сессию');
    return next();
  }

  // Проверка через заголовок авторизации
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Отсутствует заголовок авторизации');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const address = authHeader.split(' ')[1];
  console.log('Проверка адреса из заголовка:', address);

  try {
    // Проверяем напрямую в базе данных
    const userResult = await db.query('SELECT is_admin FROM users WHERE address = $1', [
      address.toLowerCase(),
    ]);

    if (userResult.rows.length === 0) {
      console.log(`Пользователь с адресом ${address} не найден`);
      return res.status(404).json({ error: 'User not found' });
    }

    const isAdmin = userResult.rows[0].is_admin;
    console.log(`Пользователь с адресом ${address} имеет статус администратора:`, isAdmin);

    if (!isAdmin) {
      console.log(`Пользователь с адресом ${address} не является администратором`);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Обновляем сессию
    if (req.session) {
      req.session.authenticated = true;
      req.session.address = address;
      req.session.isAdmin = true;

      console.log('Сессия обновлена из middleware:', {
        address,
        isAdmin: true,
      });
    }

    next();
  } catch (error) {
    console.error('Ошибка при проверке прав администратора:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Применяем middleware ко всем маршрутам
router.use(requireAdmin);

// Маршрут для получения списка пользователей
router.get('/users', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Маршрут для получения статистики
router.get('/stats', async (req, res) => {
  try {
    // Получаем количество пользователей
    const usersCount = await db.query('SELECT COUNT(*) FROM users');

    // Получаем количество досок
    const boardsCount = await db.query('SELECT COUNT(*) FROM kanban_boards');

    // Получаем количество задач
    const tasksCount = await db.query('SELECT COUNT(*) FROM kanban_tasks');

    res.json({
      userCount: parseInt(usersCount.rows[0].count),
      boardCount: parseInt(boardsCount.rows[0].count),
      taskCount: parseInt(tasksCount.rows[0].count),
    });
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Маршрут для получения логов
router.get('/logs', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при получении логов:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
