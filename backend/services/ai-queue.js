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
    this.processing = false;
    this.activeRequests = 0;
    this.maxConcurrent = 1; // Ограничиваем до 1 для стабильности
    this.isPaused = false;
    this.stats = {
      completed: 0,
      failed: 0,
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

    logger.info(`[AIQueue] Добавлен запрос ${requestId} с приоритетом ${priority}. Очередь: ${this.queue.length}`);

    // Запускаем обработку очереди
    if (!this.processing) {
      this.processQueue();
    }

    return requestId;
  }

  // Обработка очереди
  async processQueue() {
    if (this.processing) return;

    this.processing = true;
    logger.info(`[AIQueue] Начинаем обработку очереди. Запросов в очереди: ${this.queue.length}`);

    while (!this.isPaused && this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const item = this.queue.shift();
      if (!item) continue;

      this.activeRequests++;
      item.status = 'processing';
      logger.info(`[AIQueue] Обрабатываем запрос ${item.id} (приоритет: ${item.priority})`);

      try {
        const startTime = Date.now();
        const result = await this.processRequest(item.request);
        const responseTime = Date.now() - startTime;

        item.status = 'completed';
        item.result = result;
        item.responseTime = responseTime;

        this.stats.completed++;
        this.updateAvgResponseTime(responseTime);
        this.stats.lastProcessedAt = Date.now();

        logger.info(`[AIQueue] Запрос ${item.id} завершен за ${responseTime}ms`);

        // Эмитим событие о завершении
        this.emit('completed', item);

      } catch (error) {
        item.status = 'failed';
        item.error = error.message;

        this.stats.failed++;
        this.stats.lastProcessedAt = Date.now();
        logger.error(`[AIQueue] Запрос ${item.id} завершился с ошибкой:`, error.message);

        // Эмитим событие об ошибке
        this.emit('failed', item);
      } finally {
        this.activeRequests--;
      }
    }

    this.processing = false;
    logger.info(`[AIQueue] Обработка очереди завершена. Осталось запросов: ${this.queue.length}`);

    // Если в очереди еще есть запросы, продолжаем обработку
    if (!this.isPaused && this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 100);
    }
  }

  // Обработка одного запроса
  async processRequest(request) {
    const aiAssistant = require('./ai-assistant');
    
    // Формируем сообщения для API
    const messages = [];
    
    // Добавляем системный промпт
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    
    // Добавляем историю сообщений
    if (request.history && Array.isArray(request.history)) {
      for (const msg of request.history) {
        if (msg.role && msg.content) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }
    
    // Добавляем текущее сообщение пользователя
    messages.push({ role: 'user', content: request.message });

    // Используем прямой метод для избежания рекурсии
    return await aiAssistant.directRequest(messages, request.systemPrompt);
  }

  // Обновление средней скорости ответа
  updateAvgResponseTime(responseTime) {
    const total = this.stats.completed;
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (total - 1) + responseTime) / total;
  }

  // Получение статистики
  getStats() {
    const totalProcessed = this.stats.completed + this.stats.failed;
    return {
      // совместимость с AIQueueMonitor.vue и маршрутами
      totalProcessed,
      totalFailed: this.stats.failed,
      averageProcessingTime: this.stats.avgResponseTime,
      currentQueueSize: this.queue.length,
      runningTasks: this.activeRequests,
      lastProcessedAt: this.stats.lastProcessedAt,
      isInitialized: true,
      // старые поля на всякий случай
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

  // Совместимость с роутами AI Queue
  pause() {
    this.isPaused = true;
    logger.info('[AIQueue] Queue paused');
  }

  resume() {
    const wasPaused = this.isPaused;
    this.isPaused = false;
    logger.info('[AIQueue] Queue resumed');
    if (wasPaused) {
      this.processQueue();
    }
  }

  async addTask(taskData) {
    // Маппинг к addRequest
    const priority = this._calcTaskPriority(taskData);
    const taskId = await this.addRequest(taskData, priority);
    return { taskId };
  }

  _calcTaskPriority({ message = '', type, userRole, history }) {
    let priority = 0;
    if (userRole === 'admin') priority += 10;
    if (type === 'chat') priority += 5;
    if (type === 'analysis') priority += 3;
    if (type === 'generation') priority += 1;
    if (message && message.length < 100) priority += 2;
    if (history && Array.isArray(history) && history.length > 0) priority += 1;
    return priority;
  }
}

module.exports = new AIQueue(); 