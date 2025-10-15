/**
 * Менеджер прокси настроек для RPC провайдеров
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const rpcProviderService = require('../services/rpcProviderService');

class ProxyManager {
  constructor() {
    this.initialized = false;
  }

  /**
   * Инициализация менеджера прокси
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      await this.configureNoProxyFromRpcProviders();
      this.initialized = true;
      console.log('[ProxyManager] ✅ Инициализация завершена');
    } catch (error) {
      console.error('[ProxyManager] ❌ Ошибка инициализации:', error.message);
      throw error;
    }
  }

  /**
   * Настройка NO_PROXY на основе RPC провайдеров из базы данных
   */
  async configureNoProxyFromRpcProviders() {
    try {
      const providers = await rpcProviderService.getAllRpcProviders();
      
      const rpcDomains = providers
        .map(provider => provider.rpc_url)
        .filter(url => url && url.startsWith('http'))
        .map(url => {
          try {
            const urlObj = new URL(url);
            return urlObj.hostname;
          } catch (e) {
            console.warn(`[ProxyManager] Неверный URL: ${url}`, e.message);
            return null;
          }
        })
        .filter(hostname => hostname)
        .filter((hostname, index, array) => array.indexOf(hostname) === index); // убираем дубликаты
      
      if (rpcDomains.length > 0) {
        const existingNoProxy = process.env.NO_PROXY || '';
        
        // Добавляем RPC домены к существующему NO_PROXY
        const newDomains = rpcDomains.filter(domain => !existingNoProxy.includes(domain));
        
        if (newDomains.length > 0) {
          process.env.NO_PROXY = existingNoProxy ? `${existingNoProxy},${newDomains.join(',')}` : newDomains.join(',');
          console.log('[ProxyManager] ✅ Добавлены RPC домены в NO_PROXY:', newDomains.join(', '));
          console.log('[ProxyManager] 📋 Обновленный NO_PROXY:', process.env.NO_PROXY);
        } else {
          console.log('[ProxyManager] ℹ️ Все RPC домены уже в NO_PROXY');
        }
      } else {
        console.warn('[ProxyManager] ⚠️ Не найдено RPC провайдеров для настройки NO_PROXY');
      }
    } catch (error) {
      console.error('[ProxyManager] ❌ Не удалось загрузить RPC провайдеры для NO_PROXY:', error.message);
      throw error;
    }
  }

  /**
   * Проверить текущие настройки прокси
   */
  getProxyStatus() {
    return {
      httpProxy: process.env.HTTP_PROXY || null,
      httpsProxy: process.env.HTTPS_PROXY || null,
      noProxy: process.env.NO_PROXY || null,
      initialized: this.initialized
    };
  }

  /**
   * Принудительно обновить настройки NO_PROXY
   */
  async refresh() {
    this.initialized = false;
    await this.initialize();
  }
}

// Создаем singleton
const proxyManager = new ProxyManager();

module.exports = {
  ProxyManager,
  proxyManager,
  // Экспортируем методы для удобства
  initialize: () => proxyManager.initialize(),
  configureNoProxyFromRpcProviders: () => proxyManager.configureNoProxyFromRpcProviders(),
  getProxyStatus: () => proxyManager.getProxyStatus(),
  refresh: () => proxyManager.refresh()
};
