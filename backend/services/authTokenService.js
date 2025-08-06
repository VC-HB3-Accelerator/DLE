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

const encryptedDb = require('./encryptedDatabaseService');

async function getAllAuthTokens() {
  const tokens = await encryptedDb.getData('auth_tokens', {}, null, 'id');
  return tokens;
}

async function saveAllAuthTokens(authTokens) {
  // Удаляем все существующие токены
  await encryptedDb.deleteData('auth_tokens', {});
  
  // Сохраняем новые токены
  for (const token of authTokens) {
    await encryptedDb.saveData('auth_tokens', {
      name: token.name,
      address: token.address,
      network: token.network,
      min_balance: token.minBalance == null ? 0 : Number(token.minBalance)
    });
  }
}

async function upsertAuthToken(token) {
  const minBalance = token.minBalance == null ? 0 : Number(token.minBalance);
  
  // Проверяем, существует ли токен
  const existingTokens = await encryptedDb.getData('auth_tokens', {
    address: token.address,
    network: token.network
  }, 1);
  
  if (existingTokens.length > 0) {
    // Обновляем существующий токен
    await encryptedDb.saveData('auth_tokens', {
      name: token.name,
      min_balance: minBalance
    }, {
      address: token.address,
      network: token.network
    });
  } else {
    // Создаем новый токен
    await encryptedDb.saveData('auth_tokens', {
      name: token.name,
      address: token.address,
      network: token.network,
      min_balance: minBalance
    });
  }
}

async function deleteAuthToken(address, network) {
  console.log(`[AuthTokenService] deleteAuthToken: address=${address}, network=${network}`);
  try {
    await encryptedDb.deleteData('auth_tokens', { address, network });
    console.log(`[AuthTokenService] Токен успешно удален`);
  } catch (error) {
    console.error(`[AuthTokenService] Ошибка при удалении токена:`, error);
    throw error;
  }
}

module.exports = { getAllAuthTokens, saveAllAuthTokens, upsertAuthToken, deleteAuthToken }; 