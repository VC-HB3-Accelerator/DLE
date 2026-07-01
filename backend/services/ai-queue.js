/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');
const axios = require('axios');
const ollamaConfig = require('./ollamaConfig');
const aiCache = require('./ai-cache');
const aiConfigService = require('./aiConfigService');
const { buildOllamaRequest } = require('../utils/ollamaRequestBuilder');

class AIQueue extends EventEmitter {
  constructor() {
    super();
    const timeouts = ollamaConfig.getTimeouts();
    
    this.queue = [];
    this.isProcessing = false;               // ✨ НОВОЕ: Флаг обработки
    this.maxQueueSize = timeouts.queueMaxSize;  // Из централизованных настроек
    this.workerInterval = null;              // ✨ НОВОЕ: Интервал worker
    this.checkInterval = timeouts.queueInterval; // Интервал проверки очереди
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

  // ✨ НОВОЕ: Добавление задачи с Promise (для ожидания результата)
  async addTask(taskData) {
    // Проверяем лимит очереди
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Очередь переполнена');
    }

    const taskId = Date.now() + Math.random();
    
    const queueItem = {
      id: taskId,
      request: taskData,
      priority: 0, // Все задачи с одинаковым приоритетом (FIFO)
      status: 'queued',
      timestamp: Date.now()
    };

    this.queue.push(queueItem);
    // Не сортируем - FIFO (First In First Out)
    this.stats.totalAdded++;

    logger.info(`[AIQueue] Задача ${taskId} добавлена. Очередь: ${this.queue.length}`);
    this.emit('requestAdded', queueItem);

    // Возвращаем Promise для ожидания результата.
    // Таймаут ожидания должен покрывать не только время самого запроса к Ollama,
    // но и время ожидания задач, которые уже стоят перед текущей задачей.
    return new Promise((resolve, reject) => {
      const timeouts = ollamaConfig.getTimeouts();
      const tasksAhead = Math.max(this.queue.length - 1, 0);
      const effectiveQueueTimeout = Math.max(
        timeouts.queueTimeout || 0,
        ((tasksAhead + 1) * (timeouts.ollamaChat || 600000)) + 60000
      );
      const timeout = setTimeout(() => {
        reject(new Error(`Queue timeout after ${Math.round(effectiveQueueTimeout / 1000)}s`));
      }, effectiveQueueTimeout);

      this.once(`task_${taskId}_completed`, (result) => {
        clearTimeout(timeout);
        resolve(result.response);
      });

      this.once(`task_${taskId}_failed`, (error) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });
    });
  }

  // ✨ НОВОЕ: Запуск автоматического worker
  startWorker() {
    if (this.workerInterval) {
      logger.warn('[AIQueue] Worker уже запущен');
      return;
    }

    logger.info('[AIQueue] 🚀 Запуск worker для обработки очереди...');
    
    this.workerInterval = setInterval(() => {
      this.processNextTask();
    }, this.checkInterval); // Интервал из централизованных настроек
  }

  // ✨ НОВОЕ: Остановка worker
  stopWorker() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      logger.info('[AIQueue] ⏹️ Worker остановлен');
    }
  }

  // ✨ НОВОЕ: Обработка следующей задачи из очереди
  async processNextTask() {
    if (this.isProcessing) return;
    
    const task = this.getNextRequest();
    if (!task) return;

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      logger.info(`[AIQueue] Обработка задачи ${task.id}`);

      // 1. Проверяем кэш
      const cacheKey = await aiCache.generateKey(task.request.messages);
      const cached = aiCache.get(cacheKey);
      
      if (cached) {
        logger.info(`[AIQueue] Cache HIT для задачи ${task.id}`);
        const responseTime = Date.now() - startTime;
        const cachedResult = task.request.returnFullResponse
          ? { response: cached, message: { content: cached }, raw: null }
          : cached;

        this.updateRequestStatus(task.id, 'completed', cachedResult, null, responseTime);
        this.emit(`task_${task.id}_completed`, { response: cachedResult, fromCache: true });
        return;
      }

      // 2. Загружаем параметры LLM и qwen из настроек
      const llmParameters = task.request.llmParameters || await aiConfigService.getLLMParameters();
      const qwenParameters = task.request.qwenParameters || await aiConfigService.getQwenSpecificParameters();
      const ollamaConfig_data = await ollamaConfig.getConfigAsync();

      // 3. Формируем тело запроса (используем утилиту)
      const requestBody = buildOllamaRequest({
        messages: task.request.messages,
        model: task.request.model,
        llmParameters: llmParameters,
        qwenParameters: qwenParameters,
        defaultModel: ollamaConfig_data.defaultModel,
        tools: task.request.tools || null,
        tool_choice: task.request.tool_choice || null,
        stream: false
      });

      // 4. Вызываем Ollama API
      const ollamaUrl = ollamaConfig.getBaseUrl();
      const timeouts = ollamaConfig.getTimeouts();

      logger.info(`[AIQueue] Отправка запроса в Ollama с параметрами:`, {
        model: requestBody.model,
        temperature: requestBody.temperature,
        num_predict: requestBody.num_predict,
        format: requestBody.format || 'не задан',
        hasTools: !!requestBody.tools
      });

      const progressInterval = setInterval(() => {
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        if (elapsedSeconds >= 30) {
          logger.info(`[AIQueue] Ollama обрабатывает задачу ${task.id} уже ${elapsedSeconds}с...`);
        }
      }, 30000);

      let response;
      try {
        response = await axios.post(`${ollamaUrl}/api/chat`, requestBody, {
          timeout: timeouts.ollamaChat
        });
      } finally {
        clearInterval(progressInterval);
      }

      const result = task.request.returnFullResponse
        ? {
            response: response.data.message.content,
            message: response.data.message,
            raw: response.data
          }
        : response.data.message.content;
      
      const responseTime = Date.now() - startTime;

      // 4. Сохраняем в кэш (только текст ответа)
      const cacheValue = typeof result === 'string' ? result : (result.response || '');
      if (cacheValue) {
        try {
          aiCache.set(cacheKey, cacheValue);
        } catch (cacheError) {
          logger.warn(`[AIQueue] Не удалось сохранить в кэш: ${cacheError.message}`);
        }
      }

      // 5. Обновляем статус
      this.updateRequestStatus(task.id, 'completed', result, null, responseTime);
      this.emit(`task_${task.id}_completed`, { response: result, fromCache: false });

      logger.info(`[AIQueue] ✅ Задача ${task.id} выполнена за ${responseTime}ms`);

    } catch (error) {
      logger.error(`[AIQueue] ❌ Ошибка задачи ${task.id}:`, error.message);
      
      this.updateRequestStatus(task.id, 'failed', null, error.message);
      this.emit(`task_${task.id}_failed`, { message: error.message });

    } finally {
      this.isProcessing = false;
    }
  }
}

module.exports = AIQueue;

