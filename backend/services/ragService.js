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
const vectorSearch = require('./vectorSearchClient');
const { getProviderSettings } = require('./aiProviderSettingsService');
const axios = require('axios');
const ollamaConfig = require('./ollamaConfig');
const aiCache = require('./ai-cache');
const AIQueue = require('./ai-queue');
const aiConfigService = require('./aiConfigService');
const userContextService = require('./userContextService');
const profileAnalysisService = require('./profileAnalysisService');
const { buildOllamaRequest } = require('../utils/ollamaRequestBuilder');
const logger = require('../utils/logger');
const db = require('../db');

// Кэш для плейсхолдеров таблиц
const tablePlaceholdersCache = {
  data: null,
  timestamp: 0
};
const TABLE_PLACEHOLDERS_CACHE_TTL = 10 * 60 * 1000; // 10 минут

/**
 * Генерация плейсхолдера из названия (транслитерация)
 * @param {string} name - Название таблицы или столбца
 * @returns {string} Плейсхолдер
 */
function generatePlaceholder(name) {
  if (!name || typeof name !== 'string') {
    return 'placeholder';
  }

  // Транслитерация (упрощённая)
  const cyrillicToLatinMap = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', 
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', 
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', 
    щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
    А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ё: 'E', Ж: 'Zh', З: 'Z',
    И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P', Р: 'R',
    С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'H', Ц: 'Ts', Ч: 'Ch', Ш: 'Sh',
    Щ: 'Sch', Ъ: '', Ы: 'Y', Ь: '', Э: 'E', Ю: 'Yu', Я: 'Ya'
  };

  let translit = name.toLowerCase().split('').map(ch => {
    if (cyrillicToLatinMap[ch]) return cyrillicToLatinMap[ch];
    if (/[a-z0-9]/.test(ch)) return ch;
    if (ch === ' ') return '_';
    if (ch === '-') return '_';
    return '';
  }).join('');

  // Удаляем множественные подчеркивания и подчеркивания в начале/конце
  translit = translit.replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  // Если translit пустой, используем fallback
  if (!translit) {
    translit = 'placeholder';
  }

  return translit;
}

// Управляет поведением: выполнять ли upsert всех строк на каждый запрос поиска
// Теперь из настроек ai_config
let RAG_BEHAVIOR = null;

// Флаги для включения/выключения Queue и Cache
const USE_AI_CACHE = process.env.USE_AI_CACHE !== 'false'; // default: true
const USE_AI_QUEUE = process.env.USE_AI_QUEUE !== 'false'; // default: true

// Создаем экземпляр очереди
const aiQueue = new AIQueue();

// Загружаем RAG поведение из настроек
async function getRAGBehavior() {
  if (!RAG_BEHAVIOR) {
    RAG_BEHAVIOR = await aiConfigService.getRAGBehavior();
  }
  return RAG_BEHAVIOR;
}

async function getTableData(tableId) {
  const columns = await encryptedDb.getData('user_columns', { table_id: tableId });
  const rows = await encryptedDb.getData('user_rows', { table_id: tableId });
  
  const cellValues = rows.length > 0 
    ? await encryptedDb.getData('user_cell_values', { row_id: { $in: rows.map(row => row.id) } })
    : [];

  const getColId = purpose => columns.find(col => col.options?.purpose === purpose)?.id;
  const questionColId = getColId('question');
  const answerColId = getColId('answer');
  const contextColId = getColId('context');
  const productColId = getColId('product');
  const priorityColId = getColId('priority');
  const dateColId = getColId('date');
  
  const data = rows.map(row => {
    const cells = cellValues.filter(cell => cell.row_id === row.id);
    const result = {
      id: row.id,
      question: cells.find(c => c.column_id === questionColId)?.value,
      answer: cells.find(c => c.column_id === answerColId)?.value,
      context: cells.find(c => c.column_id === contextColId)?.value,
      product: parseIfArray(cells.find(c => c.column_id === productColId)?.value),
      userTags: parseIfArray(cells.find(c => c.column_id === getColId('userTags'))?.value),
      priority: cells.find(c => c.column_id === priorityColId)?.value,
      date: cells.find(c => c.column_id === dateColId)?.value,
    };
    return result;
  });
  return data;
}

/**
 * Получить строки таблицы с фильтрацией по тегам пользователя
 * @param {number} tableId - ID таблицы
 * @param {number} userId - ID пользователя (опционально)
 * @returns {Promise<Array<number>>} Массив rowIds отфильтрованных строк
 */
async function getFilteredRowIdsByTags(tableId, userId = null) {
  if (!userId) {
    return null; // Без фильтрации
  }

  try {
    // Получаем теги пользователя
    const tagIds = await userContextService.getUserTags(userId);
    if (!tagIds || tagIds.length === 0) {
      return null; // Нет тегов - без фильтрации
    }

    // Получаем столбцы таблицы
    const columns = await encryptedDb.getData('user_columns', { table_id: tableId });
    
    // Находим столбец "Теги" с purpose='userTags' и типом multiselect-relation
    const tagsColumn = columns.find(col => 
      col.options?.purpose === 'userTags' && 
      (col.type === 'multiselect-relation' || col.type === 'relation')
    );

    if (!tagsColumn) {
      // Нет столбца с тегами - без фильтрации
      return null;
    }

    // Фильтруем строки по тегам через user_table_relations
    // Логика: найти строки, где хотя бы один тег пользователя совпадает с тегами строки
    const query = db.getQuery();
    const result = await query(`
      SELECT DISTINCT from_row_id
      FROM user_table_relations
      WHERE column_id = $1
        AND to_row_id = ANY($2)
    `, [tagsColumn.id, tagIds]);

    const filteredRowIds = result.rows.map(row => row.from_row_id);
    
    if (filteredRowIds.length === 0) {
      // Нет строк с тегами пользователя - возвращаем пустой массив
      return [];
    }

    console.log(`[RAG] Фильтрация по тегам: найдено ${filteredRowIds.length} строк с тегами пользователя`);
    return filteredRowIds;
  } catch (error) {
    logger.error('[RAG] Ошибка фильтрации по тегам:', error.message);
    return null; // При ошибке - без фильтрации
  }
}

