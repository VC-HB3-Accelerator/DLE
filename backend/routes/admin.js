const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('/app/shared/permissions');
const authService = require('../services/auth-service');
const logger = require('../utils/logger');

const manageSettings = [requireAuth, requirePermission(PERMISSIONS.MANAGE_SETTINGS)];

// Роли
router.get('/roles', ...manageSettings, async (req, res, next) => {
  try {
    const roles = await authService.getAllRoles();
    res.json({ success: true, roles });
  } catch (error) {
    logger.error('Error getting roles:', error);
    next(error);
  }
});

router.post('/roles', ...manageSettings, async (req, res, next) => {
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
router.get('/users', ...manageSettings, async (req, res, next) => {
  try {
    const users = await authService.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    logger.error('Error getting users:', error);
    next(error);
  }
});

// Маршрут для получения статистики
router.get('/stats', ...manageSettings, async (req, res, next) => {
  try {
    const usersCount = await db.getQuery()('SELECT COUNT(*) FROM users');
    const boardsCount = await db.getQuery()('SELECT COUNT(*) FROM kanban_boards');
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
router.get('/logs', ...manageSettings, async (req, res, next) => {
  try {
    const result = await db.getQuery()('SELECT * FROM logs ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при получении логов:', error);
    next(error);
  }
});

module.exports = router;
