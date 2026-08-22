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

const logger = require('../utils/logger');
const ollamaConfig = require('./ollamaConfig');
const { shouldProcessWithAI } = require('../utils/languageFilter');
const userContextService = require('./userContextService');
const { resolveTurnContext } = require('./assistantTurnContext');

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
      conversationHistory: incomingHistory = [],
      conversationId,
      ragTableId = null,
      metadata = {},
      media = null
    } = options;
    let conversationHistory = Array.isArray(incomingHistory) ? incomingHistory.slice() : [];

    try {
      logger.info(`[AIAssistant] Генерация ответа для канала ${channel}, пользователь ${userId}`);

      // 0. Язык: русский или английский
      const languageCheck = await shouldProcessWithAI(userQuestion, { hasMedia: Boolean(media?.data) });
      if (!languageCheck.shouldProcess) {
        logger.info(`[AIAssistant] ⚠️ Пропуск обработки: ${languageCheck.reason} (user: ${userId}, channel: ${channel})`);
        return {
          success: false,
          reason: languageCheck.reason,
          skipped: true,
          message: 'AI обрабатывает сообщения на русском или английском языке'
        };
      }

      const messageDeduplicationService = require('./messageDeduplicationService');
      const aiAssistantSettingsService = require('./aiAssistantSettingsService');
      const aiAssistantRulesService = require('./aiAssistantRulesService');
      const profileAnalysisService = require('./profileAnalysisService');
      
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
          profileAnalysis = await profileAnalysisService.analyzeUserMessage(userId, userQuestion, {
            history: conversationHistory
          });
          const tagsDisplay = profileAnalysis.currentTagNames && profileAnalysis.currentTagNames.length > 0 
            ? profileAnalysis.currentTagNames.join(', ') 
            : 'нет тегов';
          logger.info(`[AIAssistant] Анализ профиля: имя=${profileAnalysis.name || 'null'}, теги=${tagsDisplay}`);
          
          // Получаем текущие теги пользователя для передачи в generateLLMResponse
          if (profileAnalysis.currentTagNames && profileAnalysis.currentTagNames.length > 0) {
            userTags = profileAnalysis.currentTagNames;
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

      const {
        parseAcceptInputForGenerate,
        filterMediaForLlm,
        FAIL_CLOSED_MEDIA
      } = (() => {
        try { return require('/app/shared/assistantAcceptInput'); }
        catch (_) { return require('../../shared/assistantAcceptInput'); }
      })();
      let acceptInput;
      try {
        acceptInput = parseAcceptInputForGenerate(aiSettings?.accept_input);
      } catch (acceptErr) {
        logger.warn(`[AIAssistant] accept_input unreadable, fail-closed media: ${acceptErr.message}`);
        acceptInput = { ...FAIL_CLOSED_MEDIA };
      }
      const filteredIngest = filterMediaForLlm({
        accept: acceptInput,
        media,
        text: userQuestion
      });
      if (filteredIngest.reason) {
        logger.info(`[AIAssistant] accept_input skip kind=${media?.kind || 'text'} reason=${filteredIngest.reason}`);
      }
      if (filteredIngest.skipGenerate) {
        return {
          success: false,
          skipped: true,
          reason: 'accept_input_skipped'
        };
      }
      const ingestMedia = filteredIngest.media;
      const ingestQuestion = filteredIngest.promptText;

      let crmTagIds = [];
      if (userId && !userContextService.isGuestId(userId)) {
        try {
          crmTagIds = await userContextService.getUserTags(userId) || [];
        } catch (_) {
          crmTagIds = [];
        }
      }
      const crmTagNames = (userId && !userContextService.isGuestId(userId) && Array.isArray(userTags))
        ? userTags
        : [];
      if ((!crmTagNames.length) && crmTagIds.length) {
        try {
          const names = await userContextService.getTagNames(crmTagIds);
          if (Array.isArray(names) && names.length) userTags = names;
        } catch (_) { /* ignore */ }
      }

      const turnCtx = resolveTurnContext({
        userId,
        isGuest: Boolean(metadata.isGuest) || userContextService.isGuestId(userId) || !userId,
        userQuestion: ingestQuestion,
        metadata,
        conversationHistory,
        crmTagIds,
        crmTagNames: Array.isArray(userTags) ? userTags : [],
        isGuestId: userContextService.isGuestId
      });
      logger.info(
        `[AIAssistant] turn: guest=${turnCtx.isGuest} aud=${turnCtx.audienceSlugs.join(',')} mode=${turnCtx.modeSlugs.join(',')} hint=${turnCtx.ragHint || '—'} crm=${turnCtx.crmTagNames.join(',') || '∅'}`
      );

      // Правила B: гость / user без ЦА — только KB base. С ЦА — AND mode+audience+combo, без base.
      let rules = { byTags: [], global: null };
      try {
        rules = await aiAssistantRulesService.resolveRulesForUser({
          rulesId: aiSettings?.rules_id || null,
          tagIds: turnCtx.crmTagIds,
          tagNames: turnCtx.crmTagNames,
          includeBase: turnCtx.includeBaseRules,
          matchTaggedRules: turnCtx.hasCrmAudience,
          audienceSlugs: turnCtx.audienceSlugs,
          modeSlugs: turnCtx.modeSlugs
        });
        logger.info(
          `[AIAssistant] Правила: по тегам=${rules.byTags?.length || 0}, базовый=${rules.global ? rules.global.name : 'нет'}`
        );
      } catch (rulesErr) {
        logger.warn(`[AIAssistant] Не удалось загрузить правила: ${rulesErr.message}`);
      }

      // 3. Определяем tableIds для RAG (может быть несколько таблиц)
      const tableIds = aiSettings && aiSettings.selected_rag_tables && aiSettings.selected_rag_tables.length > 0
        ? aiSettings.selected_rag_tables
        : (ragTableId ? [ragTableId] : []);
      
      logger.info(`[AIAssistant] Определены tableIds для RAG: ${JSON.stringify(tableIds)}`);

      // 4. Поиск только pgvector (FAQ + documents), pre-filter до ANN
      logger.info(`[AIAssistant] Начало поиска rag_chunks/pgvector...`);
      const ragPgvectorService = require('./ragPgvectorService');
      const aiConfigService = require('./aiConfigService');
      const ragConfig = await aiConfigService.getRAGConfig();
      
      let searchResults = null;
      let ragResult = null; // Для обратной совместимости

      // Важно (продукт): не отдаём FAQ дословно — ассистент ведёт беседу и синтезирует ответ.
      // RAG hit’ы = факты/якоря для LLM, не готовый UX-текст («киоск документов»).
      // См. docs.ru/back-docs/AI-OS-CONFIG/00-product-intent.ru.md

      const ragBehavior = await aiConfigService.getRAGBehavior();
      const searchInDocuments = ragBehavior.searchInDocuments !== false;

      const { mediaRagQuery } = (() => {
        try { return require('/app/shared/mediaLimits'); }
        catch (_) { return require('../../shared/mediaLimits'); }
      })();
      const ragQuery = ingestMedia
        ? mediaRagQuery(ingestMedia.kind, ingestQuestion)
        : ingestQuestion;

      if (ragQuery && (tableIds.length > 0 || searchInDocuments)) {
        try {
          logger.info(`[AIAssistant] pgvector search: "${String(ragQuery).substring(0, 50)}..."`);
          const searchStartTime = Date.now();
          const oversample = Math.max(15, Math.min(50, Number(ragConfig.maxResults) || 8));
          searchResults = await ragPgvectorService.search({
            query: ragQuery,
            tableIds,
            ctx: turnCtx,
            limit: oversample
          });
          const searchDuration = Date.now() - searchStartTime;
          logger.info(`[AIAssistant] pgvector завершен за ${searchDuration}ms, hits=${searchResults?.results?.length || 0}`);

          if (searchResults?.results?.length) {
            const {
              filterHitsByTurnContext,
              rerankTableHitsByQuestion,
              preferCoreProductFaqHits,
              preferCoreInvestorFaqHits,
              preferCorePartnerFaqHits,
              preferCorpusPresentationHits,
              pickSourcesForPrompt
            } = require('./ragPromptAssembly');
            const before = searchResults.results.length;
            const filtered = filterHitsByTurnContext(searchResults.results, turnCtx);
            let nextHits = filtered.results;
            if (filtered.emptied) {
              logger.warn('[AIAssistant] Фильтр аудитории опустошил выдачу — fail-closed (0 hits)');
            } else if (filtered.results.length !== before) {
              logger.info(`[AIAssistant] После фильтра: ${before} → ${filtered.results.length}`);
            }
            nextHits = rerankTableHitsByQuestion(nextHits, ragQuery);
            const hint = turnCtx.ragHint;
            // rag_hint — rerank, не ACL. Гость / без allowAsk не бустим investor/partner FAQ и inv-a страницы.
            if (!turnCtx.isGuest && turnCtx.allowAsk
              && (hint === 'investor' || turnCtx.audienceSlugs.includes('investor-a'))) {
              nextHits = preferCoreInvestorFaqHits(nextHits, ragQuery);
            } else if (!turnCtx.isGuest
              && (hint === 'partner' || turnCtx.audienceSlugs.includes('partner'))) {
              nextHits = preferCorePartnerFaqHits(nextHits, ragQuery);
            } else {
              nextHits = preferCoreProductFaqHits(nextHits, ragQuery);
            }
            nextHits = preferCorpusPresentationHits(nextHits, ragQuery, turnCtx.audienceSlugs, hint, {
              isGuest: turnCtx.isGuest
            });
            nextHits.sort((a, b) => (Number(b.combinedScore != null ? b.combinedScore : b.score) || 0)
              - (Number(a.combinedScore != null ? a.combinedScore : a.score) || 0));
            const promptLimit = Math.max(
              nextHits.length,
              1
            );
            searchResults.results = pickSourcesForPrompt(nextHits, promptLimit);
          }

          // Формируем объединенный результат для обратной совместимости
          if (searchResults.results && searchResults.results.length > 0) {
            const bestResult = searchResults.results[0];
            ragResult = {
              answer: bestResult.text,
              context: bestResult.context || '',
              product: bestResult.metadata?.product || null,
              priority: bestResult.metadata?.priority || null,
              date: bestResult.metadata?.date || null,
              score: bestResult.score || 0
            };
          }
        } catch (error) {
          logger.error(`[AIAssistant] Ошибка pgvector поиска (fail-closed, без FAISS):`, error.message);
          searchResults = { results: [] };
          ragResult = null;
        }
      }

      // 5. Генерируем LLM ответ
      const { generateLLMResponse } = require('./ragService');
      // Получаем актуальную информацию о пользователе для LLM
      let profileComment = null;
      let profileLink = null;
      if (!userNameForProfile && userId && !userContextService.isGuestId(userId)) {
        try {
          const userContext = await userContextService.getUserContext(userId);
          if (userContext) {
            userNameForProfile = userNameForProfile || userContext.name || null;
            if (!userTags && userContext.tagNames && userContext.tagNames.length > 0) {
              userTags = userContext.tagNames;
            }
            profileComment = userContext.comment || null;
            profileLink = userContext.link || null;
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
      } else if (userId && !userContextService.isGuestId(userId)) {
        try {
          const userContext = await userContextService.getUserContext(userId);
          if (userContext) {
            profileComment = userContext.comment || null;
            profileLink = userContext.link || null;
            if (!userTags && userContext.tagNames?.length) {
              userTags = userContext.tagNames;
            }
            if (!userNameForProfile && userContext.name) {
              userNameForProfile = userContext.name;
            }
          }
        } catch (_) {
          // ignore
        }
      }

      const userProfile = {
        id: userId,
        name: userNameForProfile || null,
        tags: turnCtx.isGuest ? [] : (turnCtx.crmTagNames || []),
        nameMissing: turnCtx.isGuest ? false : shouldAskForName,
        isGuest: turnCtx.isGuest,
        suggestedTags: turnCtx.isGuest ? [] : (profileAnalysis?.suggestedTags || []),
        comment: profileComment,
        link: profileLink
      };

      const enableTools = Boolean(userId && !userContextService.isGuestId(userId));

      const conversationMemoryService = require('./conversationMemoryService');
      const memoryKey = conversationMemoryService.buildMemoryKey({
        userId: userId && !userContextService.isGuestId(userId) ? userId : null,
        guestIdentifier: metadata?.guestIdentifier || null
      });
      if (memoryKey) {
        await conversationMemoryService.resetIfAudienceChanged(
          memoryKey,
          turnCtx.hasCrmAudience ? (turnCtx.audienceSlugs[0] || '') : ''
        );
      }
      const conversationMemory = memoryKey
        ? await conversationMemoryService.getSummary(memoryKey)
        : null;

      logger.info(`[AIAssistant] Вызов generateLLMResponse для пользователя ${userId}...`);
      const aiResponse = await generateLLMResponse({
        userQuestion: ingestQuestion,
        context: ragResult?.context || '',
        answer: ragResult?.answer || '',
        systemPrompt: aiSettings ? aiSettings.system_prompt : '',
        history: conversationHistory,
        model: aiSettings ? aiSettings.model : undefined,
        rules,
        selectedRagTables: aiSettings ? aiSettings.selected_rag_tables : [],
        userId: userId,
        multiSourceResults: searchResults,
        userTags: turnCtx.isGuest ? null : (turnCtx.crmTagNames.length ? turnCtx.crmTagNames : null),
        userProfile,
        enableTools,
        conversationMemory,
        media: ingestMedia,
        acceptInput,
        allowAsk: turnCtx.allowAsk,
        isGuest: turnCtx.isGuest,
        behaviorSettings: aiSettings || null,
        generateIfNoRag: aiAssistantRulesService.resolveGenerateIfNoRag(rules, {
          isGuest: turnCtx.isGuest
        })
      });

      logger.info(`[AIAssistant] generateLLMResponse вернул ответ типа: ${typeof aiResponse}`);

      if (typeof aiResponse === 'object' && aiResponse !== null && aiResponse.skipped) {
        return {
          success: false,
          skipped: true,
          reason: aiResponse.reason || 'accept_input_skipped'
        };
      }

      if (!aiResponse) {
        logger.warn(`[AIAssistant] Пустой ответ от AI для пользователя ${userId}`);
        return { success: false, reason: 'empty_response' };
      }

      let responseText = typeof aiResponse === 'object' && aiResponse !== null && 'text' in aiResponse
        ? aiResponse.text
        : aiResponse;
      const responseMedia = typeof aiResponse === 'object' && aiResponse !== null ? aiResponse.media : null;
      let multimodalUsed = typeof aiResponse === 'object' && aiResponse !== null ? aiResponse.multimodalUsed : undefined;
      let multimodalReason = typeof aiResponse === 'object' && aiResponse !== null ? aiResponse.multimodalReason : undefined;
      if (ingestMedia?.data && multimodalUsed === undefined) {
        multimodalUsed = false;
        multimodalReason = multimodalReason || 'model_text_only';
      }

      if (metadata.isGuest && ingestMedia?.data && !responseMedia && multimodalUsed === false) {
        const { fallbackGuestCopy } = require('./chatMultimodalService');
        const extra = fallbackGuestCopy();
        if (typeof responseText === 'string' && !responseText.includes(extra)) {
          responseText = `${responseText}\n\n${extra}`;
        }
      }

      if (memoryKey && typeof responseText === 'string') {
        conversationMemoryService.scheduleUpdate({
          memoryKey,
          userMessage: userQuestion,
          assistantMessage: responseText
        });
      }

      logger.info(`[AIAssistant] AI ответ успешно сгенерирован для пользователя ${userId}`);

      return {
        success: true,
        response: responseText,
        media: responseMedia || null,
        multimodalUsed,
        multimodalReason,
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
