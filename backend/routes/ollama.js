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

const express = require('express');
const router = express.Router();
const axios = require('axios');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const ollamaConfig = require('../services/ollamaConfig');
const ollamaMemoryService = require('../services/ollamaMemoryService');

function getOllamaUrl() {
  return ollamaConfig.getBaseUrl();
}

// Инициализируем один раз
const TIMEOUTS = ollamaConfig.getTimeouts();

// Получение дефолтного base URL для Ollama (для настроек UI)
router.get('/default-base-url', requireAuth, async (req, res) => {
  try {
    const defaultBaseUrl = ollamaConfig.getBaseUrl();
    const fromEnv = !!process.env.OLLAMA_BASE_URL;
    res.json({ 
      baseUrl: defaultBaseUrl,
      fromEnv, // флаг, что URL из переменной окружения
      priority: fromEnv ? 'environment' : 'default'
    });
  } catch (error) {
    logger.error('Error getting default base URL:', error);
    res.status(500).json({ error: 'Failed to get default base URL' });
  }
});

// Проверка статуса подключения к Ollama
router.get('/status', requireAuth, async (req, res) => {
  try {
    const ollamaUrl = ollamaConfig.getBaseUrl();
    
    // Проверяем API Ollama через HTTP запрос
    try {
      const response = await axios.get(`${ollamaUrl}/api/tags`, { 
        timeout: TIMEOUTS.ollamaTags // Централизованный таймаут
      });
      
      const models = response.data.models || [];
      return res.json({ 
        connected: true, 
        message: 'Ollama is running',
        models: models.length,
        availableModels: models.map(m => m.name)
      });
    } catch (apiError) {
      logger.error('Ollama API error:', apiError.message);
      return res.json({ 
        connected: false, 
        error: `Ollama API not responding: ${apiError.message}` 
      });
    }
  } catch (error) {
    logger.error('Error checking Ollama status:', error);
    res.status(500).json({ connected: false, error: 'Failed to check Ollama status' });
  }
});

