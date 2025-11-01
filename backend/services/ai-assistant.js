/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');
const { shouldProcessWithAI } = require('../utils/languageFilter');

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

      // 0. Проверяем язык сообщения (только русский)
      const languageCheck = shouldProcessWithAI(userQuestion);
      if (!languageCheck.shouldProcess) {
        logger.info(`[AIAssistant] ⚠️ Пропуск обработки: ${languageCheck.reason} (user: ${userId}, channel: ${channel})`);
        return {
          success: false,
          reason: languageCheck.reason,
          skipped: true,
          message: 'AI обрабатывает только сообщения на русском языке'
        };
      }

      const messageDeduplicationService = require('./messageDeduplicationService');
      const aiAssistantSettingsService = require('./aiAssistantSettingsService');
      const aiAssistantRulesService = require('./aiAssistantRulesService');
      const { ragAnswer } = require('./ragService');
      
      // 1. Проверяем дедупликацию через хеш
      const messageForDedup = {
        userId,
        content: userQuestion,
        channel
      };
      
      const isDuplicate = messageDeduplicationService.isDuplicate(messageForDedup);

      if (isDuplicate) {
        logger.info(`[AIAssistant] Сообщение уже обработано - пропускаем`);
        return { success: false, reason: 'duplicate' };
      }
      
      // Помечаем как обработанное
      messageDeduplicationService.markAsProcessed(messageForDedup);

      // 2. Получаем настройки AI ассистента
      const aiSettings = await aiAssistantSettingsService.getSettings();
      let rules = null;
      if (aiSettings && aiSettings.rules_id) {
        rules = await aiAssistantRulesService.getRuleById(aiSettings.rules_id);
      }

      // 3. Определяем tableId для RAG
      let tableId = ragTableId;
      if (!tableId && aiSettings && aiSettings.selected_rag_tables && aiSettings.selected_rag_tables.length > 0) {
        tableId = aiSettings.selected_rag_tables[0];
      }

      // 4. Выполняем RAG поиск если есть tableId
      let ragResult = null;
      if (tableId) {
        ragResult = await ragAnswer({
          tableId,
          userQuestion
          // threshold использует дефолтное значение 300 из ragService
        });
      }

      // 5. Генерируем LLM ответ
      const { generateLLMResponse } = require('./ragService');
      const aiResponse = await generateLLMResponse({
        userQuestion,
        context: ragResult?.context || '',
        answer: ragResult?.answer || '',
        systemPrompt: aiSettings ? aiSettings.system_prompt : '',
        history: conversationHistory,
        model: aiSettings ? aiSettings.model : undefined,
        rules: rules ? rules.rules : null,
        selectedRagTables: aiSettings ? aiSettings.selected_rag_tables : []
      });

      if (!aiResponse) {
        logger.warn(`[AIAssistant] Пустой ответ от AI для пользователя ${userId}`);
        return { success: false, reason: 'empty_response' };
      }

      logger.info(`[AIAssistant] AI ответ успешно сгенерирован для пользователя ${userId}`);
      
      return {
        success: true,
        response: aiResponse,
        ragData: ragResult,
        messageId: messageId,
        conversationId: conversationId
      };

    } catch (error) {
      logger.error(`[AIAssistant] Ошибка генерации ответа:`, error);
      return { success: false, reason: 'error', error: error.message };
    }
  }

  /**
   * Простая генерация ответа (для гостевых сообщений)
   * Используется в UniversalGuestService
   */
  async getResponse(message, history = null, systemPrompt = '', rules = null) {
    try {
      const { generateLLMResponse } = require('./ragService');
      
      const result = await generateLLMResponse({
        userQuestion: message,
        context: '',
        answer: '',
        systemPrompt: systemPrompt || '',
        history: history || [],
        model: undefined,
        rules: rules
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
