/**
 * Менеджер nonce для управления транзакциями в разных сетях
 * Решает проблему "nonce too low" при деплое в нескольких сетях
 */

const { ethers } = require('ethers');

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
    const { timeout = 10000, maxRetries = 3 } = options; // Увеличиваем таймаут и попытки
    
    const cacheKey = `${address}-${chainId}`;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
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

  /**
   * Быстрое получение nonce без retry (для критичных по времени операций)
   * @param {string} address - Адрес кошелька
   * @param {string} rpcUrl - RPC URL сети
   * @param {number} chainId - ID сети
   * @returns {Promise<number>} - Nonce
   */
  async getNonceFast(address, rpcUrl, chainId) {
    const cacheKey = `${address}-${chainId}`;
    const cachedNonce = this.nonceCache.get(cacheKey);
    
    if (cachedNonce !== undefined) {
      console.log(`[NonceManager] Быстрый nonce из кэша: ${cachedNonce} для ${address}:${chainId}`);
      return cachedNonce;
    }
    
    // Получаем RPC URLs из базы данных с fallback
    const rpcUrls = await this.getRpcUrlsFromDatabase(chainId, rpcUrl);
    
    for (const currentRpc of rpcUrls) {
      try {
        console.log(`[NonceManager] Пробуем RPC: ${currentRpc}`);
        const provider = new ethers.JsonRpcProvider(currentRpc);
        
        const networkNonce = await Promise.race([
          provider.getTransactionCount(address, 'pending'),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Fast nonce timeout')), 3000)
          )
        ]);
        
        this.nonceCache.set(cacheKey, networkNonce);
        console.log(`[NonceManager] ✅ Nonce получен: ${networkNonce} для ${address}:${chainId} с RPC: ${currentRpc}`);
        return networkNonce;
      } catch (error) {
        console.warn(`[NonceManager] RPC failed: ${currentRpc} - ${error.message}`);
        continue;
      }
    }
    
    // Если все RPC недоступны, возвращаем 0
    console.warn(`[NonceManager] Все RPC недоступны для ${address}:${chainId}, возвращаем 0`);
    this.nonceCache.set(cacheKey, 0);
    return 0;
  }

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
      // Получаем RPC из deploy_params (как в deploy-multichain.js)
      const DeployParamsService = require('../services/deployParamsService');
      const deployParamsService = new DeployParamsService();
      
      // Получаем последние параметры деплоя
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        const params = latestParams[0];
        const supportedChainIds = params.supported_chain_ids || [];
        const rpcUrlsFromParams = params.rpc_urls || [];
        
        // Находим RPC для нужного chainId
        const chainIndex = supportedChainIds.indexOf(chainId);
        if (chainIndex !== -1 && rpcUrlsFromParams[chainIndex]) {
          const deployRpcUrl = rpcUrlsFromParams[chainIndex];
          if (!rpcUrls.includes(deployRpcUrl)) {
            rpcUrls.push(deployRpcUrl);
            console.log(`[NonceManager] ✅ RPC из deploy_params для chainId ${chainId}: ${deployRpcUrl}`);
          }
        }
      }
      
      await deployParamsService.close();
    } catch (error) {
      console.warn(`[NonceManager] deploy_params недоступны для chainId ${chainId}, используем fallback: ${error.message}`);
    }
    
    // Всегда добавляем fallback RPC для надежности
    const fallbackRPCs = this.getFallbackRPCs(chainId);
    for (const fallbackRpc of fallbackRPCs) {
      if (!rpcUrls.includes(fallbackRpc)) {
        rpcUrls.push(fallbackRpc);
      }
    }
    
    console.log(`[NonceManager] RPC URLs для chainId ${chainId}:`, rpcUrls);
    return rpcUrls;
  }

  /**
   * Получить список fallback RPC для сети
   * @param {number} chainId - ID сети
   * @returns {Array} - Массив RPC URL
   */
  getFallbackRPCs(chainId) {
    const fallbackRPCs = {
      1: [ // Mainnet
        'https://eth.llamarpc.com',
        'https://rpc.ankr.com/eth',
        'https://ethereum.publicnode.com'
      ],
      11155111: [ // Sepolia
        'https://rpc.sepolia.org',
        process.env.SEPOLIA_INFURA_URL || 'https://sepolia.infura.io/v3/YOUR_INFURA_KEY'
      ],
      17000: [ // Holesky
        'https://ethereum-holesky.publicnode.com',
        process.env.HOLESKY_INFURA_URL || 'https://holesky.infura.io/v3/YOUR_INFURA_KEY'
      ],
      421614: [ // Arbitrum Sepolia
        'https://sepolia-rollup.arbitrum.io/rpc'
      ],
      84532: [ // Base Sepolia
        'https://sepolia.base.org'
      ]
    };
    
    return fallbackRPCs[chainId] || [];
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
      const provider = new ethers.JsonRpcProvider(rpcUrl);
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
}

// Создаем глобальный экземпляр
const nonceManager = new NonceManager();

module.exports = {
  NonceManager,
  nonceManager
};
