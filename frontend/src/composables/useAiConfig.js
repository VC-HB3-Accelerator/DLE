/**
 * Централизованный load/save ai_config (TZ_AI_RAG_SETTINGS_PAGE).
 * Save per tab: отправляем полный объект колонки (сервер deep-merge JSONB).
 */
import { reactive, ref } from 'vue';
import axios from 'axios';

const defaults = () => ({
  ollama_base_url: 'http://ollama:11434',
  ollama_llm_model: 'qwen2.5:1.5b',
  ollama_embedding_model: 'mxbai-embed-large:latest',
  vector_search_url: 'http://vector-search:8001',
  rag_settings: {
    threshold: 300,
    searchMethod: 'hybrid',
    maxResults: 3,
    searchWeights: { semantic: 70, keyword: 30 }
  },
  llm_parameters: {
    temperature: 0.3,
    maxTokens: 150,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.1
  },
  qwen_specific_parameters: { format: null },
  embedding_parameters: {
    batch_size: 32,
    normalize: true,
    dimension: null,
    pooling: 'mean'
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
  deduplication_settings: {
    enabled: true,
    ttl: 300000
  },
  rag_behavior: {
    upsertOnQuery: false,
    autoIndexOnTableChange: true,
    searchInDocuments: true
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
});

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch ?? base;
  const out = { ...(base && typeof base === 'object' ? base : {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)
        && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function useAiConfig() {
  const config = reactive(defaults());
  const runtime = ref(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref(null);
  const lastSavedAt = ref(null);

  async function load() {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await axios.get('/settings/ai-config');
      if (data?.success && data.config) {
        const d = defaults();
        Object.assign(config, {
          ollama_base_url: data.config.ollama_base_url || d.ollama_base_url,
          ollama_llm_model: data.config.ollama_llm_model || d.ollama_llm_model,
          ollama_embedding_model: data.config.ollama_embedding_model || d.ollama_embedding_model,
          vector_search_url: data.config.vector_search_url || d.vector_search_url,
          rag_settings: deepMerge(d.rag_settings, data.config.rag_settings || {}),
          llm_parameters: deepMerge(d.llm_parameters, data.config.llm_parameters || {}),
          qwen_specific_parameters: deepMerge(d.qwen_specific_parameters, data.config.qwen_specific_parameters || {}),
          embedding_parameters: deepMerge(d.embedding_parameters, data.config.embedding_parameters || {}),
          cache_settings: deepMerge(d.cache_settings, data.config.cache_settings || {}),
          queue_settings: deepMerge(d.queue_settings, data.config.queue_settings || {}),
          deduplication_settings: deepMerge(d.deduplication_settings, data.config.deduplication_settings || {}),
          rag_behavior: deepMerge(d.rag_behavior, data.config.rag_behavior || {}),
          timeouts: deepMerge(d.timeouts, data.config.timeouts || {}),
          dialog_settings: deepMerge(d.dialog_settings, data.config.dialog_settings || {}),
          chunking_settings: deepMerge(d.chunking_settings, data.config.chunking_settings || {})
        });
      }
      await loadRuntime();
    } catch (e) {
      error.value = e?.response?.data?.error || e.message || 'load failed';
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function loadRuntime() {
    try {
      const { data } = await axios.get('/settings/ai-config/runtime-status');
      if (data?.success) runtime.value = data.runtime;
    } catch (_) {
      runtime.value = null;
    }
  }

  /**
   * @param {Record<string, unknown>} payload — partial ai_config fields (полные JSONB-объекты колонок)
   */
  async function save(payload) {
    saving.value = true;
    error.value = null;
    try {
      const { data } = await axios.put('/settings/ai-config', payload);
      if (data?.success && data.config) {
        // refresh local from server
        await load();
        lastSavedAt.value = Date.now();
      }
      return data;
    } catch (e) {
      error.value = e?.response?.data?.error || e.message || 'save failed';
      throw e;
    } finally {
      saving.value = false;
    }
  }

  return {
    config,
    runtime,
    loading,
    saving,
    error,
    lastSavedAt,
    load,
    loadRuntime,
    save
  };
}
