/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 *
 * Выбор провайдера / модели / размерности для RAG embeddings.
 * Cloud (Qwen DashScope, OpenAI) — API, без ollama pull.
 */

const axios = require('axios');
const logger = require('../utils/logger');

const ALLOWED_DIMS = [512, 768, 1024, 1536, 2048, 3072];

const CLOUD_EMBED_FALLBACKS = {
  qwencloud: ['text-embedding-v4', 'text-embedding-v3', 'text-embedding-v2'],
  openai: ['text-embedding-3-large', 'text-embedding-3-small', 'text-embedding-ada-002']
};

const MODEL_DIMS = {
  'text-embedding-v4': [512, 768, 1024, 1536, 2048],
  'text-embedding-v3': [512, 768, 1024],
  'text-embedding-v2': [1536],
  'text-embedding-3-small': [512, 768, 1024, 1536],
  'text-embedding-3-large': [256, 1024, 1536, 3072],
  'text-embedding-ada-002': [1536]
};

const MODEL_DEFAULT_DIM = {
  'text-embedding-v4': 1024,
  'text-embedding-v3': 1024,
  'text-embedding-v2': 1536,
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536
};

function isEmbeddingModelName(name) {
  const n = String(name || '').toLowerCase();
  if (!n) return false;
  return n.includes('embed')
    || n.includes('bge')
    || n.includes('nomic')
    || n.includes('mxbai')
    || n.includes('sentence')
    || n.includes('e5-');
}

function modelKey(model) {
  return String(model || '').trim().toLowerCase().replace(/:latest$/i, '');
}

function lookupModelTable(table, model, fallback) {
  const key = modelKey(model);
  const ids = Object.keys(table).sort((a, b) => b.length - a.length);
  for (const id of ids) {
    if (key === id || key.endsWith(`/${id}`) || key.startsWith(`${id}-`)) {
      return table[id];
    }
  }
  return fallback;
}

function allowedDimsFor(provider, model) {
  if (String(provider || '') === 'ollama') return [1024];
  const dims = lookupModelTable(MODEL_DIMS, model, ALLOWED_DIMS);
  return dims.filter((d) => ALLOWED_DIMS.includes(d));
}

function defaultDimensionFor(provider, model) {
  if (String(provider || '') === 'ollama') return 1024;
  return lookupModelTable(MODEL_DEFAULT_DIM, model, 1024);
}

function normalizeDimension(raw, fallback = 1024) {
  const n = Number(raw);
  if (Number.isInteger(n) && ALLOWED_DIMS.includes(n)) return n;
  const fb = Number(fallback);
  return Number.isInteger(fb) && ALLOWED_DIMS.includes(fb) ? fb : 1024;
}

function parseVectorFormatType(typ) {
  const m = String(typ || '').match(/vector\s*\(\s*(\d+)\s*\)/i);
  return m ? Number(m[1]) : null;
}

function embeddingsCreatePayload({ model, input, dimension, provider }) {
  const payload = { model, input };
  const dims = allowedDimsFor(provider, model);
  const dim = Number(dimension);
  if (dims.length > 1 && dims.includes(dim)) {
    payload.dimensions = dim;
  }
  return payload;
}

