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

/** Приоритеты: выше число — раньше в очереди */
const PRIORITY = {
  CHAT: 10,
  PROFILE: 4,
  BROADCAST: 3,
  MEMORY: 1,
  CHUNKING: 1,
  DEFAULT: 0
};

class AIQueue extends EventEmitter {
  constructor() {
    super();
    const timeouts = ollamaConfig.getTimeouts();
    
    this.queue = [];
    this.isProcessing = false;
    this.isPaused = false;
    this.activeTask = null;
    this.activeAbortController = null;
    this.maxQueueSize = timeouts.queueMaxSize;
    this.workerInterval = null;
    this.checkInterval = timeouts.queueInterval;
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

  // Получение следующего запроса: всегда предпочитаем CHAT и выше
  getNextRequest() {
    if (this.queue.length === 0) return null;

    const highIdx = this.queue.findIndex((t) => t.priority >= PRIORITY.CHAT);
    if (highIdx >= 0) {
      return this.queue.splice(highIdx, 1)[0];
    }

    // Не стартуем фон (MEMORY/CHUNKING), если в очереди есть PROFILE/BROADCAST —
    // достаточно взять голову после сортировки
    return this.queue.shift();
  }

  _abortActiveIfLowerPriorityThan(priority) {
    if (!this.activeTask || !this.activeAbortController) return;
    if (this.activeTask.priority >= priority) return;
    if (priority < PRIORITY.CHAT) return;
    logger.info(
      `[AIQueue] Прерываем задачу ${this.activeTask.id} (prio=${this.activeTask.priority}) ради prio=${priority}`
    );
    try {
      this.activeAbortController.abort();
    } catch (_) {
      // ignore
    }
  }

  _removeQueuedTask(taskId) {
    const idx = this.queue.findIndex((q) => q.id === taskId);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  // Обновление статуса запроса (задача уже может быть снята с очереди)
  updateRequestStatus(requestId, status, result = null, error = null, responseTime = null) {
    const item = this.queue.find((q) => q.id === requestId)
      || (this.activeTask && this.activeTask.id === requestId ? this.activeTask : null);
    if (!item) {
      if (status === 'completed') {
        this.stats.totalProcessed++;
        if (responseTime) this.updateAvgResponseTime(responseTime);
        this.stats.lastProcessedAt = Date.now();
      } else if (status === 'failed') {
        this.stats.totalFailed++;
        this.stats.lastProcessedAt = Date.now();
      }
      return false;
    }

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
    const pending = this.queue.splice(0, this.queue.length);
    for (const item of pending) {
      this.emit(`task_${item.id}_failed`, { message: 'Queue cleared' });
    }
    logger.info(`[AIQueue] Очередь очищена. Удалено запросов: ${pending.length}`);
    return pending.length;
  }

  /** Алиас для API /control */
  clear() {
    return this.clearQueue();
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

  getRequestById(requestId) {
    return this.queue.find((item) => item.id === requestId)
      || (this.activeTask && this.activeTask.id === requestId ? this.activeTask : null);
  }

  /**
   * Добавление задачи с Promise (ожидание результата).
   * taskData.priority — число (см. PRIORITY); выше = раньше.
   * taskData.timeoutMs — опциональный таймаут axios к Ollama.
   */
  async addTask(taskData) {
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error('Очередь переполнена');
    }

    if (!taskData?.messages || !Array.isArray(taskData.messages)) {
      throw new Error('AIQueue task requires messages[]');
    }

    const taskId = Date.now() + Math.random();
    const priority = Number.isFinite(Number(taskData?.priority))
      ? Number(taskData.priority)
      : PRIORITY.DEFAULT;

    const queueItem = {
      id: taskId,
      request: taskData,
      priority,
      status: 'queued',
      timestamp: Date.now()
    };

    this.queue.push(queueItem);
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.timestamp - b.timestamp;
    });
    this.stats.totalAdded++;

    // CHAT вытесняет активный низкий приоритет (MEMORY/CHUNKING/BROADCAST)
    this._abortActiveIfLowerPriorityThan(priority);

    logger.info(`[AIQueue] Задача ${taskId} добавлена (priority=${priority}). Очередь: ${this.queue.length}`);
    this.emit('requestAdded', queueItem);

    return new Promise((resolve, reject) => {
      const timeouts = ollamaConfig.getTimeouts();
      const tasksAhead = Math.max(this.queue.length - 1, 0);
      const perTask = Number(taskData?.timeoutMs) > 0
        ? Number(taskData.timeoutMs)
        : (timeouts.ollamaChat || 600000);
      const effectiveQueueTimeout = Math.max(
        timeouts.queueTimeout || 0,
        ((tasksAhead + 1) * perTask) + 60000
      );

      const onCompleted = (result) => {
        clearTimeout(timeout);
        this.off(`task_${taskId}_failed`, onFailed);
        resolve(result.response);
      };

      const onFailed = (error) => {
        clearTimeout(timeout);
        this.off(`task_${taskId}_completed`, onCompleted);
        reject(new Error(error.message || 'AIQueue task failed'));
      };

      const timeout = setTimeout(() => {
        const removed = this._removeQueuedTask(taskId);
        if (!removed && this.activeTask?.id === taskId) {
          try {
            this.activeAbortController?.abort();
          } catch (_) {
            // ignore
          }
        }
        this.off(`task_${taskId}_completed`, onCompleted);
        this.off(`task_${taskId}_failed`, onFailed);
        reject(new Error(`Queue timeout after ${Math.round(effectiveQueueTimeout / 1000)}s`));
      }, effectiveQueueTimeout);

      this.once(`task_${taskId}_completed`, onCompleted);
      this.once(`task_${taskId}_failed`, onFailed);
    });
  }

