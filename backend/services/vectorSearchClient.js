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

const axios = require('axios');
const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');
const aiConfigService = require('./aiConfigService');

const MIN_VECTOR_UPSERT_TIMEOUT = 360000; // 6 минут — с запасом для больших документов

// Загружаем настройки из aiConfigService (с fallback на ENV)
let VECTOR_SEARCH_URL = null;
let TIMEOUTS = null;

// Инициализация настроек (асинхронная загрузка)
async function loadSettings() {
  try {
    const vectorConfig = await aiConfigService.getVectorSearchConfig();
    VECTOR_SEARCH_URL = vectorConfig.url || process.env.VECTOR_SEARCH_URL || 'http://vector-search:8001';
    TIMEOUTS = ollamaConfig.getTimeouts();
  } catch (error) {
    logger.warn('[VectorSearchClient] Ошибка загрузки настроек, используем дефолты:', error.message);
    VECTOR_SEARCH_URL = process.env.VECTOR_SEARCH_URL || 'http://vector-search:8001';
    TIMEOUTS = ollamaConfig.getTimeouts();
  }
}

// Инициализируем настройки при загрузке модуля
loadSettings().catch(err => logger.warn('[VectorSearchClient] Ошибка инициализации:', err.message));

async function upsert(tableId, rows) {
  // Загружаем актуальные настройки
  if (!VECTOR_SEARCH_URL || !TIMEOUTS) {
    await loadSettings();
  }
  
  logger.info(`[VectorSearch] upsert: tableId=${tableId}, rows=${rows.length}`);
  try {
    const res = await axios.post(`${VECTOR_SEARCH_URL}/upsert`, {
      table_id: String(tableId),
      rows: rows.map(r => ({
        row_id: String(r.row_id),
        text: r.text,
        metadata: r.metadata || {}
      }))
    }, {
      timeout: Math.max(TIMEOUTS.vectorUpsert || 0, MIN_VECTOR_UPSERT_TIMEOUT)
    });
    logger.info(`[VectorSearch] upsert result:`, res.data);
    return res.data;
  } catch (error) {
    logger.error(`[VectorSearch] upsert error:`, error.message);
    throw error;
  }
}

async function search(tableId, query, topK = 3) {
  // Загружаем актуальные настройки
  if (!VECTOR_SEARCH_URL || !TIMEOUTS) {
    await loadSettings();
  }
  
  logger.info(`[VectorSearch] search: tableId=${tableId}, query="${query}", topK=${topK}`);
  try {
    const res = await axios.post(`${VECTOR_SEARCH_URL}/search`, {
      table_id: String(tableId),
      query,
      top_k: topK
    }, {
      timeout: TIMEOUTS.vectorSearch // Централизованный таймаут для поиска
    });
    logger.info(`[VectorSearch] search result:`, res.data.results);
    return res.data.results;
  } catch (error) {
    logger.error(`[VectorSearch] search error:`, error.message);
    throw error;
  }
}

async function remove(tableId, rowIds) {
  logger.info(`[VectorSearch] remove: tableId=${tableId}, rowIds=${rowIds}`);
  try {
    const res = await axios.post(`${VECTOR_SEARCH_URL}/delete`, {
      table_id: String(tableId),
      row_ids: rowIds.map(String)
    });
    logger.info(`[VectorSearch] remove result:`, res.data);
    return res.data;
  } catch (error) {
    logger.error(`[VectorSearch] remove error:`, error.message);
    throw error;
  }
}

async function rebuild(tableId, rows) {
  logger.info(`[VectorSearch] rebuild: tableId=${tableId}, rows=${rows.length}`);
  try {
    const res = await axios.post(`${VECTOR_SEARCH_URL}/rebuild`, {
      table_id: String(tableId),
      rows: rows.map(r => ({
        row_id: String(r.row_id),
        text: r.text,
        metadata: r.metadata || {}
      }))
    });
    logger.info(`[VectorSearch] rebuild result:`, res.data);
    return res.data;
  } catch (error) {
    logger.error(`[VectorSearch] rebuild error:`, error.message);
    throw error;
  }
}

async function health() {
  // Загружаем актуальные настройки
  if (!VECTOR_SEARCH_URL || !TIMEOUTS) {
    await loadSettings();
  }
  
  logger.info(`[VectorSearch] health check`);
  try {
    const res = await axios.get(`${VECTOR_SEARCH_URL}/health`, { timeout: TIMEOUTS.vectorHealth });
    logger.info(`[VectorSearch] health result:`, res.data);
    return {
      status: 'ok',
      url: VECTOR_SEARCH_URL,
      response: res.data
    };
  } catch (error) {
    logger.error(`[VectorSearch] health error:`, error.message);
    return {
      status: 'error',
      url: VECTOR_SEARCH_URL,
      error: error.message
    };
  }
}

module.exports = {
  upsert,
  search,
  remove,
  rebuild,
  health
}; 