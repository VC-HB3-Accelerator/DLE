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

const encryptedDb = require('./encryptedDatabaseService');
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const axios = require('axios');
const ollamaConfig = require('./ollamaConfig');
const openaiProxy = require('./openaiProxy');
const blancVpnService = require('./blancVpnService');

const TABLE = 'ai_providers_settings';
const TIMEOUTS = ollamaConfig.getTimeouts();
const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com';
const QWENCLOUD_DEFAULT_BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

/** DashScope / Model Studio часто не отдаёт полный /models — запасной список для UI. */
const QWENCLOUD_FALLBACK_MODELS = [
  'qwen-plus',
  'qwen-turbo',
  'qwen-max',
  'qwen-flash',
  'qwen3.5-plus',
  'qwen3-max',
  'qwen3.7-plus',
  'qwen3.8-max',
  'qwen-omni-turbo',
  'qwen3.5-omni-flash',
  'qwen3.5-omni-plus',
  'qwen3.5-omni-flash-realtime',
  'qwen3.5-omni-plus-realtime',
  'qwen3-asr-flash',
  'qwen-audio-3.0-tts-plus'
];

function resolveDeepseekBaseUrl(base_url) {
  const trimmed = String(base_url || '').trim();
  return trimmed || DEEPSEEK_DEFAULT_BASE_URL;
}

function resolveQwenCloudBaseUrl(base_url) {
  const trimmed = String(base_url || '').trim();
  return trimmed || QWENCLOUD_DEFAULT_BASE_URL;
}

function mapOpenAiModelsList(res) {
  return res?.data ? res.data.map((m) => ({ id: m.id, ...m })) : [];
}

function qwenCloudFallbackModels() {
  return QWENCLOUD_FALLBACK_MODELS.map((id) => ({ id }));
}

/** DeepSeek — OpenAI-compatible API, без openai proxy/Blanc. */
function createDeepseekClient(settings) {
  if (!settings?.api_key) {
    const err = new Error('DeepSeek API key не настроен');
    err.status = 400;
    err.code = 'DEEPSEEK_KEY_MISSING';
    throw err;
  }
  return new OpenAI({
    apiKey: settings.api_key,
    baseURL: resolveDeepseekBaseUrl(settings.base_url)
  });
}

/** Qwen Cloud / DashScope — OpenAI-compatible API, без openai proxy/Blanc. */
function createQwenCloudClient(settings) {
  if (!settings?.api_key) {
    const err = new Error('Qwen Cloud API key не настроен');
    err.status = 400;
    err.code = 'QWENCLOUD_KEY_MISSING';
    throw err;
  }
  return new OpenAI({
    apiKey: settings.api_key,
    baseURL: resolveQwenCloudBaseUrl(settings.base_url)
  });
}

function createOpenAiCompatibleProviderClient(provider, settings) {
  if (provider === 'deepseek') return createDeepseekClient(settings);
  if (provider === 'qwencloud') return createQwenCloudClient(settings);
  throw new Error(`Неизвестный OpenAI-compatible провайдер: ${provider}`);
}

async function getProviderSettings(provider) {
  const settings = await encryptedDb.getData(TABLE, { provider: provider }, 1);
  return settings[0] || null;
}

async function upsertProviderSettings({
  provider,
  api_key,
  base_url,
  selected_model,
  embedding_model,
  proxy_url,
  proxy_enabled,
  blanc_subscription_url,
  proxy_openai,
  proxy_telegram
}) {
  const data = {
    provider: provider,
    api_key: api_key,
    base_url: base_url,
    selected_model: selected_model,
    embedding_model: embedding_model,
    updated_at: new Date()
  };

  if (provider === 'openai') {
    if (proxy_url !== undefined) {
      data.proxy_url = proxy_url ? openaiProxy.normalizeProxyUrl(proxy_url) : '';
      if (data.proxy_url && !blancVpnService.isBlancSubscriptionUrl(data.proxy_url)) {
        openaiProxy.assertManualProxyUrl(data.proxy_url);
      }
    }
    if (proxy_enabled !== undefined) {
      data.proxy_enabled = Boolean(proxy_enabled);
    }
    if (blanc_subscription_url !== undefined) {
      const sub = String(blanc_subscription_url || '').trim();
      if (sub) {
        blancVpnService.assertBlancSubscriptionUrl(sub);
        data.blanc_subscription_url = sub;
      } else {
        data.blanc_subscription_url = '';
      }
    }
    if (proxy_openai !== undefined) {
      data.proxy_openai = Boolean(proxy_openai);
    }
    if (proxy_telegram !== undefined) {
      data.proxy_telegram = Boolean(proxy_telegram);
    }
  }

  // Проверяем, существует ли запись
  const existing = await encryptedDb.getData(TABLE, { provider: provider }, 1);

  let saved;
  if (existing.length > 0) {
    saved = await encryptedDb.saveData(TABLE, data, { id: existing[0].id });
  } else {
    saved = await encryptedDb.saveData(TABLE, data);
  }

  // После сохранения — обновить Xray config из Blanc subscription
  if (provider === 'openai') {
    const merged = {
      ...(existing[0] || {}),
      ...data,
      proxy_enabled: data.proxy_enabled !== undefined
        ? data.proxy_enabled
        : Boolean(existing[0]?.proxy_enabled),
      blanc_subscription_url: data.blanc_subscription_url !== undefined
        ? data.blanc_subscription_url
        : (existing[0]?.blanc_subscription_url || '')
    };
    if (merged.proxy_enabled && merged.blanc_subscription_url) {
      try {
        await blancVpnService.applySubscription(merged.blanc_subscription_url);
      } catch (e) {
        const err = new Error(`BlancVPN: ${e.message}`);
        err.status = e.status || 502;
        throw err;
      }
    }
  }

  return saved || (await getProviderSettings(provider));
}

