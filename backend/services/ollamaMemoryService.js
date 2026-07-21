/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const logger = require('../utils/logger');
const aiConfigService = require('./aiConfigService');
const ollamaConfig = require('./ollamaConfig');

const MODEL_NAME_REGEX = /^[a-zA-Z0-9._:-]+$/;

function resolvePreloadFilePath() {
  if (process.env.OLLAMA_PRELOAD_FILE) {
    return process.env.OLLAMA_PRELOAD_FILE;
  }
  const repoShared = path.join(__dirname, '../../shared/ollama_preload_model.txt');
  const appShared = path.join(__dirname, '../shared/ollama_preload_model.txt');
  // В Docker backend пишет в /app/shared — тот же host-каталог, что у ollama в /preload-shared
  if (fs.existsSync('/app/shared')) {
    return appShared;
  }
  if (fs.existsSync(path.dirname(repoShared))) {
    return repoShared;
  }
  return appShared;
}

const PRELOAD_FILE = resolvePreloadFilePath();
const KEEP_ALIVE = process.env.OLLAMA_PRELOAD_KEEP_ALIVE || '24h';

let schemaEnsured = false;

function validateModelName(modelName) {
  const name = String(modelName || '').trim();
  if (!name || name.length > 128 || !MODEL_NAME_REGEX.test(name)) {
    throw new Error('Invalid model name');
  }
  return name;
}

function modelMatches(loadedName, requestedName) {
  const loaded = String(loadedName || '').trim();
  const requested = String(requestedName || '').trim();
  if (!loaded || !requested) return false;
  if (loaded === requested) return true;
  if (loaded.startsWith(`${requested}:`)) return true;
  if (requested.startsWith(`${loaded}:`)) return true;
  return false;
}

async function ensurePreloadColumn() {
  if (schemaEnsured) return;
  try {
    const db = require('../db');
    const query = db.getQuery();
    await query(
      'ALTER TABLE ai_config ADD COLUMN IF NOT EXISTS ollama_preload_model TEXT'
    );
    schemaEnsured = true;
  } catch (error) {
    logger.warn('[ollamaMemory] Не удалось проверить колонку ollama_preload_model:', error.message);
  }
}

function writePreloadFile(modelName) {
  try {
    const dir = path.dirname(PRELOAD_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PRELOAD_FILE, `${modelName}\n`, 'utf8');
  } catch (error) {
    logger.warn('[ollamaMemory] Не удалось записать файл предзагрузки:', error.message);
  }
}

function readPreloadFile() {
  try {
    if (!fs.existsSync(PRELOAD_FILE)) return null;
    const value = fs.readFileSync(PRELOAD_FILE, 'utf8').trim();
    if (!value) return null;
    return validateModelName(value);
  } catch (_) {
    return null;
  }
}

async function getExplicitPreloadModel() {
  await ensurePreloadColumn();
  const config = await aiConfigService.getOllamaConfig();
  if (config.preloadModel) {
    return config.preloadModel;
  }
  return readPreloadFile();
}

async function syncPreloadFileFromDb() {
  await ensurePreloadColumn();
  const config = await aiConfigService.getOllamaConfig();
  if (config.preloadModel) {
    writePreloadFile(config.preloadModel);
    return;
  }
  const fromFile = readPreloadFile();
  if (fromFile) {
    try {
      await aiConfigService.updateConfig({ ollama_preload_model: fromFile });
    } catch (error) {
      logger.warn('[ollamaMemory] Не удалось записать preload в БД:', error.message);
    }
    writePreloadFile(fromFile);
  }
}

async function getPreloadModelName() {
  const explicit = await getExplicitPreloadModel();
  if (explicit) {
    return explicit;
  }
  const config = await aiConfigService.getOllamaConfig();
  return config.llmModel;
}

async function setPreloadModel(modelName, userId = null) {
  const name = validateModelName(modelName);
  await ensurePreloadColumn();
  await aiConfigService.updateConfig({ ollama_preload_model: name }, userId);
  writePreloadFile(name);
  return name;
}

async function clearPreloadModel(userId = null) {
  await ensurePreloadColumn();
  await aiConfigService.updateConfig({ ollama_preload_model: null }, userId);
  try {
    if (fs.existsSync(PRELOAD_FILE)) {
      fs.unlinkSync(PRELOAD_FILE);
    }
  } catch (_) {
    // ignore
  }
}

