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

/**
 * User Context Service
 * Предоставляет информацию о пользователе: теги, имя, язык
 * Кэширование (TTL: 10 минут)
 */

const db = require('../db');
const encryptedDb = require('./encryptedDatabaseService');
const logger = require('../utils/logger');
const encryptionUtils = require('../utils/encryptionUtils');

// Кэш для пользовательских данных
const userCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 минут

/**
 * Получить теги пользователя (tagIds)
 * @param {number} userId - ID пользователя
 * @returns {Promise<Array<number>>} Массив tagIds
 */
async function getUserTags(userId) {
  try {
    // Проверяем кэш
    const cacheKey = `tags_${userId}`;
    const cached = userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }

    // Гостевые пользователи не имеют тегов
    if (isGuestId(userId)) {
      return [];
    }

    const query = db.getQuery();
    const result = await query(
      'SELECT tag_id FROM user_tag_links WHERE user_id = $1',
      [userId]
    );

    const tagIds = result.rows.map(row => row.tag_id);
    
    // Сохраняем в кэш
    userCache.set(cacheKey, {
      data: tagIds,
      timestamp: Date.now()
    });

    return tagIds;
  } catch (error) {
    logger.error('[UserContextService] Ошибка получения тегов пользователя:', error.message);
    return [];
  }
}

/**
 * Получить названия тегов по их ID
 * @param {Array<number>} tagIds - Массив tagIds
 * @returns {Promise<Array<string>>} Массив названий тегов
 */
async function getTagNames(tagIds) {
  if (!tagIds || tagIds.length === 0) {
    return [];
  }

  try {
    // Проверяем кэш
    const cacheKey = `tagNames_${tagIds.sort().join(',')}`;
    const cached = userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }

    // Находим таблицу "Теги клиентов"
    // encryptedDb.getData уже расшифровывает данные, поэтому используем поле name
    const tables = await encryptedDb.getData('user_tables', {});
    const tagsTable = tables.find(table => table.name === 'Теги клиентов');

    if (!tagsTable) {
      logger.warn('[UserContextService] Таблица "Теги клиентов" не найдена');
      return [];
    }

    // Получаем строки таблицы (теги)
    const rows = await encryptedDb.getData('user_rows', { 
      table_id: tagsTable.id,
      id: { $in: tagIds }
    });

    // Получаем столбец с названием тега
    // encryptedDb.getData уже расшифровывает данные
    const columns = await encryptedDb.getData('user_columns', { 
      table_id: tagsTable.id 
    });
    
    // Ищем столбец "Список тегов", затем "Название", затем первый текстовый столбец
    const nameColumn = columns.find(col => 
      col.name === 'Список тегов' && col.type === 'text'
    ) || columns.find(col => 
      (col.name === 'Название' || col.name === 'Название тега') && col.type === 'text'
    ) || columns.find(col => col.type === 'text');

    if (!nameColumn) {
      logger.warn('[UserContextService] Столбец с названием тега не найден');
      return [];
    }

    // Получаем значения ячеек
    const cellValues = await encryptedDb.getData('user_cell_values', { 
      row_id: { $in: rows.map(r => r.id) },
      column_id: nameColumn.id
    });

    // Создаем маппинг row_id -> название
    const tagNamesMap = new Map();
    for (const cell of cellValues) {
      if (cell.value) {
        tagNamesMap.set(cell.row_id, cell.value);
      }
    }

    // Сортируем по порядку tagIds
    const tagNames = tagIds
      .map(tagId => tagNamesMap.get(tagId))
      .filter(Boolean);

    // Сохраняем в кэш
    userCache.set(cacheKey, {
      data: tagNames,
      timestamp: Date.now()
    });

    return tagNames;
  } catch (error) {
    logger.error('[UserContextService] Ошибка получения названий тегов:', error.message);
    return [];
  }
}

/**
 * Получить полный контекст пользователя
 * @param {number} userId - ID пользователя
 * @returns {Promise<Object>} Контекст пользователя
 */
async function getUserContext(userId) {
  try {
    // Проверяем кэш
    const cacheKey = `context_${userId}`;
    const cached = userCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.data;
    }

    // Гостевые пользователи
    if (isGuestId(userId)) {
      return {
        id: userId,
        name: null,
        tags: [],
        tagNames: [],
        language: 'ru',
        role: 'guest'
      };
    }

    // Получаем данные пользователя
    const query = db.getQuery();
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    const userResult = await query(`
      SELECT 
        u.id,
        decrypt_text(u.first_name_encrypted, $1) as first_name,
        decrypt_text(u.last_name_encrypted, $1) as last_name,
        u.preferred_language,
        u.role
      FROM users u
      WHERE u.id = $2
    `, [encryptionKey, userId]);

    if (userResult.rows.length === 0) {
      return null;
    }

    const user = userResult.rows[0];
    
    // Формируем имя
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    const name = [firstName, lastName].filter(Boolean).join(' ') || null;

    // Получаем теги
    const tagIds = await getUserTags(userId);
    const tagNames = await getTagNames(tagIds);

    const context = {
      id: userId,
      name,
      tags: tagIds,
      tagNames,
      language: user.preferred_language || 'ru',
      role: user.role || 'user'
    };

    // Сохраняем в кэш
    userCache.set(cacheKey, {
      data: context,
      timestamp: Date.now()
    });

    return context;
  } catch (error) {
    logger.error('[UserContextService] Ошибка получения контекста пользователя:', error.message);
    return null;
  }
}

/**
 * Проверяет, является ли идентификатор гостевым (строковым)
 * @param {unknown} userId
 * @returns {boolean}
 */
function isGuestId(userId) {
  if (typeof userId !== 'string') {
    return false;
  }

  const normalized = userId.trim();
  return (
    normalized.startsWith('guest_') ||
    normalized.startsWith('web:guest_') ||
    normalized.startsWith('telegram:guest_') ||
    normalized.startsWith('email:guest_') ||
    normalized.includes(':guest_')
  );
}

/**
 * Инвалидация кэша для пользователя
 * @param {number} userId - ID пользователя
 */
function invalidateUserCache(userId) {
  const keysToDelete = [];
  for (const key of userCache.keys()) {
    if (key.includes(`_${userId}`) || key.includes(`_${userId}_`)) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    userCache.delete(key);
  }
  
  logger.debug(`[UserContextService] Кэш инвалидирован для пользователя ${userId}`);
}

/**
 * Очистка всего кэша
 */
function clearCache() {
  userCache.clear();
  logger.info('[UserContextService] Кэш очищен');
}

/**
 * Получить статистику кэша
 */
function getCacheStats() {
  return {
    size: userCache.size,
    ttl: CACHE_TTL
  };
}

module.exports = {
  getUserTags,
  getTagNames,
  getUserContext,
  invalidateUserCache,
  clearCache,
  getCacheStats,
  isGuestId
};

