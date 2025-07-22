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
const vectorSearch = require('./vectorSearchClient');
const { getProviderSettings } = require('./aiProviderSettingsService');

console.log('[RAG] ragService.js loaded');

async function getTableData(tableId) {
  console.log(`[RAG] getTableData called for tableId: ${tableId}`);
  
  const columns = (await db.query('SELECT * FROM user_columns WHERE table_id = $1', [tableId])).rows;
  console.log(`[RAG] Found ${columns.length} columns:`, columns.map(col => ({ id: col.id, name: col.name, purpose: col.options?.purpose })));
  
  const rows = (await db.query('SELECT * FROM user_rows WHERE table_id = $1', [tableId])).rows;
  console.log(`[RAG] Found ${rows.length} rows:`, rows.map(row => ({ id: row.id, name: row.name })));
  
  const cellValues = (await db.query('SELECT * FROM user_cell_values WHERE row_id IN (SELECT id FROM user_rows WHERE table_id = $1)', [tableId])).rows;
  console.log(`[RAG] Found ${cellValues.length} cell values`);

  const getColId = purpose => columns.find(col => col.options?.purpose === purpose)?.id;
  const questionColId = getColId('question');
  const answerColId = getColId('answer');
  const contextColId = getColId('context');
  const productColId = getColId('product');
  const priorityColId = getColId('priority');
  const dateColId = getColId('date');
  
  console.log(`[RAG] Column IDs:`, {
    question: questionColId,
    answer: answerColId,
    context: contextColId,
    product: productColId,
    priority: priorityColId,
    date: dateColId
  });

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
    console.log(`[RAG] Processed row ${row.id}:`, result);
    return result;
  });
  return data;
}

async function ragAnswer({ tableId, userQuestion, product = null, threshold = 10 }) {
  console.log(`[RAG] ragAnswer called: tableId=${tableId}, userQuestion="${userQuestion}"`);
  
  const data = await getTableData(tableId);
  console.log(`[RAG] Got ${data.length} rows from database`);
  
  // Подробное логирование данных
  data.forEach((row, index) => {
    console.log(`[RAG] Row ${index}:`, {
      id: row.id,
      question: row.question,
      answer: row.answer,
      product: row.product
    });
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
  
  console.log(`[RAG] Prepared ${rowsForUpsert.length} rows for upsert`);
  console.log(`[RAG] First row:`, rowsForUpsert[0]);
  
  // Upsert все вопросы в индекс (можно оптимизировать по изменению)
  if (rowsForUpsert.length > 0) {
    await vectorSearch.upsert(tableId, rowsForUpsert);
    console.log(`[RAG] Upsert completed`);
  } else {
    console.log(`[RAG] No rows to upsert, skipping`);
  }
  
  // Поиск
  let results = [];
  if (rowsForUpsert.length > 0) {
    results = await vectorSearch.search(tableId, userQuestion, 3);
    console.log(`[RAG] Search completed, got ${results.length} results`);
    
    // Подробное логирование результатов поиска
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
  
  // Фильтрация по тегам/продукту
  let filtered = results;
  console.log(`[RAG] Before filtering: ${filtered.length} results`);
  
  if (product) {
    console.log(`[RAG] Filtering by product:`, product);
    filtered = filtered.filter(row => Array.isArray(row.metadata.product) ? row.metadata.product.includes(product) : row.metadata.product === product);
    console.log(`[RAG] After product filtering: ${filtered.length} results`);
  }
  
  // Берём ближайший результат с учётом порога (по модулю)
  console.log(`[RAG] Looking for best result with abs(threshold): ${threshold}`);
  const best = filtered.reduce((acc, row) => {
    if (Math.abs(row.score) <= threshold && (acc === null || Math.abs(row.score) < Math.abs(acc.score))) {
      return row;
    }
    return acc;
  }, null);
  console.log(`[RAG] Best result:`, best);
  
  // Логируем все результаты с их score для диагностики
  if (filtered.length > 0) {
    console.log(`[RAG] All filtered results with scores:`);
    filtered.forEach((result, index) => {
      console.log(`[RAG]   ${index}: score=${result.score}, meets_threshold=${Math.abs(result.score) <= threshold}`);
    });
  }
  
  return {
    answer: best?.metadata?.answer,
    context: best?.metadata?.context,
    product: best?.metadata?.product,
    priority: best?.metadata?.priority,
    date: best?.metadata?.date,
    score: best?.score,
  };
}

/**
 * Загрузка всех плейсхолдеров и их значений из пользовательских таблиц
 * Возвращает объект: { placeholder1: value1, placeholder2: value2, ... }
 */
async function getAllPlaceholdersWithValues() {
  // Получаем все плейсхолдеры и их значения (берём первое значение для каждого плейсхолдера)
  const result = await db.getQuery()(`
    SELECT c.placeholder, cv.value
    FROM user_columns c
    JOIN user_cell_values cv ON c.id = cv.column_id
    WHERE c.placeholder IS NOT NULL AND c.placeholder != ''
    ORDER BY c.id, cv.id
  `);
  // Группируем по плейсхолдеру (берём первое значение)
  const map = {};
  for (const row of result.rows) {
    if (row.placeholder && !(row.placeholder in map)) {
      map[row.placeholder] = row.value;
    }
  }
  return map;
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
  model,
  language
}) {
  console.log(`[RAG] generateLLMResponse called with:`, {
    userQuestion,
    context,
    answer,
    systemPrompt,
    userTags,
    product,
    priority,
    date,
    model,
    language
  });

  try {
    const aiAssistant = require('./ai-assistant');
    
    // Формируем промпт для LLM
    let prompt = userQuestion;
    
    if (context) {
      prompt += `\n\nКонтекст: ${context}`;
    }
    
    if (answer) {
      prompt += `\n\nНайденный ответ: ${answer}`;
    }
    
    if (product) {
      prompt += `\n\nПродукт: ${product}`;
    }

    // --- ДОБАВЛЕНО: подстановка плейсхолдеров ---
    let finalSystemPrompt = systemPrompt;
    if (systemPrompt && systemPrompt.includes('{')) {
      const placeholders = await getAllPlaceholdersWithValues();
      finalSystemPrompt = replacePlaceholders(systemPrompt, placeholders);
    }
    // --- КОНЕЦ ДОБАВЛЕНИЯ ---

    // Получаем ответ от AI
    const llmResponse = await aiAssistant.getResponse(
      prompt,
      language || 'auto',
      history,
      finalSystemPrompt,
      rules
    );

    console.log(`[RAG] LLM response generated:`, llmResponse);
    return llmResponse;
  } catch (error) {
    console.error(`[RAG] Error generating LLM response:`, error);
    return 'Извините, произошла ошибка при генерации ответа.';
  }
}

module.exports = {
  ragAnswer,
  getTableData,
  generateLLMResponse
}; 