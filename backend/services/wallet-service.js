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

const encryptedDb = require('./encryptedDatabaseService');
const logger = require('../utils/logger');

// Получение связанного кошелька
async function getLinkedWallet(userId) {
  try {
    const result = await encryptedDb.getData('user_identities', {
      user_id: userId,
      provider: 'wallet'
    }, 1);
    const address = result[0]?.provider_id;
    return address;
  } catch (error) {
    logger.error(`[getLinkedWallet] Error fetching linked wallet for userId ${userId}:`, error);
    return undefined;
  }
}

module.exports = { getLinkedWallet }; 