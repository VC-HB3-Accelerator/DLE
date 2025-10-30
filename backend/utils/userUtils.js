/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const db = require('../db');

async function isUserBlocked(userId) {
  if (!userId) return false;
  const result = await db.getQuery()('SELECT is_blocked FROM users WHERE id = $1', [userId]);
  return !!result.rows[0]?.is_blocked;
}

module.exports = { isUserBlocked }; 