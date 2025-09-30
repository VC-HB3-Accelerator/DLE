/**
 * Менеджер RPC соединений с retry логикой и обработкой ошибок
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const { ethers } = require('ethers');
const logger = require('./logger');

class RPCConnectionManager {
  constructor() {
    this.connections = new Map(); // Кэш соединений
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000, // 1 секунда
      maxDelay: 10000, // 10 секунд
      timeout: 30000 // 30 секунд
    };
  }

  /**
   * Создает RPC соединение с retry логикой
   * @param {string} rpcUrl - URL RPC
   * @param {string} privateKey - Приватный ключ
   * @param {Object} options - Опции соединения
   * @returns {Promise<Object>} - {provider, wallet, network}
   */
  async createConnection(rpcUrl, privateKey, options = {}) {
    const config = { ...this.retryConfig, ...options };
    const connectionKey = `${rpcUrl}_${privateKey}`;
    
    // Проверяем кэш
    if (this.connections.has(connectionKey)) {
      const cached = this.connections.get(connectionKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 минута кэш
        logger.info(`[RPC_MANAGER] Используем кэшированное соединение: ${rpcUrl}`);
        return cached.connection;
      }
    }

    logger.info(`[RPC_MANAGER] Создаем новое RPC соединение: ${rpcUrl}`);
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
          polling: false,
          staticNetwork: false
        });
        
        // Проверяем соединение с timeout
        const network = await Promise.race([
          provider.getNetwork(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('RPC timeout')), config.timeout)
          )
        ]);
        
        const wallet = new ethers.Wallet(privateKey, provider);
        
        const connection = { provider, wallet, network };
        
        // Кэшируем соединение
        this.connections.set(connectionKey, {
          connection,
          timestamp: Date.now()
        });
        
        logger.info(`[RPC_MANAGER] ✅ RPC соединение установлено: ${rpcUrl} (chainId: ${network.chainId})`);
        return connection;
        
      } catch (error) {
        logger.error(`[RPC_MANAGER] ❌ Попытка ${attempt}/${config.maxRetries} failed: ${error.message}`);
        
        if (attempt === config.maxRetries) {
          throw new Error(`RPC соединение не удалось установить после ${config.maxRetries} попыток: ${error.message}`);
        }
        
        // Экспоненциальная задержка
        const delay = Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay);
        logger.info(`[RPC_MANAGER] Ожидание ${delay}ms перед повторной попыткой...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Создает множественные RPC соединения с обработкой ошибок
   * @param {Array} rpcUrls - Массив RPC URL
   * @param {string} privateKey - Приватный ключ
   * @param {Object} options - Опции соединения
   * @returns {Promise<Array>} - Массив успешных соединений
   */
  async createMultipleConnections(rpcUrls, privateKey, options = {}) {
    logger.info(`[RPC_MANAGER] Создаем ${rpcUrls.length} RPC соединений...`);
    
    const connectionPromises = rpcUrls.map(async (rpcUrl, index) => {
      try {
        const connection = await this.createConnection(rpcUrl, privateKey, options);
        return { index, rpcUrl, ...connection, success: true };
      } catch (error) {
        logger.error(`[RPC_MANAGER] ❌ Соединение ${index + 1} failed: ${rpcUrl} - ${error.message}`);
        return { index, rpcUrl, error: error.message, success: false };
      }
    });
    
    const results = await Promise.all(connectionPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    logger.info(`[RPC_MANAGER] ✅ Успешных соединений: ${successful.length}/${rpcUrls.length}`);
    if (failed.length > 0) {
      logger.warn(`[RPC_MANAGER] ⚠️ Неудачных соединений: ${failed.length}`);
      failed.forEach(f => logger.warn(`[RPC_MANAGER] - ${f.rpcUrl}: ${f.error}`));
    }
    
    if (successful.length === 0) {
      throw new Error('Не удалось установить ни одного RPC соединения');
    }
    
    return successful;
  }

  /**
   * Выполняет транзакцию с retry логикой
   * @param {Object} wallet - Кошелек
   * @param {Object} txData - Данные транзакции
   * @param {Object} options - Опции
   * @returns {Promise<Object>} - Результат транзакции
   */
  async sendTransactionWithRetry(wallet, txData, options = {}) {
    const config = { ...this.retryConfig, ...options };
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        logger.info(`[RPC_MANAGER] Отправка транзакции (попытка ${attempt}/${config.maxRetries})`);
        
        const tx = await wallet.sendTransaction({
          ...txData,
          timeout: config.timeout
        });
        
        logger.info(`[RPC_MANAGER] ✅ Транзакция отправлена: ${tx.hash}`);
        
        // Ждем подтверждения с timeout
        const receipt = await Promise.race([
          tx.wait(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction timeout')), config.timeout)
          )
        ]);
        
        logger.info(`[RPC_MANAGER] ✅ Транзакция подтверждена: ${tx.hash}`);
        return { tx, receipt, success: true };
        
      } catch (error) {
        logger.error(`[RPC_MANAGER] ❌ Транзакция failed (попытка ${attempt}): ${error.message}`);
        
        if (attempt === config.maxRetries) {
          throw new Error(`Транзакция не удалась после ${config.maxRetries} попыток: ${error.message}`);
        }
        
        // Проверяем, стоит ли повторять
        if (this.shouldRetry(error)) {
          const delay = Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay);
          logger.info(`[RPC_MANAGER] Ожидание ${delay}ms перед повторной попыткой...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Определяет, стоит ли повторять операцию
   * @param {Error} error - Ошибка
   * @returns {boolean} - Стоит ли повторять
   */
  shouldRetry(error) {
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'RPC timeout',
      'Transaction timeout'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
  }

  // getNonceWithRetry функция удалена - используем nonceManager.getNonceWithRetry() вместо этого

  /**
   * Очищает кэш соединений
   */
  clearCache() {
    this.connections.clear();
    logger.info('[RPC_MANAGER] Кэш соединений очищен');
  }

  /**
   * Получает статистику соединений
   * @returns {Object} - Статистика
   */
  getStats() {
    return {
      cachedConnections: this.connections.size,
      retryConfig: this.retryConfig
    };
  }
}

module.exports = RPCConnectionManager;
