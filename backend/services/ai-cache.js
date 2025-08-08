/**
 * Кэширование AI ответов для ускорения работы
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

class AICache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Максимальное количество кэшированных ответов
    this.ttl = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
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
    return this.cache.size / this.maxSize;
  }
}

module.exports = new AICache(); 