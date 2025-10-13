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

const FIELDS_TO_EXCLUDE = ['image', 'tags'];

// Проверка и создание общей таблицы для всех админов
async function ensureAdminPagesTable(fields) {
  fields = fields.filter(f => !FIELDS_TO_EXCLUDE.includes(f));
  const tableName = `admin_pages_simple`;
  
  // Получаем ключ шифрования
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  
  // Проверяем, есть ли таблица
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  
  if (!existsRes.rows[0].exists) {
    // Формируем SQL для создания таблицы с зашифрованными полями
    let columns = [
      'id SERIAL PRIMARY KEY',
      'author_address_encrypted TEXT NOT NULL', // Зашифрованный адрес автора
      'created_at TIMESTAMP DEFAULT NOW()',
      'updated_at TIMESTAMP DEFAULT NOW()'
    ];
    for (const field of fields) {
      columns.push(`"${field}_encrypted" TEXT`);
    }
    const sql = `CREATE TABLE ${tableName} (${columns.join(', ')})`;
    await db.getQuery()(sql);
  } else {
    // Проверяем, есть ли все нужные столбцы, и добавляем недостающие
    const colRes = await db.getQuery()(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [tableName]
    );
    const existingCols = colRes.rows.map(r => r.column_name);
    
    // Добавляем поле author_address_encrypted если его нет
    if (!existingCols.includes('author_address_encrypted')) {
      await db.getQuery()(
        `ALTER TABLE ${tableName} ADD COLUMN author_address_encrypted TEXT`
      );
    }
    
    for (const field of fields) {
      const encryptedField = `${field}_encrypted`;
      if (!existingCols.includes(encryptedField)) {
        await db.getQuery()(
          `ALTER TABLE ${tableName} ADD COLUMN "${encryptedField}" TEXT`
        );
      }
    }
  }
  return { tableName, encryptionKey };
}

// Создать страницу (только для админа)
router.post('/', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  // Проверяем роль админа через токены в кошельке
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can create pages' });
  }
  
  const authorAddress = req.session.address;
  const fields = Object.keys(req.body).filter(f => !FIELDS_TO_EXCLUDE.includes(f));
  const tableName = `admin_pages_simple`;

  // Формируем SQL для вставки данных
  const colNames = ['author_address', ...fields].join(', ');
  const values = [authorAddress, ...fields.map(f => {
    const value = typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f];
    return value || '';
  })];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  
  const sql = `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await db.getQuery()(sql, values);
  res.json(rows[0]);
});

// Получить все страницы админов
router.get('/', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  // Проверяем роль админа через токены в кошельке
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can view pages' });
  }
  
  const tableName = `admin_pages_simple`;
  
  // Получаем ключ шифрования
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  
  // Проверяем, есть ли таблица
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.json([]);
  
  // Получаем все страницы всех админов
  const { rows } = await db.getQuery()(`
    SELECT * FROM ${tableName} 
    ORDER BY created_at DESC
  `);
  
  res.json(rows);
});

// Получить одну страницу по id (только для админа)
router.get('/:id', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  // Проверяем роль админа через токены в кошельке
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can view pages' });
  }
  
  const tableName = `admin_pages_simple`;
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  
  const { rows } = await db.getQuery()(
    `SELECT * FROM ${tableName} WHERE id = $1`, 
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  res.json(rows[0]);
});

// Редактировать страницу по id
router.patch('/:id', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  // Проверяем роль админа через токены в кошельке
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can edit pages' });
  }
  
  const tableName = `admin_pages_simple`;
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  
  const fields = Object.keys(req.body).filter(f => !FIELDS_TO_EXCLUDE.includes(f));
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  
  const filteredBody = {};
  fields.forEach(f => { 
    // Преобразуем объекты в JSON строки
    filteredBody[f] = typeof req.body[f] === 'object' ? JSON.stringify(req.body[f]) : req.body[f];
  });
  const setClause = fields.map((f, i) => `"${f}" = $${i + 1}`).join(', ');
  const values = Object.values(filteredBody);
  values.push(req.params.id);
  
  const sql = `UPDATE ${tableName} SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`;
  const { rows } = await db.getQuery()(sql, values);
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  res.json(rows[0]);
});

// Удалить страницу по id
router.delete('/:id', async (req, res) => {
  if (!req.session || !req.session.authenticated) {
    return res.status(401).json({ error: 'Требуется аутентификация' });
  }
  if (!req.session.address) {
    return res.status(403).json({ error: 'Требуется подключение кошелька' });
  }
  
  // Проверяем роль админа через токены в кошельке
  const authService = require('../services/auth-service');
  const userAccessLevel = await authService.getUserAccessLevel(req.session.address);
  if (!userAccessLevel.hasAccess) {
    return res.status(403).json({ error: 'Only admin can delete pages' });
  }
  
  const tableName = `admin_pages_simple`;
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  
  const { rows } = await db.getQuery()(
    `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, 
    [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  res.json(rows[0]);
});

// Публичные маршруты для просмотра страниц (доступны всем пользователям)
// Получить все опубликованные страницы
router.get('/public/all', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.json([]);
    }
    
    // Получаем все опубликованные страницы всех админов
    const { rows } = await db.getQuery()(`
      SELECT * FROM ${tableName} 
      WHERE status = 'published' 
      ORDER BY created_at DESC
    `);
    
    res.json(rows);
  } catch (error) {
    console.error('Ошибка получения публичных страниц:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Получить одну опубликованную страницу по id
router.get('/public/:id', async (req, res) => {
  try {
    const tableName = `admin_pages_simple`;
    
    // Проверяем, есть ли таблица
    const existsRes = await db.getQuery()(
      `SELECT to_regclass($1) as exists`, [tableName]
    );
    
    if (!existsRes.rows[0].exists) {
      return res.status(404).json({ error: 'Страница не найдена или не опубликована' });
    }
    
    // Ищем страницу среди всех админов
    const { rows } = await db.getQuery()(`
      SELECT * FROM ${tableName} 
      WHERE id = $1 AND status = 'published'
    `, [req.params.id]);
    
    if (rows.length > 0) {
      return res.json(rows[0]);
    }
    
    res.status(404).json({ error: 'Страница не найдена или не опубликована' });
  } catch (error) {
    console.error('Ошибка получения публичной страницы:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router; 