async function ragAnswer({ tableId, userQuestion, product = null, threshold = null, forceReindex = false, userId = null }) {
  // Загружаем настройки RAG из ai_config
  const ragConfig = await aiConfigService.getRAGConfig();
  const ragBehavior = await getRAGBehavior();
  
  // Используем настройки из БД, если не переданы явно
  const finalThreshold = threshold !== null ? threshold : ragConfig.threshold;
  const maxResults = ragConfig.maxResults || 3;
  const upsertOnQuery = ragBehavior.upsertOnQuery || false;
  
  // Получаем теги пользователя для включения в ключ кэша
  let userTagIds = null;
  if (userId) {
    userTagIds = await userContextService.getUserTags(userId);
    // Если тегов нет, сохраняем null (не пустой массив, чтобы различать "нет тегов" и "не проверяли")
    if (userTagIds && userTagIds.length === 0) {
      userTagIds = null;
    }
  }
  
  // Проверяем кэш (используем ai-cache вместо ragCache)
  // Включаем tagIds в ключ кэша для учета фильтрации по тегам
  if (USE_AI_CACHE) {
    const cacheKey = aiCache.generateKeyForRAG(tableId, userQuestion, product, userId, userTagIds);
    const cached = aiCache.getWithTTL(cacheKey, 'rag');
    if (cached) {
      console.log(`[RAG] Возврат RAG результата из кэша (userId=${userId}, tagIds=${userTagIds ? userTagIds.join(',') : 'null'})`);
      return cached;
    }
  }
  
  // Фильтрация по тегам пользователя ДО получения данных
  const filteredRowIds = await getFilteredRowIdsByTags(tableId, userId);
  
  const data = await getTableData(tableId);
  
  // Применяем фильтрацию по тегам, если есть отфильтрованные строки
  let filteredData = data;
  if (filteredRowIds !== null) {
    if (filteredRowIds.length === 0) {
      // Нет строк с тегами пользователя - возвращаем пустой результат
      console.log(`[RAG] Нет строк с тегами пользователя`);
      return {
        answer: null,
        context: null,
        product: null,
        priority: null,
        date: null,
        score: null
      };
    }
    // Фильтруем данные по rowIds
    filteredData = data.filter(row => filteredRowIds.includes(row.id));
    console.log(`[RAG] Фильтрация по тегам: ${data.length} -> ${filteredData.length} строк`);
  }
  
  const questions = filteredData.map(row => row.question && typeof row.question === 'string' ? row.question.trim() : row.question);
  // Фильтруем только строки с непустым вопросом (text)
  const rowsForUpsert = filteredData
    .filter(row => row.id && row.question && String(row.question).trim().length > 0)
    .map(row => ({
      row_id: row.id,
      text: row.question,
      metadata: {
        answer: row.answer || null,
        context: row.context || null,
        product: row.product || [],
        userTags: row.userTags || [],
        priority: row.priority || null,
        date: row.date || null
      }
    }));
  
  // Выполняем upsert ТОЛЬКО если явно разрешено настройками или параметром
  if ((upsertOnQuery || forceReindex) && rowsForUpsert.length > 0) {
    await vectorSearch.upsert(tableId, rowsForUpsert);
  }
  
  // Поиск
  let results = [];
  if (rowsForUpsert.length > 0 && userQuestion && userQuestion.trim()) {
    results = await vectorSearch.search(tableId, userQuestion, maxResults);
    console.log(`[RAG] Search completed, got ${results.length} results`);
    
    results.forEach((result, index) => {
      console.log(`[RAG] Search result ${index}:`, {
        row_id: result.row_id,
        score: result.score,
        metadata: result.metadata
      });
    });
  } else {
    console.log(`[RAG] No data in table, skipping search`);
  }
  
  // Фильтрация по тегам пользователя (если была применена)
  // Если мы уже отфильтровали данные по тегам, нужно отфильтровать результаты векторного поиска
  let filtered = results;
  
  if (filteredRowIds !== null && filteredRowIds.length > 0) {
    // Фильтруем результаты векторного поиска по отфильтрованным rowIds
    filtered = filtered.filter(result => filteredRowIds.includes(Number(result.row_id)));
    console.log(`[RAG] Фильтрация результатов векторного поиска по тегам: ${results.length} -> ${filtered.length} результатов`);
  }
  
  // Фильтрация по продукту
  if (product) {
    filtered = filtered.filter(row => Array.isArray(row.metadata.product) ? row.metadata.product.includes(product) : row.metadata.product === product);
  }
  
  // Берём ближайший результат с учётом порога (по модулю)
  console.log(`[RAG] Looking for best result with abs(threshold): ${finalThreshold}`);
  const best = filtered.reduce((acc, row) => {
    if (Math.abs(row.score) <= finalThreshold && (acc === null || Math.abs(row.score) < Math.abs(acc.score))) {
      return row;
    }
    return acc;
  }, null);
  console.log(`[RAG] Best result:`, best);
  
  const result = {
    answer: best?.metadata?.answer,
    context: best?.metadata?.context,
    product: best?.metadata?.product,
    priority: best?.metadata?.priority,
    date: best?.metadata?.date,
    score: best?.score !== undefined && best?.score !== null ? Number(best.score) : null,
  };
  
  console.log(`[RAG] Final result:`, result);
  
  // Кэшируем результат (используем ai-cache вместо ragCache)
  // Используем те же tagIds, что и для проверки кэша
  if (USE_AI_CACHE) {
    const cacheKey = aiCache.generateKeyForRAG(tableId, userQuestion, product, userId, userTagIds);
    aiCache.setWithType(cacheKey, result, 'rag');
    console.log(`[RAG] Результат сохранен в кэш (userId=${userId}, tagIds=${userTagIds ? userTagIds.join(',') : 'null'})`);
  }
  
  return result;
}

