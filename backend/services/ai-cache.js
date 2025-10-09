/**
 * Кэширование AI ответов для ускорения работы
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');

class AICache {
  constructor() {
    const timeouts = ollamaConfig.getTimeouts();
    
    this.cache = new Map();
    this.maxSize = timeouts.cacheMax;      // Из централизованных настроек
    this.ttl = timeouts.cacheLLM;          // 24 часа (для LLM)
    this.ragTtl = timeouts.cacheRAG;       // 5 минут (для RAG результатов)
  }

  // Генерация ключа кэша на основе запроса
  generateKey(messages, options = {}) {
    const content = JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options.temperature || 0.3,
      maxTokens: options.num_predict || 150
    });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // ✨ НОВОЕ: Генерация ключа для RAG результатов
  generateKeyForRAG(tableId, userQuestion, product = null) {
    const content = JSON.stringify({ tableId, userQuestion, product });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Получение ответа из кэша
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

  // ✨ НОВОЕ: Получение с учетом типа кэша (RAG или LLM)
  getWithTTL(key, type = 'llm') {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Выбираем TTL в зависимости от типа
    const ttl = type === 'rag' ? this.ragTtl : this.ttl;
    
    // Проверяем TTL
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    logger.info(`[AICache] Cache hit (${type}) for key: ${key.substring(0, 8)}...`);
    return cached.response;
  }

  // Сохранение ответа в кэш
  set(key, response) {
    // Очищаем старые записи если кэш переполнен
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now()
    });

    logger.info(`[AICache] Cached response for key: ${key.substring(0, 8)}...`);
  }

  // ✨ НОВОЕ: Сохранение с указанием типа (rag или llm)
  setWithType(key, response, type = 'llm') {
    // Очищаем старые записи если кэш переполнен
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      response,
      timestamp: Date.now(),
      type: type  // Сохраняем тип для статистики
    });

    logger.info(`[AICache] Cached ${type} response for key: ${key.substring(0, 8)}...`);
  }

  // Очистка кэша
  clear() {
    this.cache.clear();
    logger.info('[AICache] Cache cleared');
  }

  // Очистка старых записей по времени
  cleanup(maxAge = 3600000) { // По умолчанию 1 час
    const now = Date.now();
    let deletedCount = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      logger.info(`[AICache] Cleaned up ${deletedCount} old entries`);
    }
  }

  // Статистика кэша
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate()
    };
  }

  calculateHitRate() {
    // Простая реализация - в реальности нужно отслеживать hits/misses
    if (this.maxSize === 0) return 0;
    return this.cache.size / this.maxSize;
  }

  // ✨ НОВОЕ: Статистика по типу кэша
  getStatsByType() {
    const stats = { rag: 0, llm: 0, other: 0 };
    for (const [key, value] of this.cache.entries()) {
      const type = value.type || 'other';
      stats[type] = (stats[type] || 0) + 1;
    }
    return stats;
  }

  // ✨ НОВОЕ: Инвалидация по префиксу (для очистки RAG кэша при обновлении таблиц)
  invalidateByPrefix(prefix) {
    let deletedCount = 0;
    for (const [key, value] of this.cache.entries()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      logger.info(`[AICache] Инвалидировано ${deletedCount} записей с префиксом: ${prefix}`);
    }
    return deletedCount;
  }
}

module.exports = new AICache(); 