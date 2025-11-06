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
 * Конфигурационный сервис для Ollama и AI инфраструктуры
 * Обёртка над aiConfigService для обратной совместимости
 * 
 * ВАЖНО: Все настройки теперь берутся из ai_config через aiConfigService
 */

const logger = require('../utils/logger');
const aiConfigService = require('./aiConfigService');

// Кэш для синхронных методов (для обратной совместимости)
let syncCache = null;
let syncCacheTimestamp = 0;
const SYNC_CACHE_TTL = 60000; // 1 минута

/**
 * Обновляет синхронный кэш из aiConfigService
 * @private
 */
async function _updateSyncCache() {
  try {
    const ollamaConfig = await aiConfigService.getOllamaConfig();
    syncCache = {
      baseUrl: ollamaConfig.baseUrl,
      defaultModel: ollamaConfig.llmModel,
      embeddingModel: ollamaConfig.embeddingModel
    };
    syncCacheTimestamp = Date.now();
  } catch (error) {
    logger.warn('[ollamaConfig] Failed to update sync cache:', error.message);
    // Используем дефолты
    syncCache = {
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
      defaultModel: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
      embeddingModel: process.env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large:latest'
    };
  }
}

/**
 * Получает значение из синхронного кэша или обновляет его
 * @private
 */
function _getFromSyncCache(key) {
  const now = Date.now();
  if (!syncCache || (now - syncCacheTimestamp) > SYNC_CACHE_TTL) {
    // Обновляем кэш асинхронно (не блокируя)
    _updateSyncCache().catch(err => logger.warn('[ollamaConfig] Sync cache update failed:', err.message));
  }
  
  // Если кэш есть - используем его
  if (syncCache && syncCache[key]) {
    return syncCache[key];
  }
  
  // Иначе используем дефолты
  const defaults = {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
    defaultModel: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    embeddingModel: process.env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large:latest'
  };
  
  return defaults[key] || defaults.baseUrl;
}

/**
 * Получает базовый URL для Ollama (синхронная версия)
 * @returns {string} Базовый URL Ollama
 */
function getBaseUrl() {
  return _getFromSyncCache('baseUrl');
}

/**
 * Получает базовый URL для Ollama (асинхронная версия)
 * @returns {Promise<string>} Базовый URL Ollama
 */
async function getBaseUrlAsync() {
  const config = await aiConfigService.getOllamaConfig();
  return config.baseUrl;
}

/**
 * Получает URL для конкретного API endpoint Ollama
 * @param {string} endpoint - Endpoint API (например: 'tags', 'generate')
 * @returns {string} Полный URL для API endpoint
 */
