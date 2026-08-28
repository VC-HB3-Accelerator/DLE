/**
 * Менеджер RPC соединений с retry логикой и обработкой ошибок
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
 */

const { ethers } = require('ethers');
const logger = require('./logger');
const rpcService = require('../services/rpcProviderService');

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
   * @param {number} chainId - ID цепочки
   * @param {string} privateKey - Приватный ключ
   * @param {Object} options - Опции соединения
   * @returns {Promise<Object>} - {provider, wallet, network}
   */
  async createConnection(chainId, privateKey, options = {}) {
    const config = { ...this.retryConfig, ...options };
    const rpcUrl = (options.rpcUrlsByChainId && options.rpcUrlsByChainId[String(chainId)])
      || (options.rpcUrlsByChainId && options.rpcUrlsByChainId[Number(chainId)])
      || options.rpcUrl
      || await rpcService.getRpcUrlByChainId(chainId);
    logger.info(`[RPC_MANAGER] Получен RPC URL для chainId ${chainId}: ${rpcUrl}`);
    
    // КРИТИЧЕСКАЯ ПРОВЕРКА: если rpcUrl содержит 127.0.0.1:8545, это ошибка!
    if (rpcUrl && rpcUrl.includes('127.0.0.1:8545')) {
      logger.error(`[RPC_MANAGER] ❌ КРИТИЧЕСКАЯ ОШИБКА: Получен неправильный RPC URL: ${rpcUrl} для chainId ${chainId}`);
      throw new Error(`Получен неправильный RPC URL: ${rpcUrl} для chainId ${chainId}`);
    }
    
    if (!rpcUrl) {
      throw new Error(`RPC URL не найден для chainId ${chainId}`);
    }
    
    const connectionKey = `${rpcUrl}_${privateKey}`;
    
    // Проверяем кэш
    if (this.connections.has(connectionKey)) {
      const cached = this.connections.get(connectionKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 минута кэш
        logger.info(`[RPC_MANAGER] Используем кэшированное соединение: ${rpcUrl}`);
        // Убеждаемся, что кэшированное соединение содержит rpcUrl
        return { ...cached.connection, rpcUrl };
      }
    }

    logger.info(`[RPC_MANAGER] Создаем новое RPC соединение: ${rpcUrl}`);
    
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl, Number(chainId), {
          polling: false,
          staticNetwork: true,
        });
        
        // Проверяем соединение с timeout
        const network = await Promise.race([
          provider.getNetwork(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('RPC timeout')), config.timeout)
          )
        ]);
        
        const wallet = new ethers.Wallet(privateKey, provider);
        
        const connection = { provider, wallet, network, rpcUrl };
        
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
   * @param {Array} chainIds - Массив chain ID
   * @param {string} privateKey - Приватный ключ
   * @param {Object} options - Опции соединения
   * @returns {Promise<Array>} - Массив успешных соединений
   */
  async createMultipleConnections(chainIds, privateKey, options = {}) {
    logger.info(`[RPC_MANAGER] Создаем ${chainIds.length} RPC соединений...`);
    
    const connectionPromises = chainIds.map(async (chainId, index) => {
      try {
        const connection = await this.createConnection(chainId, privateKey, options);
        return { index, chainId, ...connection, success: true };
      } catch (error) {
        logger.error(`[RPC_MANAGER] ❌ Соединение ${index + 1} failed: chainId ${chainId} - ${error.message}`);
        return { index, chainId, error: error.message, success: false };
      }
    });
    
    const results = await Promise.all(connectionPromises);
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    logger.info(`[RPC_MANAGER] ✅ Успешных соединений: ${successful.length}/${chainIds.length}`);
    if (failed.length > 0) {
      logger.warn(`[RPC_MANAGER] ⚠️ Неудачных соединений: ${failed.length}`);
      failed.forEach(f => logger.warn(`[RPC_MANAGER] - ChainId ${f.chainId}: ${f.error}`));
      throw new Error(
        `RPC не для всех сетей: ${failed.map((f) => `${f.chainId}: ${f.error}`).join('; ')}`
      );
    }
    
    if (successful.length === 0) {
      throw new Error('Не удалось установить ни одного RPC соединения');
    }
    
    return successful;
  }

  _isAlreadyBroadcast(error) {
    const msg = String(error?.message || error).toLowerCase();
    return (
      msg.includes('already known') ||
      msg.includes('known transaction') ||
      msg.includes('nonce too low')
    );
  }

  async _waitUntilNonceMined(wallet, nonce, timeoutMs) {
    const provider = wallet.provider;
    const address = await wallet.getAddress();
    const want = Number(nonce);
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const latest = await provider.getTransactionCount(address, 'latest');
      if (latest > want) {
        logger.info(`[RPC_MANAGER] nonce ${want} mined (latest=${latest})`);
        return { status: 1, nonce: want };
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error(`Timeout waiting for nonce ${want} to mine`);
  }

  /**
   * Отправка tx. Уже попавшую в mempool НЕ ресендить тем же nonce
   * (already known после timeout — так жглись filler/CREATE).
   */
  async sendTransactionWithRetry(wallet, txData, options = {}) {
    const config = { ...this.retryConfig, ...options };
    const confirmTimeout = options.confirmTimeout || 180000;
    let sentTx = null;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        if (!sentTx) {
          logger.info(`[RPC_MANAGER] Отправка транзакции (попытка ${attempt}/${config.maxRetries})`);
          try {
            sentTx = await wallet.sendTransaction({
              ...txData,
            });
            logger.info(`[RPC_MANAGER] ✅ Транзакция отправлена: ${sentTx.hash}`);
          } catch (sendErr) {
            if (this._isAlreadyBroadcast(sendErr) && txData.nonce != null) {
              logger.warn(
                `[RPC_MANAGER] tx nonce=${txData.nonce} уже в mempool (${sendErr.message}); ждём майнинг, без resend`
              );
              const receipt = await this._waitUntilNonceMined(wallet, txData.nonce, confirmTimeout);
              const tx = {
                hash: receipt.hash || 'already-known',
                nonce: txData.nonce,
                wait: async () => receipt,
              };
              return { tx, receipt, success: true };
            }
            throw sendErr;
          }
        }

        const receipt = await Promise.race([
          sentTx.wait(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Transaction timeout')), confirmTimeout)
          ),
        ]);

        logger.info(`[RPC_MANAGER] ✅ Транзакция подтверждена: ${sentTx.hash}`);
        return { tx: sentTx, receipt, success: true };
      } catch (error) {
        logger.error(`[RPC_MANAGER] ❌ Транзакция failed (попытка ${attempt}): ${error.message}`);

        if (sentTx && String(error.message || '').toLowerCase().includes('timeout')) {
          logger.warn(`[RPC_MANAGER] wait timeout для ${sentTx.hash} — не ресендим, ждём тот же hash`);
          try {
            const receipt = await sentTx.wait();
            return { tx: sentTx, receipt, success: true };
          } catch (waitErr) {
            if (attempt === config.maxRetries) {
              throw new Error(`Транзакция не подтвердилась: ${waitErr.message}`);
            }
            continue;
          }
        }

        if (attempt === config.maxRetries) {
          throw new Error(`Транзакция не удалась после ${config.maxRetries} попыток: ${error.message}`);
        }

        if (this.shouldRetry(error) && !sentTx) {
          const delay = Math.min(config.baseDelay * Math.pow(2, attempt - 1), config.maxDelay);
          logger.info(`[RPC_MANAGER] Ожидание ${delay}ms перед повторной попыткой...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else if (sentTx) {
          continue;
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
      'Transaction timeout',
      'ECONNREFUSED',
      'ENETUNREACH',
      'EHOSTUNREACH'
    ];
    
    const errorMessage = error.message.toLowerCase();
    const isRetryable = retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError.toLowerCase())
    );
    
    // Логируем информацию об ошибке для диагностики
    if (isRetryable) {
      logger.warn(`[RPC_MANAGER] Повторяемая ошибка: ${error.message}`);
    } else {
      logger.error(`[RPC_MANAGER] Неповторяемая ошибка: ${error.message}`);
    }
    
    return isRetryable;
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
