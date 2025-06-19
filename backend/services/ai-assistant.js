console.log('[ai-assistant] loaded');

const { ChatOllama } = require('@langchain/ollama');
const { HNSWLib } = require('@langchain/community/vectorstores/hnswlib');
const { OpenAIEmbeddings } = require('@langchain/openai');
const logger = require('../utils/logger');
const fetch = require('node-fetch');

class AIAssistant {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'qwen2.5';
  }

  // Создание экземпляра ChatOllama с нужными параметрами
  createChat(language = 'ru') {
    const systemPrompt =
      language === 'ru'
        ? 'Вы - полезный ассистент. Отвечайте на русском языке.'
        : 'You are a helpful assistant. Respond in English.';

    return new ChatOllama({
      baseUrl: this.baseUrl,
      model: this.defaultModel,
      system: systemPrompt,
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000, // 30 секунд таймаут
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

      // Пробуем прямой API запрос (OpenAI-совместимый endpoint)
      try {
        console.log('Trying direct API request...');
        const response = await this.fallbackRequestOpenAI(messages, detectedLanguage);
        console.log('Direct API response received:', response);
        return response;
      } catch (error) {
        console.error('Error in direct API request:', error);
      }

      // Если прямой запрос не удался, пробуем через ChatOllama (склеиваем сообщения в текст)
      const chat = this.createChat(detectedLanguage);
      try {
        const prompt = messages.map(m => `${m.role === 'user' ? 'Пользователь' : m.role === 'assistant' ? 'Ассистент' : 'Система'}: ${m.content}`).join('\n');
        console.log('Sending request to ChatOllama...');
        const response = await chat.invoke(prompt);
        console.log('ChatOllama response:', response);
        return response.content;
      } catch (error) {
        console.error('Error using ChatOllama:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error in getResponse:', error);
      return 'Извините, я не смог обработать ваш запрос. Пожалуйста, попробуйте позже.';
    }
  }

  // Новый метод для OpenAI/Qwen2.5 совместимого endpoint
  async fallbackRequestOpenAI(messages, language) {
    try {
      console.log('Using fallbackRequestOpenAI with:', { messages, language });
      const model = this.defaultModel;
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 1000,
          },
        }),
      });
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
