/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Identifier для unifiedMessageProcessor: любой способ входа (wallet / email / telegram).
 */

const identityService = require('../services/identity-service');

const PROVIDER_ORDER = ['wallet', 'email', 'telegram'];

/**
 * @param {number|string} userId
 * @returns {Promise<string|null>} e.g. wallet:0x… | email:a@b.c | telegram:123
 */
async function resolveSenderIdentifier(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) return null;

  for (const provider of PROVIDER_ORDER) {
    const row = await identityService.findIdentity(uid, provider);
    const pid = row?.provider_id != null ? String(row.provider_id).trim() : '';
    if (pid) return `${provider}:${pid}`;
  }
  return null;
}

module.exports = {
  resolveSenderIdentifier,
  PROVIDER_ORDER,
};
