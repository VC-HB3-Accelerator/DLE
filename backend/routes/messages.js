const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/messages?userId=123
router.get('/', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const result = await db.getQuery()(
      `SELECT id, user_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata
       FROM messages
       WHERE user_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

module.exports = router; 