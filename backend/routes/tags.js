const express = require('express');
const router = express.Router();
const db = require('../db');

// Получить все теги
router.get('/', async (req, res) => {
  console.log('GET /api/tags');
  try {
    const query = db.getQuery();
    const { rows } = await query('SELECT * FROM tags ORDER BY name');
    res.json(rows);
  } catch (e) {
    console.error('Ошибка в /api/tags:', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Создать тег
router.post('/', async (req, res) => {
  console.log('POST /api/tags', req.body);
  try {
    const { name, description } = req.body;
    const query = db.getQuery();
    const result = await query(
      'INSERT INTO tags (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    const row = result && result.rows && result.rows[0] ? result.rows[0] : null;
    if (row) {
      res.json(row);
    } else {
      res.status(500).json({ error: 'Не удалось создать тег', result });
    }
  } catch (e) {
    console.error('Ошибка в /api/tags (POST):', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Удалить тег и все его связи с пользователями
router.delete('/:tagId', async (req, res) => {
  console.log('DELETE /api/tags/:id', req.params.tagId);
  try {
    const tagId = req.params.tagId;
    const query = db.getQuery();
    // Сначала удаляем связи user_tags
    await query('DELETE FROM user_tags WHERE tag_id = $1', [tagId]);
    // Затем удаляем сам тег
    const result = await query('DELETE FROM tags WHERE id = $1 RETURNING *', [tagId]);
    if (result.rowCount > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Тег не найден' });
    }
  } catch (e) {
    console.error('Ошибка в /api/tags/:id (DELETE):', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

module.exports = router; 