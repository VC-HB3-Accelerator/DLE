const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const authService = require('../services/auth-service');
const logger = require('../utils/logger');

// Роли
router.get('/roles', requireAdmin, async (req, res, next) => {
  try {
    const roles = await authService.getAllRoles();
    res.json({ success: true, roles });
  } catch (error) {
    logger.error('Error getting roles:', error);
    next(error);
  }
});

router.post('/roles', requireAdmin, async (req, res, next) => {
  try {
    const { name, permissions } = req.body;
    const role = await authService.createRole(name, permissions);
    res.json({ success: true, role });
  } catch (error) {
    logger.error('Error creating role:', error);
    next(error);
  }
});

// Админ функции
router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const users = await authService.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    logger.error('Error getting users:', error);
    next(error);
  }
});

// Маршрут для получения статистики (защищен middleware requireAdmin)
router.get('/stats', requireAdmin, async (req, res, next) => {
  try {
    // Получаем количество пользователей
    const usersCount = await db.getQuery()('SELECT COUNT(*) FROM users');

    // Получаем количество досок
    const boardsCount = await db.getQuery()('SELECT COUNT(*) FROM kanban_boards');

    // Получаем количество задач
    const tasksCount = await db.getQuery()('SELECT COUNT(*) FROM kanban_tasks');

    res.json({
      userCount: parseInt(usersCount.rows[0].count),
      boardCount: parseInt(boardsCount.rows[0].count),
      taskCount: parseInt(tasksCount.rows[0].count),
    });
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    next(error);
  }
});

// Маршрут для получения логов
router.get('/logs', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.getQuery()('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при получении логов:', error);
    next(error);
  }
});

module.exports = router;
