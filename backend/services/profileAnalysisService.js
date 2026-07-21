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

/**
 * Profile Analysis Service
 * Анализирует сообщения пользователя и автоматически обновляет профиль
 */

const axios = require('axios');
const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');
const aiConfigService = require('./aiConfigService');
const userContextService = require('./userContextService');
const encryptedDb = require('./encryptedDatabaseService');
const db = require('../db');
const {
  detectNameHint,
  normalizePersonName
} = require('../utils/assistantTextSanitizer');

/**
 * Извлечь имя пользователя из сообщения.
 * Сначала эвристика (без LLM); LLM только если есть явный намёк на имя.
 * @param {string} message - Сообщение пользователя
 * @returns {Promise<Object>} { name: string|null, should_update_name: boolean, confidence: number }
 */
async function extractName(message) {
  try {
    logger.info(`[ProfileAnalysis] Начало извлечения имени из сообщения: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);

    const hint = detectNameHint(message);
    if (!hint.likely) {
      logger.info('[ProfileAnalysis] Признаков имени в сообщении нет — LLM не вызываем');
      return { name: null, should_update_name: false, confidence: 0 };
    }

    const heuristicName = normalizePersonName(hint.candidate);
    if (heuristicName) {
      // Явные шаблоны «меня зовут …» / короткое имя — без второго прогона LLM
      const strongPattern = /меня\s+зовут|зови(?:те)?\s+меня|мо[её]\s+имя|^[А-ЯЁа-яё-]{2,20}$/i.test(
        String(message || '').trim()
      );
      if (strongPattern) {
        logger.info(`[ProfileAnalysis] Имя извлечено эвристикой без LLM: ${heuristicName}`);
        return { name: heuristicName, should_update_name: true, confidence: 0.92 };
      }
    }

    const ollamaUrl = await ollamaConfig.getBaseUrlAsync();
    let llmModel = await ollamaConfig.getDefaultModelAsync();
    // На части VDS в БД ещё лежит короткий тег «qwen2.5» без размера — нормализуем
    if (!llmModel || llmModel === 'qwen2.5' || !String(llmModel).includes(':')) {
      llmModel = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';
    }
    const timeouts = await aiConfigService.getTimeouts();
    const nameExtractionTimeout = Math.min(timeouts.ollamaChat || 60000, 45000);

    logger.info(`[ProfileAnalysis] Параметры для извлечения имени: model=${llmModel}, timeout=${nameExtractionTimeout / 1000}с`);

    const prompt = `Определи, указал ли пользователь своё личное имя в сообщении.

Сообщение: ${JSON.stringify(String(message || ''))}

Правила:
- Имя только если пользователь явно представился (например «меня зовут Анна», «я Алекс»).
- Не путай имя с ролями, компаниями, вопросами («кто главный», «расскажи о компании»).
- Имя только кириллицей, одно или два слова, без кавычек и титулов.
- Если сомневаешься — name=null, should_update_name=false, confidence ниже 0.7.
- Ответ строго JSON одной строкой: {"name":string|null,"should_update_name":boolean,"confidence":number}`;

    const extractStartTime = Date.now();
    logger.info('[ProfileAnalysis] Отправка запроса к Ollama для извлечения имени...');

    const response = await axios.post(`${ollamaUrl}/api/chat`, {
      model: llmModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      num_predict: 64,
      top_p: 0.9,
      format: 'json',
      stream: false
    }, {
      timeout: nameExtractionTimeout
    });

    const extractDuration = Date.now() - extractStartTime;
    logger.info(`[ProfileAnalysis] Получен ответ от Ollama для извлечения имени за ${extractDuration}ms, статус: ${response.status}`);

    let payload = response.data;
    if (!payload) {
      logger.error('[ProfileAnalysis] Ответ от Ollama не содержит data:', response);
      return { name: null, should_update_name: false, confidence: 0 };
    }

    if (typeof payload === 'string') {
      try {
        const lines = payload.trim().split('\n').filter(Boolean);
        const lastLine = lines.length > 0 ? lines[lines.length - 1] : payload;
        payload = JSON.parse(lastLine);
      } catch (parseError) {
        logger.error('[ProfileAnalysis] Не удалось распарсить строковый ответ Ollama:', {
          error: parseError.message,
          preview: payload.substring(0, 200)
        });
        return { name: null, should_update_name: false, confidence: 0 };
      }
    }

    if (Array.isArray(payload)) {
      payload = payload[payload.length - 1] || {};
    }

    const messagePayload = payload.message || payload.response || null;
    if (!messagePayload || !messagePayload.content) {
      logger.error('[ProfileAnalysis] Ответ от Ollama не содержит message.content:', payload);
      return { name: null, should_update_name: false, confidence: 0 };
    }

    let result;
    try {
      result = typeof messagePayload.content === 'string'
        ? JSON.parse(messagePayload.content)
        : messagePayload.content;
    } catch (parseError) {
      logger.error('[ProfileAnalysis] Ошибка парсинга JSON из ответа Ollama:', {
        content: messagePayload.content,
        error: parseError.message
      });
      // Fallback на эвристику, если LLM вернул мусор
      if (heuristicName) {
        return { name: heuristicName, should_update_name: true, confidence: 0.75 };
      }
      return { name: null, should_update_name: false, confidence: 0 };
    }

    const normalizedName = normalizePersonName(result?.name);
    const rawConfidence = Number(result?.confidence);
    const confidence = Number.isFinite(rawConfidence)
      ? Math.max(0, Math.min(1, rawConfidence))
      : (normalizedName ? 0.8 : 0);

    logger.info(`[ProfileAnalysis] Результат извлечения имени: name=${normalizedName || 'null'}, should_update=${result?.should_update_name}, confidence=${confidence}`);

    if (confidence < 0.7 || !normalizedName) {
      if (normalizedName && confidence < 0.7) {
        logger.debug(`[ProfileAnalysis] Низкая уверенность в имени (${confidence}), не обновляем`);
      }
      return { name: null, should_update_name: false, confidence };
    }

    const shouldUpdate = typeof result.should_update_name === 'boolean'
      ? result.should_update_name
      : true;

    return {
      name: normalizedName,
      should_update_name: shouldUpdate,
      confidence
    };
  } catch (error) {
    logger.error('[ProfileAnalysis] Ошибка извлечения имени:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : undefined
    });
    return { name: null, should_update_name: false, confidence: 0 };
  }
}

/**
 * Найти таблицу по названию
 * @param {string} tableName - Название таблицы
 * @returns {Promise<Object|null>} Таблица или null
 */
async function findTableByName(tableName) {
  try {
    const tables = await encryptedDb.getData('user_tables', {});
    return tables.find(table => table.name === tableName) || null;
  } catch (error) {
    logger.error(`[ProfileAnalysis] Ошибка поиска таблицы "${tableName}":`, error.message);
    return null;
  }
}

/**
 * Получить столбец по названию
 * @param {number} tableId - ID таблицы
 * @param {string} columnName - Название столбца
 * @returns {Promise<Object|null>} Столбец или null
 */
async function getColumnByName(tableId, columnName) {
  try {
    const columns = await encryptedDb.getData('user_columns', { table_id: tableId });
    return columns.find(col => col.name === columnName) || null;
  } catch (error) {
    logger.error(`[ProfileAnalysis] Ошибка поиска столбца "${columnName}":`, error.message);
    return null;
  }
}

/**
 * Получить значение ячейки
 * @param {number} rowId - ID строки
 * @param {number} columnId - ID столбца
 * @returns {Promise<string|null>} Значение ячейки или null
 */
async function getCellValue(rowId, columnId) {
  try {
    const cellValues = await encryptedDb.getData('user_cell_values', { 
      row_id: rowId,
      column_id: columnId
    }, 1);
    return cellValues && cellValues.length > 0 ? cellValues[0].value : null;
  } catch (error) {
    logger.error(`[ProfileAnalysis] Ошибка получения значения ячейки:`, error.message);
    return null;
  }
}

/**
 * Получить строки таблицы
 * @param {number} tableId - ID таблицы
 * @returns {Promise<Array>} Массив строк
 */
async function getTableRows(tableId) {
  try {
    return await encryptedDb.getData('user_rows', { table_id: tableId });
  } catch (error) {
    logger.error(`[ProfileAnalysis] Ошибка получения строк таблицы:`, error.message);
    return [];
  }
}

/**
 * Парсить теги из ячейки (multiselect-relation или строка)
 * @param {*} tagsCell - Значение ячейки с тегами
 * @returns {Array<string>} Массив названий тегов
 */
function parseTagsFromCell(tagsCell) {
  if (!tagsCell) return [];
  
  // Если это массив
  if (Array.isArray(tagsCell)) {
    return tagsCell.map(String);
  }
  
  // Если это строка JSON
  if (typeof tagsCell === 'string') {
    try {
      const parsed = JSON.parse(tagsCell);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    } catch (e) {
      // Не JSON, возможно просто строка с названиями через запятую
      return tagsCell.split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  
  return [];
}

/**
 * Найти ключевые слова в сообщении
 * @param {string} message - Сообщение пользователя
 * @param {number} keywordsTableId - ID таблицы "Ключевые слова и теги"
 * @returns {Promise<Array>} Массив найденных строк с ключевыми словами
 */
async function findKeywordsInMessage(message, keywordsTableId) {
  try {
    const rows = await getTableRows(keywordsTableId);
    
    // Получаем столбец "Ключевое слово"
    const keywordColumn = await getColumnByName(keywordsTableId, 'Ключевое слово');
    if (!keywordColumn) {
      logger.warn('[ProfileAnalysis] Столбец "Ключевое слово" не найден');
      return [];
    }

    const messageLower = message.toLowerCase();
    const foundKeywords = [];

    for (const row of rows) {
      const keywordsCell = await getCellValue(row.id, keywordColumn.id);
      if (!keywordsCell) continue;

      // Парсим ключевые слова (разделены запятой)
      const keywords = keywordsCell.split(',').map(k => k.trim().toLowerCase());

      // Проверяем, есть ли хотя бы одно ключевое слово в сообщении
      if (keywords.some(kw => messageLower.includes(kw))) {
        foundKeywords.push(row);
      }
    }

    return foundKeywords;
  } catch (error) {
    logger.error('[ProfileAnalysis] Ошибка поиска ключевых слов:', error.message);
    return [];
  }
}

/**
 * Получить теги по ключевым словам из таблицы
 * @param {Array} foundKeywordRows - Массив строк с найденными ключевыми словами
 * @param {number} keywordsTableId - ID таблицы "Ключевые слова и теги"
 * @returns {Promise<Array>} Массив объектов { tagNames: Array, action: string }
 */
async function getTagsByKeywords(foundKeywordRows, keywordsTableId) {
  try {
    const tagsColumn = await getColumnByName(keywordsTableId, 'Теги');
    const actionColumn = await getColumnByName(keywordsTableId, 'Действие');

    const results = [];

    for (const row of foundKeywordRows) {
      const tagsCell = tagsColumn ? await getCellValue(row.id, tagsColumn.id) : null;
      const action = actionColumn ? await getCellValue(row.id, actionColumn.id) : null;

      const tagNames = parseTagsFromCell(tagsCell);

      if (tagNames.length > 0) {
        results.push({
          tagNames,
          action: action || 'добавить'
        });
      }
    }

    return results;
  } catch (error) {
    logger.error('[ProfileAnalysis] Ошибка получения тегов по ключевым словам:', error.message);
    return [];
  }
}

/**
 * Найти tagIds по названиям тегов
 * @param {Array<string>} tagNames - Массив названий тегов
 * @returns {Promise<Array<number>>} Массив tagIds
 */
async function getTagIdsByNames(tagNames) {
  if (!tagNames || tagNames.length === 0) {
    return [];
  }

  try {
    // Находим таблицу "Теги клиентов"
    const tagsTable = await findTableByName('Теги клиентов');
    if (!tagsTable) {
      logger.warn('[ProfileAnalysis] Таблица "Теги клиентов" не найдена');
      return [];
    }

    const allColumns = await encryptedDb.getData('user_columns', { table_id: tagsTable.id });

    // Подбираем колонку с названием тега по приоритету
    const nameColumn =
      allColumns.find(col => col.options && col.options.purpose === 'userTags') ||
      allColumns.find(col => col.name === 'Название') ||
      allColumns.find(col => col.name === 'Список тегов') ||
      allColumns.find(col => col.type === 'text');

    if (!nameColumn) {
      logger.warn('[ProfileAnalysis] Столбец с названием тега не найден');
      return [];
    }

    const rows = await getTableRows(tagsTable.id);

    const tagIds = [];
    for (const row of rows) {
      const cellValue = await getCellValue(row.id, nameColumn.id);
      if (!cellValue) {
        continue;
      }

      const normalizedNames = parseTagsFromCell(cellValue);
      if (normalizedNames.some(name => tagNames.includes(name))) {
        tagIds.push(row.id);
      }
    }

    return tagIds;
  } catch (error) {
    logger.error('[ProfileAnalysis] Ошибка поиска tagIds по названиям:', error.message);
    return [];
  }
}

/**
 * Обработать действие (заменить/добавить теги)
 * @param {string} action - Действие (например, "заменить клиент" или "добавить")
 * @param {Array<string>} currentTagNames - Текущие названия тегов
 * @param {Array<string>} newTagNames - Новые названия тегов
 * @returns {Array<string>} Результирующие названия тегов
 */
function processAction(action, currentTagNames, newTagNames) {
  if (!action || action === 'добавить') {
    // Добавляем новые теги к существующим
    return [...new Set([...currentTagNames, ...newTagNames])];
  }

  // Обработка действия "заменить <тег>"
  if (action.startsWith('заменить')) {
    const tagToReplace = action.replace('заменить', '').trim();
    
    // Удаляем тег для замены
    const filtered = currentTagNames.filter(tag => tag !== tagToReplace);
    
    // Добавляем новые теги
    return [...new Set([...filtered, ...newTagNames])];
  }

  // По умолчанию - добавляем
  return [...new Set([...currentTagNames, ...newTagNames])];
}

/**
 * Анализировать сообщение пользователя и обновить профиль
 * @param {number} userId - ID пользователя
 * @param {string} message - Сообщение пользователя
 * @returns {Promise<Object>} { name: string|null, suggestedTags: Array<string> }
 */
async function analyzeUserMessage(userId, message) {
  try {
    logger.info(`[ProfileAnalysis] Анализ сообщения пользователя ${userId}`);
    logger.info(`[ProfileAnalysis] Сообщение пользователя ${userId}: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);

    const DEFAULT_TAG_NAME = 'Без лицензии';
    const isGuest = userContextService.isGuestId(userId);

    let currentContext = null;
    let currentName = null;
    let currentTagIds = [];
    let currentTagNames = [];
    let suggestedTags = [];
    let nameMissing = false;

    if (!isGuest) {
      currentContext = await userContextService.getUserContext(userId);
      currentName = currentContext?.name || null;
      currentTagIds = Array.isArray(currentContext?.tags) ? [...currentContext.tags] : await userContextService.getUserTags(userId);
      currentTagNames = Array.isArray(currentContext?.tagNames) && currentContext.tagNames.length > 0
        ? [...currentContext.tagNames]
        : await userContextService.getTagNames(currentTagIds);

      if (!currentTagIds || currentTagIds.length === 0) {
        const defaultTagIds = await getTagIdsByNames([DEFAULT_TAG_NAME]);
        if (defaultTagIds.length > 0) {
          await updateUserTagsInternal(userId, defaultTagIds);
          userContextService.invalidateUserCache(userId);
          currentTagIds = [...defaultTagIds];
          currentTagNames = [DEFAULT_TAG_NAME];
          logger.info(`[ProfileAnalysis] Пользователю ${userId} автоматически назначен тег по умолчанию: ${DEFAULT_TAG_NAME}`);
        } else {
          logger.warn(`[ProfileAnalysis] Тег по умолчанию "${DEFAULT_TAG_NAME}" не найден в базе`);
        }
      }

      suggestedTags = [...currentTagNames];
      nameMissing = !currentName;
    }

    // 1. Извлечение имени из сообщения (пропускаем, если имя уже известно)
    let nameResult = { name: null, should_update_name: false };
    if (!isGuest && !currentName) {
      logger.info(`[ProfileAnalysis] Начало извлечения имени для пользователя ${userId}...`);
      nameResult = await extractName(message);
      logger.info(`[ProfileAnalysis] Извлечение имени завершено: name=${nameResult.name || 'null'}, should_update=${nameResult.should_update_name}`);
    } else if (!isGuest && currentName) {
      logger.info(`[ProfileAnalysis] Имя пользователя ${userId} уже известно: "${currentName}", extractName пропущен`);
    }
    
    // 2. Обновление имени пользователя (если нужно)
    if (!isGuest && nameResult.name) {
      const shouldUpdateName = nameResult.should_update_name || !currentName;
      if (shouldUpdateName && (currentName || '') !== nameResult.name) {
        logger.info(`[ProfileAnalysis] Обновление имени пользователя ${userId}: "${currentName || ''}" → "${nameResult.name}"`);
        await updateUserNameInternal(userId, nameResult.name);
        userContextService.invalidateUserCache(userId);
        currentName = nameResult.name;
        nameMissing = false;
      }
    }

    // 3. Поиск ключевых слов в таблице "Ключевые слова и теги"
    const keywordsTable = await findTableByName('Ключевые слова и теги');

    if (!isGuest && keywordsTable) {
      const foundKeywords = await findKeywordsInMessage(message, keywordsTable.id);
      
      if (foundKeywords.length > 0) {
        // Получаем теги по ключевым словам
        const tagsByKeywords = await getTagsByKeywords(foundKeywords, keywordsTable.id);
        
        // Обрабатываем действия и собираем новые теги
        let allTagNames = [...currentTagNames];
        
        for (const { tagNames, action } of tagsByKeywords) {
          allTagNames = processAction(action, allTagNames, tagNames);
        }

        // Находим tagIds по названиям
        const tagIds = await getTagIdsByNames(allTagNames);
        
        // Обновляем теги пользователя (если есть изменения)
        const hasChanges = tagIds.length !== currentTagIds.length || !tagIds.every(id => currentTagIds.includes(id));
        if (hasChanges) {
          logger.info(`[ProfileAnalysis] Обновление тегов пользователя ${userId}: ${currentTagNames.join(', ') || '—'} → ${allTagNames.join(', ')}`);
          await updateUserTagsInternal(userId, tagIds);
          userContextService.invalidateUserCache(userId);
          currentTagIds = [...tagIds];
          currentTagNames = [...allTagNames];
        }

        suggestedTags = [...currentTagNames];
      }
    }

    return {
      name: nameResult.name,
      should_update_name: !isGuest && nameResult.name ? (nameResult.should_update_name || !currentName) : false,
      suggestedTags,
      currentName,
      currentTagNames,
      nameMissing: !isGuest ? nameMissing : false
    };
  } catch (error) {
    logger.error('[ProfileAnalysis] Ошибка анализа сообщения:', error.message);
    return { name: null, should_update_name: false, suggestedTags: [], currentName: null, currentTagNames: [], nameMissing: false };
  }
}

