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

const db = require('../db');
const logger = require('../utils/logger');

// Получение связанного кошелька
async function getLinkedWallet(userId) {
  logger.info(`[getLinkedWallet] Called with userId: ${userId} (Type: ${typeof userId})`);
  try {
    const result = await db.getQuery()(
      `SELECT provider_id as address 
       FROM user_identities 
       WHERE user_id = $1 AND provider = 'wallet'`,
      [userId]
    );
    logger.info(`[getLinkedWallet] DB query result for userId ${userId}:`, result.rows);
    const address = result.rows[0]?.address;
    logger.info(`[getLinkedWallet] Returning address: ${address} for userId ${userId}`);
    return address;
  } catch (error) {
    logger.error(`[getLinkedWallet] Error fetching linked wallet for userId ${userId}:`, error);
    return undefined;
  }
}

module.exports = { getLinkedWallet }; 