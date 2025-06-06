const express = require('express');
const router = express.Router();
const db = require('../db');

// Инициализация таблиц тегов
router.post('/init', async (req, res) => {
  console.log('POST /api/tags/init');
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
    console.error('Ошибка в /api/tags/init:', e);
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

module.exports = router; 