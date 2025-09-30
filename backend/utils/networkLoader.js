/**
 * Утилита для загрузки поддерживаемых сетей из deploy_params
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const DeployParamsService = require('../services/deployParamsService');

class NetworkLoader {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 минут
    this.fallbackChainIds = [11155111, 421614, 84532, 17000];
  }

  /**
   * Общий метод для загрузки данных из deploy_params
   * @param {string} field - Поле для извлечения
   * @param {boolean} useCache - Использовать кеш
   * @returns {Promise<Array|Object>} - Данные из deploy_params
   */
  async _loadFromDatabase(field, useCache = true) {
    const cacheKey = field;
    
    // Проверяем кеш
    if (useCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        console.log(`📋 Используем кешированные ${field}`);
        return cached.data;
      }
    }

    try {
      const deployParamsService = new DeployParamsService();
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      await deployParamsService.close();
      
      if (latestParams.length > 0) {
        const params = latestParams[0];
        let data;
        
        switch (field) {
          case 'supportedChainIds':
            data = params.supportedChainIds || params.supported_chain_ids || [];
            break;
          case 'rpcUrls':
            data = params.rpcUrls || params.rpc_urls || {};
            break;
          default:
            data = params[field] || {};
        }
        
        console.log(`✅ Загружены ${field} из deploy_params:`, Array.isArray(data) ? data : Object.keys(data));
        
        // Кешируем результат
        this.cache.set(cacheKey, {
          data: data,
          timestamp: Date.now()
        });
        
        return data;
      }
      
      // Если нет данных в deploy_params
      console.log(`⚠️ Нет ${field} в deploy_params`);
      return field === 'supportedChainIds' ? this.fallbackChainIds : {};
    } catch (error) {
      console.error(`❌ Ошибка загрузки ${field}:`, error.message);
      return field === 'supportedChainIds' ? this.fallbackChainIds : {};
    }
  }

  /**
   * Получить поддерживаемые сети из deploy_params
   * @param {boolean} useCache - Использовать кеш
   * @returns {Promise<Array>} - Массив chainId
   */
  async getSupportedChainIds(useCache = true) {
    return await this._loadFromDatabase('supportedChainIds', useCache);
  }

  /**
   * Получить RPC URLs из deploy_params
   * @param {boolean} useCache - Использовать кеш
   * @returns {Promise<Object>} - Объект с RPC URLs
   */
  async getRpcUrls(useCache = true) {
    return await this._loadFromDatabase('rpcUrls', useCache);
  }

  /**
   * Очистить кеш
   */
  clearCache() {
    this.cache.clear();
    console.log('🗑️ Кеш NetworkLoader очищен');
  }
}

// Создаем singleton
const networkLoader = new NetworkLoader();

module.exports = {
  NetworkLoader,
  networkLoader,
  // Экспортируем методы для удобства
  getSupportedChainIds: () => networkLoader.getSupportedChainIds(),
  getRpcUrls: () => networkLoader.getRpcUrls(),
  clearCache: () => networkLoader.clearCache()
};
