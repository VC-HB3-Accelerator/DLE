/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Запись аудита entitlement updates (без секретов и RPC URL).
 */

const db = require('../db');
const logger = require('../utils/logger');

async function recordEntitlementAudit(entry = {}) {
  try {
    await db.getQuery()(
      `INSERT INTO update_entitlement_audit (
         dle_contract, result, reason, token_address, treasury_address,
         chain_id, network, balance, min_balance, user_id, wallet_address, request_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        String(entry.dleContract || '').toLowerCase() || null,
        String(entry.result || 'deny'),
        entry.reason || null,
        entry.tokenAddress || null,
        entry.treasuryAddress || null,
        entry.chainId != null ? Number(entry.chainId) : null,
        entry.network || null,
        entry.balance != null ? String(entry.balance) : null,
        entry.minBalance != null ? String(entry.minBalance) : null,
        entry.userId != null ? Number(entry.userId) : null,
        entry.walletAddress || null,
        entry.requestId || null,
      ]
    );
  } catch (error) {
    // таблица может ещё не быть / БД недоступна — не ломаем authorize
    if (error?.code === '42P01') {
      logger.warn('[updates/entitlement-audit] таблица отсутствует (миграция 128)');
      return;
    }
    logger.warn(`[updates/entitlement-audit] write failed: ${error.message}`);
  }
}

module.exports = {
  recordEntitlementAudit,
};