async function deleteProviderSettings(provider) {
  await encryptedDb.deleteData(TABLE, { provider: provider });
}

async function getProviderModels(provider, settings = {}) {
  try {
    if (provider === 'openai') {
      const client = openaiProxy.createOpenAIClient({
        api_key: settings.api_key,
        base_url: settings.base_url,
        proxy_url: settings.proxy_url,
        proxy_enabled: settings.proxy_enabled,
        blanc_subscription_url: settings.blanc_subscription_url,
        proxy_openai: settings.proxy_openai,
        proxy_telegram: settings.proxy_telegram
      });
      const res = await client.models.list();
      return res.data ? res.data.map(m => ({ id: m.id, ...m })) : [];
    }
    if (provider === 'deepseek') {
      const client = createDeepseekClient(settings);
      const res = await client.models.list();
      return mapOpenAiModelsList(res);
    }
    if (provider === 'qwencloud') {
      const client = createQwenCloudClient(settings);
      let listed = [];
      try {
        const res = await client.models.list();
        listed = mapOpenAiModelsList(res);
      } catch (listErr) {
        const logger = require('../utils/logger');
        logger.warn(`[aiProviderSettings] qwencloud models.list fallback: ${listErr.message}`);
      }
      const fallback = qwenCloudFallbackModels();
      const merged = listed.length ? [...listed] : [...fallback];
      for (const fb of fallback) {
        if (!merged.some((m) => String(m.id) === String(fb.id))) {
          merged.push(fb);
        }
      }
      const selected = String(settings.selected_model || '').trim();
      if (selected && !merged.some((m) => String(m.id) === selected)) {
        merged.unshift({ id: selected });
      }
      return merged;
    }
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey: settings.api_key, baseURL: settings.base_url });
      const res = await client.models.list();
      return res.data ? res.data.map(m => ({ id: m.id, ...m })) : [];
    }
    if (provider === 'google') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: settings.api_key, baseUrl: settings.base_url });
      const pager = await ai.models.list();
      const models = [];
      for await (const model of pager) {
        models.push(model);
      }
      return models;
    }
    if (provider === 'ollama') {
      const baseUrl = settings.base_url || ollamaConfig.getBaseUrl();
      const response = await axios.get(`${baseUrl}/api/tags`, {
        timeout: TIMEOUTS.ollamaTags || 15000
      });
      return (response.data?.models || []).map((m) => ({
        id: m.name,
        name: m.name
      }));
    }
    return [];
  } catch (error) {
    const logger = require('../utils/logger');
    logger.warn(`[aiProviderSettings] getProviderModels(${provider}):`, error.message);
    return [];
  }
}