function getApiUrl(endpoint) {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/api/${endpoint}`;
}

/**
 * Получает модель по умолчанию для Ollama (синхронная версия)
 * @returns {string} Название модели
 */
function getDefaultModel() {
  return _getFromSyncCache('defaultModel');
}

/**
 * Получает модель асинхронно из БД
 * @returns {Promise<string>} Название модели из БД
 */
async function getDefaultModelAsync() {
  const config = await aiConfigService.getOllamaConfig();
  return config.llmModel;
}

/**
 * Получает embedding модель асинхронно из БД
 * @returns {Promise<string>} Название embedding модели из БД
 */
async function getEmbeddingModel() {
  const config = await aiConfigService.getOllamaConfig();
  return config.embeddingModel;
}

// Кэш для таймаутов (синхронный доступ)
let timeoutsCache = null;
let timeoutsCacheTimestamp = 0;

/**
 * Обновляет кэш таймаутов из aiConfigService
 * @private
 */
async function _updateTimeoutsCache() {
  try {
    const timeouts = await aiConfigService.getTimeouts();
    const cacheConfig = await aiConfigService.getCacheConfig();
    const queueConfig = await aiConfigService.getQueueConfig();
    
    timeoutsCache = {
      // Ollama API - таймауты запросов
      ollamaChat: timeouts.ollamaChat,
      ollamaEmbedding: timeouts.ollamaEmbedding,
      ollamaHealth: timeouts.ollamaHealth,
      ollamaTags: timeouts.ollamaTags,
      
      // Vector Search - таймауты запросов
      vectorSearch: timeouts.vectorSearch,
      vectorUpsert: timeouts.vectorUpsert,
      vectorHealth: timeouts.vectorHealth,
      
      // AI Cache - TTL (Time To Live) для кэширования
      cacheLLM: cacheConfig.llmTTL,
      cacheRAG: cacheConfig.ragTTL,
      cacheMax: cacheConfig.maxSize,
      
      // AI Queue - параметры очереди
      queueTimeout: queueConfig.timeout,
      queueMaxSize: queueConfig.maxSize,
      queueInterval: queueConfig.interval,
      
      // Default для совместимости
      default: timeouts.ollamaChat
    };
    timeoutsCacheTimestamp = Date.now();
  } catch (error) {
    logger.warn('[ollamaConfig] Failed to update timeouts cache:', error.message);
    // Используем дефолты
    timeoutsCache = {
      ollamaChat: 600000,
      ollamaEmbedding: 90000,
      ollamaHealth: 5000,
      ollamaTags: 10000,
      vectorSearch: 90000,
      vectorUpsert: 600000,
      vectorHealth: 5000,
      cacheLLM: 86400000,
      cacheRAG: 300000,
      cacheMax: 1000,
      queueTimeout: 180000,
      queueMaxSize: 100,
      queueInterval: 100,
      default: 180000
    };
  }
}

/**
 * Централизованные таймауты для Ollama и AI сервисов
 * Синхронная версия с кэшированием (для обратной совместимости)
 * @returns {Object} Объект с различными таймаутами
 */
function getTimeouts() {
  const now = Date.now();
  if (!timeoutsCache || (now - timeoutsCacheTimestamp) > SYNC_CACHE_TTL) {
    // Обновляем кэш асинхронно (не блокируя)
    _updateTimeoutsCache().catch(err => logger.warn('[ollamaConfig] Timeouts cache update failed:', err.message));
  }
  
  // Если кэш есть - используем его
  if (timeoutsCache) {
    return timeoutsCache;
  }
  
  // Иначе используем дефолты
  return {
    ollamaChat: 600000,
    ollamaEmbedding: 90000,
    ollamaHealth: 5000,
    ollamaTags: 10000,
    vectorSearch: 90000,
    vectorUpsert: 600000,
    vectorHealth: 5000,
    cacheLLM: 86400000,
    cacheRAG: 300000,
    cacheMax: 1000,
    queueTimeout: 180000,
    queueMaxSize: 100,
    queueInterval: 100,
    default: 180000
  };
}

/**
 * Получает timeout для запросов к Ollama (обратная совместимость)
 * Синхронная версия (для обратной совместимости)
 * @returns {number} Timeout в миллисекундах
 */
function getTimeout() {
  const timeouts = getTimeouts();
  return timeouts.ollamaChat;
}

/**
 * Получает все конфигурационные параметры Ollama (синхронная версия)
 * @returns {Object} Объект с конфигурацией
 */
function getConfig() {
  const baseUrl = getBaseUrl();
  const defaultModel = getDefaultModel();
  
  return {
    baseUrl,
    defaultModel,
    timeout: null, // Теперь асинхронный
    apiUrl: {
      tags: `${baseUrl}/api/tags`,
      generate: `${baseUrl}/api/generate`,
      chat: `${baseUrl}/api/chat`,
      models: `${baseUrl}/api/models`,
      show: `${baseUrl}/api/show`,
      pull: `${baseUrl}/api/pull`,
      push: `${baseUrl}/api/push`
    }
  };
}

/**
 * Получает все конфигурационные параметры Ollama (асинхронная версия)
 * @returns {Promise<Object>} Объект с конфигурацией
 */
async function getConfigAsync() {
  const ollamaConfig = await aiConfigService.getOllamaConfig();
  const timeout = await getTimeout();
  
  return {
    baseUrl: ollamaConfig.baseUrl,
    defaultModel: ollamaConfig.llmModel,
    embeddingModel: ollamaConfig.embeddingModel,
    timeout,
    apiUrl: {
      tags: `${ollamaConfig.baseUrl}/api/tags`,
      generate: `${ollamaConfig.baseUrl}/api/generate`,
      chat: `${ollamaConfig.baseUrl}/api/chat`,
      models: `${ollamaConfig.baseUrl}/api/models`,
      show: `${ollamaConfig.baseUrl}/api/show`,
      pull: `${ollamaConfig.baseUrl}/api/pull`,
      push: `${ollamaConfig.baseUrl}/api/push`
    }
  };
}

/**
 * Загружает настройки Ollama из базы данных (для обратной совместимости)
 * @returns {Promise<Object>} Настройки Ollama провайдера
 */
async function loadSettingsFromDb() {
  try {
    const config = await aiConfigService.getOllamaConfig();
    // Обновляем синхронный кэш
    await _updateSyncCache();
    return {
      base_url: config.baseUrl,
      selected_model: config.llmModel,
      embedding_model: config.embeddingModel
    };
  } catch (error) {
    logger.error('[ollamaConfig] Ошибка загрузки настроек Ollama из БД:', error.message);
    return null;
  }
}

/**
 * Очищает кэш настроек (для перезагрузки)
 */
function clearCache() {
  syncCache = null;
  syncCacheTimestamp = 0;
  timeoutsCache = null;
  timeoutsCacheTimestamp = 0;
  aiConfigService.invalidateCache();
  logger.info('[ollamaConfig] Settings cache cleared');
}

/**
 * Проверяет доступность Ollama сервиса
 * @returns {Promise<Object>} Статус здоровья сервиса
 */
async function checkHealth() {
  try {
    const baseUrl = await getBaseUrlAsync();
    const response = await fetch(`${baseUrl}/api/tags`);
    
    if (!response.ok) {
      return { 
        status: 'error', 
        error: `Ollama вернул код ${response.status}`,
        baseUrl 
      };
    }

    const data = await response.json();
    const defaultModel = await getDefaultModelAsync();
    
    return { 
      status: 'ok', 
      baseUrl,
      model: defaultModel,
      availableModels: data.models?.length || 0
    };
  } catch (error) {
    return { 
      status: 'error', 
      error: error.message,
      baseUrl: getBaseUrl()
    };
  }
}

// Инициализация синхронного кэша при загрузке модуля
_updateSyncCache().catch(err => {
  logger.warn('[ollamaConfig] Initial sync cache update failed:', err.message);
});
_updateTimeoutsCache().catch(err => {
  logger.warn('[ollamaConfig] Initial timeouts cache update failed:', err.message);
});

module.exports = {
  getBaseUrl,
  getBaseUrlAsync,
  getApiUrl,
  getDefaultModel,
  getDefaultModelAsync,
  getEmbeddingModel,
  getTimeout,        // Синхронная версия (для обратной совместимости)
  getTimeouts,       // Синхронная версия с кэшированием (для обратной совместимости)
  getConfig,
  getConfigAsync,
  loadSettingsFromDb,
  clearCache,
  checkHealth
};