  startWorker() {
    if (this.workerInterval) {
      logger.warn('[AIQueue] Worker уже запущен');
      return;
    }

    logger.info('[AIQueue] 🚀 Запуск worker для обработки очереди...');

    this.workerInterval = setInterval(() => {
      this.processNextTask();
    }, this.checkInterval);
  }

  stopWorker() {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = null;
      logger.info('[AIQueue] ⏹️ Worker остановлен');
    }
  }

  async processNextTask() {
    if (this.isPaused || this.isProcessing) return;

    const task = this.getNextRequest();
    if (!task) return;

    return this._runTask(task);
  }

  async _runTask(task) {
    this.isProcessing = true;
    this.activeTask = task;
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    const startTime = Date.now();

    try {
      logger.info(`[AIQueue] Обработка задачи ${task.id} (priority=${task.priority})`);

      if (!task.request?.messages) {
        throw new Error('AIQueue task requires messages[]');
      }

      const defaultLlm = await aiConfigService.getLLMParameters();
      const llmParameters = { ...defaultLlm, ...(task.request.llmParameters || {}) };
      const defaultQwen = await aiConfigService.getQwenSpecificParameters();
      const qwenParameters = task.request.qwenParameters !== undefined
        ? { ...defaultQwen, ...task.request.qwenParameters }
        : defaultQwen;
      const ollamaConfig_data = await ollamaConfig.getConfigAsync();
      const hasTools = Array.isArray(task.request.tools) && task.request.tools.length > 0;

      // Tool-calling не кэшируем (нужен полный message с tool_calls)
      let cacheKey = null;
      if (!hasTools) {
        cacheKey = await aiCache.generateKey(task.request.messages, {
          model: task.request.model || ollamaConfig_data.defaultModel,
          temperature: llmParameters.temperature,
          maxTokens: llmParameters.maxTokens,
          format: qwenParameters?.format ?? null,
          tool_choice: task.request.tool_choice || null,
          tools: null
        });
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
      }

      const requestBody = buildOllamaRequest({
        messages: task.request.messages,
        model: task.request.model,
        llmParameters,
        qwenParameters,
        defaultModel: ollamaConfig_data.defaultModel,
        tools: task.request.tools || null,
        tool_choice: task.request.tool_choice || null,
        stream: false
      });

      const ollamaUrl = ollamaConfig.getBaseUrl();
      const timeouts = ollamaConfig.getTimeouts();
      const requestTimeout = Number(task.request.timeoutMs) > 0
        ? Number(task.request.timeoutMs)
        : timeouts.ollamaChat;

      logger.info(`[AIQueue] Отправка запроса в Ollama с параметрами:`, {
        model: requestBody.model,
        temperature: requestBody.temperature,
        num_predict: requestBody.num_predict,
        format: requestBody.format || 'не задан',
        hasTools,
        priority: task.priority
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
          timeout: requestTimeout,
          signal: abortController.signal
        });
      } finally {
        clearInterval(progressInterval);
      }

      if (abortController.signal.aborted) {
        throw new Error('aborted');
      }

      const result = task.request.returnFullResponse
        ? {
            response: response.data.message.content,
            message: response.data.message,
            raw: response.data
          }
        : response.data.message.content;

      const responseTime = Date.now() - startTime;

      if (cacheKey) {
        const cacheValue = typeof result === 'string' ? result : (result.response || '');
        if (cacheValue) {
          try {
            aiCache.set(cacheKey, cacheValue);
          } catch (cacheError) {
            logger.warn(`[AIQueue] Не удалось сохранить в кэш: ${cacheError.message}`);
          }
        }
      }

      this.updateRequestStatus(task.id, 'completed', result, null, responseTime);
      this.emit(`task_${task.id}_completed`, { response: result, fromCache: false });
      logger.info(`[AIQueue] ✅ Задача ${task.id} выполнена за ${responseTime}ms`);
    } catch (error) {
      const aborted = error?.code === 'ERR_CANCELED'
        || error?.name === 'CanceledError'
        || error?.name === 'AbortError'
        || abortController.signal.aborted
        || /aborted/i.test(String(error?.message || ''));
      const message = aborted ? 'aborted' : (error.message || 'AIQueue task failed');
      logger.error(`[AIQueue] ❌ Ошибка задачи ${task.id}:`, message);
      this.updateRequestStatus(task.id, 'failed', null, message);
      this.emit(`task_${task.id}_failed`, { message });
    } finally {
      this.activeTask = null;
      this.activeAbortController = null;
      this.isProcessing = false;
      // Сразу берём следующую задачу, не ждём tick setInterval
      setImmediate(() => this.processNextTask());
    }
  }
}

const aiQueue = new AIQueue();

module.exports = aiQueue;
module.exports.AIQueue = AIQueue;
module.exports.PRIORITY = PRIORITY;

