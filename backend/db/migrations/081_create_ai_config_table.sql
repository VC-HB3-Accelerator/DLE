-- UP Migration
-- Создание централизованной таблицы настроек AI
-- Эта таблица объединяет все настройки AI системы в одном месте

CREATE TABLE IF NOT EXISTS ai_config (
  id INT PRIMARY KEY DEFAULT 1,
  
  -- ============================================
  -- OLLAMA НАСТРОЙКИ
  -- ============================================
  ollama_base_url TEXT NOT NULL DEFAULT 'http://ollama:11434',
  ollama_llm_model TEXT NOT NULL DEFAULT 'qwen2.5:7b',
  ollama_embedding_model TEXT NOT NULL DEFAULT 'mxbai-embed-large:latest',
  
  -- ============================================
  -- VECTOR SEARCH НАСТРОЙКИ
  -- ============================================
  vector_search_url TEXT NOT NULL DEFAULT 'http://vector-search:8001',
  
  -- ============================================
  -- EMBEDDING МОДЕЛЬ НАСТРОЙКИ
  -- ============================================
  embedding_parameters JSONB NOT NULL DEFAULT '{
    "batch_size": 32,
    "normalize": true,
    "dimension": null,
    "pooling": "mean"
  }',
  
  -- ============================================
  -- LLM ПАРАМЕТРЫ (общие для всех моделей)
  -- ============================================
  llm_parameters JSONB NOT NULL DEFAULT '{
    "temperature": 0.3,
    "maxTokens": 150,
    "top_p": 0.9,
    "top_k": 40,
    "repeat_penalty": 1.1
  }',
  
  -- ============================================
  -- QWEN СПЕЦИФИЧНЫЕ ПАРАМЕТРЫ
  -- ============================================
  qwen_specific_parameters JSONB NOT NULL DEFAULT '{
    "format": null
  }',
  
  -- ============================================
  -- RAG НАСТРОЙКИ
  -- ============================================
  rag_settings JSONB NOT NULL DEFAULT '{
    "threshold": 300,
    "maxResults": 3,
    "searchMethod": "hybrid",
    "relevanceThreshold": 0.1,
    "keywordExtraction": {
      "enabled": true,
      "minWordLength": 3,
      "maxKeywords": 10,
      "removeStopWords": true,
      "language": "ru"
    },
    "searchWeights": {
      "semantic": 70,
      "keyword": 30
    },
    "advanced": {
      "enableFuzzySearch": true,
      "enableStemming": true,
      "enableSynonyms": false
    }
  }',
  
  -- ============================================
  -- CACHE НАСТРОЙКИ
  -- ============================================
  cache_settings JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "llmTTL": 86400000,
    "ragTTL": 300000,
    "maxSize": 1000
  }',
  
  -- ============================================
  -- QUEUE НАСТРОЙКИ
  -- ============================================
  queue_settings JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "timeout": 180000,
    "maxSize": 100,
    "interval": 100
  }',
  
  -- ============================================
  -- TIMEOUTS (для всех сервисов)
  -- ============================================
  timeouts JSONB NOT NULL DEFAULT '{
    "ollamaChat": 180000,
    "ollamaEmbedding": 90000,
    "vectorSearch": 90000,
    "vectorUpsert": 90000,
    "vectorHealth": 5000,
    "ollamaHealth": 5000,
    "ollamaTags": 10000
  }',
  
  -- ============================================
  -- RAG ПОВЕДЕНИЕ
  -- ============================================
  rag_behavior JSONB NOT NULL DEFAULT '{
    "upsertOnQuery": false,
    "autoIndexOnTableChange": true
  }',
  
  -- ============================================
  -- DEDUPLICATION НАСТРОЙКИ
  -- ============================================
  deduplication_settings JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "ttl": 300000
  }',
  
  -- ============================================
  -- МЕТАДАННЫЕ
  -- ============================================
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INT,
  
  CONSTRAINT ai_config_single_row CHECK (id = 1)
);

-- Создаем единственную строку с дефолтными значениями
INSERT INTO ai_config (id) 
VALUES (1) 
ON CONFLICT (id) DO NOTHING;

-- Комментарии к таблице
COMMENT ON TABLE ai_config IS 'Централизованная таблица настроек AI системы';
COMMENT ON COLUMN ai_config.ollama_base_url IS 'Базовый URL для Ollama API';
COMMENT ON COLUMN ai_config.ollama_llm_model IS 'Название LLM модели (например: qwen2.5:7b)';
COMMENT ON COLUMN ai_config.ollama_embedding_model IS 'Название embedding модели (например: mxbai-embed-large:latest)';
COMMENT ON COLUMN ai_config.vector_search_url IS 'URL для сервиса векторного поиска';
COMMENT ON COLUMN ai_config.embedding_parameters IS 'Параметры embedding модели (batch_size, normalize, dimension, pooling)';
COMMENT ON COLUMN ai_config.llm_parameters IS 'Общие параметры LLM (temperature, maxTokens, top_p, top_k, repeat_penalty)';
COMMENT ON COLUMN ai_config.qwen_specific_parameters IS 'Специфичные параметры для модели qwen (например: format: "json")';
COMMENT ON COLUMN ai_config.rag_settings IS 'Настройки RAG поиска (threshold, maxResults, searchMethod, etc.)';
COMMENT ON COLUMN ai_config.cache_settings IS 'Настройки кэширования (enabled, llmTTL, ragTTL, maxSize)';
COMMENT ON COLUMN ai_config.queue_settings IS 'Настройки очереди запросов (enabled, timeout, maxSize, interval)';
COMMENT ON COLUMN ai_config.timeouts IS 'Таймауты для всех AI операций';
COMMENT ON COLUMN ai_config.rag_behavior IS 'Поведение RAG (upsertOnQuery, autoIndexOnTableChange)';
COMMENT ON COLUMN ai_config.deduplication_settings IS 'Настройки дедупликации сообщений (enabled, ttl)';

-- DOWN Migration
-- DROP TABLE IF EXISTS ai_config;

