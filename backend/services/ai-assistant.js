const { ChatOllama } = require('@langchain/ollama');
const { HNSWLib } = require('langchain/vectorstores/hnswlib');
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const logger = require('../utils/logger');

class AIAssistant {
  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'mistral';
  }

  // Создание экземпляра ChatOllama с нужными параметрами
  createChat(language = 'ru') {
    const systemPrompt = language === 'ru' 
      ? 'Вы - полезный ассистент. Отвечайте на русском языке.'
      : 'You are a helpful assistant. Respond in English.';

    return new ChatOllama({
      baseUrl: this.baseUrl,
      model: this.defaultModel,
      system: systemPrompt
    });
  }

  // Определение языка сообщения
  detectLanguage(message) {
    const cyrillicPattern = /[а-яА-ЯёЁ]/;
    return cyrillicPattern.test(message) ? 'ru' : 'en';
  }

  // Основной метод для получения ответа
  async getResponse(message, language = 'auto') {
    try {
      // Определяем язык, если не указан явно
      const detectedLanguage = language === 'auto' 
        ? this.detectLanguage(message) 
        : language;

      const chat = this.createChat(detectedLanguage);
      
      try {
        // Пробуем получить ответ через ChatOllama
        const response = await chat.invoke(message);
        return response.content;
      } catch (error) {
        logger.error('Error using ChatOllama:', error);
        
        // Пробуем альтернативный метод через прямой API
        return await this.fallbackRequest(message, detectedLanguage);
      }
    } catch (error) {
      logger.error('Error in getResponse:', error);
      return "Извините, я не смог обработать ваш запрос. Пожалуйста, попробуйте позже.";
    }
  }

  // Альтернативный метод запроса через прямой API
  async fallbackRequest(message, language) {
    try {
      logger.info('Using fallback request method');
      
      const systemPrompt = language === 'ru'
        ? 'Вы - полезный ассистент. Отвечайте на русском языке.'
        : 'You are a helpful assistant. Respond in English.';

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.defaultModel,
          prompt: message,
          system: systemPrompt,
          stream: false
        }),
      });
      
      const data = await response.json();
      return data.response;
    } catch (error) {
      logger.error('Error in fallback request:', error);
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
