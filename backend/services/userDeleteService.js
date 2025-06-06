const db = require('../db');

async function deleteUserById(userId) {
  console.log('[DELETE] Вызван deleteUserById для userId:', userId);
  const query = db.getQuery();
  try {
    await query('BEGIN');
    console.log('[DELETE] Начинаем удаление user_identities для userId:', userId);
    const resIdentities = await query('DELETE FROM user_identities WHERE user_id = $1', [userId]);
    console.log('[DELETE] Удалено user_identities:', resIdentities.rowCount);
    console.log('[DELETE] Начинаем удаление messages для userId:', userId);
    const resMessages = await query('DELETE FROM messages WHERE user_id = $1', [userId]);
    console.log('[DELETE] Удалено messages:', resMessages.rowCount);
    console.log('[DELETE] Начинаем удаление пользователя из users:', userId);
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING *', [userId]);
    console.log('[DELETE] Результат удаления пользователя:', result.rowCount, result.rows);
    await query('COMMIT');
    return result.rowCount;
  } catch (e) {
    await query('ROLLBACK');
    console.error('[DELETE] Ошибка при удалении пользователя:', e);
    throw e;
  }
}

module.exports = { deleteUserById }; 