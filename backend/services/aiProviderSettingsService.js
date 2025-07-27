/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/HB3-ACCELERATOR
 */

const encryptedDb = require('./encryptedDatabaseService');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

const TABLE = 'ai_providers_settings';

async function getProviderSettings(provider) {
  const settings = await encryptedDb.getData(TABLE, { provider: provider }, 1);
  return settings[0] || null;
}

async function upsertProviderSettings({ provider, api_key, base_url, selected_model, embedding_model }) {
  const data = {
    provider: provider,
    api_key: api_key,
    base_url: base_url,
    selected_model: selected_model,
    embedding_model: embedding_model,
    updated_at: new Date()
  };

  // Проверяем, существует ли запись
  const existing = await encryptedDb.getData(TABLE, { provider: provider }, 1);
  
  if (existing.length > 0) {
    // Обновляем существующую запись
    return await encryptedDb.saveData(TABLE, data, { provider: provider });
  } else {
    // Создаем новую запись
    return await encryptedDb.saveData(TABLE, data);
  }
}

async function deleteProviderSettings(provider) {
  await encryptedDb.deleteData(TABLE, { provider: provider });
}

async function getProviderModels(provider, { api_key, base_url } = {}) {
  try {
    if (provider === 'openai') {
      const client = new OpenAI({ apiKey: api_key, baseURL: base_url });
      const res = await client.models.list();
      return res.data ? res.data.map(m => ({ id: m.id, ...m })) : [];
    }
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey: api_key, baseURL: base_url });
      const res = await client.models.list();
      return res.data ? res.data.map(m => ({ id: m.id, ...m })) : [];
    }
    if (provider === 'google') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: api_key, baseUrl: base_url });
      const pager = await ai.models.list();
      const models = [];
      for await (const model of pager) {
        models.push(model);
      }
      return models;
    }
    if (provider === 'ollama') {
      // Для Ollama — через ai-assistant.js
      return [];
    }
    return [];
  } catch (error) {
    return [];
  }
}

async function verifyProviderKey(provider, { api_key, base_url } = {}) {
  try {
    if (provider === 'openai') {
      const client = new OpenAI({ apiKey: api_key, baseURL: base_url });
      await client.models.list();
      return { success: true };
    }
    if (provider === 'anthropic') {
      const client = new Anthropic({ apiKey: api_key, baseURL: base_url });
      await client.models.list();
      return { success: true };
    }
    if (provider === 'google') {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: api_key, baseUrl: base_url });
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
        allModels.push({ 
          id: provider.selected_model, 
          provider: provider.provider 
        });
      }
    }
    
    // Для Ollama проверяем реально установленные модели
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      // Проверяем, какие модели установлены в Ollama
      const { stdout } = await execAsync('docker exec dapp-ollama ollama list');
      const lines = stdout.trim().split('\n').slice(1); // Пропускаем заголовок
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const modelName = parts[0];
          allModels.push({ 
            id: modelName, 
            provider: 'ollama' 
          });
        }
      }
    } catch (ollamaError) {
      console.error('Error checking Ollama models:', ollamaError);
      // Если не удалось проверить Ollama, добавляем базовые модели
      allModels.push({ id: 'qwen2.5:7b', provider: 'ollama' });
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
    console.error('Error getting LLM models:', error);
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
    
    // Для Ollama проверяем реально установленные embedding модели
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);
      
      // Проверяем, какие embedding модели установлены в Ollama
      const { stdout } = await execAsync('docker exec dapp-ollama ollama list');
      const lines = stdout.trim().split('\n').slice(1); // Пропускаем заголовок
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
          const modelName = parts[0];
          // Проверяем, что это embedding модель
          if (modelName.includes('embed') || modelName.includes('bge') || modelName.includes('nomic')) {
            allModels.push({ 
              id: modelName, 
              provider: 'ollama' 
            });
          }
        }
      }
    } catch (ollamaError) {
      console.error('Error checking Ollama embedding models:', ollamaError);
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
    console.error('Error getting embedding models:', error);
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