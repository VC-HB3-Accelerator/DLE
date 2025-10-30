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

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS } = require('../shared/permissions');
const { broadcastTagsUpdate } = require('../wsHub');

// console.log('[tags.js] ROUTER LOADED');

router.use((req, res, next) => {
  // console.log('[tags.js] ROUTER REQUEST:', req.method, req.originalUrl);
  next();
});

// PATCH /api/tags/user/:userId — установить теги пользователю
router.patch('/user/:userId', requireAuth, requirePermission(PERMISSIONS.MANAGE_TAGS), async (req, res) => {
  const userIdParam = req.params.userId;
  const { tags } = req.body; // массив tagIds (id строк из таблицы тегов)
  
  // Гостевые пользователи (guest_123) не могут иметь теги
  if (userIdParam.startsWith('guest_')) {
    return res.status(400).json({ error: 'Guests cannot have tags' });
  }
  
  const userId = Number(userIdParam);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  if (!Array.isArray(tags)) {
    return res.status(400).json({ error: 'tags должен быть массивом' });
  }
  
  try {
    // Удаляем старые связи
    await db.getQuery()('DELETE FROM user_tag_links WHERE user_id = $1', [userId]);
    // Добавляем новые связи
    for (const tagId of tags) {
      await db.getQuery()(
        'INSERT INTO user_tag_links (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, tagId]
      );
    }
    
    // Отправляем WebSocket уведомление об обновлении тегов
    broadcastTagsUpdate(null, userId);
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tags/user/:userId — получить все теги пользователя
// Получение тегов пользователя
router.get('/user/:userId', requireAuth, requirePermission(PERMISSIONS.VIEW_CONTACTS), async (req, res) => {
  const userIdParam = req.params.userId;
  
  // Гостевые пользователи (guest_123) не имеют тегов
  if (userIdParam.startsWith('guest_')) {
    return res.json({ tags: [] });
  }
  
  const userId = Number(userIdParam);
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  try {
    const result = await db.getQuery()(
      'SELECT tag_id FROM user_tag_links WHERE user_id = $1',
      [userId]
    );
    res.json({ tags: result.rows.map(r => r.tag_id) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/tags/user/:userId/tag/:tagId — удалить тег у пользователя
// Удаление тега у пользователя
router.delete('/user/:userId/tag/:tagId', requireAuth, requirePermission(PERMISSIONS.MANAGE_TAGS), async (req, res) => {
  const userIdParam = req.params.userId;
  
  // Гостевые пользователи (guest_123) не могут иметь теги
  if (userIdParam.startsWith('guest_')) {
    return res.status(400).json({ error: 'Guests cannot have tags' });
  }
  
  const userId = Number(userIdParam);
  const tagId = Number(req.params.tagId);
  
  if (isNaN(userId) || isNaN(tagId)) {
    return res.status(400).json({ error: 'Invalid user ID or tag ID' });
  }
  
  try {
    await db.getQuery()(
      'DELETE FROM user_tag_links WHERE user_id = $1 AND tag_id = $2',
      [userId, tagId]
    );
    
    // Отправляем WebSocket уведомление об обновлении тегов
    broadcastTagsUpdate(null, userId);
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tags/user/:rowId/multirelations — массовое обновление тегов через multirelations
// Добавление множественных тегов пользователю
router.post('/user/:rowId/multirelations', requireAuth, requirePermission(PERMISSIONS.MANAGE_TAGS), async (req, res) => {
  const rowId = Number(req.params.rowId);
  const { column_id, to_table_id, to_row_ids } = req.body; // to_row_ids: массив id тегов
  if (!Array.isArray(to_row_ids)) return res.status(400).json({ error: 'to_row_ids должен быть массивом' });
  
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  
  // Проверяем, является ли это обновлением тегов (проверяем связанную таблицу)
  const relatedTableName = (await db.getQuery()('SELECT decrypt_text(name_encrypted, $2) as name FROM user_tables WHERE id = $1', [to_table_id, encryptionKey])).rows[0];
        // console.log('🔄 [Tags] Multirelations: проверяем связанную таблицу:', { to_table_id, tableName: relatedTableName?.name });
  
  if (relatedTableName && relatedTableName.name === 'Теги клиентов') {
          // console.log('🔄 [Tags] Multirelations: обновление тегов для строки:', rowId);
    
    // Удаляем старые связи для этой строки/столбца
    await db.getQuery()('DELETE FROM user_table_relations WHERE from_row_id = $1 AND column_id = $2', [rowId, column_id]);
    
    // Добавляем новые связи
    for (const to_row_id of to_row_ids) {
      await db.getQuery()(
        `INSERT INTO user_table_relations (from_row_id, column_id, to_table_id, to_row_id)
         VALUES ($1, $2, $3, $4)`,
        [rowId, column_id, to_table_id, to_row_id]
      );
    }
    
    // Отправляем WebSocket уведомление об обновлении тегов
    broadcastTagsUpdate(null, rowId);
    
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Этот endpoint предназначен только для работы с тегами' });
  }
});

module.exports = router; 