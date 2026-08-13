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

/**
 * Централизованный сервис для управления всеми настройками AI
 * 
 * Принципы:
 * - Единый источник истины (таблица ai_config)
 * - Кэширование в памяти (TTL: 1 минута)
 * - Автоматическая инвалидация при изменении
 * - Приоритет источников: БД > ENV > хардкод
 */

const db = require('../db');
const logger = require('../utils/logger');

class AIConfigService {
  constructor() {
    // Кэш для настроек
    this.cache = null;
    this.cacheTimestamp = 0;
    this.CACHE_TTL = 60000; // 1 минута
    
    // Дефолтные значения (fallback)
    this.defaults = {
      ollama_base_url: process.env.OLLAMA_BASE_URL || 'http://ollama:11434',
      ollama_llm_model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b',
      ollama_preload_model: null,
      ollama_embedding_model: process.env.OLLAMA_EMBED_MODEL || process.env.OLLAMA_EMBEDDINGS_MODEL || 'mxbai-embed-large:latest',
      vector_search_url: process.env.VECTOR_SEARCH_URL || 'http://vector-search:8001',
      embedding_parameters: {
        batch_size: 32,
        normalize: true,
        dimension: null,
        pooling: 'mean'
      },
      llm_parameters: {
        temperature: 0.3,
        maxTokens: 150,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1
      },
      qwen_specific_parameters: {
        format: null
      },
      rag_settings: {
        threshold: 300,
        maxResults: 3,
        searchMethod: 'hybrid',
        relevanceThreshold: 0.1,
        keywordExtraction: {
          enabled: true,
          minWordLength: 3,
          maxKeywords: 10,
          removeStopWords: true,
          language: 'ru'
        },
        searchWeights: {
          semantic: 70,
          keyword: 30
        },
        advanced: {
          enableFuzzySearch: true,
          enableStemming: true,
          enableSynonyms: false
        }
      },
      cache_settings: {
        enabled: true,
        llmTTL: 86400000,
        ragTTL: 300000,
        maxSize: 1000
      },
      queue_settings: {
        enabled: true,
        timeout: 180000,
        maxSize: 100,
        interval: 100
      },
      timeouts: {
        ollamaChat: 600000,
        ollamaEmbedding: 90000,
        vectorSearch: 90000,
        vectorUpsert: 600000,
        vectorHealth: 5000,
        ollamaHealth: 5000,
        ollamaTags: 10000
      },
      rag_behavior: {
        upsertOnQuery: false,
        autoIndexOnTableChange: true,
        searchInDocuments: true
      },
      deduplication_settings: {
        enabled: true,
        ttl: 300000
      },
      dialog_settings: {
        historyTurns: 4,
        ragSnippetLength: 300,
        memorySnippetLength: 160,
        docSnippetLength: 350,
        memoryMaxChars: 900,
        compressEvery: 4,
        minCyrillicPercent: 10,
        maxMessageLength: 10000,
        languages: ['ru']
      },
      chunking_settings: {
        maxChunkSize: 1500,
        overlap: 200,
        llmThreshold: 8000,
        semanticMaxChunkSize: 1000,
        semanticMinChunkSize: 100
      }
    };
    /** @type {Set<Function>} */
    this._changeListeners = new Set();
  }

