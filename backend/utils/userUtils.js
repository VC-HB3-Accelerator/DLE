const db = require('../db');

async function isUserBlocked(userId) {
  if (!userId) return false;
  const result = await db.getQuery()('SELECT is_blocked FROM users WHERE id = $1', [userId]);
  return !!result.rows[0]?.is_blocked;
}

module.exports = { isUserBlocked }; 