/**
 * Получить плейсхолдеры для всех таблиц (генерируются на лету)
 * Плейсхолдеры таблиц НЕ хранятся в БД, генерируются из названий таблиц
 * Возвращает объект: { placeholderName: tableName, ... }
 * Пример: { svyaz_tegov_i_pravil: "Связь тегов и правил", faq: "FAQ" }
 * @returns {Promise<Object>} Объект с плейсхолдерами таблиц
 */
async function getTablePlaceholders() {
  try {
    // Проверяем кэш
    const now = Date.now();
    if (tablePlaceholdersCache.data && (now - tablePlaceholdersCache.timestamp) < TABLE_PLACEHOLDERS_CACHE_TTL) {
      logger.debug('[RAG] Плейсхолдеры таблиц загружены из кэша');
      return tablePlaceholdersCache.data;
    }

    logger.info('[RAG] Генерация плейсхолдеров таблиц...');

    // Получаем все электронные таблицы (user_tables)
    const tables = await encryptedDb.getData('user_tables', {});
    logger.info(`[RAG] Получено таблиц: ${tables.length}`);

    // Генерируем плейсхолдеры из названий таблиц
    const placeholders = {};
    const existingPlaceholders = [];

    for (const table of tables) {
      if (!table.name || typeof table.name !== 'string') {
        continue;
      }

      // Генерируем плейсхолдер из названия таблицы
      let placeholderName = generatePlaceholder(table.name);

      // Проверяем уникальность и добавляем суффикс если нужно
      let candidate = placeholderName;
      let i = 1;
      while (existingPlaceholders.includes(candidate)) {
        candidate = `${placeholderName}_${i}`;
        i++;
        if (i > 1000) {
          candidate = `${placeholderName}_${Date.now()}`;
          break;
        }
      }

      placeholders[candidate] = table.name;
      existingPlaceholders.push(candidate);

      logger.debug(`[RAG] Таблица "${table.name}" → плейсхолдер: {${candidate}}`);
    }

    // Сохраняем в кэш
    tablePlaceholdersCache.data = placeholders;
    tablePlaceholdersCache.timestamp = now;

    logger.info(`[RAG] Сгенерировано плейсхолдеров таблиц: ${Object.keys(placeholders).length}`);
    return placeholders;
  } catch (error) {
    logger.error('[RAG] Ошибка генерации плейсхолдеров таблиц:', error.message);
    return {};
  }
}

/**
 * Инвалидация кэша плейсхолдеров таблиц
 */
function invalidateTablePlaceholdersCache() {
  tablePlaceholdersCache.data = null;
  tablePlaceholdersCache.timestamp = 0;
  logger.info('[RAG] Кэш плейсхолдеров таблиц инвалидирован');
}

/**
 * Загрузка всех плейсхолдеров и их значений из пользовательских таблиц
 * Возвращает объект: { placeholder1: value1, placeholder2: value2, ... }
 * @param {Array} selectedRagTables - Массив ID выбранных RAG таблиц для фильтрации
 */
async function getAllPlaceholdersWithValues(selectedRagTables = []) {
  try {
    console.log('[RAG] Начинаем загрузку плейсхолдеров...');
    
    // Получаем колонки с плейсхолдерами
    let columns = await encryptedDb.getData('user_columns', {});
    
    // Фильтруем по выбранным RAG таблицам, если они указаны
    if (selectedRagTables && selectedRagTables.length > 0) {
      columns = columns.filter(col => selectedRagTables.includes(col.table_id));
      console.log(`[RAG] Фильтруем по RAG таблицам: ${selectedRagTables.join(', ')}`);
    }
    console.log(`[RAG] Получено колонок: ${columns.length}`);
    
    const columnsWithPlaceholders = columns.filter(col => col.placeholder && col.placeholder.trim() !== '');
    console.log(`[RAG] Колонок с плейсхолдерами: ${columnsWithPlaceholders.length}`);
    
    if (columnsWithPlaceholders.length === 0) {
      console.log('[RAG] Нет колонок с плейсхолдерами');
      return {};
    }
    
    // Получаем значения для каждой колонки с плейсхолдером
    const map = {};
    for (const column of columnsWithPlaceholders) {
      try {
        console.log(`[RAG] Получаем значение для плейсхолдера: ${column.placeholder} (column_id: ${column.id})`);
        
        // Получаем первое значение для этой колонки
        const values = await encryptedDb.getData('user_cell_values', { column_id: column.id }, 1);
        console.log(`[RAG] Найдено значений для ${column.placeholder}: ${values ? values.length : 0}`);
        
        if (values && values.length > 0 && values[0].value) {
          map[column.placeholder] = values[0].value;
          console.log(`[RAG] Установлено значение для ${column.placeholder}: ${values[0].value.substring(0, 50)}...`);
        } else {
          console.log(`[RAG] Нет значений для плейсхолдера ${column.placeholder}`);
        }
      } catch (error) {
        console.error(`[RAG] Ошибка получения значения для плейсхолдера ${column.placeholder}:`, error);
      }
    }
    
    console.log(`[RAG] Итоговый объект плейсхолдеров:`, Object.keys(map));
    return map;
  } catch (error) {
    console.error('[RAG] Ошибка получения плейсхолдеров:', error);
    return {};
  }
}

