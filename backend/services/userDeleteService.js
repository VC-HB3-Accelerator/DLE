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

async function deleteUserById(userId) {
  console.log('[DELETE] Вызван deleteUserById для userId:', userId);
  try {
    // Удаляем в правильном порядке (сначала зависимые таблицы, потом основную)
    
    // 1. Удаляем user_identities
    console.log('[DELETE] Начинаем удаление user_identities для userId:', userId);
    const resIdentities = await db.getQuery()(
      'DELETE FROM user_identities WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено user_identities:', resIdentities.rows.length);
    
    // 2. Удаляем messages
    console.log('[DELETE] Начинаем удаление messages для userId:', userId);
    const resMessages = await db.getQuery()(
      'DELETE FROM messages WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено messages:', resMessages.rows.length);
    
    // 2.1. Удаляем хеши дедупликации
    console.log('[DELETE] Начинаем удаление message_deduplication для userId:', userId);
    const resDeduplication = await db.getQuery()(
      'DELETE FROM message_deduplication WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено deduplication hashes:', resDeduplication.rows.length);
    
    // 3. Удаляем conversations
    console.log('[DELETE] Начинаем удаление conversations для userId:', userId);
    const resConversations = await db.getQuery()(
      'DELETE FROM conversations WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено conversations:', resConversations.rows.length);
    
    // 4. Удаляем conversation_participants
    console.log('[DELETE] Начинаем удаление conversation_participants для userId:', userId);
    const resParticipants = await db.getQuery()(
      'DELETE FROM conversation_participants WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено conversation_participants:', resParticipants.rows.length);
    
    // 5. Удаляем user_preferences
    console.log('[DELETE] Начинаем удаление user_preferences для userId:', userId);
    const resPreferences = await db.getQuery()(
      'DELETE FROM user_preferences WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено user_preferences:', resPreferences.rows.length);
    
    // 6. Удаляем verification_codes
    console.log('[DELETE] Начинаем удаление verification_codes для userId:', userId);
    const resCodes = await db.getQuery()(
      'DELETE FROM verification_codes WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено verification_codes:', resCodes.rows.length);
    
    // 7. Удаляем guest_user_mapping
    console.log('[DELETE] Начинаем удаление guest_user_mapping для userId:', userId);
    const resGuestMapping = await db.getQuery()(
      'DELETE FROM guest_user_mapping WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено guest_user_mapping:', resGuestMapping.rows.length);
    
    // 8. Удаляем user_tag_links
    console.log('[DELETE] Начинаем удаление user_tag_links для userId:', userId);
    const resTagLinks = await db.getQuery()(
      'DELETE FROM user_tag_links WHERE user_id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Удалено user_tag_links:', resTagLinks.rows.length);
    
    // 9. Удаляем global_read_status
    console.log('[DELETE] Начинаем удаление global_read_status для userId:', userId);
    const resReadStatus = await db.getQuery()(
      'DELETE FROM global_read_status WHERE user_id = $1 RETURNING user_id',
      [userId]
    );
    console.log('[DELETE] Удалено global_read_status:', resReadStatus.rows.length);
    
    // 10. Удаляем самого пользователя
    console.log('[DELETE] Начинаем удаление пользователя из users:', userId);
    const result = await db.getQuery()(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [userId]
    );
    console.log('[DELETE] Результат удаления пользователя:', result.rows.length, result.rows);
    
    return result.rows.length;
  } catch (e) {
    console.error('[DELETE] Ошибка при удалении пользователя:', e);
    throw e;
  }
}

module.exports = { deleteUserById }; 