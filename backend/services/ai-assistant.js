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
const userContextService = require('./userContextService');

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
      const profileAnalysisService = require('./profileAnalysisService');
      const { ragAnswer } = require('./ragService');
      
      // 1. Проверяем дедупликацию через хеш
      const messageForDedup = {
        userId,
        content: userQuestion,
        channel
      };
      
      const isDuplicate = await messageDeduplicationService.isDuplicate(messageForDedup);

      if (isDuplicate) {
        logger.info(`[AIAssistant] Сообщение уже обработано - пропускаем`);
        return { success: false, reason: 'duplicate' };
      }
      
      // Помечаем как обработанное
      await messageDeduplicationService.markAsProcessed(messageForDedup);

      // 1.5. Анализ профиля пользователя и автоматическое обновление (если не гость)
      let userTags = null;
      let userNameForProfile = null;
      let shouldAskForName = false;
      let profileAnalysis = null;
      if (userId && !userContextService.isGuestId(userId)) {
        try {
          profileAnalysis = await profileAnalysisService.analyzeUserMessage(userId, userQuestion);
          const tagsDisplay = profileAnalysis.currentTagNames && profileAnalysis.currentTagNames.length > 0 
            ? profileAnalysis.currentTagNames.join(', ') 
            : 'нет тегов';
          logger.info(`[AIAssistant] Анализ профиля: имя=${profileAnalysis.name || 'null'}, теги=${tagsDisplay}`);
          
          // Получаем текущие теги пользователя для передачи в generateLLMResponse
          if (profileAnalysis.currentTagNames && profileAnalysis.currentTagNames.length > 0) {
            userTags = profileAnalysis.currentTagNames;
          } else if (profileAnalysis.suggestedTags && profileAnalysis.suggestedTags.length > 0) {
            userTags = profileAnalysis.suggestedTags;
          }

          userNameForProfile = profileAnalysis.currentName || profileAnalysis.name || null;
          shouldAskForName = Boolean(profileAnalysis?.nameMissing);
        } catch (error) {
          logger.error(`[AIAssistant] Ошибка анализа профиля:`, {
            message: error.message,
            stack: error.stack
          });
          // Продолжаем работу даже при ошибке анализа, но пытаемся получить теги из БД
          try {
            const currentTagIds = await userContextService.getUserTags(userId);
            if (currentTagIds && currentTagIds.length > 0) {
              userTags = await userContextService.getTagNames(currentTagIds);
              logger.info(`[AIAssistant] Получены теги пользователя из БД после ошибки анализа: ${userTags.join(', ')}`);
            }
            const fallbackContext = await userContextService.getUserContext(userId);
            if (fallbackContext?.name) {
              userNameForProfile = fallbackContext.name;
              shouldAskForName = false;
            } else if (!userNameForProfile) {
              shouldAskForName = true;
            }
          } catch (tagError) {
            logger.warn(`[AIAssistant] Не удалось получить теги пользователя:`, {
              message: tagError.message,
              stack: tagError.stack
            });
          }
        }
      }

      // 2. Получаем настройки AI ассистента
      logger.info(`[AIAssistant] Получение настроек AI ассистента...`);
      const aiSettings = await aiAssistantSettingsService.getSettings();
      logger.info(`[AIAssistant] Настройки получены, selected_rag_tables: ${aiSettings?.selected_rag_tables?.length || 0}`);

      const defaultChannelState = { web: true, telegram: true, email: true };
      const enabledChannels = {
        ...defaultChannelState,
        ...(aiSettings?.enabled_channels || {})
      };
      const normalizedChannel = ['web', 'telegram', 'email'].includes(channel) ? channel : 'web';

      if (enabledChannels[normalizedChannel] === false) {
        logger.info(`[AIAssistant] Ассистент отключен для канала ${normalizedChannel} — пропускаем генерацию.`);
        return {
          success: false,
          reason: 'channel_disabled',
          disabled: true,
          channel: normalizedChannel
        };
      }
      
      let rules = null;
      if (aiSettings && aiSettings.rules_id) {
        logger.info(`[AIAssistant] Загрузка правил по ID: ${aiSettings.rules_id}`);
        rules = await aiAssistantRulesService.getRuleById(aiSettings.rules_id);
      }

      // 3. Определяем tableIds для RAG (может быть несколько таблиц)
      const tableIds = aiSettings && aiSettings.selected_rag_tables && aiSettings.selected_rag_tables.length > 0
        ? aiSettings.selected_rag_tables
        : (ragTableId ? [ragTableId] : []);
      
      logger.info(`[AIAssistant] Определены tableIds для RAG: ${JSON.stringify(tableIds)}`);

      // 4. Выполняем мульти-источниковый поиск (таблицы + документы)
      logger.info(`[AIAssistant] Начало мульти-источникового поиска...`);
      const multiSourceSearchService = require('./multiSourceSearchService');
      const ragConfig = await (require('./aiConfigService')).getRAGConfig();
      logger.info(`[AIAssistant] RAG конфигурация получена, метод поиска: ${ragConfig.searchMethod || 'hybrid'}`);
      
      let searchResults = null;
      let ragResult = null; // Для обратной совместимости

      if (tableIds.length > 0 || true) { // Всегда ищем в документах, если включено
        try {
          logger.info(`[AIAssistant] Вызов multiSourceSearchService.search для запроса: "${userQuestion.substring(0, 50)}..."`);
          const searchStartTime = Date.now();
          searchResults = await multiSourceSearchService.search({
            query: userQuestion,
            tableIds: tableIds,
            searchInDocuments: true, // Поиск в документах включен
            searchMethod: ragConfig.searchMethod || 'hybrid', // 'semantic', 'keyword', 'hybrid'
            userId: userId,
            maxResultsPerSource: ragConfig.maxResults || 10,
            totalMaxResults: (ragConfig.maxResults || 10) * 2 // Увеличиваем для объединения
          });
          const searchDuration = Date.now() - searchStartTime;
          logger.info(`[AIAssistant] Мульти-источниковый поиск завершен за ${searchDuration}ms, найдено результатов: ${searchResults?.results?.length || 0}`);

          // Формируем объединенный результат для обратной совместимости
          if (searchResults.results && searchResults.results.length > 0) {
            // Берем лучший результат
            const bestResult = searchResults.results[0];
            ragResult = {
              answer: bestResult.text,
              context: bestResult.context || '',
              product: bestResult.metadata?.product || null,
              priority: bestResult.metadata?.priority || null,
              date: bestResult.metadata?.date || null,
              score: bestResult.score || 0
            };

            // Формируем контекст из всех результатов для LLM
            const allResultsContext = searchResults.results
              .slice(0, 3) // Берем топ-3 результатов
              .map((r, idx) => {
                const sourceLabel = r.sourceType === 'table' ? 'Таблица' : 'Документ';
                const fallbackText = (r.metadata?.answer && String(r.metadata.answer).trim())
                  || (r.metadata?.title && String(r.metadata.title).trim())
                  || '(текст отсутствует)';
                const text = (r.text && r.text.trim()) || fallbackText;
                const snippetLimit = 300;
                const truncatedText = text.length > snippetLimit
                  ? `${text.slice(0, snippetLimit)}...`
                  : text;
                return `[${idx + 1}] ${sourceLabel}: ${truncatedText}`;
              })
              .join('\n\n');

            ragResult.context = allResultsContext;
          }
        } catch (error) {
          logger.error(`[AIAssistant] Ошибка мульти-источникового поиска:`, error);
          // Fallback на старый метод, если новый не работает
          if (tableIds.length > 0) {
            const { ragAnswer } = require('./ragService');
        ragResult = await ragAnswer({
              tableId: tableIds[0],
              userQuestion,
              userId: userId
            });
          }
        }
      }

      // 5. Генерируем LLM ответ
      const { generateLLMResponse } = require('./ragService');
      // Получаем актуальную информацию о пользователе для LLM
      if (!userNameForProfile && userId && !userContextService.isGuestId(userId)) {
        try {
          const userContext = await userContextService.getUserContext(userId);
          if (userContext) {
            userNameForProfile = userNameForProfile || userContext.name || null;
            if (!userTags && userContext.tagNames && userContext.tagNames.length > 0) {
              userTags = userContext.tagNames;
            }
            if (!userNameForProfile) {
              shouldAskForName = true;
            }
          }
        } catch (contextError) {
          logger.warn(`[AIAssistant] Не удалось получить контекст пользователя:`, {
            message: contextError.message,
            stack: contextError.stack
          });
        }
      }

      const userProfile = {
        id: userId,
        name: userNameForProfile || null,
        tags: Array.isArray(userTags) ? userTags : [],
        nameMissing: shouldAskForName,
        suggestedTags: profileAnalysis?.suggestedTags || []
      };

      logger.info(`[AIAssistant] Вызов generateLLMResponse для пользователя ${userId}...`);
      const aiResponse = await generateLLMResponse({
        userQuestion,
        context: ragResult?.context || '',
        answer: ragResult?.answer || '',
        systemPrompt: aiSettings ? aiSettings.system_prompt : '',
        history: conversationHistory,
        model: aiSettings ? aiSettings.model : undefined,
        rules: rules ? rules.rules : null,
        selectedRagTables: aiSettings ? aiSettings.selected_rag_tables : [],
        userId: userId, // Передаем userId для function calling
        multiSourceResults: searchResults, // Передаем результаты мульти-поиска
        userTags: userTags,
        userProfile
      });

      logger.info(`[AIAssistant] generateLLMResponse вернул ответ типа: ${typeof aiResponse}, длина: ${aiResponse ? (typeof aiResponse === 'string' ? aiResponse.length : JSON.stringify(aiResponse).length) : 0}`);

      if (!aiResponse) {
        logger.warn(`[AIAssistant] Пустой ответ от AI для пользователя ${userId}`);
        return { success: false, reason: 'empty_response' };
      }

      logger.info(`[AIAssistant] AI ответ успешно сгенерирован для пользователя ${userId}, длина: ${typeof aiResponse === 'string' ? aiResponse.length : JSON.stringify(aiResponse).length} символов`);
      
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
