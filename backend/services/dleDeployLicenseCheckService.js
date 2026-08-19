/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Проверка license-токена на кошельке для запуска деплоя DLE.
 */

const { checkHolderAgainstWhitelist } = require('./tokenWhitelistBalanceCheck');

async function checkWallet(walletAddress) {
  if (!walletAddress) {
    return { allowed: false, reason: 'wallet_not_connected' };
  }
  // Деплой — действие editor: соблюдаем editor_threshold (и min_balance как нижнюю границу).
  return checkHolderAgainstWhitelist(walletAddress, { requiredLevel: 'editor' });
}

module.exports = {
  checkWallet,
};

