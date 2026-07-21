/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 * All rights reserved.
 */

const logger = require('./logger');
const ollamaConfig = require('../services/ollamaConfig');
const ollamaMemoryService = require('../services/ollamaMemoryService');

/**
 * Проверяет, загружена ли модель в память через /api/ps
 * @param {string} modelName - название модели (например: qwen2.5:1.5b)
 * @returns {Promise<boolean>} true если модель в памяти
 */
async function isModelLoaded(modelName) {
  return ollamaMemoryService.isModelLoaded(modelName);
}

/**
 * Ожидание готовности Ollama и загрузки модели в память
 * @param {Object} options - Опции ожидания
 * @returns {Promise<boolean>} true если Ollama готов, false если таймаут (и required=false)
 */
async function waitForOllama(options = {}) {
  const {
    maxWaitTime = parseInt(process.env.OLLAMA_WAIT_TIME, 10) || 4 * 60 * 1000,
    retryInterval = parseInt(process.env.OLLAMA_RETRY_INTERVAL, 10) || 5000,
    required = process.env.OLLAMA_REQUIRED === 'true' || false
  } = options;

  const startTime = Date.now();
  let attempt = 0;
  let preloadTriggered = false;
  const maxAttempts = Math.ceil(maxWaitTime / retryInterval);

  logger.info(`[waitForOllama] ⏳ Ожидание готовности Ollama и загрузки модели в память (макс. ${maxWaitTime / 1000}с, интервал ${retryInterval / 1000}с)...`);

  try {
    await ollamaMemoryService.syncPreloadFileFromDb();
  } catch (syncErr) {
    logger.warn(`[waitForOllama] sync preload file: ${syncErr.message}`);
  }

  while (Date.now() - startTime < maxWaitTime) {
    attempt++;

    try {
      const healthStatus = await ollamaConfig.checkHealth();

      if (healthStatus.status === 'ok') {
        const model = healthStatus.model;
        let modelReady = await isModelLoaded(model);

        if (!modelReady && !preloadTriggered) {
          preloadTriggered = true;
          logger.info(`[waitForOllama] Запуск предзагрузки модели ${model}...`);
          await ollamaMemoryService.ensurePreloadedModelInMemory();
          modelReady = await isModelLoaded(model);
        }

        if (modelReady) {
          const waitedTime = ((Date.now() - startTime) / 1000).toFixed(1);
          logger.info(`[waitForOllama] ✅ Ollama готов! Модель ${model} загружена в память (ожидание ${waitedTime}с, попытка ${attempt}/${maxAttempts})`);
          logger.info(`[waitForOllama] 📊 Ollama: ${healthStatus.baseUrl}, доступно моделей: ${healthStatus.availableModels}`);
          return true;
        }

        logger.info(`[waitForOllama] ⏳ Ollama API готов, но модель ${model} ещё грузится в память... (попытка ${attempt}/${maxAttempts})`);
      } else {
        logger.warn(`[waitForOllama] ⚠️ Ollama API не готов (попытка ${attempt}/${maxAttempts}): ${healthStatus.error}`);
      }
    } catch (error) {
      logger.warn(`[waitForOllama] ⚠️ Ошибка проверки Ollama (попытка ${attempt}/${maxAttempts}): ${error.message}`);
    }

    if (Date.now() - startTime < maxWaitTime) {
      const remainingTime = Math.max(0, maxWaitTime - (Date.now() - startTime));
      const nextRetry = Math.min(retryInterval, remainingTime);

      if (nextRetry > 0) {
        await new Promise((resolve) => setTimeout(resolve, nextRetry));
      }
    }
  }

  const totalWaitTime = ((Date.now() - startTime) / 1000).toFixed(1);

  if (required) {
    const error = `Ollama не готов после ${totalWaitTime}с ожидания (${attempt} попыток)`;
    logger.error(`[waitForOllama] ❌ ${error}`);
    throw new Error(error);
  }

  logger.warn(`[waitForOllama] ⚠️ Ollama не готов после ${totalWaitTime}с ожидания (${attempt} попыток). Продолжаем без AI.`);
  return false;
}

async function isOllamaReady() {
  try {
    const healthStatus = await ollamaConfig.checkHealth();
    if (healthStatus.status !== 'ok') return false;

    return await isModelLoaded(healthStatus.model);
  } catch (error) {
    return false;
  }
}

module.exports = {
  waitForOllama,
  isOllamaReady
};
