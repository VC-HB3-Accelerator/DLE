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

const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Скрипт для уведомления Ollama о готовности
 * Используется для проверки доступности Ollama и прогрева моделей
 */

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
const MAX_RETRIES = 30;
const RETRY_DELAY = 2000; // 2 секунды

/**
 * Проверить доступность Ollama
 * @returns {Promise<boolean>}
 */
async function checkOllamaHealth() {
  try {
    const response = await axios.get(`${OLLAMA_HOST}/api/tags`, {
      timeout: 5000
    });
    
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Дождаться готовности Ollama с retry
 * @returns {Promise<boolean>}
 */
async function waitForOllama() {
  logger.info('[NotifyOllamaReady] Ожидание готовности Ollama...');
  
  for (let i = 0; i < MAX_RETRIES; i++) {
    const isReady = await checkOllamaHealth();
    
    if (isReady) {
      logger.info(`[NotifyOllamaReady] ✅ Ollama готов! (попытка ${i + 1}/${MAX_RETRIES})`);
      return true;
    }
    
    logger.info(`[NotifyOllamaReady] Ollama не готов, повтор ${i + 1}/${MAX_RETRIES}...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
  
  logger.error('[NotifyOllamaReady] ❌ Ollama не стал доступен после всех попыток');
  return false;
}

/**
 * Получить список доступных моделей
 * @returns {Promise<Array>}
 */
async function getAvailableModels() {
  try {
    const response = await axios.get(`${OLLAMA_HOST}/api/tags`, {
      timeout: 5000
    });
    
    return response.data.models || [];
  } catch (error) {
    logger.error('[NotifyOllamaReady] Ошибка получения моделей:', error.message);
    return [];
  }
}

/**
 * Прогреть модель (загрузить в память)
 * @param {string} modelName - Название модели
 * @returns {Promise<boolean>}
 */
async function warmupModel(modelName) {
  try {
    logger.info(`[NotifyOllamaReady] Прогрев модели: ${modelName}`);
    
    const response = await axios.post(`${OLLAMA_HOST}/api/generate`, {
      model: modelName,
      prompt: 'Hello',
      stream: false
    }, {
      timeout: 30000
    });
    
    if (response.status === 200) {
      logger.info(`[NotifyOllamaReady] ✅ Модель ${modelName} прогрета`);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error(`[NotifyOllamaReady] Ошибка прогрева модели ${modelName}:`, error.message);
    return false;
  }
}

/**
 * Основная функция инициализации
 */
async function initialize() {
  try {
    logger.info('[NotifyOllamaReady] 🚀 Начало инициализации Ollama...');
    
    // Ждем готовности Ollama
    const isReady = await waitForOllama();
    
    if (!isReady) {
      logger.error('[NotifyOllamaReady] Не удалось дождаться готовности Ollama');
      return false;
    }
    
    // Получаем список моделей
    const models = await getAvailableModels();
    logger.info(`[NotifyOllamaReady] Найдено моделей: ${models.length}`);
    
    if (models.length > 0) {
      logger.info('[NotifyOllamaReady] Доступные модели:', models.map(m => m.name).join(', '));
      
      // Прогреваем первую модель (опционально)
      if (process.env.WARMUP_MODEL === 'true' && models[0]) {
        await warmupModel(models[0].name);
      }
    }
    
    logger.info('[NotifyOllamaReady] ✅ Инициализация завершена');
    return true;
    
  } catch (error) {
    logger.error('[NotifyOllamaReady] Ошибка инициализации:', error);
    return false;
  }
}

// Если запущен напрямую как скрипт
if (require.main === module) {
  initialize()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logger.error('[NotifyOllamaReady] Критическая ошибка:', error);
      process.exit(1);
    });
}

module.exports = {
  initialize,
  waitForOllama,
  checkOllamaHealth,
  getAvailableModels,
  warmupModel
};

