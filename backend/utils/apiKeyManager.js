/**
 * Централизованный менеджер API ключей
 * Унифицирует работу с API ключами Etherscan
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const logger = require('./logger');

class ApiKeyManager {
  /**
   * Получает API ключ Etherscan из различных источников
   * @param {Object} params - Параметры деплоя
   * @param {Object} reqBody - Тело запроса (опционально)
   * @returns {string|null} - API ключ или null
   */
  static getEtherscanApiKey(params = {}, reqBody = {}) {
    // Приоритет источников:
    // 1. Из параметров деплоя (БД)
    // 2. Из тела запроса (фронтенд)
    // 3. Из переменных окружения
    // 4. Из секретов
    
    let apiKey = null;
    
    // 1. Из параметров деплоя (БД) - приоритет 1
    if (params.etherscan_api_key) {
      apiKey = params.etherscan_api_key;
      logger.info('[API_KEY] ✅ Ключ получен из параметров деплоя (БД)');
    }
    
    // 2. Из тела запроса (фронтенд) - приоритет 2
    else if (reqBody.etherscanApiKey) {
      apiKey = reqBody.etherscanApiKey;
      logger.info('[API_KEY] ✅ Ключ получен из тела запроса (фронтенд)');
    }
    
    // 3. Из переменных окружения - приоритет 3
    else if (process.env.ETHERSCAN_API_KEY) {
      apiKey = process.env.ETHERSCAN_API_KEY;
      logger.info('[API_KEY] ✅ Ключ получен из переменных окружения');
    }
    
    // 4. Из секретов - приоритет 4
    else if (process.env.ETHERSCAN_V2_API_KEY) {
      apiKey = process.env.ETHERSCAN_V2_API_KEY;
      logger.info('[API_KEY] ✅ Ключ получен из секретов');
    }
    
    if (apiKey) {
      logger.info(`[API_KEY] 🔑 API ключ найден: ${apiKey.substring(0, 8)}...`);
      return apiKey;
    } else {
      logger.warn('[API_KEY] ⚠️ API ключ Etherscan не найден');
      return null;
    }
  }
  
  /**
   * Устанавливает API ключ в переменные окружения
   * @param {string} apiKey - API ключ
   */
  static setEtherscanApiKey(apiKey) {
    if (apiKey) {
      process.env.ETHERSCAN_API_KEY = apiKey;
      logger.info(`[API_KEY] 🔧 API ключ установлен в переменные окружения: ${apiKey.substring(0, 8)}...`);
    }
  }
  
  /**
   * Проверяет наличие API ключа
   * @param {string} apiKey - API ключ для проверки
   * @returns {boolean} - true если ключ валидный
   */
  static validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      logger.warn('[API_KEY] ❌ API ключ не валидный: пустой или не строка');
      return false;
    }
    
    if (apiKey.length < 10) {
      logger.warn('[API_KEY] ❌ API ключ слишком короткий');
      return false;
    }
    
    logger.info('[API_KEY] ✅ API ключ валидный');
    return true;
  }
  
  /**
   * Получает и устанавливает API ключ (универсальный метод)
   * @param {Object} params - Параметры деплоя
   * @param {Object} reqBody - Тело запроса (опционально)
   * @returns {string|null} - API ключ или null
   */
  static getAndSetEtherscanApiKey(params = {}, reqBody = {}) {
    const apiKey = this.getEtherscanApiKey(params, reqBody);
    
    if (apiKey && this.validateApiKey(apiKey)) {
      this.setEtherscanApiKey(apiKey);
      return apiKey;
    }
    
    return null;
  }
}

module.exports = ApiKeyManager;
