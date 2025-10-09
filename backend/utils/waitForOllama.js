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

const logger = require('./logger');
const ollamaConfig = require('../services/ollamaConfig');

/**
 * Проверяет, загружена ли модель в память через /api/ps
 * НЕ триггерит загрузку модели (в отличие от /api/generate)
 * @param {string} modelName - название модели (например: qwen2.5:7b)
 * @returns {Promise<boolean>} true если модель в памяти
 */
async function isModelLoaded(modelName) {
  try {
    const axios = require('axios');
    const baseUrl = ollamaConfig.getBaseUrl();
    
    // Используем /api/ps - показывает какие модели сейчас в памяти
    // Этот endpoint НЕ триггерит загрузку модели!
    const response = await axios.get(`${baseUrl}/api/ps`, {
      timeout: 3000
    });
    
    // Проверяем, есть ли наша модель в списке загруженных
    if (response.data && response.data.models) {
      return response.data.models.some(m => {
        // Сравниваем без тега (qwen2.5 == qwen2.5:7b)
        const modelBaseName = modelName.split(':')[0];
        const loadedBaseName = (m.name || m.model || '').split(':')[0];
        return loadedBaseName === modelBaseName;
      });
    }
    
    return false;
  } catch (error) {
    // API ps может не существовать в старых версиях Ollama
    // Или модель не загружена
    return false;
  }
}

/**
 * Ожидание готовности Ollama и загрузки модели в память
 * Ollama может загружаться до 4 минут при старте Docker контейнера
 * entrypoint.sh загружает модель qwen2.5:7b в память с keep_alive=24h
 * 
 * @param {Object} options - Опции ожидания
 * @param {number} options.maxWaitTime - Максимальное время ожидания в мс (по умолчанию 4 минуты)
 * @param {number} options.retryInterval - Интервал между попытками в мс (по умолчанию 5 секунд)
 * @param {boolean} options.required - Обязательно ли ждать Ollama (по умолчанию false)
 * @returns {Promise<boolean>} true если Ollama готов, false если таймаут (и required=false)
 */
async function waitForOllama(options = {}) {
  const {
    maxWaitTime = parseInt(process.env.OLLAMA_WAIT_TIME) || 4 * 60 * 1000,
    retryInterval = parseInt(process.env.OLLAMA_RETRY_INTERVAL) || 5000,
    required = process.env.OLLAMA_REQUIRED === 'true' || false
  } = options;

  const startTime = Date.now();
  let attempt = 0;
  const maxAttempts = Math.ceil(maxWaitTime / retryInterval);

  logger.info(`[waitForOllama] ⏳ Ожидание готовности Ollama и загрузки модели в память (макс. ${maxWaitTime/1000}с, интервал ${retryInterval/1000}с)...`);

  while (Date.now() - startTime < maxWaitTime) {
    attempt++;
    
    try {
      // Шаг 1: Проверяем доступность Ollama API
      const healthStatus = await ollamaConfig.checkHealth();
      
      if (healthStatus.status === 'ok') {
        const model = healthStatus.model;
        
        // Шаг 2: Проверяем, загружена ли модель в память
        const modelReady = await isModelLoaded(model);
        
        if (modelReady) {
          const waitedTime = ((Date.now() - startTime) / 1000).toFixed(1);
          logger.info(`[waitForOllama] ✅ Ollama готов! Модель ${model} загружена в память (ожидание ${waitedTime}с, попытка ${attempt}/${maxAttempts})`);
          logger.info(`[waitForOllama] 📊 Ollama: ${healthStatus.baseUrl}, доступно моделей: ${healthStatus.availableModels}`);
          return true;
        } else {
          logger.info(`[waitForOllama] ⏳ Ollama API готов, но модель ${model} ещё грузится в память... (попытка ${attempt}/${maxAttempts})`);
        }
      } else {
        logger.warn(`[waitForOllama] ⚠️ Ollama API не готов (попытка ${attempt}/${maxAttempts}): ${healthStatus.error}`);
      }
      
    } catch (error) {
      logger.warn(`[waitForOllama] ⚠️ Ошибка проверки Ollama (попытка ${attempt}/${maxAttempts}): ${error.message}`);
    }

    // Если не последняя попытка - ждем перед следующей
    if (Date.now() - startTime < maxWaitTime) {
      const remainingTime = Math.max(0, maxWaitTime - (Date.now() - startTime));
      const nextRetry = Math.min(retryInterval, remainingTime);
      
      if (nextRetry > 0) {
        await new Promise(resolve => setTimeout(resolve, nextRetry));
      }
    }
  }

  // Таймаут истек
  const totalWaitTime = ((Date.now() - startTime) / 1000).toFixed(1);
  
  if (required) {
    const error = `Ollama не готов после ${totalWaitTime}с ожидания (${attempt} попыток)`;
    logger.error(`[waitForOllama] ❌ ${error}`);
    throw new Error(error);
  } else {
    logger.warn(`[waitForOllama] ⚠️ Ollama не готов после ${totalWaitTime}с ожидания (${attempt} попыток). Продолжаем без AI.`);
    return false;
  }
}

/**
 * Проверка готовности Ollama (одна попытка, без ожидания)
 * @returns {Promise<boolean>} true если Ollama готов
 */
async function isOllamaReady() {
  try {
    const healthStatus = await ollamaConfig.checkHealth();
    if (healthStatus.status !== 'ok') return false;
    
    // Проверяем модель
    return await isModelLoaded(healthStatus.model);
  } catch (error) {
    return false;
  }
}

module.exports = {
  waitForOllama,
  isOllamaReady
};

