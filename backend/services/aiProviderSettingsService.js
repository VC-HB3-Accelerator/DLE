const db = require('../db');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

const TABLE = 'ai_providers_settings';

async function getProviderSettings(provider) {
  const { rows } = await db.getQuery()(
    `SELECT * FROM ${TABLE} WHERE provider = $1 LIMIT 1`,
    [provider]
  );
  return rows[0] || null;
}

async function upsertProviderSettings({ provider, api_key, base_url, selected_model }) {
  const { rows } = await db.getQuery()(
    `INSERT INTO ${TABLE} (provider, api_key, base_url, selected_model, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (provider) DO UPDATE SET
       api_key = EXCLUDED.api_key,
       base_url = EXCLUDED.base_url,
       selected_model = EXCLUDED.selected_model,
       updated_at = NOW()
     RETURNING *`,
    [provider, api_key, base_url, selected_model]
  );
  return rows[0];
}

async function deleteProviderSettings(provider) {
  await db.getQuery()(
    `DELETE FROM ${TABLE} WHERE provider = $1`,
    [provider]
  );
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

module.exports = {
  getProviderSettings,
  upsertProviderSettings,
  deleteProviderSettings,
  getProviderModels,
  verifyProviderKey,
}; 