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
const vectorSearch = require('./vectorSearchClient');
const { getProviderSettings } = require('./aiProviderSettingsService');

// console.log('[RAG] ragService.js loaded');

// Простой кэш для RAG результатов
const ragCache = new Map();
const RAG_CACHE_TTL = 5 * 60 * 1000; // 5 минут
// Управляет поведением: выполнять ли upsert всех строк на каждый запрос поиска
const UPSERT_ON_QUERY = process.env.RAG_UPSERT_ON_QUERY === 'true';

async function getTableData(tableId) {
      // console.log(`[RAG] getTableData called for tableId: ${tableId}`);
  
  const columns = await encryptedDb.getData('user_columns', { table_id: tableId });
      // console.log(`[RAG] Found ${columns.length} columns:`, columns.map(col => ({ id: col.id, name: col.name, purpose: col.options?.purpose })));
  
  const rows = await encryptedDb.getData('user_rows', { table_id: tableId });
      // console.log(`[RAG] Found ${rows.length} rows:`, rows.map(row => ({ id: row.id, name: row.name })));
  
  const cellValues = await encryptedDb.getData('user_cell_values', { row_id: { $in: rows.map(row => row.id) } });
      // console.log(`[RAG] Found ${cellValues.length} cell values`);

  const getColId = purpose => columns.find(col => col.options?.purpose === purpose)?.id;
  const questionColId = getColId('question');
  const answerColId = getColId('answer');
  const contextColId = getColId('context');
  const productColId = getColId('product');
  const priorityColId = getColId('priority');
  const dateColId = getColId('date');
  
      // console.log(`[RAG] Column IDs:`, {
      //   question: questionColId,
      //   answer: answerColId,
      //   context: contextColId,
      //   product: productColId,
      //   priority: priorityColId,
      //   date: dateColId
      // });

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
    // console.log(`[RAG] Processed row ${row.id}:`, result);
    return result;
  });
  return data;
}

async function ragAnswer({ tableId, userQuestion, product = null, threshold = 10, forceReindex = false }) {
      // console.log(`[RAG] ragAnswer called: tableId=${tableId}, userQuestion="${userQuestion}"`);
  
  // Проверяем кэш
  const cacheKey = `${tableId}:${userQuestion}:${product}`;
  const cached = ragCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < RAG_CACHE_TTL) {
    // console.log(`[RAG] Returning cached result for: ${cacheKey}`);
    return cached.result;
  }
  
  const data = await getTableData(tableId);
      // console.log(`[RAG] Got ${data.length} rows from database`);
  
  // Подробное логирование данных
  data.forEach((row, index) => {
    // console.log(`[RAG] Row ${index}:`, {
    //   id: row.id,
    //   question: row.question,
    //   answer: row.answer,
    //   product: row.product
    // });
  });
  
  const questions = data.map(row => row.question && typeof row.question === 'string' ? row.question.trim() : row.question);
  // Фильтруем только строки с непустым вопросом (text)
  const rowsForUpsert = data
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
  
  // console.log(`[RAG] Prepared ${rowsForUpsert.length} rows for upsert`);
  // console.log(`[RAG] First row:`, rowsForUpsert[0]);
  
  // Выполняем upsert ТОЛЬКО если явно разрешено флагом/параметром.
  if ((UPSERT_ON_QUERY || forceReindex) && rowsForUpsert.length > 0) {
    await vectorSearch.upsert(tableId, rowsForUpsert);
  }
  
  // Поиск
  let results = [];
  if (rowsForUpsert.length > 0) {
    results = await vectorSearch.search(tableId, userQuestion, 3); // Увеличиваем до 3 результатов для лучшего поиска
    // console.log(`[RAG] Search completed, got ${results.length} results`);
    
    // Подробное логирование результатов поиска
    results.forEach((result, index) => {
      // console.log(`[RAG] Search result ${index}:`, {
      //   row_id: result.row_id,
      //   score: result.score,
      //   metadata: result.metadata
      // });
    });
  } else {
    // console.log(`[RAG] No data in table, skipping search`);
  }
  
  // Фильтрация по тегам/продукту
  let filtered = results;
  // console.log(`[RAG] Before filtering: ${filtered.length} results`);
  
  if (product) {
    // console.log(`[RAG] Filtering by product:`, product);
    filtered = filtered.filter(row => Array.isArray(row.metadata.product) ? row.metadata.product.includes(product) : row.metadata.product === product);
    // console.log(`[RAG] After product filtering: ${filtered.length} results`);
  }
  
  // Берём ближайший результат с учётом порога (по модулю)
  // console.log(`[RAG] Looking for best result with abs(threshold): ${threshold}`);
  const best = filtered.reduce((acc, row) => {
    if (Math.abs(row.score) <= threshold && (acc === null || Math.abs(row.score) < Math.abs(acc.score))) {
      return row;
    }
    return acc;
  }, null);
  // console.log(`[RAG] Best result:`, best);
  
  // Логируем все результаты с их score для диагностики
  if (filtered.length > 0) {
    // console.log(`[RAG] All filtered results with scores:`);
    // filtered.forEach((result, index) => {
    //   console.log(`[RAG]   ${index}: score=${result.score}, meets_threshold=${Math.abs(result.score) <= threshold}`);
    // });
  }
  
  const result = {
    answer: best?.metadata?.answer,
    context: best?.metadata?.context,
    product: best?.metadata?.product,
    priority: best?.metadata?.priority,
    date: best?.metadata?.date,
    score: best?.score !== undefined && best?.score !== null ? Number(best.score) : null,
  };
  
  // Кэшируем результат
  ragCache.set(cacheKey, {
    result,
    timestamp: Date.now()
  });
  
  return result;
}

