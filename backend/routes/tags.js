/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
const { requirePermission, requireEditContactsScoped } = require('../middleware/permissions');
const { PERMISSIONS } = require('../shared/permissions');
const { broadcastTagsUpdate } = require('../wsHub');
const contactViewerTagsService = require('../services/contactViewerTagsService');

router.use((req, res, next) => {
  next();
});

async function requireCanEditContactParam(req, res, contactId) {
  const viewerId = req.user?.id || req.session?.userId;
  const accessResolver = require('../services/accessResolverService');
  const access = req.viewerAccess || await accessResolver.resolveAccess(viewerId);
  req.viewerAccess = access;
  if (!accessResolver.canEditContacts(access)) {
    return res.status(403).json({ error: 'Доступ запрещен' });
  }
  const allowed = await accessResolver.canEditContact(access, contactId, viewerId);
  if (!allowed) {
    return res.status(403).json({ error: 'Доступ к этому контакту запрещен' });
  }
  return null;
}

// --- Личные теги (TZ_CRM_PERSONAL_TAGS) ---

router.get('/my/dictionary', requireAuth, requireEditContactsScoped(), async (req, res) => {
  try {
    const viewerId = req.user?.id || req.session?.userId;
    const { tableId, tags } = await contactViewerTagsService.listDictionaryTags(viewerId);
    res.json({ success: true, tableId, tags });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/my/dictionary', requireAuth, requireEditContactsScoped(), async (req, res) => {
  try {
    const viewerId = req.user?.id || req.session?.userId;
    const tag = await contactViewerTagsService.createDictionaryTag(viewerId, {
      name: req.body?.name,
      description: req.body?.description,
    });
    res.json({ success: true, tag });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/my/contact/:contactId', requireAuth, requirePermission(PERMISSIONS.VIEW_CONTACTS), async (req, res) => {
  try {
    const viewerId = req.user?.id || req.session?.userId;
    const contactIdParam = req.params.contactId;
    if (String(contactIdParam).startsWith('guest_')) {
      return res.json({ my_tag_ids: [] });
    }
    const contactId = Number(contactIdParam);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return res.status(400).json({ error: 'Invalid contact id' });
    }
    const accessResolver = require('../services/accessResolverService');
    const access = await accessResolver.resolveAccess(viewerId);
    const allowed = await accessResolver.canViewContact(access, contactId, viewerId);
    if (!allowed) {
      return res.status(403).json({ error: 'Доступ к этому контакту запрещен' });
    }
    const my_tag_ids = await contactViewerTagsService.getMyTagIdsForContact(viewerId, contactId);
    res.json({ my_tag_ids });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.patch('/my/contact/:contactId', requireAuth, requireEditContactsScoped(), async (req, res) => {
  try {
    const viewerId = req.user?.id || req.session?.userId;
    const contactIdParam = req.params.contactId;
    if (String(contactIdParam).startsWith('guest_')) {
      return res.status(400).json({ error: 'Guests cannot have tags' });
    }
    const contactId = Number(contactIdParam);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return res.status(400).json({ error: 'Invalid contact id' });
    }
    const denied = await requireCanEditContactParam(req, res, contactId);
    if (denied) return;

    const { tags, add, remove } = req.body || {};
    let my_tag_ids;
    if (Array.isArray(tags)) {
      my_tag_ids = await contactViewerTagsService.replaceMyTagsOnContact(viewerId, contactId, tags);
    } else if (Array.isArray(add) || Array.isArray(remove)) {
      if (Array.isArray(add) && add.length) {
        await contactViewerTagsService.addMyTagsToContacts(viewerId, [contactId], add);
      }
      if (Array.isArray(remove) && remove.length) {
        await contactViewerTagsService.removeMyTagsFromContacts(viewerId, [contactId], remove);
      }
      my_tag_ids = await contactViewerTagsService.getMyTagIdsForContact(viewerId, contactId);
    } else {
      return res.status(400).json({ error: 'Укажите tags[] или add[]/remove[]' });
    }

    broadcastTagsUpdate(null, contactId);
    res.json({ success: true, my_tag_ids });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/my/contact/:contactId/tag/:tagId', requireAuth, requireEditContactsScoped(), async (req, res) => {
  try {
    const viewerId = req.user?.id || req.session?.userId;
    const contactId = Number(req.params.contactId);
    const tagId = Number(req.params.tagId);
    if (!Number.isInteger(contactId) || !Number.isInteger(tagId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const denied = await requireCanEditContactParam(req, res, contactId);
    if (denied) return;
    await contactViewerTagsService.removeMyTagFromContact(viewerId, contactId, tagId);
    broadcastTagsUpdate(null, contactId);
    res.json({ success: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/my/contacts/bulk-add', requireAuth, requireEditContactsScoped(), async (req, res) => {
  try {
    const viewerId = req.user?.id || req.session?.userId;
    const accessResolver = require('../services/accessResolverService');
    const access = req.viewerAccess;
    const { userIds = [], tagIds = [] } = req.body || {};
    const uniqueUserIds = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!uniqueUserIds.length) {
      return res.status(400).json({ error: 'userIds обязателен' });
    }
    const scoped = await accessResolver.filterContactIdsToScope(access, uniqueUserIds, viewerId);
    if (!scoped.length) {
      return res.status(403).json({ error: 'Нет доступных контактов в скоупе' });
    }
    const result = await contactViewerTagsService.addMyTagsToContacts(viewerId, scoped, tagIds);
    for (const uid of scoped) broadcastTagsUpdate(null, uid);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/my/contacts/bulk-remove', requireAuth, requireEditContactsScoped(), async (req, res) => {
  try {
    const viewerId = req.user?.id || req.session?.userId;
    const accessResolver = require('../services/accessResolverService');
    const access = req.viewerAccess;
    const { userIds = [], tagIds = [] } = req.body || {};
    const uniqueUserIds = [...new Set(userIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!uniqueUserIds.length) {
      return res.status(400).json({ error: 'userIds обязателен' });
    }
    const scoped = await accessResolver.filterContactIdsToScope(access, uniqueUserIds, viewerId);
    const result = await contactViewerTagsService.removeMyTagsFromContacts(viewerId, scoped, tagIds);
    for (const uid of scoped) broadcastTagsUpdate(null, uid);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// PATCH /api/tags/user/:userId — установить теги пользователю
router.patch('/user/:userId', requireAuth, requirePermission(PERMISSIONS.MANAGE_TAGS), async (req, res) => {
  const userIdParam = req.params.userId;
  const { tags } = req.body;

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
    await db.getQuery()('DELETE FROM user_tag_links WHERE user_id = $1', [userId]);
    for (const tagId of tags) {
      await db.getQuery()(
        'INSERT INTO user_tag_links (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, tagId]
      );
    }

    broadcastTagsUpdate(null, userId);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tags/users/bulk-add — добавить теги выбранным пользователям (без удаления существующих)
router.post('/users/bulk-add', requireAuth, requirePermission(PERMISSIONS.MANAGE_TAGS), async (req, res) => {
  const { userIds = [], tagIds = [] } = req.body;

  const uniqueUserIds = [...new Set(
    userIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)
  )];
  const uniqueTagIds = [...new Set(
    tagIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)
  )];

  if (!uniqueUserIds.length) {
    return res.status(400).json({ error: 'userIds обязателен' });
  }

  if (!uniqueTagIds.length) {
    return res.status(400).json({ error: 'tagIds обязателен' });
  }

  try {
    for (const userId of uniqueUserIds) {
      for (const tagId of uniqueTagIds) {
        await db.getQuery()(
          'INSERT INTO user_tag_links (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, tagId]
        );
      }
      broadcastTagsUpdate(null, userId);
    }

    res.json({
      success: true,
      usersUpdated: uniqueUserIds.length,
      tagsAdded: uniqueTagIds.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/tags/users/bulk-remove — удалить теги у выбранных пользователей
router.post('/users/bulk-remove', requireAuth, requirePermission(PERMISSIONS.MANAGE_TAGS), async (req, res) => {
  const { userIds = [], tagIds = [] } = req.body;

  const uniqueUserIds = [...new Set(
    userIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)
  )];
  const uniqueTagIds = [...new Set(
    tagIds.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)
  )];

  if (!uniqueUserIds.length) {
    return res.status(400).json({ error: 'userIds обязателен' });
  }

  if (!uniqueTagIds.length) {
    return res.status(400).json({ error: 'tagIds обязателен' });
  }

  try {
    for (const userId of uniqueUserIds) {
      for (const tagId of uniqueTagIds) {
        await db.getQuery()(
          'DELETE FROM user_tag_links WHERE user_id = $1 AND tag_id = $2',
          [userId, tagId]
        );
      }
      broadcastTagsUpdate(null, userId);
    }

    res.json({
      success: true,
      usersUpdated: uniqueUserIds.length,
      tagsRemoved: uniqueTagIds.length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/tags/user/:userId — получить все теги пользователя
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