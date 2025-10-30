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
 * Централизует все настройки, URL и таймауты для:
 * - Ollama API
 * - Vector Search
 * - AI Cache
 * - AI Queue
 * 
 * ВАЖНО: Настройки берутся из таблицы ai_providers_settings (через aiProviderSettingsService)
 */

const logger = require('../utils/logger');

// Кэш для настроек из БД
let settingsCache = null;

/**
 * Загружает настройки Ollama из базы данных
 * @returns {Promise<Object>} Настройки Ollama провайдера
 */
async function loadSettingsFromDb() {
  try {
    const aiProviderSettingsService = require('./aiProviderSettingsService');
    const settings = await aiProviderSettingsService.getProviderSettings('ollama');
    
    if (settings) {
      settingsCache = settings;
      logger.info(`[ollamaConfig] Loaded settings from DB: model=${settings.selected_model}, base_url=${settings.base_url}`);
    }
    
    return settings;
  } catch (error) {
    logger.error('[ollamaConfig] Ошибка загрузки настроек Ollama из БД:', error.message);
    return null;
  }
}

/**
 * Внутренняя функция: определяет base URL из доступных источников
 * Приоритет: кэш из БД > переменная окружения > Docker дефолт
 * @returns {string} Базовый URL Ollama
 */
function _getBaseUrlFromSources() {
  // Приоритет 1: кэш из БД
  if (settingsCache && settingsCache.base_url) {
    return settingsCache.base_url;
  }
  // Приоритет 2: переменная окружения
  if (process.env.OLLAMA_BASE_URL) {
    return process.env.OLLAMA_BASE_URL;
  }
  // Приоритет 3: Docker дефолт
  return 'http://ollama:11434';
}

/**
 * Получает базовый URL для Ollama (синхронная версия)
 * @returns {string} Базовый URL Ollama
 */
function getBaseUrl() {
  return _getBaseUrlFromSources();
}

/**
 * Получает базовый URL для Ollama (асинхронная версия)
 * @returns {Promise<string>} Базовый URL Ollama
 */
async function getBaseUrlAsync() {
  try {
    if (!settingsCache) {
      await loadSettingsFromDb();
    }
  } catch (error) {
    logger.warn('[ollamaConfig] Failed to load base_url from DB, using default');
  }
  
  return _getBaseUrlFromSources();
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
  // Приоритет: кэш из БД > дефолт
  if (settingsCache && settingsCache.selected_model) {
    return settingsCache.selected_model;
  }
  // Дефолтное значение если БД недоступна
  return 'qwen2.5:7b';
}

/**
 * Получает модель асинхронно из БД
 * @returns {Promise<string>} Название модели из БД
 */
async function getDefaultModelAsync() {
  try {
    if (!settingsCache) {
      await loadSettingsFromDb();
    }
    
    if (settingsCache && settingsCache.selected_model) {
      logger.info(`[ollamaConfig] Using model from DB: ${settingsCache.selected_model}`);
      return settingsCache.selected_model;
    }
  } catch (error) {
    logger.warn('[ollamaConfig] Failed to load model from DB, using default');
  }
  return 'qwen2.5:7b';
}

/**
 * Получает embedding модель асинхронно из БД
 * @returns {Promise<string>} Название embedding модели из БД
 */
async function getEmbeddingModel() {
  try {
    if (!settingsCache) {
      await loadSettingsFromDb();
    }
    
    if (settingsCache && settingsCache.embedding_model) {
      logger.info(`[ollamaConfig] Using embedding model from DB: ${settingsCache.embedding_model}`);
      return settingsCache.embedding_model;
    }
  } catch (error) {
    logger.warn('[ollamaConfig] Failed to load embedding model from DB, using default');
  }
  return 'mxbai-embed-large:latest';
}

/**
 * Централизованные таймауты для Ollama и AI сервисов
 * @returns {Object} Объект с различными таймаутами
 */
function getTimeouts() {
  return {
    // Ollama API - таймауты запросов
    ollamaChat: 180000,        // 180 сек (3 мин) - генерация ответов LLM (увеличено для сложных запросов)
    ollamaEmbedding: 90000,    // 90 сек (1.5 мин) - генерация embeddings (увеличено)
    ollamaHealth: 5000,        // 5 сек - health check
    ollamaTags: 10000,         // 10 сек - список моделей
    
    // Vector Search - таймауты запросов
    vectorSearch: 90000,       // 90 сек - поиск по векторам (увеличено для больших баз)
    vectorUpsert: 90000,       // 90 сек - индексация данных (увеличено)
    vectorHealth: 5000,        // 5 сек - health check
    
    // AI Cache - TTL (Time To Live) для кэширования
    cacheLLM: 24 * 60 * 60 * 1000,   // 24 часа - LLM ответы
    cacheRAG: 5 * 60 * 1000,         // 5 минут - RAG результаты
    cacheMax: 1000,                  // Максимум записей в кэше
    
    // AI Queue - параметры очереди
    queueTimeout: 180000,      // 180 сек - таймаут задачи в очереди (увеличено)
    queueMaxSize: 100,         // Максимум задач в очереди
    queueInterval: 100,        // 100 мс - интервал проверки очереди
    
    // Default для совместимости
    default: 180000            // 180 сек (увеличено с 120)
  };
}

/**
 * Получает timeout для запросов к Ollama (обратная совместимость)
 * @returns {number} Timeout в миллисекундах
 */
function getTimeout() {
  return getTimeouts().ollamaChat; // 120 секунд (2 минуты) - для генерации длинных ответов
}

/**
 * Получает все конфигурационные параметры Ollama (синхронная версия)
 * @returns {Object} Объект с конфигурацией
 */
function getConfig() {
  return {
    baseUrl: getBaseUrl(),
    defaultModel: getDefaultModel(),
    timeout: getTimeout(),
    apiUrl: {
      tags: getApiUrl('tags'),
      generate: getApiUrl('generate'),
      chat: getApiUrl('chat'),
      models: getApiUrl('models'),
      show: getApiUrl('show'),
      pull: getApiUrl('pull'),
      push: getApiUrl('push')
    }
  };
}

/**
 * Получает все конфигурационные параметры Ollama (асинхронная версия)
 * @returns {Promise<Object>} Объект с конфигурацией
 */
async function getConfigAsync() {
  const baseUrl = await getBaseUrlAsync();
  const defaultModel = await getDefaultModelAsync();
  const embeddingModel = await getEmbeddingModel();
  
  return {
    baseUrl,
    defaultModel,
    embeddingModel,
    timeout: getTimeout(),
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
 * Очищает кэш настроек (для перезагрузки)
 */
function clearCache() {
  settingsCache = null;
  logger.info('[ollamaConfig] Settings cache cleared');
}

/**
 * Проверяет доступность Ollama сервиса
 * @returns {Promise<Object>} Статус здоровья сервиса
 */
async function checkHealth() {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/tags`);
    
    if (!response.ok) {
      return { 
        status: 'error', 
        error: `Ollama вернул код ${response.status}`,
        baseUrl 
      };
    }

    const data = await response.json();
    return { 
      status: 'ok', 
      baseUrl,
      model: getDefaultModel(),
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

module.exports = {
  getBaseUrl,
  getBaseUrlAsync,
  getApiUrl,
  getDefaultModel,
  getDefaultModelAsync,
  getEmbeddingModel,
  getTimeout,        // Обратная совместимость (возвращает ollamaChat timeout)
  getTimeouts,       // ✨ НОВОЕ: Централизованные таймауты для всех сервисов
  getConfig,
  getConfigAsync,
  loadSettingsFromDb,
  clearCache,
  checkHealth
};
