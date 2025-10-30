/**
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 * All rights reserved.
 * 
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, or distribution is prohibited.
 * 
 * For licensing inquiries: info@hb3-accelerator.com
 * Website: https://hb3-accelerator.com
 * GitHub: https://github.com/VC-HB3-Accelerator
 */

/**
 * Менеджер nonce для управления транзакциями в разных сетях
 * Решает проблему "nonce too low" при деплое в нескольких сетях
 */

const { ethers } = require('ethers');
const { getRpcUrls } = require('./networkLoader');

class NonceManager {
  constructor() {
    this.nonceCache = new Map(); // Кэш nonce для каждого адреса и сети
    this.pendingTransactions = new Map(); // Отслеживание pending транзакций
  }

  /**
   * Получить актуальный nonce для адреса в сети с таймаутом и retry логикой
   * @param {string} address - Адрес кошелька
   * @param {string} rpcUrl - RPC URL сети
   * @param {number} chainId - ID сети
   * @param {Object} options - Опции (timeout, maxRetries)
   * @returns {Promise<number>} - Актуальный nonce
   */
  async getNonce(address, rpcUrl, chainId, options = {}) {
    const { timeout = 15000, maxRetries = 5 } = options; // Увеличиваем таймаут и попытки
    
    // КРИТИЧЕСКАЯ ПРОВЕРКА: логируем входящие параметры
    console.log(`[NonceManager] getNonce вызван с параметрами: address=${address}, rpcUrl=${rpcUrl}, chainId=${chainId}`);
    
    // КРИТИЧЕСКАЯ ПРОВЕРКА: если rpcUrl содержит 127.0.0.1:8545, это ошибка!
    if (rpcUrl && rpcUrl.includes('127.0.0.1:8545')) {
      console.error(`[NonceManager] ❌ КРИТИЧЕСКАЯ ОШИБКА: Получен неправильный rpcUrl: ${rpcUrl} для chainId ${chainId}`);
      throw new Error(`Получен неправильный rpcUrl: ${rpcUrl} для chainId ${chainId}`);
    }
    
    const cacheKey = `${address}-${chainId}`;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[NonceManager] Попытка ${attempt}: создаем JsonRpcProvider с rpcUrl: ${rpcUrl}`);
        const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
          polling: false, // Отключаем polling для более быстрого получения nonce
          staticNetwork: true
        });
        
        // Получаем nonce из сети с таймаутом
        const networkNonce = await Promise.race([
          provider.getTransactionCount(address, 'pending'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Nonce timeout')), timeout)
          )
        ]);
        
        // ВАЖНО: Не используем кэш для критических операций деплоя
        // Всегда получаем актуальный nonce из сети
        this.nonceCache.set(cacheKey, networkNonce);
        
        console.log(`[NonceManager] ${address}:${chainId} nonce=${networkNonce} (попытка ${attempt})`);
        
        return networkNonce;
      } catch (error) {
        console.error(`[NonceManager] Ошибка ${address}:${chainId} (${attempt}):`, error.message);
        
        if (attempt === maxRetries) {
          // В случае критической ошибки, сбрасываем кэш и пробуем еще раз
          this.nonceCache.delete(cacheKey);
          throw new Error(`Не удалось получить nonce после ${maxRetries} попыток: ${error.message}`);
        }
        
        // Увеличиваем задержку между попытками
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * Зарезервировать nonce для транзакции
   * @param {string} address - Адрес кошелька
   * @param {number} chainId - ID сети
   * @param {number} nonce - Nonce для резервирования
   */
  reserveNonce(address, chainId, nonce) {
    const cacheKey = `${address}-${chainId}`;
    const currentNonce = this.nonceCache.get(cacheKey) || 0;
    
    if (nonce >= currentNonce) {
      this.nonceCache.set(cacheKey, nonce + 1);
      console.log(`[NonceManager] Зарезервирован nonce ${nonce} для ${address} в сети ${chainId}`);
    } else {
      console.warn(`[NonceManager] Попытка использовать nonce ${nonce} меньше текущего ${currentNonce} для ${address} в сети ${chainId}`);
    }
  }

  /**
   * Отметить транзакцию как pending
   * @param {string} address - Адрес кошелька
   * @param {number} chainId - ID сети
   * @param {number} nonce - Nonce транзакции
   * @param {string} txHash - Хэш транзакции
   */
  markTransactionPending(address, chainId, nonce, txHash) {
    const cacheKey = `${address}-${chainId}`;
    const pendingTxs = this.pendingTransactions.get(cacheKey) || [];
    
    pendingTxs.push({
      nonce,
      txHash,
      timestamp: Date.now()
    });
    
    this.pendingTransactions.set(cacheKey, pendingTxs);
    console.log(`[NonceManager] Отмечена pending транзакция ${txHash} с nonce ${nonce} для ${address} в сети ${chainId}`);
  }

  /**
   * Отметить транзакцию как подтвержденную
   * @param {string} address - Адрес кошелька
   * @param {number} chainId - ID сети
   * @param {string} txHash - Хэш транзакции
   */
  markTransactionConfirmed(address, chainId, txHash) {
    const cacheKey = `${address}-${chainId}`;
    const pendingTxs = this.pendingTransactions.get(cacheKey) || [];
    
    const txIndex = pendingTxs.findIndex(tx => tx.txHash === txHash);
    if (txIndex !== -1) {
      const tx = pendingTxs[txIndex];
      pendingTxs.splice(txIndex, 1);
      
      console.log(`[NonceManager] Транзакция ${txHash} подтверждена для ${address} в сети ${chainId}`);
    }
  }

  /**
   * Очистить старые pending транзакции
   * @param {string} address - Адрес кошелька
   * @param {number} chainId - ID сети
   * @param {number} maxAge - Максимальный возраст в миллисекундах (по умолчанию 5 минут)
   */
  clearOldPendingTransactions(address, chainId, maxAge = 5 * 60 * 1000) {
    const cacheKey = `${address}-${chainId}`;
    const pendingTxs = this.pendingTransactions.get(cacheKey) || [];
    const now = Date.now();
    
    const validTxs = pendingTxs.filter(tx => (now - tx.timestamp) < maxAge);
    
    if (validTxs.length !== pendingTxs.length) {
      this.pendingTransactions.set(cacheKey, validTxs);
      console.log(`[NonceManager] Очищено ${pendingTxs.length - validTxs.length} старых pending транзакций для ${address} в сети ${chainId}`);
    }
  }

  /**
   * Получить информацию о pending транзакциях
   * @param {string} address - Адрес кошелька
   * @param {number} chainId - ID сети
   * @returns {Array} - Массив pending транзакций
   */
  getPendingTransactions(address, chainId) {
    const cacheKey = `${address}-${chainId}`;
    return this.pendingTransactions.get(cacheKey) || [];
  }

  /**
   * Сбросить кэш nonce для адреса и сети
   * @param {string} address - Адрес кошелька
   * @param {number} chainId - ID сети
   */
  resetNonce(address, chainId) {
    const cacheKey = `${address}-${chainId}`;
    this.nonceCache.delete(cacheKey);
    this.pendingTransactions.delete(cacheKey);
    console.log(`[NonceManager] Сброшен кэш nonce для ${address} в сети ${chainId}`);
  }

  /**
   * Получить статистику по nonce
   * @returns {Object} - Статистика
   */
  getStats() {
    return {
      nonceCache: Object.fromEntries(this.nonceCache),
      pendingTransactions: Object.fromEntries(this.pendingTransactions)
    };
  }

  // getNonceFast функция удалена - используем getNonce() вместо этого

  /**
   * Получить RPC URLs из базы данных с fallback
   * @param {number} chainId - ID сети
   * @param {string} primaryRpcUrl - Основной RPC URL (опциональный)
   * @returns {Promise<Array>} - Массив RPC URL
   */
  async getRpcUrlsFromDatabase(chainId, primaryRpcUrl = null) {
    const rpcUrls = [];
    
    // Добавляем основной RPC URL если указан
    if (primaryRpcUrl) {
      rpcUrls.push(primaryRpcUrl);
    }
    
    try {
      // Используем networkLoader для получения RPC URLs
      const { getRpcUrls } = require('./networkLoader');
      const rpcUrlsFromLoader = await getRpcUrls();
      
      // Получаем RPC для конкретного chainId
      const chainRpcUrl = rpcUrlsFromLoader[chainId] || rpcUrlsFromLoader[chainId.toString()];
      if (chainRpcUrl && !rpcUrls.includes(chainRpcUrl)) {
        rpcUrls.push(chainRpcUrl);
        console.log(`[NonceManager] ✅ RPC из networkLoader для chainId ${chainId}: ${chainRpcUrl}`);
      }
    } catch (error) {
      console.warn(`[NonceManager] networkLoader недоступен для chainId ${chainId}, используем fallback: ${error.message}`);
    }
    
    // Всегда добавляем fallback RPC для надежности ИЗ БАЗЫ ДАННЫХ
    const fallbackRPCs = await this.getFallbackRPCs(chainId);
    for (const fallbackRpc of fallbackRPCs) {
      if (!rpcUrls.includes(fallbackRpc)) {
        rpcUrls.push(fallbackRpc);
      }
    }
    
    console.log(`[NonceManager] RPC URLs для chainId ${chainId}:`, rpcUrls);
    return rpcUrls;
  }

  /**
   * Получить список fallback RPC для сети ИЗ БАЗЫ ДАННЫХ
   * @param {number} chainId - ID сети
   * @returns {Array} - Массив RPC URL из базы данных
   */
  async getFallbackRPCs(chainId) {
    try {
      // Получаем ВСЕ RPC провайдеры для данной сети из базы данных
      const rpcService = require('../services/rpcProviderService');
      const providers = await rpcService.getAllRpcProviders();
      
      // Фильтруем по chain_id
      const networkProviders = providers.filter(p => p.chain_id === chainId);
      
      if (networkProviders.length === 0) {
        console.warn(`[NonceManager] Нет RPC провайдеров в базе данных для chain_id: ${chainId}`);
        return [];
      }
      
      // Возвращаем только RPC URL из базы данных
      return networkProviders.map(p => p.rpc_url).filter(url => url);
      
    } catch (error) {
      console.error(`[NonceManager] Ошибка получения RPC из базы данных для chain_id ${chainId}:`, error);
      return [];
    }
  }

  /**
   * Интеграция с существующими системами - замена для rpcConnectionManager
   * @param {Object} provider - Провайдер ethers
   * @param {string} address - Адрес кошелька
   * @param {Object} options - Опции
   * @returns {Promise<number>} - Nonce
   */
  async getNonceWithRetry(provider, address, options = {}) {
    // Извлекаем chainId из провайдера
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    
    // Получаем RPC URL из провайдера (если возможно)
    const rpcUrl = provider._getConnection?.()?.url || 'unknown';
    
    return await this.getNonce(address, rpcUrl, chainId, options);
  }

  /**
   * Принудительно обновляет nonce из сети (для обработки race conditions)
   * @param {string} address - Адрес кошелька
   * @param {string} rpcUrl - RPC URL сети
   * @param {number} chainId - ID сети
   * @returns {Promise<number>} - Актуальный nonce
   */
  async forceRefreshNonce(address, rpcUrl, chainId) {
    const cacheKey = `${address}-${chainId}`;
    
    try {
      const provider = new ethers.JsonRpcProvider(await rpcService.getRpcUrlByChainId(chainId));
      const networkNonce = await provider.getTransactionCount(address, 'pending');
      
      // Принудительно обновляем кэш
      this.nonceCache.set(cacheKey, networkNonce);
      
      console.log(`[NonceManager] Force refreshed nonce for ${address}:${chainId} = ${networkNonce}`);
      return networkNonce;
    } catch (error) {
      console.error(`[NonceManager] Force refresh failed for ${address}:${chainId}:`, error.message);
      throw error;
    }
  }

  /**
   * Выровнять nonce до целевого значения с помощью filler транзакций
   * @param {string} address - Адрес кошелька
   * @param {string} rpcUrl - RPC URL сети
   * @param {number} chainId - ID сети
   * @param {number} targetNonce - Целевой nonce
   * @param {Object} wallet - Кошелек для отправки транзакций
   * @param {Object} options - Опции (gasLimit, maxRetries)
   * @returns {Promise<number>} - Финальный nonce
   */
  async alignNonceToTarget(address, rpcUrl, chainId, targetNonce, wallet, options = {}) {
    const { gasLimit = 21000, maxRetries = 5 } = options;
    const burnAddress = "0x000000000000000000000000000000000000dEaD";
    
    // Получаем текущий nonce
    let current = await this.getNonce(address, rpcUrl, chainId, { timeout: 15000, maxRetries: 5 });
    console.log(`[NonceManager] Aligning nonce ${current} -> ${targetNonce} for ${address}:${chainId}`);
    
    if (current >= targetNonce) {
      console.log(`[NonceManager] Nonce already aligned: ${current} >= ${targetNonce}`);
      return current;
    }
    
    // Используем RPCConnectionManager для retry логики
    const RPCConnectionManager = require('./rpcConnectionManager');
    const rpcManager = new RPCConnectionManager();
    
    // Выравниваем nonce с помощью filler транзакций
    while (current < targetNonce) {
      console.log(`[NonceManager] Sending filler tx nonce=${current} for ${address}:${chainId}`);
      
      try {
        const txData = {
          to: burnAddress,
          value: 0n,
          nonce: current,
          gasLimit,
        };
        
        const result = await rpcManager.sendTransactionWithRetry(wallet, txData, { maxRetries });
        console.log(`[NonceManager] Filler tx sent: ${result.tx.hash} for nonce=${current}`);
        current++;
        
      } catch (e) {
        const errorMsg = e?.message || e;
        console.warn(`[NonceManager] Filler tx failed: ${errorMsg}`);
        
        // Обрабатываем ошибки nonce
        if (String(errorMsg).toLowerCase().includes('nonce too low')) {
          this.resetNonce(address, chainId);
          const newNonce = await this.getNonce(address, rpcUrl, chainId, { timeout: 15000, maxRetries: 5 });
          console.log(`[NonceManager] Nonce changed from ${current} to ${newNonce}`);
          current = newNonce;
          
          if (current >= targetNonce) {
            console.log(`[NonceManager] Nonce alignment completed: ${current} >= ${targetNonce}`);
            return current;
          }
          continue;
        }
        
        throw new Error(`Failed to send filler tx for nonce=${current}: ${errorMsg}`);
      }
    }
    
    console.log(`[NonceManager] Nonce alignment completed: ${current} for ${address}:${chainId}`);
    return current;
  }
}

// Создаем глобальный экземпляр
const nonceManager = new NonceManager();

module.exports = {
  NonceManager,
  nonceManager
};