/**
 * Загрузка всех плейсхолдеров и их значений из пользовательских таблиц
 * Возвращает объект: { placeholder1: value1, placeholder2: value2, ... }
 */
async function getAllPlaceholdersWithValues() {
  try {
    console.log('[RAG] Начинаем загрузку плейсхолдеров...');
    
    // Получаем все колонки с плейсхолдерами
    const columns = await encryptedDb.getData('user_columns', {});
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
  model
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
    historyLength: history ? history.length : 0
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
    
    // Формируем улучшенный промпт для LLM с учетом найденной информации
    let prompt = `Вопрос пользователя: ${userQuestion}`;
    
    // Добавляем найденную информацию из RAG
    if (answer) {
      prompt += `\n\nНайденный ответ из базы знаний: ${answer}`;
    }
    
    if (context) {
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

    // --- ДОБАВЛЕНО: подстановка плейсхолдеров ---
    let finalSystemPrompt = systemPrompt;
    if (systemPrompt && systemPrompt.includes('{')) {
      const placeholders = await getAllPlaceholdersWithValues();
      finalSystemPrompt = replacePlaceholders(systemPrompt, placeholders);
      console.log(`[RAG] Подставлены плейсхолдеры в системный промпт`);
    }
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---

    // Используем системный промпт из настроек, если он есть
    if (!finalSystemPrompt || !finalSystemPrompt.trim()) {
      // Fallback инструкция, если системный промпт не настроен
      prompt += `\n\nИнструкция: Используй найденную информацию из базы знаний для ответа. Если найденный ответ подходит к вопросу пользователя, используй его как основу. Если нужно дополнить или уточнить ответ, сделай это. Поддерживай естественную беседу, учитывая предыдущие сообщения. Отвечай на русском языке кратко и по делу. Если пользователь задает уточняющие вопросы, используй контекст предыдущих ответов.`;
    }

    console.log(`[RAG] Сформированный промпт:`, prompt.substring(0, 200) + '...');

    // Получаем ответ от AI с учетом истории беседы
    let llmResponse;
    try {
      // Прямое обращение к модели без очереди для снижения задержек при fallback
      const messages = [];
      if (finalSystemPrompt) {
        messages.push({ role: 'system', content: finalSystemPrompt });
      }
      for (const h of (history || [])) {
        if (h && h.content) {
          const role = h.role === 'assistant' ? 'assistant' : 'user';
          messages.push({ role, content: h.content });
        }
      }
      messages.push({ role: 'user', content: prompt });
      // Облегченные опции для снижения времени ответа на CPU
      llmResponse = await aiAssistant.directRequest(messages, finalSystemPrompt, {
        temperature: 0.2,
        numPredict: 192,
        numCtx: 1024,
        numThread: 4
      });
    } catch (error) {
      console.error(`[RAG] Error in getResponse:`, error.message);
      
      // Fallback: если очередь перегружена, возвращаем найденный ответ напрямую
      if (error.message.includes('очередь перегружена') && answer) {
        console.log(`[RAG] Queue overloaded, returning direct answer from RAG`);
        return answer;
      }
      
      // Другой fallback для других ошибок
      return 'Извините, произошла ошибка при генерации ответа.';
    }

    console.log(`[RAG] LLM response generated:`, llmResponse ? llmResponse.substring(0, 100) + '...' : 'null');
    return llmResponse;
  } catch (error) {
    console.error(`[RAG] Error generating LLM response:`, error);
    return 'Извините, произошла ошибка при генерации ответа.';
  }
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
  threshold = 10,
  history = [],
  conversationId = null,
  forceReindex = false
}) {
  console.log(`[RAG] ragAnswerWithConversation: tableId=${tableId}, question="${userQuestion}", historyLength=${history.length}`);

  // Получаем базовый RAG результат
  const ragResult = await ragAnswer({ tableId, userQuestion, product, threshold, forceReindex });
  
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
    if (ragResult.answer && typeof ragResult.score === 'number' && Math.abs(ragResult.score) <= threshold) {
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
      threshold,
      forceReindex
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

module.exports = {
  ragAnswer,
  getTableData,
  generateLLMResponse,
  ragAnswerWithConversation
}; 