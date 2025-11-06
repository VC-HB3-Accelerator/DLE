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
 * Кэширование AI ответов для ускорения работы
 * Использует настройки из aiConfigService
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');
const aiConfigService = require('./aiConfigService');

class AICache {
  constructor() {
    // Загружаем настройки из aiConfigService
    this.cache = new Map();
    this._loadSettings();
  }

  /**
   * Загружает настройки кэша из aiConfigService
   * @private
   */
  async _loadSettings() {
    try {
      const cacheConfig = await aiConfigService.getCacheConfig();
      this.maxSize = cacheConfig.maxSize || 1000;
      this.ttl = cacheConfig.llmTTL || 86400000; // 24 часа
      this.ragTtl = cacheConfig.ragTTL || 300000; // 5 минут
    } catch (error) {
      logger.warn('[AICache] Ошибка загрузки настроек, используем дефолты:', error.message);
      // Дефолтные значения
      const timeouts = ollamaConfig.getTimeouts();
      this.maxSize = timeouts.cacheMax || 1000;
      this.ttl = timeouts.cacheLLM || 86400000;
      this.ragTtl = timeouts.cacheRAG || 300000;
    }
  }

  /**
   * Получает актуальные настройки (перезагружает из БД)
   */
  async _getSettings() {
    await this._loadSettings();
    return {
      maxSize: this.maxSize,
      ttl: this.ttl,
      ragTtl: this.ragTtl
    };
  }

  /**
   * Генерация ключа кэша на основе запроса
   * Использует параметры LLM из настроек для генерации ключа
   */
  async generateKey(messages, options = {}) {
    // Загружаем актуальные параметры LLM для ключа
    const llmParams = await aiConfigService.getLLMParameters();
    
    const content = JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature || llmParams.temperature,
      maxTokens: options.num_predict || llmParams.maxTokens
    });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Генерация ключа для RAG результатов
   * Включает tagIds для учета фильтрации по тегам
   */
  generateKeyForRAG(tableId, userQuestion, product = null, userId = null, tagIds = null) {
    // Сортируем tagIds для стабильности ключа (одинаковый порядок = одинаковый ключ)
    const sortedTagIds = tagIds ? [...tagIds].sort((a, b) => a - b) : null;
    const content = JSON.stringify({ tableId, userQuestion, product, userId, tagIds: sortedTagIds });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Получение ответа из кэша (LLM)
   */
  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Проверяем TTL
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    logger.info(`[AICache] Cache hit for key: ${key.substring(0, 8)}...`);
    return cached.response;
  }

  /**
   * Получение с учетом типа кэша (RAG или LLM)
   */
  getWithTTL(key, type = 'llm') {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ttl = type === 'rag' ? this.ragTtl : this.ttl;

    // Проверяем TTL
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    logger.info(`[AICache] Cache hit (${type}) for key: ${key.substring(0, 8)}...`);
    return cached.response;
  }

  /**
   * Сохранение в кэш
   */
  set(key, value, type = 'llm') {
    // Проверяем размер кэша
    if (this.cache.size >= this.maxSize) {
      // Удаляем самую старую запись
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
      logger.warn(`[AICache] Кэш переполнен, удалена старая запись: ${oldestKey.substring(0, 8)}...`);
    }

    this.cache.set(key, {
      response: value,
      timestamp: Date.now(),
      type
    });

    logger.debug(`[AICache] Сохранено в кэш (${type}): ${key.substring(0, 8)}...`);
  }

  /**
   * Сохранение с указанием типа
   */
  setWithType(key, value, type = 'llm') {
    this.set(key, value, type);
  }

  /**
   * Очистка кэша
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    logger.info(`[AICache] Кэш очищен. Удалено записей: ${size}`);
    return size;
  }

  /**
   * Получение статистики
   */
  getStats() {
    const stats = {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
      ragTtl: this.ragTtl
    };

    // Подсчитываем по типам
    let llmCount = 0;
    let ragCount = 0;
    for (const [key, value] of this.cache.entries()) {
      if (value.type === 'rag') {
        ragCount++;
      } else {
        llmCount++;
      }
    }

    stats.llmCount = llmCount;
    stats.ragCount = ragCount;

    return stats;
  }

  /**
   * Получение статистики по типам
   */
  getStatsByType() {
    const stats = {
      llm: { count: 0, size: 0 },
      rag: { count: 0, size: 0 }
    };

    for (const [key, value] of this.cache.entries()) {
      const type = value.type || 'llm';
      stats[type].count++;
      stats[type].size += JSON.stringify(value.response).length;
    }

    return stats;
  }

  /**
   * Инвалидация кэша по префиксу
   */
  invalidateByPrefix(prefix) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      logger.info(`[AICache] Инвалидировано записей с префиксом ${prefix}: ${count}`);
    }
    return count;
  }
}

// Экспортируем singleton экземпляр
const aiCache = new AICache();

module.exports = aiCache;

