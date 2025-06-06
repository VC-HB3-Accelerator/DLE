const express = require('express');
const router = express.Router();
const db = require('../db');

// Инициализация таблиц тегов (если нужно)
router.post('/init', async (req, res) => {
  console.log('POST /api/users/tags/init');
  try {
    const query = db.getQuery();
    await query(`
      CREATE TABLE IF NOT EXISTS tags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(64) NOT NULL UNIQUE,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS user_tags (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, tag_id)
      );
    `);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка в /api/users/tags/init:', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// --- Работа с тегами пользователя ---

// Получить теги пользователя
router.get('/:userId/tags', async (req, res) => {
  console.log('GET /api/users/:id/tags', req.params.userId);
  try {
    const userId = req.params.userId;
    const query = db.getQuery();
    const result = await query(
      `SELECT t.* FROM tags t
       JOIN user_tags ut ON ut.tag_id = t.id
       WHERE ut.user_id = $1`,
      [userId]
    );
    const rows = result && result.rows ? result.rows : [];
    res.json(rows);
  } catch (e) {
    console.error('Ошибка в /api/users/:id/tags (GET):', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Добавить тег пользователю
router.post('/:userId/tags', async (req, res) => {
  console.log('POST /api/users/:id/tags', req.params.userId, req.body);
  try {
    const userId = req.params.userId;
    const { tag_id } = req.body;
    const query = db.getQuery();
    await query(
      'INSERT INTO user_tags (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [userId, tag_id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка в /api/users/:id/tags (POST):', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Удалить тег у пользователя
router.delete('/:userId/tags/:tagId', async (req, res) => {
  console.log('DELETE /api/users/:id/tags/:tagId', req.params.userId, req.params.tagId);
  try {
    const userId = req.params.userId;
    const tagId = req.params.tagId;
    const query = db.getQuery();
    const result = await query(
      'DELETE FROM user_tags WHERE user_id = $1 AND tag_id = $2 RETURNING *',
      [userId, tagId]
    );
    if (result.rowCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Связь не найдена' });
    }
  } catch (e) {
    console.error('Ошибка в /api/users/:id/tags/:tagId (DELETE):', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

module.exports = router; 