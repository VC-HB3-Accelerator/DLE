/**
 * Очередь для AI запросов с приоритизацией
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class AIQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 2; // Максимум 2 запроса одновременно
    this.activeRequests = 0;
    this.stats = {
      total: 0,
      completed: 0,
      failed: 0,
      avgResponseTime: 0
    };
  }

  // Добавление запроса в очередь
  async addRequest(request, priority = 0) {
    const queueItem = {
      id: Date.now() + Math.random(),
      request,
      priority,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.queue.push(queueItem);
    this.queue.sort((a, b) => b.priority - a.priority); // Сортировка по приоритету

    this.stats.total++;
    logger.info(`[AIQueue] Added request ${queueItem.id} with priority ${priority}`);

    // Запускаем обработку если не запущена
    if (!this.processing) {
      this.processQueue();
    }

    return queueItem.id;
  }

  // Обработка очереди
  async processQueue() {
    if (this.processing || this.activeRequests >= this.maxConcurrent) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) continue;

      this.activeRequests++;
      item.status = 'processing';

      try {
        const startTime = Date.now();
        const result = await this.processRequest(item.request);
        const responseTime = Date.now() - startTime;

        item.status = 'completed';
        item.result = result;
        item.responseTime = responseTime;

        this.stats.completed++;
        this.updateAvgResponseTime(responseTime);

        logger.info(`[AIQueue] Request ${item.id} completed in ${responseTime}ms`);

        // Эмитим событие о завершении
        this.emit('completed', item);

      } catch (error) {
        item.status = 'failed';
        item.error = error.message;

        this.stats.failed++;
        logger.error(`[AIQueue] Request ${item.id} failed:`, error.message);

        // Эмитим событие об ошибке
        this.emit('failed', item);
      } finally {
        this.activeRequests--;
      }
    }

    this.processing = false;

    // Если в очереди еще есть запросы, продолжаем обработку
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  // Обработка одного запроса
  async processRequest(request) {
    // Прямой вызов AI без очереди
    const aiAssistant = require('./ai-assistant');
    
    // Используем прямой метод без очереди
    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    if (request.history && Array.isArray(request.history)) {
      for (const msg of request.history) {
        if (msg.role && msg.content) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    messages.push({ role: 'user', content: request.message });

    // Прямой вызов API без очереди
    return await aiAssistant.fallbackRequestOpenAI(messages, request.language, request.systemPrompt);
  }

  // Обновление средней скорости ответа
  updateAvgResponseTime(responseTime) {
    const total = this.stats.completed;
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (total - 1) + responseTime) / total;
  }

  // Получение статистики
  getStats() {
    return {
      ...this.stats,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
      processing: this.processing
    };
  }

  // Очистка очереди
  clear() {
    this.queue = [];
    logger.info('[AIQueue] Queue cleared');
  }
}

module.exports = new AIQueue(); 