/**
 * Внутренняя функция для обновления имени пользователя (без проверки прав)
 * @param {number} userId - ID пользователя
 * @param {string} name - Новое имя
 */
async function updateUserNameInternal(userId, name) {
  try {
    const encryptionUtils = require('../utils/encryptionUtils');
    const encryptionKey = encryptionUtils.getEncryptionKey();
    
    const nameParts = name.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    await db.getQuery()(
      `UPDATE users 
       SET first_name_encrypted = encrypt_text($1, $3), 
           last_name_encrypted = encrypt_text($2, $3)
       WHERE id = $4`,
      [firstName, lastName, encryptionKey, userId]
    );

    // Инвалидируем кэш пользователя
    userContextService.invalidateUserCache(userId);
    
    // Отправляем WebSocket уведомление об обновлении контакта
    const { broadcastContactsUpdate } = require('../wsHub');
    broadcastContactsUpdate();
    
    logger.info(`[ProfileAnalysis] Имя пользователя ${userId} обновлено: "${name}"`);
  } catch (error) {
    logger.error(`[ProfileAnalysis] Ошибка обновления имени пользователя ${userId}:`, error.message);
    throw error;
  }
}

/**
 * Внутренняя функция для обновления тегов пользователя (без проверки прав)
 * @param {number} userId - ID пользователя
 * @param {Array<number>} tagIds - Массив tagIds
 */
async function updateUserTagsInternal(userId, tagIds) {
  try {
    // Удаляем старые связи
    await db.getQuery()('DELETE FROM user_tag_links WHERE user_id = $1', [userId]);
    
    // Добавляем новые связи
    for (const tagId of tagIds) {
      await db.getQuery()(
        'INSERT INTO user_tag_links (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, tagId]
      );
    }

    // Отправляем WebSocket уведомление
    const { broadcastTagsUpdate } = require('../wsHub');
    broadcastTagsUpdate(null, userId);

    // Инвалидируем кэш пользователя
    userContextService.invalidateUserCache(userId);
    
    logger.info(`[ProfileAnalysis] Теги пользователя ${userId} обновлены: ${tagIds.join(', ')}`);
  } catch (error) {
    logger.error(`[ProfileAnalysis] Ошибка обновления тегов пользователя ${userId}:`, error.message);
    throw error;
  }
}

module.exports = {
  analyzeUserMessage,
  extractName,
  findKeywordsInMessage,
  getTagsByKeywords,
  getTagIdsByNames,
  processAction,
  updateUserNameInternal,
  updateUserTagsInternal,
  findTableByName,
  getColumnByName,
  getCellValue,
  getTableRows
};

