const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const db = require('../db');
const { ethers } = require('ethers');

// Подключение к БД
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Проверка доступа
router.get('/check', async (req, res) => {
  const walletAddress = req.headers['x-wallet-address'];

  if (!walletAddress) {
    return res.status(400).json({ error: 'No wallet address provided' });
  }

  try {
    // Проверяем наличие активного токена для адреса
    const result = await pool.query(
      'SELECT * FROM access_tokens WHERE wallet_address = $1 AND expires_at > NOW()',
      [walletAddress.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.json({ hasAccess: false });
    }

    const token = result.rows[0];

    res.json({
      hasAccess: true,
      tokenId: token.id,
      role: token.role,
      expiresAt: token.expires_at,
    });
  } catch (error) {
    console.error('Access check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Проверка прав администратора
router.get('/admin-only', async (req, res) => {
  const walletAddress = req.headers['x-wallet-address'];

  if (!walletAddress) {
    return res.status(400).json({ error: 'No wallet address provided' });
  }

  try {
    // Временное решение: разрешаем доступ для всех
    console.log('Admin access requested by:', walletAddress);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получение списка токенов
router.get('/tokens', async (req, res) => {
  const walletAddress = req.headers['x-wallet-address'];

  if (!walletAddress) {
    return res.status(400).json({ error: 'No wallet address provided' });
  }

  try {
    // Проверяем права администратора
    const adminCheck = await pool.query(
      'SELECT * FROM access_tokens WHERE wallet_address = $1 AND role = $2 AND expires_at > NOW()',
      [walletAddress.toLowerCase(), 'ADMIN']
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Получаем список всех токенов
    const result = await pool.query('SELECT * FROM access_tokens ORDER BY created_at DESC');

    res.json(
      result.rows.map((token) => ({
        id: token.id,
        walletAddress: token.wallet_address,
        role: token.role,
        createdAt: token.created_at,
        expiresAt: token.expires_at,
      }))
    );
  } catch (error) {
    console.error('Tokens list error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Создание токена
router.post('/tokens', async (req, res) => {
  const walletAddress = req.headers['x-wallet-address'];

  if (!walletAddress) {
    return res.status(400).json({ error: 'No wallet address provided' });
  }

  try {
    // Проверяем права администратора
    const adminCheck = await pool.query(
      'SELECT * FROM access_tokens WHERE wallet_address = $1 AND role = $2 AND expires_at > NOW()',
      [walletAddress.toLowerCase(), 'ADMIN']
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { walletAddress: targetAddress, role, expiresInDays } = req.body;

    if (!targetAddress || !role || !expiresInDays) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Вычисляем дату истечения
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));

    // Создаем токен
    const result = await pool.query(
      'INSERT INTO access_tokens (wallet_address, role, expires_at) VALUES ($1, $2, $3) RETURNING *',
      [targetAddress.toLowerCase(), role, expiresAt]
    );

    res.json({
      id: result.rows[0].id,
      walletAddress: result.rows[0].wallet_address,
      role: result.rows[0].role,
      createdAt: result.rows[0].created_at,
      expiresAt: result.rows[0].expires_at,
    });
  } catch (error) {
    console.error('Token creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Отзыв токена
router.delete('/tokens/:id', async (req, res) => {
  const walletAddress = req.headers['x-wallet-address'];

  if (!walletAddress) {
    return res.status(400).json({ error: 'No wallet address provided' });
  }

  try {
    // Проверяем права администратора
    const adminCheck = await pool.query(
      'SELECT * FROM access_tokens WHERE wallet_address = $1 AND role = $2 AND expires_at > NOW()',
      [walletAddress.toLowerCase(), 'ADMIN']
    );

    if (adminCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { id } = req.params;

    // Удаляем токен
    await pool.query('DELETE FROM access_tokens WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Token revocation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Получение информации о роли текущего пользователя
router.get('/role', requireAuth, async (req, res) => {
  try {
    const address = req.session.address.toLowerCase();

    const result = await db.query(
      'SELECT r.name as role FROM users u JOIN roles r ON u.role_id = r.id WHERE LOWER(u.address) = $1',
      [address]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    return res.json({ role: result.rows[0].role });
  } catch (error) {
    console.error('Ошибка при получении роли:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение списка всех пользователей (только для администраторов)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT u.id, u.wallet_address, r.name as role, u.created_at FROM users u JOIN roles r ON u.role_id = r.id'
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при получении списка пользователей:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Изменение роли пользователя (только для администраторов)
router.post('/users/:userId/role', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Некорректная роль' });
    }

    await db.query(
      'UPDATE users SET role_id = (SELECT id FROM roles WHERE name = $1) WHERE id = $2',
      [role, userId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при изменении роли пользователя:', error);
    return res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получение информации о токенах доступа текущего пользователя
router.get('/tokens', requireAuth, async (req, res) => {
  try {
    // Логирование для отладки
    console.log('GET /api/access/tokens запрос получен');
    console.log('Сессия пользователя:', req.session);

    // Получаем адрес из сессии, а не из заголовков
    if (!req.session || !req.session.address) {
      return res.status(400).json({ error: 'No wallet address in session' });
    }

    const address = req.session.address.toLowerCase();

    // Используем правильное имя таблицы и полей
    const result = await db.query(
      'SELECT id, wallet_address, role, created_at, expires_at FROM access_tokens WHERE LOWER(wallet_address) = $1',
      [address]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при получении токенов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/mint', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Логирование для отладки
    console.log('POST /api/access/mint запрос получен');
    console.log('Данные запроса:', req.body);

    const { walletAddress, role, expiresInDays } = req.body;

    if (!walletAddress || !role || !expiresInDays) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Вычисляем дату истечения
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiresInDays));

    // Создаем токен
    const result = await pool.query(
      'INSERT INTO access_tokens (wallet_address, role, expires_at) VALUES ($1, $2, $3) RETURNING *',
      [walletAddress.toLowerCase(), role, expiresAt]
    );

    res.json({
      id: result.rows[0].id,
      walletAddress: result.rows[0].wallet_address,
      role: result.rows[0].role,
      createdAt: result.rows[0].created_at,
      expiresAt: result.rows[0].expires_at,
    });
  } catch (error) {
    console.error('Ошибка при создании токена:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;
