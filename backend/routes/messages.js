const express = require('express');
const router = express.Router();
const db = require('../db');
const { broadcastMessagesUpdate } = require('../wsHub');

// GET /api/messages?userId=123
router.get('/', async (req, res) => {
  const userId = req.query.userId;
  const conversationId = req.query.conversationId;
  try {
    let result;
    if (conversationId) {
      result = await db.getQuery()(
        `SELECT id, user_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC`,
        [conversationId]
      );
    } else if (userId) {
      result = await db.getQuery()(
        `SELECT id, user_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata
         FROM messages
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [userId]
      );
    } else {
      result = await db.getQuery()(
        `SELECT id, user_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata
         FROM messages
         ORDER BY created_at ASC`
      );
    }
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// POST /api/messages
router.post('/', async (req, res) => {
  const { user_id, sender_type, content, channel, role, direction, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata } = req.body;
  try {
    const result = await db.getQuery()(
      `INSERT INTO messages (user_id, sender_type, content, channel, role, direction, created_at, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7,$8,$9,$10,$11) RETURNING *`,
      [user_id, sender_type, content, channel, role, direction, attachment_filename, attachment_mimetype, attachment_size, attachment_data, metadata]
    );
    broadcastMessagesUpdate();
    res.json({ success: true, message: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// POST /api/messages/mark-read
router.post('/mark-read', async (req, res) => {
  try {
    console.log('[DEBUG] /mark-read req.user:', req.user);
    console.log('[DEBUG] /mark-read req.body:', req.body);
    const adminId = req.user && req.user.id;
    const { userId, lastReadAt } = req.body;
    if (!adminId) {
      console.error('[ERROR] /mark-read: adminId (req.user.id) is missing');
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
    if (!userId || !lastReadAt) {
      console.error('[ERROR] /mark-read: userId or lastReadAt missing');
      return res.status(400).json({ error: 'userId and lastReadAt required' });
    }
    await db.query(`
      INSERT INTO admin_read_messages (admin_id, user_id, last_read_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (admin_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at
    `, [adminId, userId, lastReadAt]);
    res.json({ success: true });
  } catch (e) {
    console.error('[ERROR] /mark-read:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/messages/read-status
router.get('/read-status', async (req, res) => {
  try {
    console.log('[DEBUG] /read-status req.user:', req.user);
    console.log('[DEBUG] /read-status req.session:', req.session);
    console.log('[DEBUG] /read-status req.session.userId:', req.session && req.session.userId);
    const adminId = req.user && req.user.id;
    if (!adminId) {
      console.error('[ERROR] /read-status: adminId (req.user.id) is missing');
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
    const result = await db.query('SELECT user_id, last_read_at FROM admin_read_messages WHERE admin_id = $1', [adminId]);
    console.log('[DEBUG] /read-status SQL result:', result.rows);
    const map = {};
    for (const row of result.rows) {
      map[row.user_id] = row.last_read_at;
    }
    res.json(map);
  } catch (e) {
    console.error('[ERROR] /read-status:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/conversations?userId=123
router.get('/conversations', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const result = await db.getQuery()(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC LIMIT 1',
      [userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

module.exports = router; 