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
const axios = require('axios');
const ollamaConfig = require('./ollamaConfig');
const openaiProxy = require('./openaiProxy');
const blancVpnService = require('./blancVpnService');

const TABLE = 'ai_providers_settings';
const TIMEOUTS = ollamaConfig.getTimeouts();

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
  blanc_subscription_url
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
        blanc_subscription_url: settings.blanc_subscription_url
      });
      const res = await client.models.list();
      return res.data ? res.data.map(m => ({ id: m.id, ...m })) : [];
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
      const client = openaiProxy.createOpenAIClient({
        api_key: settings.api_key,
        base_url: settings.base_url,
        proxy_url: settings.proxy_url,
        proxy_enabled: settings.proxy_enabled,
        blanc_subscription_url: settings.blanc_subscription_url
      });
      await client.models.list();
      return { success: true };
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
      allModels.push({ id: 'qwen2.5:1.5b', provider: 'ollama' });
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
    // Получаем все настройки провайдеров
    const providers = await encryptedDb.getData(TABLE, {});
    
    // Собираем все embedding модели из всех провайдеров
    const allModels = [];
    
    for (const provider of providers) {
      if (provider.embedding_model) {
        allModels.push({ 
          id: provider.embedding_model, 
          provider: provider.provider 
        });
      }
    }
    
    // Для Ollama проверяем реально установленные embedding модели через HTTP API
    try {
      const ollamaUrl = ollamaConfig.getBaseUrl();
      
      const response = await axios.get(`${ollamaUrl}/api/tags`, { 
        timeout: TIMEOUTS.ollamaTags 
      });
      
      const models = response.data.models || [];
      for (const model of models) {
        // Проверяем, что это embedding модель
        if (model.name.includes('embed') || model.name.includes('bge') || model.name.includes('nomic')) {
          allModels.push({ 
            id: model.name, 
            provider: 'ollama' 
          });
        }
      }
    } catch (ollamaError) {
      // console.error('Error checking Ollama embedding models:', ollamaError);
      // Если не удалось проверить Ollama, добавляем базовые embedding модели
      allModels.push({ id: 'mxbai-embed-large:latest', provider: 'ollama' });
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
    // console.error('Error getting embedding models:', error);
    return [];
  }
}

module.exports = {
  getProviderSettings,
  upsertProviderSettings,
  deleteProviderSettings,
  getProviderModels,
  verifyProviderKey,
  getAllLLMModels,
  getAllEmbeddingModels,
}; 