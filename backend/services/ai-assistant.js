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

// console.log('[ai-assistant] loaded');

const { ChatOllama } = require('@langchain/ollama');
const { HNSWLib } = require('@langchain/community/vectorstores/hnswlib');
const { OpenAIEmbeddings } = require('@langchain/openai');
const logger = require('../utils/logger');
const fetch = require('node-fetch');
const aiCache = require('./ai-cache');
const aiQueue = require('./ai-queue');

// Простой кэш для ответов
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

class AIAssistant {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
    this.isModelLoaded = false;
    this.lastHealthCheck = 0;
    this.healthCheckInterval = 30000; // 30 секунд
  }

  // Проверка здоровья модели
  async checkModelHealth() {
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.isModelLoaded;
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { 
        timeout: 5000 
      });
      if (response.ok) {
        const data = await response.json();
        this.isModelLoaded = data.models?.some(m => m.name === this.defaultModel) || false;
      } else {
        this.isModelLoaded = false;
      }
    } catch (error) {
      // console.error('Model health check failed:', error);
      this.isModelLoaded = false;
    }
    
    this.lastHealthCheck = now;
    return this.isModelLoaded;
  }

  // Очистка старых записей кэша
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of responseCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        responseCache.delete(key);
      }
    }
  }

  // Создание экземпляра ChatOllama с нужными параметрами
  createChat(customSystemPrompt = '') {
    // Используем кастомный системный промпт, если он передан, иначе используем дефолтный
    let systemPrompt = customSystemPrompt;
    if (!systemPrompt) {
      systemPrompt = 'Вы - полезный ассистент. Отвечайте на русском языке кратко и по делу.';
    }

    return new ChatOllama({
      baseUrl: this.baseUrl,
      model: this.defaultModel,
      system: systemPrompt,
      temperature: 0.7, // Восстанавливаем для более творческих ответов
      maxTokens: 2048, // Восстанавливаем для полных ответов
      timeout: 300000, // 5 минут для качественной обработки
      numCtx: 4096, // Увеличиваем контекст для лучшего понимания
      numGpu: 1, // Используем GPU
      numThread: 8, // Оптимальное количество потоков
      repeatPenalty: 1.1, // Штраф за повторения
      topK: 40, // Разнообразие ответов
      topP: 0.9, // Ядерная выборка
      tfsZ: 1, // Tail free sampling
      mirostat: 2, // Mirostat 2.0 для контроля качества
      mirostatTau: 5, // Целевая перплексия
      mirostatEta: 0.1, // Скорость адаптации
      grammar: '', // Грамматика (если нужна)
      seed: -1, // Случайный сид
      numPredict: -1, // Неограниченная длина
      stop: [], // Стоп-слова
      stream: false, // Без стриминга для стабильности
      options: {
        numCtx: 4096,
        numGpu: 1,
        numThread: 8,
        repeatPenalty: 1.1,
        topK: 40,
        topP: 0.9,
        tfsZ: 1,
        mirostat: 2,
        mirostatTau: 5,
        mirostatEta: 0.1
      }
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
      // console.log('getResponse called with:', { message, history, systemPrompt, rules });

      // Очищаем старый кэш
      this.cleanupCache();

      // Проверяем здоровье модели
      const isHealthy = await this.checkModelHealth();
      if (!isHealthy) {
        // console.warn('Model is not healthy, returning fallback response');
        return 'Извините, модель временно недоступна. Пожалуйста, попробуйте позже.';
      }

      // Проверяем кэш
      const cacheKey = aiCache.generateKey([{ role: 'user', content: message }], {
        temperature: 0.3,
        maxTokens: 150
      });
      const cachedResponse = aiCache.get(cacheKey);
      if (cachedResponse) {
        // console.log('Returning cached response');
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
        }, 180000); // 180 секунд таймаут для очереди (увеличено с 60)

        const onCompleted = (item) => {
          if (item.id === requestId) {
            clearTimeout(timeout);
            aiQueue.off('completed', onCompleted);
            aiQueue.off('failed', onFailed);
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
      // console.error('Error in getResponse:', error);
      return 'Извините, я не смог обработать ваш запрос. Пожалуйста, попробуйте позже.';
    }
  }

  // Новый метод для OpenAI/Qwen2.5 совместимого endpoint
  async fallbackRequestOpenAI(messages, systemPrompt = '') {
    try {
      // console.log('Using fallbackRequestOpenAI with:', { messages, systemPrompt });
      const model = this.defaultModel;
      
      // Создаем AbortController для таймаута
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // Увеличиваем до 120 секунд
      
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 2048, // Восстанавливаем для полных ответов
            num_ctx: 4096, // Восстанавливаем контекст для лучшего понимания
            num_thread: 8, // Оптимальное количество потоков
            num_gpu: 1, // Используем GPU если доступен
            num_gqa: 8, // Оптимизация для qwen2.5
            rope_freq_base: 1000000, // Оптимизация для qwen2.5
            rope_freq_scale: 0.5, // Оптимизация для qwen2.5
            repeat_penalty: 1.1, // Восстанавливаем штраф за повторения
            top_k: 40, // Восстанавливаем разнообразие ответов
            top_p: 0.9, // Восстанавливаем nucleus sampling
            tfs_z: 1, // Tail free sampling
            mirostat: 2, // Mirostat 2.0 для контроля качества
            mirostat_tau: 5, // Целевая перплексия
            mirostat_eta: 0.1, // Скорость адаптации
            seed: -1, // Случайный сид
            stop: [] // Стоп-слова
          }
        })
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      // Qwen2.5/OpenAI API возвращает ответ в data.choices[0].message.content
      if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        return data.choices[0].message.content;
      }
      return data.response || '';
    } catch (error) {
      // console.error('Error in fallbackRequestOpenAI:', error);
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

// Создаем и экспортируем единственный экземпляр
const aiAssistant = new AIAssistant();
module.exports = aiAssistant;