/**
 * Подставляет значения плейсхолдеров в строку (например, systemPrompt)
 * Пример: "Добро пожаловать, {client_name}!" => "Добро пожаловать, ООО Ромашка!"
 */
function replacePlaceholders(str, placeholders) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    return key in placeholders ? placeholders[key] : match;
  });
}

function parseIfArray(val) {
  if (typeof val === 'string') {
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return arr;
    } catch {}
  }
  return Array.isArray(val) ? val : (val ? [val] : []);
}

/**
 * Выполнить function call (tool call) от ИИ
 * Только функции для обновления имени и тегов пользователя
 * @param {Object} toolCall - Вызов функции от ИИ
 * @param {number} userId - ID пользователя (для функций обновления профиля)
 * @returns {Promise<Object>} Результат выполнения функции
 */
async function executeToolCall(toolCall, userId) {
  const { name, arguments: args } = toolCall.function;
  
  try {
    logger.info(`[RAG] Выполнение function call: ${name}`, args);
    
    if (!userId) {
      return { error: 'userId required for function calling' };
    }
    
    switch (name) {
      case 'update_user_name':
        // Обновление имени пользователя
        const resultName = await profileAnalysisService.updateUserNameInternal(userId, args.name);
        return { 
          success: true, 
          message: `Имя пользователя обновлено: ${args.name}`,
          name: args.name
        };
        
      case 'update_user_tags':
        // Обновление тегов пользователя
        // args.tagNames - массив названий тегов
        const tagIds = await profileAnalysisService.getTagIdsByNames(args.tagNames || []);
        const resultTags = await profileAnalysisService.updateUserTagsInternal(userId, tagIds);
        return { 
          success: true, 
          message: `Теги пользователя обновлены: ${args.tagNames.join(', ')}`,
          tagNames: args.tagNames,
          tagIds: tagIds
        };
        
      default:
        logger.warn(`[RAG] Unknown function call: ${name}`);
        return { error: `Unknown function: ${name}. Available functions: update_user_name, update_user_tags` };
    }
  } catch (error) {
    logger.error(`[RAG] Ошибка выполнения function call ${name}:`, error.message);
    return { error: error.message };
  }
}

/**
 * Получить определения функций для Function Calling
 * Только функции для обновления имени и тегов пользователя
 * @param {number} userId - ID пользователя (для функций обновления профиля)
 * @returns {Array} Массив определений функций
 */
function getFunctionDefinitions(userId) {
  return [
    {
      type: "function",
      function: {
        name: "update_user_name",
        description: "Обновить имя пользователя в профиле. Используй когда пользователь называет свое имя в сообщении. Пример: пользователь говорит 'Меня зовут Иван Петров' → вызывай update_user_name с name='Иван Петров'.",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Полное имя пользователя (например, 'Иван Петров' или 'Мария Иванова')"
            }
          },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_user_tags",
        description: "Обновить теги пользователя. Используй когда нужно добавить или изменить теги пользователя на основе контекста беседы. Пример: пользователь говорит 'Я купил ваш продукт' → можно добавить тег 'клиент' или 'холдер'. Пример: пользователь спрашивает про VIP программу → можно добавить тег 'VIP'.",
        parameters: {
          type: "object",
          properties: {
            tagNames: {
              type: "array",
              items: { type: "string" },
              description: "Массив названий тегов для добавления/обновления (например, ['VIP', 'клиент'] или ['холдер'])"
            }
          },
          required: ["tagNames"]
        }
      }
    }
  ];
}