  /**
   * Deep-merge plain objects (JSONB columns). Arrays/ primitives replace.
   * @private
   */
  _deepMerge(base, patch) {
    if (patch === null || patch === undefined) return base;
    if (typeof patch !== 'object' || Array.isArray(patch)) return patch;
    const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
    for (const [k, v] of Object.entries(patch)) {
      if (v && typeof v === 'object' && !Array.isArray(v)
          && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = this._deepMerge(out[k], v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  onChange(listener) {
    if (typeof listener === 'function') this._changeListeners.add(listener);
    return () => this._changeListeners.delete(listener);
  }

  _emitChange(config) {
    for (const fn of this._changeListeners) {
      try { fn(config); } catch (e) { logger.warn('[aiConfigService] listener error:', e.message); }
    }
  }

  /**
   * Проверка актуальности кэша
   * @returns {boolean}
   */
  _isCacheValid() {
    if (!this.cache) return false;
    const now = Date.now();
    return (now - this.cacheTimestamp) < this.CACHE_TTL;
  }

  /**
   * Загрузить все настройки из БД
   * @returns {Promise<Object>} Полный объект настроек
   */
  async loadConfig() {
    try {
      const query = db.getQuery();
      const result = await query(
        'SELECT * FROM ai_config WHERE id = 1 LIMIT 1'
      );

      if (result.rows.length === 0) {
        logger.warn('[aiConfigService] Таблица ai_config пуста, используем дефолтные значения');
        // Создаем дефолтную запись
        await this._createDefaultConfig();
        return this.defaults;
      }

      const config = result.rows[0];
      
      // Парсим JSONB поля
      const parsedConfig = {
        ...config,
        embedding_parameters: config.embedding_parameters || this.defaults.embedding_parameters,
        llm_parameters: config.llm_parameters || this.defaults.llm_parameters,
        qwen_specific_parameters: config.qwen_specific_parameters || this.defaults.qwen_specific_parameters,
        rag_settings: config.rag_settings || this.defaults.rag_settings,
        cache_settings: config.cache_settings || this.defaults.cache_settings,
        queue_settings: config.queue_settings || this.defaults.queue_settings,
        timeouts: config.timeouts || this.defaults.timeouts,
        rag_behavior: { ...this.defaults.rag_behavior, ...(config.rag_behavior || {}) },
        deduplication_settings: config.deduplication_settings || this.defaults.deduplication_settings,
        dialog_settings: { ...this.defaults.dialog_settings, ...(config.dialog_settings || {}) },
        chunking_settings: { ...this.defaults.chunking_settings, ...(config.chunking_settings || {}) }
      };

      // Объединяем таймауты с дефолтами и при необходимости обновляем БД
      const existingTimeouts = parsedConfig.timeouts || {};
      const mergedTimeouts = { ...existingTimeouts };

      for (const [key, defaultValue] of Object.entries(this.defaults.timeouts)) {
        const rawValue = existingTimeouts[key];
        const numericValue = Number(rawValue);

        if (!Number.isFinite(numericValue) || numericValue < defaultValue) {
          mergedTimeouts[key] = defaultValue;
        } else {
          mergedTimeouts[key] = numericValue;
        }
      }

      const shouldPersistTimeouts = JSON.stringify(existingTimeouts) !== JSON.stringify(mergedTimeouts);
      parsedConfig.timeouts = mergedTimeouts;

      // Обновляем кэш
      this.cache = parsedConfig;
      this.cacheTimestamp = Date.now();

      if (shouldPersistTimeouts) {
        try {
          await query(
            'UPDATE ai_config SET timeouts = $1::jsonb, updated_at = NOW() WHERE id = 1',
            [JSON.stringify(mergedTimeouts)]
          );
          logger.info('[aiConfigService] Таймауты обновлены до актуальных значений по умолчанию');
        } catch (updateError) {
          logger.warn('[aiConfigService] Не удалось обновить таймауты в БД:', updateError.message);
        }
      }

      logger.info('[aiConfigService] Настройки загружены из БД');
      return parsedConfig;
    } catch (error) {
      logger.error('[aiConfigService] Ошибка загрузки настроек из БД:', error.message);
      // Возвращаем дефолтные значения в случае ошибки
      return this.defaults;
    }
  }

  /**
   * Создать дефолтную запись в БД
   * @private
   */
  async _createDefaultConfig() {
    try {
      const query = db.getQuery();
      await query(
        `INSERT INTO ai_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
      );
      logger.info('[aiConfigService] Создана дефолтная запись в ai_config');
    } catch (error) {
      logger.error('[aiConfigService] Ошибка создания дефолтной записи:', error.message);
    }
  }

  /**
   * Получить все настройки (с кэшированием)
   * @returns {Promise<Object>} Настройки
   */
  async getConfig() {
    if (this._isCacheValid()) {
      return this.cache;
    }
    return await this.loadConfig();
  }

  /**
   * Обновить настройки
   * @param {Object} updates - Обновления
   * @param {number} userId - ID пользователя (опционально)
   * @returns {Promise<Object>} Обновленные настройки
   */
  async updateConfig(updates, userId = null) {
    try {
      const query = db.getQuery();
      const current = await this.getConfig();
      const fields = [];
      const values = [];
      let paramIndex = 1;

      const jsonbKeys = new Set([
        'embedding_parameters', 'llm_parameters', 'qwen_specific_parameters',
        'rag_settings', 'cache_settings', 'queue_settings', 'timeouts',
        'rag_behavior', 'deduplication_settings', 'dialog_settings', 'chunking_settings'
      ]);

      for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'updated_at' || key === 'updated_by') continue;

        if (typeof value === 'object' && value !== null && !Array.isArray(value) && jsonbKeys.has(key)) {
          const base = current[key] || this.defaults[key] || {};
          const merged = this._deepMerge(base, value);
          fields.push(`${key} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(merged));
        } else if (typeof value === 'object' && value !== null) {
          fields.push(`${key} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }

      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        if (userId) {
          fields.push(`updated_by = $${paramIndex}`);
          values.push(userId);
        }

        const sql = `UPDATE ai_config SET ${fields.join(', ')} WHERE id = 1`;
        await query(sql, values);

        this.invalidateCache();
        const loaded = await this.loadConfig();
        this._emitChange(loaded);
        try {
          const ollamaConfig = require('./ollamaConfig');
          if (typeof ollamaConfig.clearCache === 'function') ollamaConfig.clearCache();
        } catch (_) { /* optional */ }

        logger.info('[aiConfigService] Настройки обновлены');
        return loaded;
      }

      return await this.getConfig();
    } catch (error) {
      logger.error('[aiConfigService] Ошибка обновления настроек:', error.message);
      throw error;
    }
  }

  /**
   * Инвалидация кэша (принудительная перезагрузка)
   */
  invalidateCache() {
    this.cache = null;
    this.cacheTimestamp = 0;
    logger.debug('[aiConfigService] Кэш инвалидирован');
  }

  // ============================================
  // МЕТОДЫ ДЛЯ КОНКРЕТНЫХ КАТЕГОРИЙ
  // ============================================

  /**
   * Получить настройки Ollama
   * @returns {Promise<Object>}
   */
  async getOllamaConfig() {
    const config = await this.getConfig();
    return {
      baseUrl: config.ollama_base_url || this.defaults.ollama_base_url,
      llmModel: config.ollama_llm_model || this.defaults.ollama_llm_model,
      preloadModel: config.ollama_preload_model || null,
      embeddingModel: config.ollama_embedding_model || this.defaults.ollama_embedding_model
    };
  }

  /**
   * Получить RAG настройки
   * @returns {Promise<Object>}
   */
  async getRAGConfig() {
    const config = await this.getConfig();
    return config.rag_settings || this.defaults.rag_settings;
  }

  /**
   * Получить LLM параметры (общие)
   * @returns {Promise<Object>}
   */
  async getLLMParameters() {
    const config = await this.getConfig();
    return config.llm_parameters || this.defaults.llm_parameters;
  }

  /**
   * Получить специфичные параметры qwen
   * @returns {Promise<Object>}
   */
  async getQwenSpecificParameters() {
    const config = await this.getConfig();
    return config.qwen_specific_parameters || this.defaults.qwen_specific_parameters;
  }

  /**
   * Получить настройки кэша
   * @returns {Promise<Object>}
   */
  async getCacheConfig() {
    const config = await this.getConfig();
    return config.cache_settings || this.defaults.cache_settings;
  }

  /**
   * Получить настройки очереди
   * @returns {Promise<Object>}
   */
  async getQueueConfig() {
    const config = await this.getConfig();
    return config.queue_settings || this.defaults.queue_settings;
  }

  /**
   * Получить таймауты
   * @returns {Promise<Object>}
   */
  async getTimeouts() {
    const config = await this.getConfig();
    return config.timeouts || this.defaults.timeouts;
  }

  /**
   * Получить настройки дедупликации
   * @returns {Promise<Object>}
   */
  async getDeduplicationConfig() {
    const config = await this.getConfig();
    return config.deduplication_settings || this.defaults.deduplication_settings;
  }

  /**
   * Получить настройки embedding модели
   * @returns {Promise<Object>}
   */
  async getEmbeddingParameters() {
    const config = await this.getConfig();
    return config.embedding_parameters || this.defaults.embedding_parameters;
  }

  /**
   * Получить настройки Vector Search
   * @returns {Promise<Object>}
   */
  async getVectorSearchConfig() {
    const config = await this.getConfig();
    return {
      url: config.vector_search_url || this.defaults.vector_search_url
    };
  }

  /**
   * Получить настройки RAG поведения
   * @returns {Promise<Object>}
   */
  async getRAGBehavior() {
    const config = await this.getConfig();
    return { ...this.defaults.rag_behavior, ...(config.rag_behavior || {}) };
  }

  async getDialogSettings() {
    const config = await this.getConfig();
    return { ...this.defaults.dialog_settings, ...(config.dialog_settings || {}) };
  }

  async getChunkingSettings() {
    const config = await this.getConfig();
    return { ...this.defaults.chunking_settings, ...(config.chunking_settings || {}) };
  }

  /**
   * Hybrid weights from rag_settings.searchWeights (UI stores 0–100 or 0–1).
   */
  resolveHybridWeights(ragSettings = null) {
    const rs = ragSettings || this.defaults.rag_settings;
    const sw = (rs && rs.searchWeights) || this.defaults.rag_settings.searchWeights;
    let semantic = Number(sw.semantic);
    let keyword = Number(sw.keyword);
    if (!Number.isFinite(semantic)) semantic = 70;
    if (!Number.isFinite(keyword)) keyword = 30;
    if (semantic > 1 || keyword > 1) {
      const sum = semantic + keyword || 100;
      return { semantic: semantic / sum, keyword: keyword / sum, raw: sw };
    }
    const sum = semantic + keyword || 1;
    return { semantic: semantic / sum, keyword: keyword / sum, raw: sw };
  }
}

// Экспортируем singleton экземпляр
const aiConfigService = new AIConfigService();

module.exports = aiConfigService;

