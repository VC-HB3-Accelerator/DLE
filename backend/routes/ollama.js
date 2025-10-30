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

const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const axios = require('axios');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const ollamaConfig = require('../services/ollamaConfig');

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
  
  if (!model) {
    return res.status(400).json({ error: 'Model name is required' });
  }

  try {
    logger.info(`Starting installation of model: ${model}`);
    
    // Запускаем установку в фоне
    const installProcess = exec(`docker exec dapp-ollama ollama pull ${model}`, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Error installing model ${model}:`, error);
      } else {
        logger.info(`Successfully installed model: ${model}`);
      }
    });

    // Возвращаем ответ сразу, не ждем завершения
    res.json({ 
      success: true, 
      message: `Installation of ${model} started`,
      processId: installProcess.pid 
    });
  } catch (error) {
    logger.error('Error starting model installation:', error);
    res.status(500).json({ error: 'Failed to start installation' });
  }
});

// Удаление модели
router.delete('/models/:modelName', requireAuth, async (req, res) => {
  const { modelName } = req.params;
  
  if (!modelName) {
    return res.status(400).json({ error: 'Model name is required' });
  }

  try {
    logger.info(`Removing model: ${modelName}`);
    
    const { stdout, stderr } = await execAsync(`docker exec dapp-ollama ollama rm ${modelName}`);
    
    if (stderr && !stderr.includes('deleted')) {
      throw new Error(stderr);
    }
    
    logger.info(`Successfully removed model: ${modelName}`);
    res.json({ success: true, message: `Model ${modelName} removed successfully` });
  } catch (error) {
    logger.error(`Error removing model ${modelName}:`, error);
    res.status(500).json({ error: `Failed to remove model: ${error.message}` });
  }
});

// Получение информации о модели
router.get('/models/:modelName', requireAuth, async (req, res) => {
  const { modelName } = req.params;
  
  try {
    const { stdout } = await execAsync(`docker exec dapp-ollama ollama show ${modelName}`);
    res.json({ model: modelName, info: stdout });
  } catch (error) {
    logger.error(`Error getting model info for ${modelName}:`, error);
    res.status(404).json({ error: 'Model not found' });
  }
});

// Поиск моделей в реестре (если поддерживается)
router.get('/search', requireAuth, async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    // Пока просто возвращаем популярные модели
    const popularModels = [
      'qwen2.5:7b',
      'llama2:7b',
      'mistral:7b',
      'codellama:7b',
      'llama2:13b',
      'qwen2.5:14b',
      'gemma:7b',
      'phi3:3.8b'
    ];
    
    const filteredModels = popularModels.filter(model => 
      model.toLowerCase().includes(query.toLowerCase())
    );
    
    res.json({ models: filteredModels });
  } catch (error) {
    logger.error('Error searching models:', error);
    res.status(500).json({ error: 'Failed to search models' });
  }
});

module.exports = router; 