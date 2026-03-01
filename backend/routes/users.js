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
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { PERMISSIONS, ROLES } = require('../shared/permissions');
const { deleteUserById } = require('../services/userDeleteService');
const { broadcastContactsUpdate } = require('../wsHub');
// const userService = require('../services/userService');

// console.log('[users.js] ROUTER LOADED');

router.use((req, res, next) => {
  // console.log('[users.js] ROUTER REQUEST:', req.method, req.originalUrl);
  next();
});

// Получение списка пользователей
// router.get('/', (req, res) => {
//   res.json({ message: 'Users API endpoint' });
// });

// Получить профиль текущего пользователя
/*
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await userService.getUserProfile(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (error) {
    // console.error('Error getting user profile:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
*/

// Обновить профиль текущего пользователя
/*
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const profileData = req.body;
    const updatedUser = await userService.updateUserProfile(userId, profileData);
    res.json({ success: true, user: updatedUser, message: 'Profile updated successfully' });
  } catch (error) {
    // console.error('Error updating user profile:', error);
    // Можно добавить более специфичную обработку ошибок, например, если данные невалидны
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
*/

// Получение списка пользователей с фильтрацией (CRM/Контакты)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const {
      tagIds = '',
      dateFrom = '',
      dateTo = '',
      contactType = 'all',
      search = '',
      newMessages = '',
      blocked = 'all'
    } = req.query;
    const adminId = req.user && req.user.id;
    const userRole = req.user.role;

    // Получаем ключ шифрования
    const fs = require('fs');
    const path = require('path');
    // Получаем ключ шифрования через унифицированную утилиту
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();

    // --- Формируем условия ---
    const where = [];
    const params = [];
    let idx = 1;

    // Фильтрация для USER - видит только editor админов и себя
    if (userRole === 'user') {
      where.push(`(u.role = '${ROLES.EDITOR}' OR u.id = $${idx++})`);
      params.push(req.user.id);
    }

    // Фильтр по дате
    if (dateFrom) {
      where.push(`DATE(u.created_at) >= $${idx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push(`DATE(u.created_at) <= $${idx++}`);
      params.push(dateTo);
    }

    // Фильтр по типу контакта
    if (contactType !== 'all') {
      where.push(`EXISTS (
        SELECT 1 FROM user_identities ui
        WHERE ui.user_id = u.id AND ui.provider_encrypted = encrypt_text($${idx++}, $${idx++})
      )`);
      params.push(contactType);
      params.push(encryptionKey);
    }

    // Фильтр по поиску
    if (search) {
      where.push(`(
        LOWER(decrypt_text(u.first_name_encrypted, $${idx++})) LIKE $${idx++} OR
        LOWER(decrypt_text(u.last_name_encrypted, $${idx++})) LIKE $${idx++} OR
        EXISTS (SELECT 1 FROM user_identities ui WHERE ui.user_id = u.id AND LOWER(decrypt_text(ui.provider_id_encrypted, $${idx++})) LIKE $${idx++})
      )`);
      params.push(encryptionKey); // Для first_name_encrypted
      params.push(`%${search.toLowerCase()}%`);
      params.push(encryptionKey); // Для last_name_encrypted
      params.push(`%${search.toLowerCase()}%`);
      params.push(encryptionKey); // Для provider_id_encrypted
      params.push(`%${search.toLowerCase()}%`);
    }

    // Фильтр по блокировке
    if (blocked === 'blocked') {
      where.push(`u.is_blocked = true`);
    } else if (blocked === 'unblocked') {
      where.push(`u.is_blocked = false`);
    }

    // --- Основной SQL ---
    let sql = `
      SELECT u.id, 
        CASE 
          WHEN u.first_name_encrypted IS NULL OR u.first_name_encrypted = '' THEN NULL
          ELSE decrypt_text(u.first_name_encrypted, $${idx++})
        END as first_name,
        CASE 
          WHEN u.last_name_encrypted IS NULL OR u.last_name_encrypted = '' THEN NULL
          ELSE decrypt_text(u.last_name_encrypted, $${idx++})
        END as last_name,
        u.created_at, u.preferred_language, u.is_blocked, u.role,
        CASE 
          WHEN u.role = 'editor' THEN 'editor'
          WHEN u.role = 'readonly' THEN 'editor'  -- readonly админы тоже editor
          ELSE 'user'
        END as contact_type,
        (SELECT decrypt_text(provider_id_encrypted, $${idx++}) FROM user_identities WHERE user_id = u.id AND provider_encrypted = encrypt_text('email', $${idx++}) LIMIT 1) AS email,
        (SELECT decrypt_text(provider_id_encrypted, $${idx++}) FROM user_identities WHERE user_id = u.id AND provider_encrypted = encrypt_text('telegram', $${idx++}) LIMIT 1) AS telegram,
        (SELECT decrypt_text(provider_id_encrypted, $${idx++}) FROM user_identities WHERE user_id = u.id AND provider_encrypted = encrypt_text('wallet', $${idx++}) LIMIT 1) AS wallet
      FROM users u
    `;
    params.push(encryptionKey, encryptionKey, encryptionKey, encryptionKey, encryptionKey, encryptionKey, encryptionKey, encryptionKey);

    // Фильтрация по тегам
    if (tagIds) {
      const tagIdArr = tagIds.split(',').map(Number).filter(Boolean);
      if (tagIdArr.length > 0) {
        sql += `
          JOIN user_tag_links utl ON utl.user_id = u.id
          WHERE utl.tag_id = ANY($${idx++})
          GROUP BY u.id
          HAVING COUNT(DISTINCT utl.tag_id) = $${idx++}
        `;
        params.push(tagIdArr);
        params.push(tagIdArr.length);
      }
    } else if (where.length > 0) {
      sql += ` WHERE ${where.join(' AND ')} `;
    }

    if (!tagIds) {
      sql += ' ORDER BY u.id ';
    }

    // --- Выполняем запрос ---
    const usersResult = await db.getQuery()(sql, params);
    let users = usersResult.rows;

    // --- Фильтрация по новым сообщениям ---
    if (newMessages === 'yes' && adminId) {
      // Получаем время последнего прочтения для каждого пользователя
      const readRes = await db.getQuery()(
        'SELECT user_id, last_read_at FROM admin_read_messages WHERE admin_id = $1',
        [adminId]
      );
      const readMap = {};
      for (const row of readRes.rows) {
        readMap[row.user_id] = row.last_read_at;
      }
      // Получаем последнее сообщение для каждого пользователя
      const msgRes = await db.getQuery()(
        `SELECT user_id, MAX(created_at) as last_msg_at FROM messages GROUP BY user_id`
      );
      const msgMap = {};
      for (const row of msgRes.rows) {
        msgMap[row.user_id] = row.last_msg_at;
      }
      // Оставляем только тех, у кого есть новые сообщения
      users = users.filter(u => {
        const lastRead = readMap[u.id];
        const lastMsg = msgMap[u.id];
        return lastMsg && (!lastRead || new Date(lastMsg) > new Date(lastRead));
      });
    }

    // --- Формируем ответ для зарегистрированных пользователей ---
    const contacts = users.map(u => ({
      id: u.id,
      name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || null,
      email: u.email || null,
      telegram: u.telegram || null,
      wallet: u.wallet || null,
      created_at: u.created_at,
      preferred_language: u.preferred_language || [],
      is_blocked: u.is_blocked || false,
      contact_type: u.contact_type || 'user',
      role: u.role || 'user'
    }));

    // --- Добавляем гостевые контакты ---
    const guestContactsResult = await db.getQuery()(
      `WITH decrypted_guests AS (
        SELECT 
          id,
          decrypt_text(identifier_encrypted, $1) as guest_identifier,
          channel,
          created_at,
          user_id,
          metadata
        FROM unified_guest_messages
        WHERE user_id IS NULL
      ),
      first_messages AS (
        SELECT DISTINCT ON (guest_identifier, channel)
          id as guest_id,
          guest_identifier,
          channel,
          metadata,
          created_at
        FROM decrypted_guests
        ORDER BY guest_identifier, channel, id ASC
      ),
      guest_groups AS (
        SELECT 
          fm.guest_id,
          fm.guest_identifier,
          fm.channel,
          fm.metadata,
          fm.created_at,
          MAX(dg.created_at) as last_message_at,
          COUNT(*) as message_count
        FROM first_messages fm
        JOIN decrypted_guests dg ON dg.guest_identifier = fm.guest_identifier AND dg.channel = fm.channel
        GROUP BY fm.guest_id, fm.guest_identifier, fm.channel, fm.metadata, fm.created_at
      )
      SELECT 
        ROW_NUMBER() OVER (ORDER BY guest_id ASC) as guest_number,
        guest_id,
        guest_identifier,
        channel,
        created_at,
        last_message_at,
        message_count,
        metadata
      FROM guest_groups
      ORDER BY guest_id ASC`,
      [encryptionKey]
    );

    const guestContacts = guestContactsResult.rows.map((g) => {
      const channelMap = {
        'web': '🌐',
        'telegram': '📱',
        'email': '✉️'
      };
      const icon = channelMap[g.channel] || '👤';
      const rawId = g.guest_identifier.replace(`${g.channel}:`, '');
      
      // Проверяем, есть ли кастомное имя в metadata
      let metadata = g.metadata || {};
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }
      
      // Формируем имя: сначала проверяем кастомное имя, затем генерируем автоматически
      let displayName;
      if (metadata.custom_name) {
        displayName = metadata.custom_name;
      } else if (g.channel === 'email') {
        displayName = `${icon} ${rawId}`;
      } else if (g.channel === 'telegram') {
        displayName = `${icon} Telegram (${rawId})`;
      } else {
        displayName = `${icon} Гость ${g.guest_number}`;
      }
      
      return {
        id: `guest_${g.guest_id}`, // Используем внутренний ID для поиска
        guest_number: parseInt(g.guest_number), // Порядковый номер для отображения
        guest_identifier: g.guest_identifier, // Сохраняем для запросов
        name: displayName,
        email: g.channel === 'email' ? rawId : null,
        telegram: g.channel === 'telegram' ? rawId : null,
        wallet: null,
        created_at: g.created_at,
        preferred_language: [],
        is_blocked: false,
        contact_type: 'guest',
        role: 'guest',
        guest_info: {
          channel: g.channel,
          message_count: parseInt(g.message_count),
          last_message_at: g.last_message_at
        }
      };
    });

    // Объединяем списки
    const allContacts = [...contacts, ...guestContacts];

    res.json({ success: true, contacts: allContacts });
  } catch (error) {
    logger.error('Error fetching contacts:', error);
    next(error);
  }
});

// GET /api/users - Получить список всех пользователей (пример, может требовать прав администратора)
// В текущей реализации этот маршрут не используется и закомментирован
/*
router.get('/', async (req, res) => {
  try {
    // const users = await userService.getAllUsers(); // Удаляем
    await userService.getAllUsers(); // Просто вызываем, если нужно действие, но результат не используется
    // res.json({ success: true, users });
    res.json({ success: true, message: "Users retrieved" }); // Пример ответа без данных
  } catch (error) {
    console.error('Error getting all users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
*/

// Получить просмотренные контакты
router.get('/read-contacts-status', async (req, res) => {
  try {
    const adminId = req.user && req.user.id;
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized: adminId missing' });
    }
    const result = await db.query(
      'SELECT contact_id FROM admin_read_contacts WHERE admin_id = $1',
      [adminId]
    );
    res.json(result.rows.map(r => r.contact_id));
  } catch (e) {
    console.error('[ERROR] /read-contacts-status:', e);
    res.status(500).json({ error: e.message });
  }
});

// Пометить контакт как просмотренный
router.post('/mark-contact-read', async (req, res) => {
  try {
    console.log('[DEBUG] /mark-contact-read: req.body:', req.body);
    console.log('[DEBUG] /mark-contact-read: req.user:', req.user);
    console.log('[DEBUG] /mark-contact-read: req.session:', req.session);
    console.log('[DEBUG] /mark-contact-read: req.user.userAccessLevel:', req.user?.userAccessLevel);
    
    const { contactId } = req.body;
    
    if (!contactId) {
      console.log('[ERROR] /mark-contact-read: contactId missing');
      return res.status(400).json({ error: 'contactId required' });
    }

    // НОВАЯ СИСТЕМА РОЛЕЙ: используем shared/permissions.js
    const { hasPermission, ROLES } = require('/app/shared/permissions');
    
    // Определяем роль пользователя через новую систему
    let userRole = ROLES.GUEST; // По умолчанию гость
    
    if (req.user?.userAccessLevel) {
      // Используем новую систему ролей
      if (req.user.userAccessLevel.level === ROLES.READONLY || req.user.userAccessLevel.level === 'readonly') {
        userRole = ROLES.READONLY;
      } else if (req.user.userAccessLevel.level === ROLES.EDITOR || req.user.userAccessLevel.level === 'editor') {
        userRole = ROLES.EDITOR;
      } else if (req.user.userAccessLevel.level === ROLES.USER || req.user.userAccessLevel.level === 'user') {
        userRole = ROLES.USER;
      }
    } else if (req.user?.id) {
      // Fallback для старой системы
      userRole = ROLES.USER;
    }
    
    console.log('[DEBUG] /mark-contact-read: userRole:', userRole);
    
    // Проверяем права через новую систему
    if (!hasPermission(userRole, PERMISSIONS.VIEW_CONTACTS)) {
      console.log('[ERROR] /mark-contact-read: Insufficient permissions for role:', userRole);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // ИСПРАВЛЕННАЯ ЛОГИКА: все админы (EDITOR и READONLY) могут влиять на цвет контактов
    let adminId;
    if (req.user?.id && (userRole === ROLES.EDITOR || userRole === ROLES.READONLY)) {
      // Админы (редактор и чтение) могут записывать в admin_read_contacts
      adminId = req.user.id;
      console.log('[DEBUG] /mark-contact-read: Using admin ID:', adminId, 'Role:', userRole);
      
      // Админ может помечать любого контакта как прочитанного, включая самого себя
    } else {
      // Для всех остальных ролей (GUEST, USER) - НЕ записываем в БД
      console.log('[DEBUG] /mark-contact-read: User role is not editor/readonly, not recording in admin_read_contacts. Role:', userRole);
      return res.json({ success: true }); // Просто возвращаем успех без записи в БД
    }
    
    const contactIdStr = String(contactId);
    console.log('[DEBUG] /mark-contact-read: Final adminId:', adminId, 'contactId:', contactIdStr);
    
    await db.query(
      'INSERT INTO admin_read_contacts (admin_id, contact_id, read_at) VALUES ($1, $2, NOW()) ON CONFLICT (admin_id, contact_id) DO UPDATE SET read_at = NOW()',
      [adminId, contactIdStr]
    );
    
    console.log('[SUCCESS] /mark-contact-read: Contact marked as read');
    res.json({ success: true });
  } catch (e) {
    console.error('[ERROR] /mark-contact-read:', e);
    res.status(500).json({ error: e.message });
  }
});

// Заблокировать пользователя
// Блокировка пользователя
router.patch('/:id/block', requireAuth, requirePermission(PERMISSIONS.BLOCK_USERS), async (req, res) => {
  try {
    const userId = req.params.id;
    await db.query('UPDATE users SET is_blocked = true, blocked_at = NOW() WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Пользователь заблокирован' });
  } catch (e) {
    logger.error('Ошибка блокировки пользователя:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Разблокировать пользователя
// Разблокировка пользователя
router.patch('/:id/unblock', requireAuth, requirePermission(PERMISSIONS.BLOCK_USERS), async (req, res) => {
  try {
    const userId = req.params.id;
    await db.query('UPDATE users SET is_blocked = false, blocked_at = NULL WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Пользователь разблокирован' });
  } catch (e) {
    logger.error('Ошибка разблокировки пользователя:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Обновить пользователя (в том числе is_blocked)
// Обновление данных пользователя
router.patch('/:id', requireAuth, requirePermission(PERMISSIONS.EDIT_CONTACTS), async (req, res) => {
  try {
    const userId = req.params.id;
    const { first_name, last_name, name, preferred_language, language, is_blocked } = req.body;
    
    // Получаем ключ шифрования один раз
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    // Обработка гостевых контактов (guest_123)
    if (userId.startsWith('guest_')) {
      const guestId = parseInt(userId.replace('guest_', ''));
      
      if (isNaN(guestId)) {
        return res.status(400).json({ success: false, error: 'Invalid guest ID format' });
      }
      
      // Проверяем, существует ли гость и получаем его идентификатор
      const guestResult = await db.getQuery()(
        `WITH decrypted_guest AS (
          SELECT 
            id,
            decrypt_text(identifier_encrypted, $2) as guest_identifier,
            channel,
            metadata
          FROM unified_guest_messages
          WHERE user_id IS NULL
        )
        SELECT 
          id as first_message_id,
          guest_identifier,
          channel,
          metadata
        FROM decrypted_guest
        WHERE id = $1
        LIMIT 1`,
        [guestId, encryptionKey]
      );
      
      if (guestResult.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Guest contact not found' });
      }
      
      const guest = guestResult.rows[0];
      const firstMessageId = guest.first_message_id;
      let metadata = guest.metadata || {};
      
      // Если metadata - строка, парсим её
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }
      
      // Обработка имени гостя
      let hasUpdates = false;
      if (name !== undefined) {
        const nameParts = name.trim().split(' ');
        metadata.custom_name = name.trim();
        metadata.custom_first_name = nameParts[0] || '';
        metadata.custom_last_name = nameParts.slice(1).join(' ') || '';
        hasUpdates = true;
      } else {
        if (first_name !== undefined) {
          metadata.custom_first_name = first_name;
          // Обновляем полное имя, если есть
          if (metadata.custom_last_name) {
            metadata.custom_name = `${first_name} ${metadata.custom_last_name}`.trim();
          } else {
            metadata.custom_name = first_name;
          }
          hasUpdates = true;
        }
        if (last_name !== undefined) {
          metadata.custom_last_name = last_name;
          // Обновляем полное имя, если есть
          if (metadata.custom_first_name) {
            metadata.custom_name = `${metadata.custom_first_name} ${last_name}`.trim();
          } else {
            metadata.custom_name = last_name;
          }
          hasUpdates = true;
        }
      }
      
      // Если имя пустое, удаляем кастомное имя
      if (name === '' || (first_name === '' && last_name === '')) {
        delete metadata.custom_name;
        delete metadata.custom_first_name;
        delete metadata.custom_last_name;
        hasUpdates = true;
      }
      
      if (!hasUpdates) {
        return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
      }
      
      // Обновляем metadata первого сообщения гостя
      await db.getQuery()(
        `UPDATE unified_guest_messages 
         SET metadata = $1 
         WHERE id = $2`,
        [JSON.stringify(metadata), firstMessageId]
      );
      
      broadcastContactsUpdate();
      return res.json({ 
        success: true, 
        message: 'Имя гостя обновлено'
      });
    }
    
    // Обработка обычных пользователей
    const fields = [];
    const values = [];
    let idx = 1;
    
    // Обработка поля name - разбиваем на first_name и last_name
    if (name !== undefined) {
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      fields.push(`first_name_encrypted = encrypt_text($${idx++}, $${idx++})`); 
      values.push(firstName);
      values.push(encryptionKey);
      fields.push(`last_name_encrypted = encrypt_text($${idx++}, $${idx++})`); 
      values.push(lastName);
      values.push(encryptionKey);
    } else {
      if (first_name !== undefined) { 
        fields.push(`first_name_encrypted = encrypt_text($${idx++}, $${idx++})`); 
        values.push(first_name);
        values.push(encryptionKey);
      }
      if (last_name !== undefined) { 
        fields.push(`last_name_encrypted = encrypt_text($${idx++}, $${idx++})`); 
        values.push(last_name);
        values.push(encryptionKey);
      }
    }
    
    // Обработка поля language (alias для preferred_language)
    const languageToUpdate = language !== undefined ? language : preferred_language;
    if (languageToUpdate !== undefined) { 
      fields.push(`preferred_language = $${idx++}`); 
      values.push(JSON.stringify(languageToUpdate)); 
    }
    if (is_blocked !== undefined) {
      fields.push(`is_blocked = $${idx++}`);
      values.push(is_blocked);
      if (is_blocked) {
        fields.push(`blocked_at = NOW()`);
      } else {
        fields.push(`blocked_at = NULL`);
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, error: 'Нет данных для обновления' });
    
    // Проверяем, что userId - это число
    const userIdNum = Number(userId);
    if (isNaN(userIdNum)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID format' });
    }
    
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`;
    values.push(userIdNum);
    await db.query(sql, values);
    broadcastContactsUpdate();
    res.json({ success: true, message: 'Пользователь обновлен' });
  } catch (e) {
    logger.error('Ошибка обновления пользователя:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// DELETE /api/users/:id — удалить контакт и все связанные данные
// Удаление пользователя
router.delete('/:id', requireAuth, requirePermission(PERMISSIONS.DELETE_USER_DATA), async (req, res) => {
  const userIdParam = req.params.id;
  
  try {
    // Обработка гостевых контактов (guest_123)
    if (userIdParam.startsWith('guest_')) {
      const guestId = parseInt(userIdParam.replace('guest_', ''));
      
      if (isNaN(guestId)) {
        return res.status(400).json({ error: 'Invalid guest ID format' });
      }
      
      // Получаем ключ шифрования
      const encryptionUtils = require('../utils/encryptionUtils');
      const encryptionKey = encryptionUtils.getEncryptionKey();
      
      // Находим guest_identifier по guestId
      const identifierResult = await db.getQuery()(
        `WITH decrypted_guest AS (
          SELECT 
            id,
            decrypt_text(identifier_encrypted, $2) as guest_identifier,
            channel
          FROM unified_guest_messages
          WHERE user_id IS NULL
        )
        SELECT guest_identifier, channel
        FROM decrypted_guest
        GROUP BY guest_identifier, channel
        HAVING MIN(id) = $1
        LIMIT 1`,
        [guestId, encryptionKey]
      );
      
      if (identifierResult.rows.length === 0) {
        return res.status(404).json({ error: 'Guest contact not found' });
      }
      
      const guestIdentifier = identifierResult.rows[0].guest_identifier;
      const guestChannel = identifierResult.rows[0].channel;
      
      // Удаляем все сообщения этого гостя
      const deleteResult = await db.getQuery()(
        `DELETE FROM unified_guest_messages 
         WHERE decrypt_text(identifier_encrypted, $2) = $1 
           AND channel = $3`,
        [guestIdentifier, encryptionKey, guestChannel]
      );
      
      broadcastContactsUpdate();
      return res.json({ success: true, deleted: deleteResult.rowCount });
    }
    
    // Обработка обычных пользователей
    const userId = Number(userIdParam);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const deletedCount = await deleteUserById(userId);
    
    if (deletedCount === 0) {
      return res.status(404).json({ success: false, deleted: 0, error: 'User not found' });
    }
    
    broadcastContactsUpdate();
    res.json({ success: true, deleted: deletedCount });
  } catch (e) {
    console.error('[DELETE] Ошибка при удалении:', e);
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// --- Получение ролей из базы данных (созданных через миграции) ---
router.get('/roles', requireAuth, async (req, res, next) => {
  try {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();

    const sql = `
      SELECT 
        id,
        decrypt_text(name_encrypted, $1) as name,
        created_at
      FROM roles 
      ORDER BY id
    `;

    const result = await db.getQuery()(sql, [encryptionKey]);
    
    res.json({
      success: true,
      roles: result.rows
    });
  } catch (error) {
    console.error('[users/roles] Ошибка при получении ролей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении ролей',
      details: error.message
    });
  }
});

// Получить пользователя по id
// Получение деталей конкретного контакта
router.get('/:id', requireAuth, requirePermission(PERMISSIONS.VIEW_CONTACTS), async (req, res, next) => {
  const userId = req.params.id;

  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    const query = db.getQuery();

    // Проверяем, это гостевой идентификатор (формат: guest_123)
    if (userId.startsWith('guest_')) {
      const guestId = parseInt(userId.replace('guest_', ''));
      
      if (isNaN(guestId)) {
        return res.status(400).json({ error: 'Invalid guest ID format' });
      }
      
      const guestResult = await query(
        `WITH decrypted_guest AS (
          SELECT 
            id,
            decrypt_text(identifier_encrypted, $2) as guest_identifier,
            channel,
            created_at,
            user_id,
            metadata
          FROM unified_guest_messages
          WHERE user_id IS NULL
        )
        SELECT 
          id as guest_id,
          guest_identifier,
          channel,
          created_at,
          (SELECT MAX(created_at) FROM decrypted_guest dg2 WHERE dg2.guest_identifier = decrypted_guest.guest_identifier AND dg2.channel = decrypted_guest.channel) as last_message_at,
          (SELECT COUNT(*) FROM decrypted_guest dg2 WHERE dg2.guest_identifier = decrypted_guest.guest_identifier AND dg2.channel = decrypted_guest.channel) as message_count,
          metadata
        FROM decrypted_guest
        WHERE id = $1
        LIMIT 1`,
        [guestId, encryptionKey]
      );

      if (guestResult.rows.length === 0) {
        return res.status(404).json({ error: 'Guest contact not found' });
      }

      const guest = guestResult.rows[0];
      const rawId = guest.guest_identifier.replace(`${guest.channel}:`, '');
      const channelMap = {
        'web': '🌐',
        'telegram': '📱',
        'email': '✉️'
      };
      const icon = channelMap[guest.channel] || '👤';
      
      // Проверяем, есть ли кастомное имя в metadata
      let metadata = guest.metadata || {};
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          metadata = {};
        }
      }
      
      // Формируем имя: сначала проверяем кастомное имя, затем генерируем автоматически
      let displayName;
      if (metadata.custom_name) {
        displayName = metadata.custom_name;
      } else if (guest.channel === 'email') {
        displayName = `${icon} ${rawId}`;
      } else if (guest.channel === 'telegram') {
        displayName = `${icon} Telegram (${rawId})`;
      } else {
        displayName = `${icon} Гость ${guestId}`;
      }

      return res.json({
        id: `guest_${guestId}`,
        guest_identifier: guest.guest_identifier,
        name: displayName,
        email: guest.channel === 'email' ? rawId : null,
        telegram: guest.channel === 'telegram' ? rawId : null,
        wallet: null,
        created_at: guest.created_at,
        preferred_language: [],
        is_blocked: false,
        contact_type: 'guest',
        role: 'guest',
        guest_info: {
          channel: guest.channel,
          message_count: parseInt(guest.message_count),
          last_message_at: guest.last_message_at,
          raw_identifier: rawId
        }
      });
    }

    // Получаем пользователя (зарегистрированный)
    const userResult = await query('SELECT id, created_at, preferred_language, is_blocked FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Получаем идентификаторы
    const identitiesResult = await query('SELECT CASE WHEN provider_encrypted IS NULL OR provider_encrypted = \'\' THEN NULL ELSE decrypt_text(provider_encrypted, $2) END as provider, CASE WHEN provider_id_encrypted IS NULL OR provider_id_encrypted = \'\' THEN NULL ELSE decrypt_text(provider_id_encrypted, $2) END as provider_id FROM user_identities WHERE user_id = $1', [userId, encryptionKey]);
    const identityMap = {};
    for (const id of identitiesResult.rows) {
      identityMap[id.provider] = id.provider_id;
    }
    // Получаем имя пользователя из зашифрованных полей
    const nameResult = await query('SELECT CASE WHEN first_name_encrypted IS NULL OR first_name_encrypted = \'\' THEN NULL ELSE decrypt_text(first_name_encrypted, $2) END as first_name, CASE WHEN last_name_encrypted IS NULL OR last_name_encrypted = \'\' THEN NULL ELSE decrypt_text(last_name_encrypted, $2) END as last_name FROM users WHERE id = $1', [userId, encryptionKey]);
    
    let fullName = null;
    if (nameResult.rows.length > 0) {
      const firstName = nameResult.rows[0].first_name || '';
      const lastName = nameResult.rows[0].last_name || '';
      fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    }
    
    res.json({
      id: user.id,
      name: fullName,
      email: identityMap.email || null,
      telegram: identityMap.telegram || null,
      wallet: identityMap.wallet || null,
      created_at: user.created_at,
      preferred_language: user.preferred_language || [],
      is_blocked: user.is_blocked || false
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  const { first_name, last_name, preferred_language } = req.body;
  
  // Получаем ключ шифрования
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();
  
  // Используем централизованную систему ролей

  try {
    const result = await db.getQuery()(
      `INSERT INTO users (first_name_encrypted, last_name_encrypted, preferred_language, role, created_at)
       VALUES (encrypt_text($1, $5), encrypt_text($2, $5), $3, $4, NOW()) RETURNING *`,
      [first_name, last_name, JSON.stringify(preferred_language || []), ROLES.USER, encryptionKey]
    );
    broadcastContactsUpdate();
    res.json({ success: true, user: result.rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// Массовый импорт контактов
router.post('/import', requireAuth, async (req, res) => {
  // Получаем ключ шифрования
  const fs = require('fs');
  const path = require('path');
  // Получаем ключ шифрования через унифицированную утилиту
  const encryptionUtils = require('../utils/encryptionUtils');
  const encryptionKey = encryptionUtils.getEncryptionKey();

  try {
    const contacts = req.body;
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ success: false, error: 'Ожидается массив контактов' });
    }
    const dbq = db.getQuery();
    let added = 0, updated = 0, errors = [];
    for (const [i, c] of contacts.entries()) {
      try {
        // Имя
        let first_name = null, last_name = null;
        if (c.name) {
          const parts = c.name.trim().split(' ');
          first_name = parts[0] || null;
          last_name = parts.slice(1).join(' ') || null;
        }
        // Проверка на существование по email/telegram/wallet
        let userId = null;
        let foundUser = null;
        if (c.email) {
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider_encrypted = encrypt_text($1, $3) AND provider_id_encrypted = encrypt_text($2, $3)', ['email', c.email.toLowerCase(), encryptionKey]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (!foundUser && c.telegram) {
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider_encrypted = encrypt_text($1, $3) AND provider_id_encrypted = encrypt_text($2, $3)', ['telegram', c.telegram, encryptionKey]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (!foundUser && c.wallet) {
          const r = await dbq('SELECT user_id FROM user_identities WHERE provider_encrypted = encrypt_text($1, $3) AND provider_id_encrypted = encrypt_text($2, $3)', ['wallet', c.wallet, encryptionKey]);
          if (r.rows.length) foundUser = r.rows[0].user_id;
        }
        if (foundUser) {
          userId = foundUser;
          updated++;
          // Обновляем имя, если нужно
          if (first_name || last_name) {
            await dbq('UPDATE users SET first_name_encrypted = COALESCE(encrypt_text($1, $4), first_name_encrypted), last_name_encrypted = COALESCE(encrypt_text($2, $4), last_name_encrypted) WHERE id = $3', [first_name, last_name, userId, encryptionKey]);
          }
        } else {
          // Создаём нового пользователя с централизованной ролью
          const ins = await dbq('INSERT INTO users (first_name_encrypted, last_name_encrypted, role, created_at) VALUES (encrypt_text($1, $4), encrypt_text($2, $4), $3, NOW()) RETURNING id', [first_name, last_name, ROLES.USER, encryptionKey]);
          userId = ins.rows[0].id;
          added++;
        }
        // Добавляем идентификаторы (email, telegram, wallet)
        const identities = [
          c.email ? { provider: 'email', provider_id: c.email.toLowerCase() } : null,
          c.telegram ? { provider: 'telegram', provider_id: c.telegram } : null,
          c.wallet ? { provider: 'wallet', provider_id: c.wallet } : null
        ].filter(Boolean);
        for (const idn of identities) {
          // Проверяем, есть ли уже такой идентификатор у пользователя
          const exists = await dbq('SELECT 1 FROM user_identities WHERE user_id = $1 AND provider_encrypted = encrypt_text($2, $4) AND provider_id_encrypted = encrypt_text($3, $4)', [userId, idn.provider, idn.provider_id, encryptionKey]);
          if (!exists.rows.length) {
            await dbq('INSERT INTO user_identities (user_id, provider_encrypted, provider_id_encrypted) VALUES ($1, encrypt_text($2, $4), encrypt_text($3, $4)) ON CONFLICT DO NOTHING', [userId, idn.provider, idn.provider_id, encryptionKey]);
          }
        }
      } catch (e) {
        errors.push({ row: i + 1, error: e.message });
      }
    }
    broadcastContactsUpdate();
    res.json({ success: true, added, updated, errors });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// --- Работа с тегами перенесена в /api/tags ---
// Используйте следующие endpoints:
// PATCH /api/tags/user/:id — установить теги пользователю
// GET /api/tags/user/:id — получить теги пользователя  
// DELETE /api/tags/user/:id/tag/:tagId — удалить тег у пользователя
// POST /api/tags/user/:id/multirelations — массовое обновление тегов


module.exports = router;
