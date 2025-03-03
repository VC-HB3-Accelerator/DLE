const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// Подключение к БД
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
      expiresAt: token.expires_at
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
    const result = await pool.query(
      'SELECT * FROM access_tokens ORDER BY created_at DESC'
    );
    
    res.json(result.rows.map(token => ({
      id: token.id,
      walletAddress: token.wallet_address,
      role: token.role,
      createdAt: token.created_at,
      expiresAt: token.expires_at
    })));
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
      expiresAt: result.rows[0].expires_at
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
    await pool.query(
      'DELETE FROM access_tokens WHERE id = $1',
      [id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Token revocation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 