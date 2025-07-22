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

// Проверка и создание таблицы для пользователя-админа
async function ensureUserPagesTable(userId, fields) {
  fields = fields.filter(f => !FIELDS_TO_EXCLUDE.includes(f));
  const tableName = `pages_user_${userId}`;
  // Проверяем, есть ли таблица
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) {
    // Формируем SQL для создания таблицы с нужными полями
    let columns = [
      'id SERIAL PRIMARY KEY',
      'created_at TIMESTAMP DEFAULT NOW()',
      'updated_at TIMESTAMP DEFAULT NOW()'
    ];
    for (const field of fields) {
      columns.push(`"${field}" TEXT`);
    }
    const sql = `CREATE TABLE ${tableName} (${columns.join(', ')})`;
    await db.getQuery()(sql);
  } else {
    // Проверяем, есть ли все нужные столбцы, и добавляем недостающие
    const colRes = await db.getQuery()(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [tableName]
    );
    const existingCols = colRes.rows.map(r => r.column_name);
    for (const field of fields) {
      if (!existingCols.includes(field)) {
        await db.getQuery()(
          `ALTER TABLE ${tableName} ADD COLUMN "${field}" TEXT`
        );
      }
    }
  }
  return tableName;
}

// Создать страницу (только для админа)
router.post('/', async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Only admin can create pages' });
  }
  const userId = req.user.id;
  const fields = Object.keys(req.body).filter(f => !FIELDS_TO_EXCLUDE.includes(f));
  const filteredBody = {};
  fields.forEach(f => { filteredBody[f] = req.body[f]; });
  const tableName = await ensureUserPagesTable(userId, fields);

  // Формируем SQL для вставки данных
  const colNames = fields.map(f => `"${f}"`).join(', ');
  const values = Object.values(filteredBody);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders}) RETURNING *`;
  const { rows } = await db.getQuery()(sql, values);
  res.json(rows[0]);
});

// Получить все страницы пользователя-админа
router.get('/', async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Only admin can view pages' });
  }
  const userId = req.user.id;
  const tableName = `pages_user_${userId}`;
  // Проверяем, есть ли таблица
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.json([]);
  const { rows } = await db.getQuery()(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
  res.json(rows);
});

// Получить одну страницу по id
router.get('/:id', async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Only admin can view pages' });
  }
  const userId = req.user.id;
  const tableName = `pages_user_${userId}`;
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  const { rows } = await db.getQuery()(`SELECT * FROM ${tableName} WHERE id = $1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  res.json(rows[0]);
});

// Редактировать страницу по id
router.patch('/:id', async (req, res) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Only admin can edit pages' });
  }
  const userId = req.user.id;
  const tableName = `pages_user_${userId}`;
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  const fields = Object.keys(req.body).filter(f => !FIELDS_TO_EXCLUDE.includes(f));
  if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
  const filteredBody = {};
  fields.forEach(f => { filteredBody[f] = req.body[f]; });
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
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Only admin can delete pages' });
  }
  const userId = req.user.id;
  const tableName = `pages_user_${userId}`;
  const existsRes = await db.getQuery()(
    `SELECT to_regclass($1) as exists`, [tableName]
  );
  if (!existsRes.rows[0].exists) return res.status(404).json({ error: 'Page table not found' });
  const { rows } = await db.getQuery()(`DELETE FROM ${tableName} WHERE id = $1 RETURNING *`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Page not found' });
  res.json(rows[0]);
});

module.exports = router; 