async function getLoadedModels() {
  const ollamaUrl = ollamaConfig.getBaseUrl();
  const timeouts = ollamaConfig.getTimeouts();
  const response = await axios.get(`${ollamaUrl}/api/ps`, {
    timeout: timeouts.ollamaHealth || 5000
  });
  const models = (response.data?.models || []).map((m) => ({
    name: m.name || m.model,
    size: m.size,
    sizeVram: m.size_vram,
    expiresAt: m.expires_at
  }));
  return models.filter((m) => m.name);
}

function isEmbeddingModelName(modelName) {
  const n = modelName.toLowerCase();
  return n.includes('embed') || n.includes('mxbai') || n.includes('bge') || n.includes('nomic');
}

async function loadModelIntoMemory(modelName, options = {}) {
  const { persist = true, userId = null } = options;
  const name = validateModelName(modelName);
  if (isEmbeddingModelName(name)) {
    const ollamaUrl = ollamaConfig.getBaseUrl();
    const timeouts = ollamaConfig.getTimeouts();
    await axios.post(`${ollamaUrl}/api/embed`, {
      model: name,
      input: 'preload',
      keep_alive: KEEP_ALIVE
    }, { timeout: timeouts.ollamaEmbedding || 90000 });
  } else {
    const ollamaUrl = ollamaConfig.getBaseUrl();
    const timeouts = ollamaConfig.getTimeouts();
    await axios.post(`${ollamaUrl}/api/chat`, {
      model: name,
      messages: [{ role: 'user', content: '.' }],
      stream: false,
      keep_alive: KEEP_ALIVE,
      options: { num_predict: 1 }
    }, { timeout: timeouts.ollamaChat || 600000 });
  }

  if (persist) {
    await setPreloadModel(name, userId);
  }

  logger.info(`[ollamaMemory] Модель ${name} загружена в память (persist=${persist})`);
  return { model: name, keepAlive: KEEP_ALIVE };
}

async function unloadModelFromMemory(modelName) {
  const name = validateModelName(modelName);
  const ollamaUrl = ollamaConfig.getBaseUrl();
  const timeouts = ollamaConfig.getTimeouts();

  if (isEmbeddingModelName(name)) {
    await axios.post(`${ollamaUrl}/api/embed`, {
      model: name,
      input: '',
      keep_alive: 0
    }, { timeout: timeouts.ollamaHealth || 8000 });
  } else {
    await axios.post(`${ollamaUrl}/api/generate`, {
      model: name,
      prompt: '',
      keep_alive: 0,
      stream: false
    }, { timeout: timeouts.ollamaHealth || 8000 });
  }

  logger.info(`[ollamaMemory] Модель ${name} выгружена из памяти`);
  return { model: name };
}

async function unloadAllFromMemory() {
  const loaded = await getLoadedModels();
  const results = [];
  for (const item of loaded) {
    try {
      await unloadModelFromMemory(item.name);
      results.push({ model: item.name, success: true });
    } catch (error) {
      results.push({ model: item.name, success: false, error: error.message });
    }
  }
  const stillLoaded = await getLoadedModels();
  return { results, loaded: stillLoaded };
}

async function isModelLoaded(modelName) {
  try {
    const loaded = await getLoadedModels();
    return loaded.some((m) => modelMatches(m.name, modelName));
  } catch (_) {
    return false;
  }
}

async function ensurePreloadedModelInMemory() {
  const model = await getPreloadModelName();
  if (!model) return false;
  if (await isModelLoaded(model)) {
    return true;
  }
  try {
    await loadModelIntoMemory(model, { persist: false });
    return true;
  } catch (error) {
    logger.warn(`[ollamaMemory] Не удалось предзагрузить ${model}:`, error.message);
    return false;
  }
}

module.exports = {
  validateModelName,
  modelMatches,
  getPreloadModelName,
  getExplicitPreloadModel,
  syncPreloadFileFromDb,
  setPreloadModel,
  clearPreloadModel,
  getLoadedModels,
  loadModelIntoMemory,
  unloadModelFromMemory,
  unloadAllFromMemory,
  isModelLoaded,
  ensurePreloadedModelInMemory,
  readPreloadFile,
  PRELOAD_FILE
};