async function verifyProviderKey(provider, settings = {}) {
  try {
    if (provider === 'openai') {
      // VPN-страница: достаточно применить Blanc без ключа OpenAI
      if (
        !settings.api_key
        && settings.proxy_enabled
        && String(settings.blanc_subscription_url || '').trim()
      ) {
        return { success: true };
      }
      const client = openaiProxy.createOpenAIClient({
        api_key: settings.api_key,
        base_url: settings.base_url,
        proxy_url: settings.proxy_url,
        proxy_enabled: settings.proxy_enabled,
        blanc_subscription_url: settings.blanc_subscription_url,
        proxy_openai: settings.proxy_openai !== undefined ? settings.proxy_openai : true,
        proxy_telegram: settings.proxy_telegram
      });
      await client.models.list();
      return { success: true };
    }
    if (provider === 'deepseek') {
      const client = createDeepseekClient(settings);
      await client.models.list();
      return { success: true };
    }
    if (provider === 'qwencloud') {
      const client = createQwenCloudClient(settings);
      try {
        await client.models.list();
        return { success: true };
      } catch (listErr) {
        // /models у DashScope часто недоступен — проверяем ключ мини-chat
        const model = String(settings.selected_model || QWENCLOUD_FALLBACK_MODELS[0]).trim();
        await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        });
        return { success: true };
      }
    }
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey: settings.api_key, baseURL: settings.base_url });
      await client.models.list();
      return { success: true };
    }
    if (provider === 'google') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: settings.api_key, baseUrl: settings.base_url });
      const pager = await ai.models.list();
      for await (const _ of pager) {
        break;
      }
      return { success: true };
    }
    if (provider === 'ollama') {
      // Для Ollama — всегда true (локальный)
      return { success: true };
    }
    return { success: false, error: 'Unknown provider' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getAllLLMModels() {
  try {
    // Получаем все настройки провайдеров
    const providers = await encryptedDb.getData(TABLE, {});
    
    // Собираем все модели из всех провайдеров
    const allModels = [];
    
    for (const provider of providers) {
      if (provider.selected_model) {
        // Фильтруем embedding модели - они не должны быть в списке LLM
        const modelName = provider.selected_model.toLowerCase();
        const isEmbeddingModel = modelName.includes('embed') || 
                                modelName.includes('embedding') || 
                                modelName.includes('bge') || 
                                modelName.includes('nomic') ||
                                modelName.includes('text-embedding') ||
                                modelName.includes('mxbai') ||
                                modelName.includes('sentence') ||
                                modelName.includes('ada-002') ||
                                modelName.includes('text-embedding-ada') ||
                                modelName.includes('text-embedding-3');
        
        if (!isEmbeddingModel) {
          allModels.push({ 
            id: provider.selected_model, 
            provider: provider.provider 
          });
        }
      }
    }
    
    // Для Ollama проверяем реально установленные модели через HTTP API
    try {
      const ollamaUrl = ollamaConfig.getBaseUrl();
      
      const response = await axios.get(`${ollamaUrl}/api/tags`, { 
        timeout: TIMEOUTS.ollamaTags 
      });
      
      const models = response.data.models || [];
      for (const model of models) {
        // Фильтруем embedding модели из Ollama
        const modelName = model.name.toLowerCase();
        const isEmbeddingModel = modelName.includes('embed') || 
                                modelName.includes('embedding') || 
                                modelName.includes('bge') || 
                                modelName.includes('nomic') ||
                                modelName.includes('mxbai') ||
                                modelName.includes('sentence');
        
        if (!isEmbeddingModel) {
          allModels.push({ 
            id: model.name, 
            provider: 'ollama' 
          });
        }
      }
    } catch (ollamaError) {
      // console.error('Error checking Ollama models:', ollamaError);
      // Если не удалось проверить Ollama, добавляем базовые модели
      allModels.push({ id: 'qwen2.5:7b', provider: 'ollama' });
    }

    // DeepSeek: список моделей из API (OpenAI-compatible)
    try {
      const deepseekSettings = await getProviderSettings('deepseek');
      if (deepseekSettings?.api_key) {
        const deepseekModels = await getProviderModels('deepseek', deepseekSettings);
        for (const model of deepseekModels) {
          const id = model.id || model.name;
          if (!id) continue;
          allModels.push({ id: String(id), provider: 'deepseek' });
        }
      }
    } catch (deepseekError) {
      const logger = require('../utils/logger');
      logger.warn('[aiProviderSettings] getAllLLMModels deepseek:', deepseekError.message);
    }

    // Qwen Cloud / DashScope: список моделей из API (OpenAI-compatible)
    try {
      const qwenSettings = await getProviderSettings('qwencloud');
      if (qwenSettings?.api_key) {
        const qwenModels = await getProviderModels('qwencloud', qwenSettings);
        for (const model of qwenModels) {
          const id = model.id || model.name;
          if (!id) continue;
          allModels.push({ id: String(id), provider: 'qwencloud' });
        }
      }
    } catch (qwenError) {
      const logger = require('../utils/logger');
      logger.warn('[aiProviderSettings] getAllLLMModels qwencloud:', qwenError.message);
    }
    
    // Убираем дубликаты
    const uniqueModels = [];
    const seen = new Set();
    
    for (const model of allModels) {
      const key = `${model.id}-${model.provider}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueModels.push(model);
      }
    }
    
    return uniqueModels;
  } catch (error) {
    // console.error('Error getting LLM models:', error);
    return [];
  }
}

async function getAllEmbeddingModels() {
  try {
    const { listCatalog } = require('./embeddingRuntimeService');
    const catalog = await listCatalog();
    return (catalog.models || []).map((m) => ({ id: m.id, provider: m.provider }));
  } catch (error) {
    return [];
  }
}

module.exports = {
  createDeepseekClient,
  createQwenCloudClient,
  createOpenAiCompatibleProviderClient,
  getProviderSettings,
  upsertProviderSettings,
  deleteProviderSettings,
  getProviderModels,
  verifyProviderKey,
  getAllLLMModels,
  getAllEmbeddingModels,
}; 