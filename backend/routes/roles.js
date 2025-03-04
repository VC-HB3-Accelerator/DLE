const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { checkTokenBalanceAndUpdateRole } = require('../utils/access-check');
const logger = require('../utils/logger');

// Маршрут для проверки и обновления роли пользователя
router.post('/check-role', requireAuth, async (req, res) => {
  try {
    if (!req.session.address) {
      return res.status(400).json({ error: 'В сессии отсутствует адрес кошелька' });
    }
    
    const isAdmin = await checkTokenBalanceAndUpdateRole(req.session.address);
    
    // Обновление сессии
    req.session.isAdmin = isAdmin;
    
    res.json({ isAdmin });
  } catch (error) {
    logger.error('Error checking role:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Маршрут для получения всех ролей (только для админов)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM roles ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Маршрут для получения пользователей с их ролями (только для админов)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT u.id, u.username, u.preferred_language, r.name as role, 
             u.created_at, u.last_token_check
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      ORDER BY u.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    logger.error('Error fetching users with roles:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router; 