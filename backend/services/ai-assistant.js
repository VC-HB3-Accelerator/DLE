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

const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');

/**
 * AI Assistant - тонкая обёртка для работы с Ollama и RAG
 * Основная логика вынесена в отдельные сервисы:
 * - ragService.js - генерация ответов через RAG
 * - aiAssistantSettingsService.js - настройки ИИ
 * - aiAssistantRulesService.js - правила ИИ
 * - messageDeduplicationService.js - дедупликация сообщений
 * - ai-queue.js - управление очередью (отдельный сервис)
 */
class AIAssistant {
  constructor() {
    this.baseUrl = null;
    this.defaultModel = null;
    this.isInitialized = false;
  }

  /**
   * Инициализация из БД
   */
  async initialize() {
    try {
      await ollamaConfig.loadSettingsFromDb();
      
      this.baseUrl = ollamaConfig.getBaseUrl();
      this.defaultModel = ollamaConfig.getDefaultModel();
      
      if (!this.baseUrl || !this.defaultModel) {
        throw new Error('Настройки Ollama не найдены в БД');
      }
      
      this.isInitialized = true;
      logger.info(`[AIAssistant] ✅ Инициализирован из БД: model=${this.defaultModel}`);
    } catch (error) {
      logger.error('[AIAssistant] ❌ КРИТИЧЕСКАЯ ОШИБКА загрузки настроек из БД:', error.message);
      throw error;
    }
  }

  /**
   * Генерация ответа для всех каналов (web, telegram, email)
   * Используется ботами (telegramBot, emailBot)
   */
  async generateResponse(options) {
    const {
      channel,
      messageId,
      userId,
      userQuestion,
      conversationHistory = [],
      conversationId,
      ragTableId = null,
      metadata = {}
    } = options;

    try {
      logger.info(`[AIAssistant] Генерация ответа для канала ${channel}, пользователь ${userId}`);

      const messageDeduplicationService = require('./messageDeduplicationService');
      const aiAssistantSettingsService = require('./aiAssistantSettingsService');
      const aiAssistantRulesService = require('./aiAssistantRulesService');
      const { ragAnswer } = require('./ragService');
      
      // 1. Проверяем дедупликацию
      const cleanMessageId = messageDeduplicationService.cleanMessageId(messageId, channel);
      const isAlreadyProcessed = await messageDeduplicationService.isMessageAlreadyProcessed(
        channel, 
        cleanMessageId, 
        userId, 
        'user'
      );

      if (isAlreadyProcessed) {
        logger.info(`[AIAssistant] Сообщение ${cleanMessageId} уже обработано - пропускаем`);
        return { success: false, reason: 'duplicate' };
      }

      // 2. Получаем настройки AI ассистента
      const aiSettings = await aiAssistantSettingsService.getSettings();
      let rules = null;
      if (aiSettings && aiSettings.rules_id) {
        rules = await aiAssistantRulesService.getRuleById(aiSettings.rules_id);
      }

      // 3. Генерируем AI ответ через RAG
      const aiResponse = await ragAnswer({
        userQuestion,
        conversationHistory,
        systemPrompt: aiSettings ? aiSettings.system_prompt : '',
        rules: rules ? rules.rules : null,
        ragTableId
      });

      if (!aiResponse) {
        logger.warn(`[AIAssistant] Пустой ответ от AI для пользователя ${userId}`);
        return { success: false, reason: 'empty_response' };
      }

      // 4. Сохраняем ответ с дедупликацией
      const aiResponseId = `ai_response_${cleanMessageId}_${Date.now()}`;
      const saveResult = await messageDeduplicationService.saveMessageWithDeduplication(
        {
          user_id: userId,
          conversation_id: conversationId,
          sender_type: 'assistant',
          content: aiResponse,
          channel: channel,
          role: 'assistant',
          direction: 'out',
          created_at: new Date(),
          ...metadata
        },
        channel,
        aiResponseId,
        userId,
        'assistant',
        'messages'
      );

      if (!saveResult.success) {
        logger.error(`[AIAssistant] Ошибка сохранения AI ответа:`, saveResult.error);
        return { success: false, reason: 'save_error' };
      }

      logger.info(`[AIAssistant] AI ответ успешно сгенерирован и сохранен для пользователя ${userId}`);
      
      return {
        success: true,
        response: aiResponse,
        messageId: aiResponseId,
        conversationId: conversationId
      };

    } catch (error) {
      logger.error(`[AIAssistant] Ошибка генерации ответа:`, error);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Простая генерация ответа (для гостевых сообщений)
   * Используется в guestMessageService
   */
  async getResponse(message, history = null, systemPrompt = '', rules = null) {
    try {
      const { ragAnswer } = require('./ragService');
      
      const result = await ragAnswer({
        userQuestion: message,
        conversationHistory: history || [],
        systemPrompt: systemPrompt || '',
        rules: rules || null,
        ragTableId: null
      });

      return result;
    } catch (error) {
      logger.error('[AIAssistant] Ошибка в getResponse:', error);
      return 'Извините, я не смог обработать ваш запрос. Пожалуйста, попробуйте позже.';
    }
  }

  /**
   * Проверка здоровья AI сервиса
   * Использует централизованный метод из ollamaConfig
   */
  async checkHealth() {
    if (!this.isInitialized) {
      return { status: 'error', error: 'AI Assistant не инициализирован' };
    }
    
    // Используем метод проверки из ollamaConfig
    return await ollamaConfig.checkHealth();
  }
}

const aiAssistantInstance = new AIAssistant();
const initPromise = aiAssistantInstance.initialize();

module.exports = aiAssistantInstance;
module.exports.initPromise = initPromise;
