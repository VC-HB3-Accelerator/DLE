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
      ollama_llm_model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
      ollama_embedding_model: process.env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large:latest',
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
        autoIndexOnTableChange: true
      },
      deduplication_settings: {
        enabled: true,
        ttl: 300000
      }
    };
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
        rag_behavior: config.rag_behavior || this.defaults.rag_behavior,
        deduplication_settings: config.deduplication_settings || this.defaults.deduplication_settings
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
      const fields = [];
      const values = [];
      let paramIndex = 1;

      // Строим SET часть запроса
      for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'updated_at' || key === 'updated_by') continue;
        
        if (typeof value === 'object' && value !== null) {
          // JSONB поля
          fields.push(`${key} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }

      // Добавляем updated_at и updated_by
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        if (userId) {
          fields.push(`updated_by = $${paramIndex}`);
          values.push(userId);
        }

        const sql = `UPDATE ai_config SET ${fields.join(', ')} WHERE id = 1`;
        await query(sql, values);

        // Инвалидируем кэш
        this.invalidateCache();

        logger.info('[aiConfigService] Настройки обновлены');
        return await this.loadConfig();
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
    return config.rag_behavior || this.defaults.rag_behavior;
  }
}

// Экспортируем singleton экземпляр
const aiConfigService = new AIConfigService();

module.exports = aiConfigService;

