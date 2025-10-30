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
      min_balance: token.minBalance == null ? 0 : Number(token.minBalance),
      readonly_threshold: token.readonlyThreshold == null ? null : Number(token.readonlyThreshold),
      editor_threshold: token.editorThreshold == null ? null : Number(token.editorThreshold)
    });
  }
}

async function upsertAuthToken(token) {
  console.log('[AuthTokenService] Получены данные токена:', token);
  console.log('[AuthTokenService] token.readonlyThreshold:', token.readonlyThreshold, 'тип:', typeof token.readonlyThreshold);
  console.log('[AuthTokenService] token.editorThreshold:', token.editorThreshold, 'тип:', typeof token.editorThreshold);
  
  const minBalance = token.minBalance == null ? 0 : Number(token.minBalance);
  const readonlyThreshold = (token.readonlyThreshold === null || token.readonlyThreshold === undefined || token.readonlyThreshold === '') ? null : Number(token.readonlyThreshold);
  const editorThreshold = (token.editorThreshold === null || token.editorThreshold === undefined || token.editorThreshold === '') ? null : Number(token.editorThreshold);
  
  // Валидация порогов доступа
  if (readonlyThreshold >= editorThreshold) {
    throw new Error('Минимум токенов для Read-Only доступа должен быть меньше минимума для Editor доступа');
  }
  
  console.log('[AuthTokenService] Вычисленные значения:');
  console.log('[AuthTokenService] readonlyThreshold:', readonlyThreshold);
  console.log('[AuthTokenService] editorThreshold:', editorThreshold);
  
  // Проверяем, существует ли токен
  const existingTokens = await encryptedDb.getData('auth_tokens', {
    address: token.address,
    network: token.network
  }, 1);
  
  if (existingTokens.length > 0) {
    // Обновляем существующий токен
    await encryptedDb.saveData('auth_tokens', {
      name: token.name,
      min_balance: minBalance,
      readonly_threshold: readonlyThreshold,
      editor_threshold: editorThreshold
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
      min_balance: minBalance,
      readonly_threshold: readonlyThreshold,
      editor_threshold: editorThreshold
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