async function generateLLMResponse({
  userQuestion,
  context,
  clarifyingAnswer,
  objectionAnswer,
  answer,
  systemPrompt,
  userTags,
  product,
  priority,
  date,
  rules,
  history,
  model,
  selectedRagTables,
  userId = null, // Добавляем userId для function calling
  multiSourceResults = null, // Результаты мульти-источникового поиска
  userProfile = null
}) {
  console.log(`[RAG] generateLLMResponse called with:`, {
    userQuestion,
    context,
    answer,
    systemPrompt: systemPrompt ? systemPrompt.substring(0, 100) + '...' : 'null',
    userTags,
    product,
    priority,
    date,
    model,
    historyLength: history ? history.length : 0,
    userProfile: userProfile ? {
      name: userProfile.name,
      tags: userProfile.tags,
      nameMissing: userProfile.nameMissing
    } : null
  });

  try {
    const aiAssistant = require('./ai-assistant');
    
    // Создаем контекст беседы с RAG данными
    const conversationContext = createConversationContext({
      userQuestion,
      ragAnswer: answer,
      ragContext: context,
      history,
      product,
      priority,
      date
    }, 'generateLLMResponse');
    
    const conversationSummary = buildConversationSummary(history, {
      maxMessages: 12,
      maxChars: 700,
      snippetLength: 160
    });

    const summaryPrefix = conversationSummary
      ? `Краткая сводка предыдущего диалога:\n${conversationSummary}\n\n`
      : '';

    // Формируем улучшенный промпт для LLM с учетом найденной информации
    let prompt = '';
    
    // Если есть результаты мульти-источникового поиска, используем их
    if (multiSourceResults && multiSourceResults.results && multiSourceResults.results.length > 0) {
      const sourcesInfo = multiSourceResults.results
        .slice(0, 3) // Берем топ-3 результатов
        .map((r, idx) => {
          const sourceName = r.sourceType === 'table' ? `Таблица (ID: ${r.sourceId})` : `Документ: ${r.metadata?.title || r.context || 'Без названия'}`;
          const fallbackText = (r.metadata?.answer && String(r.metadata.answer).trim())
            || (r.metadata?.title && String(r.metadata.title).trim())
            || '(текст отсутствует)';
          const sourceText = (r.text && r.text.trim()) || fallbackText;
          const snippetLimit = 300;
          const truncatedText = sourceText.length > snippetLimit
            ? `${sourceText.slice(0, snippetLimit)}...`
            : sourceText;
          const contextPart = r.context ? `\nКонтекст: ${r.context}` : '';
          return `[Источник ${idx + 1}: ${sourceName}]\n${truncatedText}${contextPart}`;
        })
        .join('\n\n---\n\n');
      
      prompt = `${summaryPrefix}База знаний содержит следующую информацию из разных источников:\n\n${sourcesInfo}\n\nВопрос пользователя: ${userQuestion}\n\nПроанализируй информацию из всех источников и дай пользователю полный и точный ответ.`;
    } else if (answer) {
      // Формат: делаем RAG ответ главным, вопрос - контекстом
      prompt = `${summaryPrefix}База знаний содержит ответ:\n"${answer}"\n\nВопрос пользователя: ${userQuestion}\n\nДай пользователю этот ответ из базы знаний.`;
    }
    
    if (!prompt) {
      prompt = `${summaryPrefix}Вопрос пользователя: ${userQuestion}`;
    }
    
    if (context && !multiSourceResults) {
      prompt += `\n\nДополнительный контекст: ${context}`;
    }
    
    if (product) {
      prompt += `\n\nПродукт: ${product}`;
    }

    if (priority) {
      prompt += `\n\nПриоритет: ${priority}`;
    }

    if (date) {
      prompt += `\n\nДата: ${date}`;
    }

    if (userTags && Array.isArray(userTags) && userTags.length > 0) {
      prompt += `\n\nТеги пользователя: ${userTags.join(', ')}`;
    }

    // --- ДОБАВЛЕНО: подстановка плейсхолдеров ---
    let finalSystemPrompt = systemPrompt;
    if (systemPrompt && systemPrompt.includes('{')) {
      // Подставляем плейсхолдеры таблиц (переменные для ИИ)
      const tablePlaceholders = await getTablePlaceholders();
      finalSystemPrompt = replacePlaceholders(finalSystemPrompt, tablePlaceholders);
      
      // Подставляем плейсхолдеры столбцов (значения из первой строки)
      const columnPlaceholders = await getAllPlaceholdersWithValues(selectedRagTables);
      finalSystemPrompt = replacePlaceholders(finalSystemPrompt, columnPlaceholders);
      
      console.log(`[RAG] Подставлены плейсхолдеры таблиц и столбцов в системный промпт`);
    }
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---

    if (userProfile) {
      const profileLines = [];
      if (userProfile.name) {
        profileLines.push(`Имя пользователя: ${userProfile.name}`);
      } else if (userProfile.nameMissing) {
        profileLines.push('Имя пользователя неизвестно. Вежливо спросите, как к нему обращаться, и дождитесь ответа (например: "Подскажите, пожалуйста, как я могу к вам обращаться?").');
      }

      if (Array.isArray(userProfile.tags) && userProfile.tags.length > 0) {
        profileLines.push(`Активные теги пользователя: ${userProfile.tags.join(', ')}`);
      }

      if (profileLines.length > 0) {
        const profileBlock = `Информация о пользователе:\n${profileLines.join('\n')}`;
        finalSystemPrompt = finalSystemPrompt
          ? `${finalSystemPrompt}\n\n${profileBlock}`
          : profileBlock;
      }
    }

    // Системный промпт полностью настраивается пользователем в /settings/ai/assistant
    // RAG ответ уже добавлен в prompt выше

    console.log(`[RAG] Сформированный промпт:`, prompt.substring(0, 200) + '...');

    // Получаем ответ от AI с учетом истории беседы
    let llmResponse;
    
    // Формируем сообщения для LLM
    const messages = [];
    if (finalSystemPrompt) {
      messages.push({ role: 'system', content: finalSystemPrompt });
    }
    const historyForLLM = Array.isArray(history) ? history.slice(-4) : [];
    for (const h of historyForLLM) {
      if (h && h.content) {
        const role = h.role === 'assistant' ? 'assistant' : 'user';
        messages.push({ role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: prompt });

    // Загружаем параметры LLM и qwen из настроек
    const llmParameters = await aiConfigService.getLLMParameters();
    const qwenParameters = await aiConfigService.getQwenSpecificParameters();
    const ollamaConfig_data = await ollamaConfig.getConfigAsync();
    
    // Формируем тело запроса для Ollama API (используем утилиту)
    const requestBodyOptions = {
      messages: messages,
      model: model,
      llmParameters: llmParameters,
      qwenParameters: qwenParameters,
      defaultModel: ollamaConfig_data.defaultModel,
      stream: false
    };
    
    // Добавляем tools для function calling (если userId передан)
    if (userId) {
      const tools = getFunctionDefinitions(userId);
      requestBodyOptions.tools = tools;
      requestBodyOptions.tool_choice = "auto";
    }
    
    const requestBody = buildOllamaRequest(requestBodyOptions);

    // Получаем настройки Ollama заранее (нужны для всех путей выполнения)
    const ollamaUrl = ollamaConfig.getBaseUrl();
    const timeouts = ollamaConfig.getTimeouts();

    try {
      // ✨ НОВОЕ: Используем очередь (если включена)
      // ВАЖНО: Function calling не поддерживается в очереди, поэтому если tools нужны - используем прямой вызов
      if (USE_AI_QUEUE && !userId) {
        try {
          llmResponse = await aiQueue.addTask({
            messages,
            model: requestBody.model,
            // Передаем параметры для очереди
            llmParameters,
            qwenParameters
          });
          
          console.log('[RAG] LLM response from queue:', llmResponse ? llmResponse.substring(0, 100) + '...' : 'null');
          return llmResponse;
          
        } catch (queueError) {
          console.warn('[RAG] Queue error, fallback to direct call:', queueError.message);
          
          // Fallback: если очередь переполнена и есть ответ из RAG - возвращаем его
          if (queueError.message.includes('переполнена') && answer) {
            console.log('[RAG] Возврат прямого ответа из RAG (очередь переполнена)');
            return answer;
          }
          
          // Продолжаем к прямому вызову
        }
      }

      // Прямой вызов Ollama (если очередь отключена или ошибка очереди)
      
      // Логируем размер промпта для отладки
      const promptSize = JSON.stringify(messages).length;
      const systemPromptSize = messages.find(m => m.role === 'system')?.content?.length || 0;
      const userPromptSize = messages.find(m => m.role === 'user')?.content?.length || 0;
      const historySize = messages.filter(m => m.role !== 'system' && m.role !== 'user').reduce((sum, m) => sum + (m.content?.length || 0), 0);
      
      logger.info(`[RAG] Отправка запроса в Ollama. Размер промпта: ${promptSize} символов (система: ${systemPromptSize}, пользователь: ${userPromptSize}, история: ${historySize}), таймаут: ${timeouts.ollamaChat/1000}с`);
      logger.info(`[RAG] Параметры LLM:`, JSON.stringify(llmParameters));
      if (qwenParameters.format) {
        logger.info(`[RAG] Qwen параметр format: ${qwenParameters.format}`);
      }
      
      // Проверяем размер промпта и предупреждаем, если он большой
      if (promptSize > 10000) {
        logger.warn(`[RAG] ⚠️ Большой промпт (${promptSize} символов). Возможны проблемы с производительностью.`);
      }
      if (promptSize > 50000) {
        logger.error(`[RAG] ⚠️⚠️ ОЧЕНЬ БОЛЬШОЙ промпт (${promptSize} символов). Модель может не справиться.`);
      }
      
      // Логируем информацию о function calling (если включен)
      if (requestBody.tools) {
        logger.info(`[RAG] Function calling включен, доступно ${requestBody.tools.length} функций`);
      }
      
      logger.info(`[RAG] Отправка запроса в Ollama (${ollamaUrl}/api/chat) в ${new Date().toISOString()}...`);
      const requestStartTime = Date.now();
      
      // Добавляем промежуточное логирование для длительных запросов
      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - requestStartTime;
        const elapsedSeconds = Math.round(elapsed/1000);
        if (elapsed > 30000) { // 30 секунд
          logger.warn(`[RAG] Запрос к Ollama выполняется уже ${elapsedSeconds}с...`, {
            model: requestBody.model,
            promptSize,
            timeout: timeouts.ollamaChat / 1000,
            elapsedSeconds,
            remainingTimeout: Math.round((timeouts.ollamaChat - elapsed) / 1000)
          });
        }
        // Критическое предупреждение если осталось менее 30 секунд до таймаута
        if (elapsed > timeouts.ollamaChat - 30000) {
          logger.error(`[RAG] ⚠️⚠️ КРИТИЧНО: Запрос к Ollama выполняется ${elapsedSeconds}с, до таймаута осталось ~${Math.round((timeouts.ollamaChat - elapsed) / 1000)}с!`, {
            model: requestBody.model,
            promptSize,
            timeout: timeouts.ollamaChat / 1000
          });
        }
      }, 15000); // Проверяем каждые 15 секунд (чаще для лучшего мониторинга)
      
      let response;
      try {
        response = await axios.post(`${ollamaUrl}/api/chat`, requestBody, {
          timeout: timeouts.ollamaChat
        });
      } finally {
        clearInterval(progressInterval);
      }
      
      const requestDuration = Date.now() - requestStartTime;
      const durationSeconds = Math.round(requestDuration/1000);
      logger.info(`[RAG] Получен ответ от Ollama в ${new Date().toISOString()}, статус: ${response.status}, время выполнения: ${requestDuration}ms (${durationSeconds}с)`, {
        model: requestBody.model,
        promptSize,
        timeout: timeouts.ollamaChat / 1000,
        responseLength: response.data?.message?.content?.length || 0
      });
      
      // Предупреждение если запрос занял слишком много времени
      if (requestDuration > 60000) { // Больше минуты
        logger.warn(`[RAG] ⚠️ Запрос к Ollama занял ${durationSeconds}с - это слишком долго. Возможные причины: большой промпт (${promptSize} символов), перегруженная модель или медленная система.`);
      }
      
      // ✨ НОВОЕ: Обработка function calls
      if (response.data.message.tool_calls && response.data.message.tool_calls.length > 0) {
        logger.info(`[RAG] ИИ запросил выполнение ${response.data.message.tool_calls.length} функций`);
        
        const toolResults = [];
        
        // Выполняем все function calls
        for (const toolCall of response.data.message.tool_calls) {
          const result = await executeToolCall(toolCall, userId);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function.name,
            content: JSON.stringify(result)
          });
        }
        
        // Добавляем результаты в историю сообщений
        messages.push(response.data.message); // Сообщение с tool_calls
        messages.push(...toolResults); // Результаты выполнения функций
        
        // Повторяем запрос с результатами функций
        const finalRequestBody = {
          ...requestBody,
          messages: messages
        };
        
        // Убираем tools из финального запроса (они уже не нужны)
        delete finalRequestBody.tools;
        delete finalRequestBody.tool_choice;
        
        logger.info(`[RAG] Отправка финального запроса в Ollama после выполнения function calls...`);
        const finalRequestStartTime = Date.now();
        const finalPromptSize = JSON.stringify(finalRequestBody.messages).length;
        
        // Мониторинг второго запроса
        const finalProgressInterval = setInterval(() => {
          const elapsed = Date.now() - finalRequestStartTime;
          const elapsedSeconds = Math.round(elapsed/1000);
          if (elapsed > 30000) {
            logger.warn(`[RAG] Финальный запрос к Ollama (после function calls) выполняется уже ${elapsedSeconds}с...`, {
              model: finalRequestBody.model,
              promptSize: finalPromptSize,
              timeout: timeouts.ollamaChat / 1000,
              elapsedSeconds
            });
          }
        }, 15000);
        
        let finalResponse;
        try {
          finalResponse = await axios.post(`${ollamaUrl}/api/chat`, finalRequestBody, {
            timeout: timeouts.ollamaChat
          });
        } finally {
          clearInterval(finalProgressInterval);
        }
        
        const finalRequestDuration = Date.now() - finalRequestStartTime;
        const finalDurationSeconds = Math.round(finalRequestDuration/1000);
        
        llmResponse = finalResponse.data.message.content;
        logger.info(`[RAG] Получен финальный ответ после выполнения function calls, длина: ${llmResponse ? llmResponse.length : 0} символов, время выполнения: ${finalRequestDuration}ms (${finalDurationSeconds}с)`, {
          model: finalRequestBody.model,
          promptSize: finalPromptSize,
          responseLength: llmResponse?.length || 0
        });
        
        if (finalRequestDuration > 60000) {
          logger.warn(`[RAG] ⚠️ Финальный запрос к Ollama (после function calls) занял ${finalDurationSeconds}с - это слишком долго.`);
        }
      } else {
        llmResponse = response.data.message.content;
        logger.info(`[RAG] Получен ответ от Ollama, длина: ${llmResponse ? llmResponse.length : 0} символов`);
      }
      
    } catch (error) {
      const isTimeout = error.message && (
        error.message.includes('timeout') || 
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('ECONNABORTED')
      );
      
      logger.error(`[RAG] Ошибка при вызове Ollama:`, {
        message: error.message,
        code: error.code,
        isTimeout,
        stack: error.stack
      });
      
      if (isTimeout) {
        logger.warn(`[RAG] Ollama timeout после ${timeouts.ollamaChat/1000}с. Возможно, модель перегружена или контекст слишком большой.`);
      } else {
        logger.error(`[RAG] Error in Ollama call:`, error.message, error.stack);
      }
      
      // Финальный fallback - возврат ответа из RAG
      if (answer) {
        logger.info('[RAG] Возврат прямого ответа из RAG (ошибка Ollama)');
        return answer;
      }
      
      // Если был таймаут и нет ответа из RAG - возвращаем более информативное сообщение
      if (isTimeout) {
        return 'Извините, обработка запроса заняла слишком много времени. Пожалуйста, попробуйте упростить ваш вопрос или повторите попытку позже.';
      }
      
      return 'Извините, произошла ошибка при генерации ответа.';
    }

    console.log(`[RAG] LLM response generated:`, llmResponse ? (typeof llmResponse === 'string' ? llmResponse.substring(0, 100) + '...' : JSON.stringify(llmResponse).substring(0, 100) + '...') : 'null');
    return llmResponse;
  } catch (error) {
    console.error(`[RAG] Error generating LLM response:`, error);
    return 'Извините, произошла ошибка при генерации ответа.';
  }
}


