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

const Queue = require('better-queue');
const logger = require('../utils/logger');

class AIQueueService {
  constructor() {
    this.queue = null;
    this.isInitialized = false;
    this.userRequestTimes = new Map(); // Добавляем Map для отслеживания запросов пользователей
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      averageProcessingTime: 0,
      currentQueueSize: 0,
      lastProcessedAt: null
    };
    
    this.initQueue();
  }

  initQueue() {
    try {
      this.queue = new Queue(this.processTask.bind(this), {
        // Ограничиваем количество одновременных запросов к Ollama
        concurrent: 2,
        
        // Максимальное время выполнения задачи
        maxTimeout: 180000, // 3 минуты
        
        // Задержка между задачами для предотвращения перегрузки
        afterProcessDelay: 1000, // 1 секунда
        
        // Максимальное количество повторных попыток
        maxRetries: 2,
        
        // Задержка между повторными попытками
        retryDelay: 5000, // 5 секунд
        
        // Функция определения приоритета
        priority: this.getTaskPriority.bind(this),
        
        // Функция фильтрации задач
        filter: this.filterTask.bind(this),
        
        // Функция слияния одинаковых задач
        merge: this.mergeTasks.bind(this),
        
        // ID задачи для предотвращения дублирования
        id: 'requestId'
      });

      this.setupEventListeners();
      this.isInitialized = true;
      
      logger.info('[AIQueue] Queue initialized successfully');
    } catch (error) {
      logger.error('[AIQueue] Failed to initialize queue:', error);
      this.isInitialized = false;
    }
  }

  // Определение приоритета задачи
  getTaskPriority(task, cb) {
    try {
      let priority = 1; // Базовый приоритет
      
      // Высокий приоритет для администраторов
      if (task.userRole === 'admin') {
        priority += 10;
      }
      
      // Приоритет по типу запроса
      switch (task.type) {
        case 'urgent':
          priority += 20;
          break;
        case 'chat':
          priority += 5;
          break;
        case 'analysis':
          priority += 3;
          break;
        case 'generation':
          priority += 1;
          break;
      }
      
      // Приоритет по размеру запроса (короткие запросы имеют больший приоритет)
      if (task.message && task.message.length < 100) {
        priority += 2;
      }
      
      // Приоритет по времени ожидания
      const waitTime = Date.now() - task.timestamp;
      if (waitTime > 30000) { // Более 30 секунд ожидания
        priority += 5;
      }
      
      cb(null, priority);
    } catch (error) {
      cb(error, 1);
    }
  }

  // Фильтрация задач
  filterTask(task, cb) {
    try {
      // Проверяем обязательные поля
      if (!task.message || typeof task.message !== 'string') {
        return cb('Invalid message format');
      }
      
      if (!task.requestId) {
        return cb('Missing request ID');
      }
      
      // Проверяем размер сообщения
      if (task.message.length > 10000) {
        return cb('Message too long (max 10000 characters)');
      }
      
      // Проверяем частоту запросов от пользователя
      if (this.isUserRateLimited(task.userId)) {
        return cb('User rate limit exceeded');
      }
      
      cb(null, task);
    } catch (error) {
      cb(error);
    }
  }

  // Слияние одинаковых задач
  mergeTasks(oldTask, newTask, cb) {
    try {
      // Если это тот же запрос от того же пользователя, обновляем метаданные
      if (oldTask.message === newTask.message && oldTask.userId === newTask.userId) {
        oldTask.timestamp = newTask.timestamp;
        oldTask.retryCount = (oldTask.retryCount || 0) + 1;
        cb(null, oldTask);
      } else {
        cb(null, newTask);
      }
    } catch (error) {
      cb(error);
    }
  }

  // Обработка задачи
  async processTask(task, cb) {
    const startTime = Date.now();
    const taskId = task.requestId;
    
    try {
      logger.info(`[AIQueue] Processing task ${taskId} for user ${task.userId}`);
      
      // Импортируем AI сервис
      const aiAssistant = require('./ai-assistant');
      const encryptedDb = require('./encryptedDatabaseService');
      
      // Выполняем AI запрос
      const result = await aiAssistant.getResponse(
        task.message,
        task.language || 'auto',
        task.history || null,
        task.systemPrompt || '',
        task.rules || null
      );
      
      const processingTime = Date.now() - startTime;
      
      // Сохраняем AI ответ в базу данных
      if (task.conversationId && result) {
        try {
          const aiMessage = await encryptedDb.saveData('messages', {
            conversation_id: task.conversationId,
            user_id: task.userId,
            content: result,
            sender_type: 'assistant',
            role: 'assistant',
            channel: 'web'
          });
          
          // Получаем расшифрованные данные для WebSocket
          const decryptedAiMessage = await encryptedDb.getData('messages', { id: aiMessage.id }, 1);
          if (decryptedAiMessage && decryptedAiMessage[0]) {
            // Отправляем сообщение через WebSocket
            const { broadcastChatMessage } = require('../wsHub');
            broadcastChatMessage(decryptedAiMessage[0], task.userId);
          }
          
          logger.info(`[AIQueue] AI response saved for conversation ${task.conversationId}`);
        } catch (dbError) {
          logger.error(`[AIQueue] Error saving AI response:`, dbError);
        }
      }
      
      // Обновляем статистику
      this.updateStats(true, processingTime);
      
      logger.info(`[AIQueue] Task ${taskId} completed in ${processingTime}ms`);
      
      cb(null, {
        success: true,
        result,
        processingTime,
        taskId
      });
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Обновляем статистику
      this.updateStats(false, processingTime);
      
      logger.error(`[AIQueue] Task ${taskId} failed:`, error);
      
      cb(null, {
        success: false,
        error: error.message,
        processingTime,
        taskId
      });
    }
  }

  // Добавление задачи в очередь
  addTask(taskData) {
    if (!this.isInitialized || !this.queue) {
      throw new Error('Queue is not initialized');
    }

    const task = {
      ...taskData,
      timestamp: Date.now(),
      requestId: taskData.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    return new Promise((resolve, reject) => {
      const ticket = this.queue.push(task, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });

      // Добавляем обработчики событий для билета
      ticket.on('failed', (error) => {
        logger.error(`[AIQueue] Task ${task.requestId} failed:`, error);
        reject(error);
      });

      ticket.on('finish', (result) => {
        logger.info(`[AIQueue] Task ${task.requestId} finished`);
        resolve(result);
      });
    });
  }

  // Настройка обработчиков событий очереди
  setupEventListeners() {
    this.queue.on('task_queued', (taskId) => {
      logger.info(`[AIQueue] Task ${taskId} queued`);
      this.stats.currentQueueSize = this.queue.length;
    });

    this.queue.on('task_started', (taskId) => {
      logger.info(`[AIQueue] Task ${taskId} started`);
    });

    this.queue.on('task_finish', (taskId, result) => {
      logger.info(`[AIQueue] Task ${taskId} finished successfully`);
      this.stats.lastProcessedAt = new Date();
      this.stats.currentQueueSize = this.queue.length;
    });

    this.queue.on('task_failed', (taskId, error) => {
      logger.error(`[AIQueue] Task ${taskId} failed:`, error);
      this.stats.currentQueueSize = this.queue.length;
    });

    this.queue.on('empty', () => {
      logger.info('[AIQueue] Queue is empty');
      this.stats.currentQueueSize = 0;
    });

    this.queue.on('drain', () => {
      logger.info('[AIQueue] Queue drained');
      this.stats.currentQueueSize = 0;
    });
  }

  // Обновление статистики
  updateStats(success, processingTime) {
    this.stats.totalProcessed++;
    if (!success) {
      this.stats.totalFailed++;
    }
    
    // Обновляем среднее время обработки
    const totalTime = this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.totalProcessed;
  }

  // Проверка ограничения частоты запросов пользователя
  isUserRateLimited(userId) {
    // Простая реализация - можно улучшить с использованием Redis
    const now = Date.now();
    const userRequests = this.userRequestTimes.get(userId) || [];
    
    // Удаляем старые запросы (старше 1 минуты)
    const recentRequests = userRequests.filter(time => now - time < 60000);
    
    // Ограничиваем до 10 запросов в минуту
    if (recentRequests.length >= 10) {
      return true;
    }
    
    // Добавляем текущий запрос
    recentRequests.push(now);
    this.userRequestTimes.set(userId, recentRequests);
    
    return false;
  }

  // Получение статистики очереди
  getStats() {
    const queueStats = this.queue ? this.queue.getStats() : {};
    
    return {
      ...this.stats,
      queueStats,
      isInitialized: this.isInitialized,
      currentQueueSize: this.queue ? this.queue.length : 0,
      runningTasks: this.queue ? this.queue.running : 0
    };
  }

  // Очистка очереди
  clear() {
    if (this.queue) {
      this.queue.destroy();
      this.initQueue();
    }
  }

  // Пауза/возобновление очереди
  pause() {
    if (this.queue) {
      this.queue.pause();
      logger.info('[AIQueue] Queue paused');
    }
  }

  resume() {
    if (this.queue) {
      this.queue.resume();
      logger.info('[AIQueue] Queue resumed');
    }
  }
}

// Создаем и экспортируем единственный экземпляр
const aiQueueService = new AIQueueService();
module.exports = aiQueueService; 