function uniqueModels(list) {
  const out = [];
  const seen = new Set();
  for (const model of list || []) {
    const id = String(model?.id || model?.name || '').trim();
    const provider = String(model?.provider || '').trim();
    if (!id || !provider) continue;
    const key = `${provider}:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id,
      provider,
      dims: Array.isArray(model.dims) ? model.dims : allowedDimsFor(provider, id)
    });
  }
  return out;
}

function ollamaConfig() {
  return require('./ollamaConfig');
}

function providerSettings() {
  return require('./aiProviderSettingsService');
}

function openaiProxy() {
  return require('./openaiProxy');
}

async function listOllamaEmbeddingModels() {
  try {
    const ollama = ollamaConfig();
    const ollamaUrl = ollama.getBaseUrl();
    const timeouts = ollama.getTimeouts();
    const response = await axios.get(`${ollamaUrl}/api/tags`, {
      timeout: timeouts.ollamaTags || 10000
    });
    const models = response.data?.models || [];
    return models
      .filter((m) => isEmbeddingModelName(m.name))
      .map((m) => ({ id: m.name, provider: 'ollama', dims: [1024] }));
  } catch (err) {
    logger.warn('[embeddingRuntime] ollama /api/tags:', err.message);
    return [{ id: 'mxbai-embed-large:latest', provider: 'ollama', dims: [1024] }];
  }
}

async function listCloudEmbeddingModels(provider) {
  const fallbacks = CLOUD_EMBED_FALLBACKS[provider] || [];
  const svc = providerSettings();
  const settings = await svc.getProviderSettings(provider);
  const hasKey = Boolean(settings?.api_key);
  if (!hasKey) {
    return { available: false, models: [] };
  }
  let listed = [];
  try {
    listed = await svc.getProviderModels(provider, settings);
  } catch (err) {
    logger.warn(`[embeddingRuntime] ${provider} models:`, err.message);
  }
  const fromApi = (listed || [])
    .map((m) => ({ id: m.id || m.name, provider }))
    .filter((m) => isEmbeddingModelName(m.id));
  const merged = [...fromApi];
  for (const id of fallbacks) {
    if (!merged.some((m) => String(m.id) === id)) {
      merged.push({ id, provider });
    }
  }
  const saved = String(settings.embedding_model || '').trim();
  if (saved && !merged.some((m) => String(m.id) === saved)) {
    merged.unshift({ id: saved, provider });
  }
  return {
    available: true,
    models: merged.map((m) => ({
      id: m.id,
      provider,
      dims: allowedDimsFor(provider, m.id)
    }))
  };
}

async function listCatalog() {
  const ollamaModels = await listOllamaEmbeddingModels();
  const qwen = await listCloudEmbeddingModels('qwencloud');
  const openai = await listCloudEmbeddingModels('openai');
  const providers = [
    { id: 'ollama', available: true },
    { id: 'qwencloud', available: qwen.available },
    { id: 'openai', available: openai.available }
  ];
  const models = uniqueModels([
    ...ollamaModels,
    ...qwen.models,
    ...openai.models
  ]);
  return { providers, models, allowedDims: ALLOWED_DIMS };
}

async function resolveRuntime(deps = {}) {
  const aiConfigService = deps.aiConfigService || require('./aiConfigService');
  const params = await aiConfigService.getEmbeddingParameters();
  const ollamaCfg = await aiConfigService.getOllamaConfig();
  const provider = String(params?.provider || 'ollama').trim().toLowerCase() || 'ollama';
  let model = String(params?.model || '').trim();
  if (!model) {
    if (provider === 'ollama') {
      model = ollamaCfg?.embeddingModel || 'mxbai-embed-large:latest';
    } else {
      model = (CLOUD_EMBED_FALLBACKS[provider] || [])[0] || '';
    }
  }
  const dims = allowedDimsFor(provider, model);
  const fallbackDim = defaultDimensionFor(provider, model);
  const requested = normalizeDimension(params?.dimension, fallbackDim);
  const dimension = dims.includes(requested)
    ? requested
    : (dims.includes(fallbackDim) ? fallbackDim : (dims[0] || 1024));
  const batchSize = Math.min(128, Math.max(1, Number(params?.batch_size) || 8));
  return {
    provider,
    model,
    dimension,
    batchSize,
    normalize: params?.normalize !== false,
    pooling: params?.pooling || 'mean'
  };
}

async function createCloudEmbedClient(provider) {
  const svc = providerSettings();
  const settings = await svc.getProviderSettings(provider);
  if (provider === 'qwencloud') {
    return svc.createQwenCloudClient(settings);
  }
  if (provider === 'openai') {
    return openaiProxy().createOpenAIClient(settings);
  }
  const err = new Error(`Embeddings: провайдер ${provider} не поддерживается`);
  err.status = 400;
  throw err;
}

function collectCloudVectors(res) {
  const data = res?.data;
  if (!Array.isArray(data)) return [];
  return data
    .slice()
    .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
    .map((item) => item.embedding)
    .filter((v) => Array.isArray(v) && v.length);
}

async function embedTextsOllama(texts, runtime) {
  const ollama = ollamaConfig();
  const ollamaUrl = ollama.getBaseUrl();
  const timeouts = ollama.getTimeouts();
  const timeoutMs = Math.max(timeouts.ollamaEmbedding || 0, 300000);
  const batchSize = Math.min(runtime.batchSize || 4, 8);
  const vectors = [];

  async function embedBatch(batch) {
    try {
      const res = await axios.post(`${ollamaUrl}/api/embed`, {
        model: runtime.model,
        input: batch
      }, { timeout: timeoutMs });
      const part = res.data?.embeddings || res.data?.embedding || [];
      if (!Array.isArray(part) || part.length !== batch.length) {
        throw new Error('Ollama /api/embed вернул пустые embeddings');
      }
      return part;
    } catch (err) {
      const timedOut = /timeout/i.test(String(err.message || '')) || err.code === 'ECONNABORTED';
      if (timedOut && batch.length > 1) {
        const mid = Math.ceil(batch.length / 2);
        const left = await embedBatch(batch.slice(0, mid));
        const right = await embedBatch(batch.slice(mid));
        return [...left, ...right];
      }
      throw err;
    }
  }

  for (let i = 0; i < texts.length; i += batchSize) {
    vectors.push(...await embedBatch(texts.slice(i, i + batchSize)));
  }
  return vectors;
}

async function embedTextsCloud(texts, runtime, deps = {}) {
  const client = deps.createClient
    ? await deps.createClient(runtime.provider)
    : await createCloudEmbedClient(runtime.provider);
  const timeoutMs = 180000;
  const providerCap = runtime.provider === 'qwencloud' ? 10 : 16;
  const batchSize = Math.min(runtime.batchSize || 8, providerCap);
  const vectors = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const payload = embeddingsCreatePayload({
      model: runtime.model,
      input: batch,
      dimension: runtime.dimension,
      provider: runtime.provider
    });
    const res = await client.embeddings.create(payload, { timeout: timeoutMs });
    const part = collectCloudVectors(res);
    if (part.length !== batch.length) {
      throw new Error(`${runtime.provider} embeddings.create вернул пустые embeddings`);
    }
    vectors.push(...part);
  }
  return vectors;
}

function assertVectorDim(vectors, dimension) {
  const dim = Number(dimension);
  if (!vectors.length) return;
  const got = Array.isArray(vectors[0]) ? vectors[0].length : 0;
  if (dim && got && got !== dim) {
    throw new Error(`Embedding dim ${got} не совпадает с настройкой ${dim}`);
  }
}

async function embedTexts(texts, deps = {}) {
  const raw = Array.isArray(texts) ? texts.map((t) => String(t || '')) : [];
  const inputs = [];
  const indexMap = [];
  raw.forEach((text, i) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    indexMap.push(i);
    inputs.push(trimmed);
  });
  if (!inputs.length) {
    return {
      model: null,
      vectors: raw.map(() => null),
      provider: null,
      dimension: null
    };
  }
  const runtime = deps.runtime || await resolveRuntime(deps);
  const embedded = runtime.provider === 'ollama'
    ? await embedTextsOllama(inputs, runtime)
    : await embedTextsCloud(inputs, runtime, deps);
  if (embedded.length !== inputs.length) {
    throw new Error(`embed count ${embedded.length} != texts ${inputs.length}`);
  }
  assertVectorDim(embedded, runtime.dimension);
  const vectors = raw.map(() => null);
  embedded.forEach((vec, j) => {
    vectors[indexMap[j]] = vec;
  });
  return {
    model: runtime.model,
    provider: runtime.provider,
    dimension: runtime.dimension,
    vectors
  };
}

module.exports = {
  ALLOWED_DIMS,
  CLOUD_EMBED_FALLBACKS,
  isEmbeddingModelName,
  allowedDimsFor,
  defaultDimensionFor,
  normalizeDimension,
  parseVectorFormatType,
  embeddingsCreatePayload,
  listCatalog,
  resolveRuntime,
  embedTexts
};
