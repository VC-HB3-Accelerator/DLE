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

const EventEmitter = require('events');
const logger = require('../utils/logger');

class AIQueue extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.stats = {
      totalAdded: 0,
      totalProcessed: 0,
      totalFailed: 0,
      avgResponseTime: 0,
      lastProcessedAt: null,
      initializedAt: Date.now()
    };
  }

  // Добавление запроса в очередь
  async addRequest(request, priority = 0) {
    const requestId = Date.now() + Math.random();
    const queueItem = {
      id: requestId,
      request,
      priority,
      status: 'queued',
      timestamp: Date.now()
    };

    // Добавляем в очередь с учетом приоритета
    this.queue.push(queueItem);
    this.queue.sort((a, b) => b.priority - a.priority);

    this.stats.totalAdded++;
    logger.info(`[AIQueue] Добавлен запрос ${requestId} с приоритетом ${priority}. Очередь: ${this.queue.length}`);

    // Эмитим событие о добавлении
    this.emit('requestAdded', queueItem);

    return requestId;
  }

  // Получение следующего запроса (без обработки)
  getNextRequest() {
    if (this.queue.length === 0) return null;
    return this.queue.shift();
  }

  // Получение запроса по ID
  getRequestById(requestId) {
    return this.queue.find(item => item.id === requestId);
  }

  // Обновление статуса запроса
  updateRequestStatus(requestId, status, result = null, error = null, responseTime = null) {
    const item = this.queue.find(item => item.id === requestId);
    if (!item) return false;

    item.status = status;
    item.result = result;
    item.error = error;
    item.responseTime = responseTime;
    item.processedAt = Date.now();

    if (status === 'completed') {
      this.stats.totalProcessed++;
      if (responseTime) {
        this.updateAvgResponseTime(responseTime);
      }
      this.stats.lastProcessedAt = Date.now();
      this.emit('requestCompleted', item);
    } else if (status === 'failed') {
      this.stats.totalFailed++;
      this.stats.lastProcessedAt = Date.now();
      this.emit('requestFailed', item);
    }

    return true;
  }

  // Обновление средней скорости ответа
  updateAvgResponseTime(responseTime) {
    const total = this.stats.totalProcessed;
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (total - 1) + responseTime) / total;
  }

  // Получение статистики
  getStats() {
    return {
      totalAdded: this.stats.totalAdded,
      totalProcessed: this.stats.totalProcessed,
      totalFailed: this.stats.totalFailed,
      averageProcessingTime: this.stats.avgResponseTime,
      currentQueueSize: this.queue.length,
      lastProcessedAt: this.stats.lastProcessedAt,
      uptime: Date.now() - this.stats.initializedAt
    };
  }

  // Получение размера очереди
  getQueueSize() {
    return this.queue.length;
  }

  // Очистка очереди
  clearQueue() {
    const clearedCount = this.queue.length;
    this.queue = [];
    logger.info(`[AIQueue] Очередь очищена. Удалено запросов: ${clearedCount}`);
    return clearedCount;
  }

  // Пауза/возобновление очереди
  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  // Проверка статуса паузы
  isQueuePaused() {
    return this.isPaused;
  }
}

module.exports = AIQueue; 