function buildConversationSummary(history, options = {}) {
  const {
    maxMessages = 10,
    maxChars = 700,
    snippetLength = 160
  } = options;

  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  const recentMessages = history.slice(-Math.max(maxMessages, 1));
  const roleLabels = {
    assistant: 'Ассистент',
    system: 'Система',
    tool: 'Инструмент'
  };

  const lines = [];
  let totalLength = 0;

  for (const message of recentMessages) {
    if (!message || typeof message.content !== 'string') {
      continue;
    }

    const roleLabel = roleLabels[message.role] || 'Пользователь';
    let text = message.content.replace(/\s+/g, ' ').trim();
    if (!text) {
      continue;
    }

    if (text.length > snippetLength) {
      text = `${text.slice(0, snippetLength)}...`;
    }

    const line = `${roleLabel}: ${text}`;
    if (totalLength + line.length > maxChars) {
      break;
    }

    lines.push(line);
    totalLength += line.length + 1;
    if (totalLength >= maxChars) {
      break;
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}


/**
 * Создает контекст беседы с RAG данными
 */
function createConversationContext({
  userQuestion,
  ragAnswer,
  ragContext,
  history,
  product,
  priority,
  date
}, source = 'generic') {
  const context = {
    currentQuestion: userQuestion,
    ragData: {
      answer: ragAnswer,
      context: ragContext,
      product,
      priority,
      date
    },
    conversationHistory: history || [],
    hasRagData: !!(ragAnswer || ragContext),
    isFollowUpQuestion: history && history.length > 0
  };

  console.log(`[RAG] Создан контекст беседы (${source}):`, {
    hasRagData: context.hasRagData,
    historyLength: context.conversationHistory.length,
    isFollowUp: context.isFollowUpQuestion
  });

  return context;
}

/**
 * Улучшенная функция RAG с поддержкой беседы
 */
async function ragAnswerWithConversation({ 
  tableId, 
  userQuestion, 
  product = null, 
  threshold = null,
  history = [],
  conversationId = null,
  forceReindex = false
}) {
  // Загружаем настройки RAG для threshold
  const ragConfig = await aiConfigService.getRAGConfig();
  const finalThreshold = threshold !== null ? threshold : ragConfig.threshold;
  
  console.log(`[RAG] ragAnswerWithConversation: tableId=${tableId}, question="${userQuestion}", historyLength=${history.length}, userId=${userId}`);

  // Получаем базовый RAG результат (с фильтрацией по тегам, если userId передан)
  const ragResult = await ragAnswer({ tableId, userQuestion, product, threshold: finalThreshold, forceReindex, userId });
  
  // Анализируем контекст беседы
  const conversationContext = createConversationContext({
    userQuestion,
    ragAnswer: ragResult.answer,
    ragContext: ragResult.context,
    history,
    product: ragResult.product,
    priority: ragResult.priority,
    date: ragResult.date
  }, 'ragAnswerWithConversation');

  // Если это уточняющий вопрос и есть история
  if (conversationContext.isFollowUpQuestion && conversationContext.hasRagData) {
    console.log(`[RAG] Обнаружен уточняющий вопрос с RAG данными`);

    // Проверяем, есть ли точный ответ в первом поиске
    if (ragResult.answer && typeof ragResult.score === 'number' && Math.abs(ragResult.score) <= finalThreshold) {
      console.log(`[RAG] Найден точный ответ (score=${ragResult.score}), возвращаем ответ из базы без модификаций`);
      return {
        ...ragResult,
        // Возвращаем чистый ответ
        answer: ragResult.answer,
        conversationContext,
        isFollowUp: true
      };
    }
    
    // Модифицируем вопрос с учетом контекста (only if no confident match)
    const contextualQuestion = `${userQuestion}\n\nКонтекст предыдущих ответов: ${history.map(msg => msg.content).join('\n')}`;
    
    // Повторяем поиск с контекстуализированным вопросом
    const contextualRagResult = await ragAnswer({ 
      tableId, 
      userQuestion: contextualQuestion, 
      product, 
      threshold: finalThreshold,
      forceReindex,
      userId
    });
    
    // Объединяем результаты
    return {
      ...contextualRagResult,
      conversationContext,
      isFollowUp: true
    };
  }

  return {
    ...ragResult,
    conversationContext,
    isFollowUp: false
  };
}

// ✨ НОВОЕ: Функция для запуска AI Queue Worker
function startQueueWorker() {
  if (USE_AI_QUEUE) {
    aiQueue.startWorker();
    logger.info('[RAG] ✅ AI Queue Worker запущен из ragService');
  } else {
    logger.info('[RAG] AI Queue отключена (USE_AI_QUEUE=false)');
  }
}

// ✨ НОВОЕ: Функция для остановки AI Queue Worker
function stopQueueWorker() {
  if (aiQueue && aiQueue.workerInterval) {
    aiQueue.stopWorker();
    logger.info('[RAG] ⏹️ AI Queue Worker остановлен');
  }
}

// ✨ НОВОЕ: Получение статистики
function getQueueStats() {
  return aiQueue.getStats();
}

function getCacheStats() {
  return {
    ...aiCache.getStats(),
    byType: aiCache.getStatsByType()
  };
}

module.exports = {
  ragAnswer,
  getTableData,
  generateLLMResponse,
  ragAnswerWithConversation,
  startQueueWorker,
  stopQueueWorker,
  getQueueStats,
  getCacheStats,
  getAllPlaceholdersWithValues, // Плейсхолдеры столбцов (значения из первой строки)
  getTablePlaceholders, // Плейсхолдеры таблиц (генерируются на лету)
  invalidateTablePlaceholdersCache, // Инвалидация кэша плейсхолдеров таблиц
  replacePlaceholders, // Функция подстановки плейсхолдеров
  generatePlaceholder // Функция генерации плейсхолдера из названия
};

