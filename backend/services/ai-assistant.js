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

const { ChatOllama } = require('@langchain/ollama');
const aiCache = require('./ai-cache');
const aiQueue = require('./ai-queue');
const logger = require('../utils/logger');

// Константы для AI параметров
const AI_CONFIG = {
  temperature: 0.3,
  maxTokens: 512,
  timeout: 180000,
  numCtx: 2048,
  numGpu: 1,
  numThread: 4,
  repeatPenalty: 1.1,
  topK: 40,
  topP: 0.9,
  // tfsZ не поддерживается в текущем Ollama — удаляем
  mirostat: 2,
  mirostatTau: 5,
  mirostatEta: 0.1,
  seed: -1,
  // Ограничим количество генерируемых токенов для CPU, чтобы избежать таймаутов
  numPredict: 256,
  stop: []
};

class AIAssistant {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    this.lastHealthCheck = 0;
    this.healthCheckInterval = 30000; // 30 секунд
  }

  // Проверка здоровья модели
  async checkModelHealth() {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return true; // Используем кэшированный результат
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }
      const data = await response.json();
      const modelExists = data.models?.some(model => model.name === this.defaultModel);
      
      this.lastHealthCheck = now;
      return modelExists;
    } catch (error) {
      logger.error('Model health check failed:', error);
      return false;
    }
  }

  // Очистка старого кэша
  cleanupCache() {
    const now = Date.now();
    const maxAge = 3600000; // 1 час
    aiCache.cleanup(maxAge);
  }

  // Создание чата с кастомным системным промптом
  createChat(customSystemPrompt = '') {
    let systemPrompt = customSystemPrompt;
    if (!systemPrompt) {
      systemPrompt = 'Вы - полезный ассистент. Отвечайте на русском языке кратко и по делу.';
    }

    return new ChatOllama({
      baseUrl: this.baseUrl,
      model: this.defaultModel,
      system: systemPrompt,
      ...AI_CONFIG,
      options: AI_CONFIG
    });
  }

  // Определение приоритета запроса
  getRequestPriority(message, history, rules) {
    let priority = 0;
    
    // Высокий приоритет для коротких запросов
    if (message.length < 50) {
      priority += 10;
    }
    
    // Приоритет по типу запроса
    const urgentKeywords = ['срочно', 'важно', 'помоги'];
    if (urgentKeywords.some(keyword => message.toLowerCase().includes(keyword))) {
      priority += 20;
    }
    
    // Приоритет для администраторов
    if (rules && rules.isAdmin) {
      priority += 15;
    }
    
    // Приоритет по времени ожидания (если есть история)
    if (history && history.length > 0) {
      const lastMessage = history[history.length - 1];
      const timeDiff = Date.now() - (lastMessage.timestamp || Date.now());
      if (timeDiff > 30000) { // Более 30 секунд ожидания
        priority += 5;
      }
    }
    
    return priority;
  }

  // Основной метод для получения ответа
  async getResponse(message, history = null, systemPrompt = '', rules = null) {
    try {
      // Очищаем старый кэш
      this.cleanupCache();

      // Проверяем здоровье модели
      const isHealthy = await this.checkModelHealth();
      if (!isHealthy) {
        return 'Извините, модель временно недоступна. Пожалуйста, попробуйте позже.';
      }

      // Проверяем кэш
      const cacheKey = aiCache.generateKey([{ role: 'user', content: message }], {
        temperature: 0.3,
        maxTokens: 150
      });
      const cachedResponse = aiCache.get(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }

      // Определяем приоритет запроса
      const priority = this.getRequestPriority(message, history, rules);
      
      // Добавляем запрос в очередь
      const requestId = await aiQueue.addRequest({
        message,
        history,
        systemPrompt,
        rules
      }, priority);

      // Ждем результат из очереди
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Request timeout - очередь перегружена'));
        }, 180000); // 180 секунд таймаут для очереди

        const onCompleted = (item) => {
          if (item.id === requestId) {
            clearTimeout(timeout);
            aiQueue.off('completed', onCompleted);
            aiQueue.off('failed', onFailed);
            try {
              aiCache.set(cacheKey, item.result);
            } catch {}
            resolve(item.result);
          }
        };

        const onFailed = (item) => {
          if (item.id === requestId) {
            clearTimeout(timeout);
            aiQueue.off('completed', onCompleted);
            aiQueue.off('failed', onFailed);
            reject(new Error(item.error));
          }
        };

        aiQueue.on('completed', onCompleted);
        aiQueue.on('failed', onFailed);
      });
    } catch (error) {
      logger.error('Error in getResponse:', error);
      return 'Извините, я не смог обработать ваш запрос. Пожалуйста, попробуйте позже.';
    }
  }

  // Алиас для getResponse (для совместимости)
  async processMessage(message, history = null, systemPrompt = '', rules = null) {
    return this.getResponse(message, history, systemPrompt, rules);
  }

  // Прямой запрос к API (для очереди)
  async directRequest(messages, systemPrompt = '', optionsOverride = {}) {
    try {
      const model = this.defaultModel;
      
      // Создаем AbortController для таймаута
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AI_CONFIG.timeout);

      // Маппинг camelCase → snake_case для опций Ollama
      const mapOptionsToOllama = (opts) => ({
        temperature: opts.temperature,
        // Используем только num_predict; не мапим maxTokens, чтобы не завышать лимит генерации
        num_predict: typeof opts.numPredict === 'number' && opts.numPredict > 0 ? opts.numPredict : undefined,
        num_ctx: opts.numCtx,
        num_gpu: opts.numGpu,
        num_thread: opts.numThread,
        repeat_penalty: opts.repeatPenalty,
        top_k: opts.topK,
        top_p: opts.topP,
        tfs_z: opts.tfsZ,
        mirostat: opts.mirostat,
        mirostat_tau: opts.mirostatTau,
        mirostat_eta: opts.mirostatEta,
        seed: opts.seed,
        stop: Array.isArray(opts.stop) ? opts.stop : []
      });

      const mergedConfig = { ...AI_CONFIG, ...optionsOverride };
      const ollamaOptions = mapOptionsToOllama(mergedConfig);

      // Вставляем системный промпт в начало, если задан
      const finalMessages = Array.isArray(messages) ? [...messages] : [];
      // Нормализация: только 'user' | 'assistant' | 'system'
      for (const m of finalMessages) {
        if (m && m.role) {
          if (m.role !== 'assistant' && m.role !== 'system') m.role = 'user';
        }
      }
      if (systemPrompt && !finalMessages.find(m => m.role === 'system')) {
        finalMessages.unshift({ role: 'system', content: systemPrompt });
      }

      let response;
      try {
        response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            model,
            messages: finalMessages,
            stream: false,
            options: ollamaOptions,
            keep_alive: '3m'
          })
        });
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Ollama /api/chat возвращает ответ в data.message.content
      if (data.message && typeof data.message.content === 'string') {
        const content = data.message.content;
        try {
          const cacheKey = aiCache.generateKey(messages, { num_predict: ollamaOptions.num_predict, temperature: ollamaOptions.temperature });
          aiCache.set(cacheKey, content);
        } catch {}
        return content;
      }
      // OpenAI-совместимый /v1/chat/completions
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        const content = data.choices[0].message.content;
        try {
          const cacheKey = aiCache.generateKey(messages, { num_predict: ollamaOptions.num_predict, temperature: ollamaOptions.temperature });
          aiCache.set(cacheKey, content);
        } catch {}
        return content;
      }
      
      const content = data.response || '';
      try {
        const cacheKey = aiCache.generateKey(messages, { num_predict: ollamaOptions.num_predict, temperature: ollamaOptions.temperature });
        aiCache.set(cacheKey, content);
      } catch {}
      return content;
    } catch (error) {
      logger.error('Error in directRequest:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - модель не ответила в течение 120 секунд');
      }
      throw error;
    }
  }

  // Получение списка доступных моделей
  async getAvailableModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      logger.error('Error getting available models:', error);
      return [];
    }
  }

  // Проверка здоровья AI сервиса
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }
      const data = await response.json();
      return {
        status: 'ok',
        models: data.models?.length || 0,
        baseUrl: this.baseUrl
      };
    } catch (error) {
      logger.error('AI health check failed:', error);
      return {
        status: 'error',
        error: error.message,
        baseUrl: this.baseUrl
      };
    }
  }

  // Добавляем методы из vectorStore.js
  async initVectorStore() {
    // ... код инициализации ...
  }

  async findSimilarDocuments(query, k = 3) {
    // ... код поиска документов ...
  }
}

module.exports = new AIAssistant();