// Получение списка установленных моделей
router.get('/models', requireAuth, async (req, res) => {
  try {
    const ollamaUrl = ollamaConfig.getBaseUrl();
    
    const response = await axios.get(`${ollamaUrl}/api/tags`, { 
      timeout: TIMEOUTS.ollamaTags 
    });
    
    const models = (response.data.models || []).map(model => ({
      name: model.name,
      id: model.model || model.name,
      size: model.size || 0,
      modified: model.modified_at || 'Unknown'
    }));

    res.json({ models });
  } catch (error) {
    logger.error('Error getting Ollama models:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

// Установка модели
router.post('/install', requireAuth, async (req, res) => {
  const { model } = req.body;
  const modelName = String(model || '').trim();

  if (!modelName) {
    return res.status(400).json({ error: 'Model name is required' });
  }

  // Защита от инъекций в shell: только теги Ollama
  if (!/^[a-zA-Z0-9._:-]+$/.test(modelName) || modelName.length > 128) {
    return res.status(400).json({ error: 'Invalid model name' });
  }

  try {
    logger.info(`Starting installation of model: ${modelName}`);

    const ollamaUrl = getOllamaUrl();
    const pullTimeout = TIMEOUTS.ollamaPull || 3600000;
    axios
      .post(
        `${ollamaUrl}/api/pull`,
        { name: modelName, stream: false },
        { timeout: pullTimeout }
      )
      .then(() => {
        logger.info(`Successfully installed model: ${modelName}`);
      })
      .catch((error) => {
        logger.error(`Error installing model ${modelName}:`, error);
      });

    res.json({
      success: true,
      message: `Installation of ${modelName} started`
    });
  } catch (error) {
    logger.error('Error starting model installation:', error);
    res.status(500).json({ error: 'Failed to start installation' });
  }
});

// Модели в RAM (Ollama /api/ps)
router.get('/memory/loaded', requireAuth, async (req, res) => {
  try {
    await ollamaMemoryService.syncPreloadFileFromDb();
    const loaded = await ollamaMemoryService.getLoadedModels();
    const preloadModel = await ollamaMemoryService.getExplicitPreloadModel();
    res.json({ success: true, loaded, preloadModel: preloadModel || null });
  } catch (error) {
    logger.error('Error getting loaded Ollama models:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/memory/load', requireAuth, async (req, res) => {
  try {
    const model = ollamaMemoryService.validateModelName(req.body?.model);
    const userId = req.session?.userId || null;
    const result = await ollamaMemoryService.loadModelIntoMemory(model, { persist: true, userId });
    const loaded = await ollamaMemoryService.getLoadedModels();
    const preloadModel = await ollamaMemoryService.getExplicitPreloadModel();
    res.json({ success: true, ...result, loaded, preloadModel });
  } catch (error) {
    logger.error('Error loading Ollama model into memory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/memory/unload', requireAuth, async (req, res) => {
  try {
    const model = ollamaMemoryService.validateModelName(req.body?.model);
    const result = await ollamaMemoryService.unloadModelFromMemory(model);
    const loaded = await ollamaMemoryService.getLoadedModels();
    res.json({ success: true, ...result, loaded });
  } catch (error) {
    logger.error('Error unloading Ollama model from memory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/memory/unload-all', requireAuth, async (req, res) => {
  try {
    const { results, loaded } = await ollamaMemoryService.unloadAllFromMemory();
    res.json({ success: true, results, loaded });
  } catch (error) {
    logger.error('Error unloading all Ollama models:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Удаление модели
router.delete('/models/:modelName', requireAuth, async (req, res) => {
  let decodedName;
  try {
    decodedName = ollamaMemoryService.validateModelName(
      decodeURIComponent(req.params.modelName || '')
    );
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    logger.info(`Removing model: ${decodedName}`);

    try {
      await ollamaMemoryService.unloadModelFromMemory(decodedName);
    } catch (unloadErr) {
      logger.debug(`[ollama] unload before rm skipped: ${unloadErr.message}`);
    }

    const explicit = await ollamaMemoryService.getExplicitPreloadModel();
    if (explicit && ollamaMemoryService.modelMatches(explicit, decodedName)) {
      await ollamaMemoryService.clearPreloadModel(req.session?.userId || null);
    }

    const ollamaUrl = getOllamaUrl();
    await axios.delete(`${ollamaUrl}/api/delete`, {
      data: { name: decodedName },
      timeout: TIMEOUTS.ollamaTags || 120000
    });

    logger.info(`Successfully removed model: ${decodedName}`);
    res.json({ success: true, message: `Model ${decodedName} removed successfully` });
  } catch (error) {
    logger.error(`Error removing model ${decodedName}:`, error);
    res.status(500).json({ error: `Failed to remove model: ${error.message}` });
  }
});

// Получение информации о модели
router.get('/models/:modelName', requireAuth, async (req, res) => {
  let decodedName;
  try {
    decodedName = ollamaMemoryService.validateModelName(
      decodeURIComponent(req.params.modelName || '')
    );
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const ollamaUrl = getOllamaUrl();
    const { data } = await axios.post(
      `${ollamaUrl}/api/show`,
      { name: decodedName },
      { timeout: TIMEOUTS.ollamaTags || 30000 }
    );
    res.json({ model: decodedName, info: data });
  } catch (error) {
    logger.error(`Error getting model info for ${decodedName}:`, error);
    res.status(404).json({ error: 'Model not found' });
  }
});

// Поиск моделей в реестре (если поддерживается)
router.get('/search', requireAuth, async (req, res) => {
  const query = String(req.query?.query || '').trim().toLowerCase();

  if (query.length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  try {
    const popularModels = [
      'qwen2.5:1.5b',
      'qwen2.5:3b',
      'qwen2.5:0.5b',
      'llama2:7b',
      'mistral:7b',
      'codellama:7b',
      'llama2:13b',
      'qwen2.5:14b',
      'gemma:7b',
      'phi3:3.8b',
      'mxbai-embed-large:latest',
      'nomic-embed-text:latest'
    ];

    const filteredModels = popularModels.filter((model) =>
      model.toLowerCase().includes(query)
    );

    res.json({ models: filteredModels });
  } catch (error) {
    logger.error('Error searching models:', error);
    res.status(500).json({ error: 'Failed to search models' });
  }
});

module.exports = router; 