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

async function deleteUserById(userId) {
  console.log('[DELETE] Вызван deleteUserById для userId:', userId);
  try {
    console.log('[DELETE] Начинаем удаление user_identities для userId:', userId);
    const resIdentities = await encryptedDb.deleteData('user_identities', { user_id: userId });
    console.log('[DELETE] Удалено user_identities:', resIdentities.length);
    
    console.log('[DELETE] Начинаем удаление messages для userId:', userId);
    const resMessages = await encryptedDb.deleteData('messages', { user_id: userId });
    console.log('[DELETE] Удалено messages:', resMessages.length);
    
    console.log('[DELETE] Начинаем удаление пользователя из users:', userId);
    const result = await encryptedDb.deleteData('users', { id: userId });
    console.log('[DELETE] Результат удаления пользователя:', result.length, result);
    
    return result.length;
  } catch (e) {
    console.error('[DELETE] Ошибка при удалении пользователя:', e);
    throw e;
  }
}

module.exports = { deleteUserById }; 