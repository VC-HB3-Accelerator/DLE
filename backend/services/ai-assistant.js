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

console.log('[ai-assistant] loaded');

const { ChatOllama } = require('@langchain/ollama');
const { HNSWLib } = require('@langchain/community/vectorstores/hnswlib');
const { OpenAIEmbeddings } = require('@langchain/openai');
const logger = require('../utils/logger');
const fetch = require('node-fetch');

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
      console.error('Model health check failed:', error);
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
  createChat(language = 'ru', customSystemPrompt = '') {
    // Используем кастомный системный промпт, если он передан, иначе используем дефолтный
    let systemPrompt = customSystemPrompt;
    if (!systemPrompt) {
      systemPrompt = language === 'ru'
        ? 'Вы - полезный ассистент. Отвечайте на русском языке кратко и по делу.'
        : 'You are a helpful assistant. Respond in English briefly and to the point.';
    }

    return new ChatOllama({
      baseUrl: this.baseUrl,
      model: this.defaultModel,
      system: systemPrompt,
      temperature: 0.3, // Уменьшаем для более предсказуемых ответов
      maxTokens: 100, // Еще больше уменьшаем для быстрого ответа
      timeout: 60000, // Увеличиваем таймаут до 60 секунд
      options: {
        num_ctx: 512, // Еще больше уменьшаем контекст для экономии памяти
        num_thread: 12, // Увеличиваем количество потоков еще больше
        num_gpu: 1,
        num_gqa: 8,
        rope_freq_base: 1000000,
        rope_freq_scale: 0.5,
        repeat_penalty: 1.1, // Добавляем штраф за повторения
        top_k: 20, // Еще больше ограничиваем выбор токенов
        top_p: 0.8, // Уменьшаем nucleus sampling
        temperature: 0.1, // Еще больше уменьшаем для более предсказуемых ответов
      }
    });
  }

  // Определение языка сообщения
  detectLanguage(message) {
    const cyrillicPattern = /[а-яА-ЯёЁ]/;
    return cyrillicPattern.test(message) ? 'ru' : 'en';
  }

  // Основной метод для получения ответа
  async getResponse(message, language = 'auto', history = null, systemPrompt = '', rules = null) {
    try {
      console.log('getResponse called with:', { message, language, history, systemPrompt, rules });

      // Очищаем старый кэш
      this.cleanupCache();

      // Проверяем здоровье модели
      const isHealthy = await this.checkModelHealth();
      if (!isHealthy) {
        console.warn('Model is not healthy, returning fallback response');
        return 'Извините, модель временно недоступна. Пожалуйста, попробуйте позже.';
      }

      // Создаем ключ кэша
      const cacheKey = JSON.stringify({ message, language, systemPrompt, rules });
      const cached = responseCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log('Returning cached response');
        return cached.response;
      }

      // Определяем язык, если не указан явно
      const detectedLanguage = language === 'auto' ? this.detectLanguage(message) : language;
      console.log('Detected language:', detectedLanguage);

      // Формируем system prompt с учётом правил
      let fullSystemPrompt = systemPrompt || '';
      if (rules && typeof rules === 'object') {
        fullSystemPrompt += '\n' + JSON.stringify(rules, null, 2);
      }

      // Формируем массив сообщений для Qwen2.5/OpenAI API
      const messages = [];
      if (fullSystemPrompt) {
        messages.push({ role: 'system', content: fullSystemPrompt });
      }
      if (Array.isArray(history) && history.length > 0) {
        for (const msg of history) {
          if (msg.role && msg.content) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }
      }
      // Добавляем текущее сообщение пользователя
      messages.push({ role: 'user', content: message });

      let response = null;

      // Пробуем прямой API запрос (OpenAI-совместимый endpoint)
      try {
        console.log('Trying direct API request...');
        response = await this.fallbackRequestOpenAI(messages, detectedLanguage, fullSystemPrompt);
        console.log('Direct API response received:', response);
      } catch (error) {
        console.error('Error in direct API request:', error);
        
        // Если прямой запрос не удался, пробуем через ChatOllama (склеиваем сообщения в текст)
        const chat = this.createChat(detectedLanguage, fullSystemPrompt);
        try {
          const prompt = messages.map(m => `${m.role === 'user' ? 'Пользователь' : m.role === 'assistant' ? 'Ассистент' : 'Система'}: ${m.content}`).join('\n');
          console.log('Sending request to ChatOllama...');
          const chatResponse = await chat.invoke(prompt);
          console.log('ChatOllama response:', chatResponse);
          response = chatResponse.content;
        } catch (chatError) {
          console.error('Error using ChatOllama:', chatError);
          throw chatError;
        }
      }

      // Кэшируем ответ
      if (response) {
        responseCache.set(cacheKey, {
          response,
          timestamp: Date.now()
        });
      }

      return response;
    } catch (error) {
      console.error('Error in getResponse:', error);
      return 'Извините, я не смог обработать ваш запрос. Пожалуйста, попробуйте позже.';
    }
  }

  // Новый метод для OpenAI/Qwen2.5 совместимого endpoint
  async fallbackRequestOpenAI(messages, language, systemPrompt = '') {
    try {
      console.log('Using fallbackRequestOpenAI with:', { messages, language, systemPrompt });
      const model = this.defaultModel;
      
      // Создаем AbortController для таймаута
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // Увеличиваем до 60 секунд
      
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 200, // Уменьшаем максимальную длину ответа
            num_ctx: 1024, // Уменьшаем контекст для экономии памяти
            num_thread: 8, // Увеличиваем количество потоков
            num_gpu: 1, // Используем GPU если доступен
            num_gqa: 8, // Оптимизация для qwen2.5
            rope_freq_base: 1000000, // Оптимизация для qwen2.5
            rope_freq_scale: 0.5, // Оптимизация для qwen2.5
            repeat_penalty: 1.1, // Добавляем штраф за повторения
            top_k: 40, // Ограничиваем выбор токенов
            top_p: 0.9, // Используем nucleus sampling
          },
        }),
        signal: controller.signal,
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
      console.error('Error in fallbackRequestOpenAI:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - модель не ответила в течение 60 секунд');
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
