/**
 * Общие утилиты для деплоя контрактов
 * Устраняет дублирование кода между скриптами деплоя
 * Copyright (c) 2024-2025 Тарабанов Александр Викторович
 */

const { ethers } = require('ethers');
const logger = require('./logger');
const RPCConnectionManager = require('./rpcConnectionManager');
const { nonceManager } = require('./nonceManager');

/**
 * Подбирает безопасные gas/fee для разных сетей (включая L2)
 * @param {Object} provider - Провайдер ethers
 * @param {Object} options - Опции для настройки
 * @returns {Promise<Object>} - Объект с настройками газа
 */
async function getFeeOverrides(provider, { minPriorityGwei = 1n, minFeeGwei = 20n } = {}) {
  try {
    const fee = await provider.getFeeData();
    const overrides = {};
    const minPriority = await ethers.parseUnits(minPriorityGwei.toString(), 'gwei');
    const minFee = await ethers.parseUnits(minFeeGwei.toString(), 'gwei');
    
    if (fee.maxFeePerGas) {
      overrides.maxFeePerGas = fee.maxFeePerGas < minFee ? minFee : fee.maxFeePerGas;
      overrides.maxPriorityFeePerGas = (fee.maxPriorityFeePerGas && fee.maxPriorityFeePerGas > 0n)
        ? fee.maxPriorityFeePerGas
        : minPriority;
    } else if (fee.gasPrice) {
      overrides.gasPrice = fee.gasPrice < minFee ? minFee : fee.gasPrice;
    }
    
    return overrides;
  } catch (error) {
    logger.error('Ошибка при получении fee overrides:', error);
    throw error;
  }
}

/**
 * Создает провайдер и кошелек для деплоя
 * @param {string} rpcUrl - URL RPC
 * @param {string} privateKey - Приватный ключ
 * @returns {Object} - Объект с провайдером и кошельком
 */
function createProviderAndWallet(rpcUrl, privateKey) {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    return { provider, wallet };
  } catch (error) {
    logger.error('Ошибка при создании провайдера и кошелька:', error);
    throw error;
  }
}

/**
 * Выравнивает nonce до целевого значения
 * @param {Object} wallet - Кошелек ethers
 * @param {Object} provider - Провайдер ethers
 * @param {number} targetNonce - Целевой nonce
 * @param {Object} options - Опции для настройки
 * @returns {Promise<number>} - Текущий nonce после выравнивания
 */
async function alignNonce(wallet, provider, targetNonce, options = {}) {
  try {
    // Используем nonceManager для получения актуального nonce
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const rpcUrl = provider._getConnection?.()?.url || 'unknown';
    
    let current = await nonceManager.getNonceFast(wallet.address, rpcUrl, chainId);
    
    if (current > targetNonce) {
      throw new Error(`Current nonce ${current} > target nonce ${targetNonce}`);
    }
    
    if (current < targetNonce) {
      logger.info(`Выравнивание nonce: ${current} -> ${targetNonce} (${targetNonce - current} транзакций)`);
      
      const { burnAddress = '0x000000000000000000000000000000000000dEaD' } = options;
      
      for (let i = current; i < targetNonce; i++) {
        const overrides = await getFeeOverrides(provider);
        const gasLimit = 21000n;
        
        try {
          const txFill = await wallet.sendTransaction({
            to: burnAddress,
            value: 0,
            gasLimit,
            ...overrides
          });
          
          logger.info(`Filler tx sent, hash=${txFill.hash}, nonce=${i}`);
          
          await txFill.wait();
          logger.info(`Filler tx confirmed, hash=${txFill.hash}, nonce=${i}`);
          
          // Обновляем nonce в кэше
          nonceManager.reserveNonce(wallet.address, chainId, i);
          current = i + 1;
        } catch (error) {
          logger.error(`Filler tx failed for nonce=${i}:`, error);
          throw error;
        }
      }
      
      logger.info(`Nonce alignment completed, current nonce=${current}`);
    } else {
      logger.info(`Nonce already aligned at ${current}`);
    }
    
    return current;
  } catch (error) {
    logger.error('Ошибка при выравнивании nonce:', error);
    throw error;
  }
}

/**
 * Получает информацию о сети
 * @param {Object} provider - Провайдер ethers
 * @returns {Promise<Object>} - Информация о сети
 */
async function getNetworkInfo(provider) {
  try {
    const network = await provider.getNetwork();
    return {
      chainId: Number(network.chainId),
      name: network.name
    };
  } catch (error) {
    logger.error('Ошибка при получении информации о сети:', error);
    throw error;
  }
}

/**
 * Проверяет баланс кошелька
 * @param {Object} provider - Провайдер ethers
 * @param {string} address - Адрес кошелька
 * @returns {Promise<string>} - Баланс в ETH
 */
async function getBalance(provider, address) {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    logger.error('Ошибка при получении баланса:', error);
    throw error;
  }
}

/**
 * Создает RPC соединение с retry логикой
 * @param {string} rpcUrl - URL RPC
 * @param {string} privateKey - Приватный ключ
 * @param {Object} options - Опции соединения
 * @returns {Promise<Object>} - {provider, wallet, network}
 */
async function createRPCConnection(rpcUrl, privateKey, options = {}) {
  const rpcManager = new RPCConnectionManager();
  return await rpcManager.createConnection(rpcUrl, privateKey, options);
}

/**
 * Создает множественные RPC соединения с обработкой ошибок
 * @param {Array} rpcUrls - Массив RPC URL
 * @param {string} privateKey - Приватный ключ
 * @param {Object} options - Опции соединения
 * @returns {Promise<Array>} - Массив успешных соединений
 */
async function createMultipleRPCConnections(rpcUrls, privateKey, options = {}) {
  const rpcManager = new RPCConnectionManager();
  return await rpcManager.createMultipleConnections(rpcUrls, privateKey, options);
}

/**
 * Выполняет транзакцию с retry логикой
 * @param {Object} wallet - Кошелек
 * @param {Object} txData - Данные транзакции
 * @param {Object} options - Опции
 * @returns {Promise<Object>} - Результат транзакции
 */
async function sendTransactionWithRetry(wallet, txData, options = {}) {
  const rpcManager = new RPCConnectionManager();
  return await rpcManager.sendTransactionWithRetry(wallet, txData, options);
}

/**
 * Получает nonce с retry логикой
 * @param {Object} provider - Провайдер
 * @param {string} address - Адрес
 * @param {Object} options - Опции
 * @returns {Promise<number>} - Nonce
 */
async function getNonceWithRetry(provider, address, options = {}) {
  // Используем быстрый метод по умолчанию
  if (options.fast !== false) {
    try {
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);
      const rpcUrl = provider._getConnection?.()?.url || 'unknown';
      return await nonceManager.getNonceFast(address, rpcUrl, chainId);
    } catch (error) {
      console.warn(`[deploymentUtils] Быстрый nonce failed, используем retry: ${error.message}`);
    }
  }
  
  // Fallback на retry метод
  return await nonceManager.getNonceWithRetry(provider, address, options);
}

module.exports = {
  getFeeOverrides,
  createProviderAndWallet,
  alignNonce,
  getNetworkInfo,
  getBalance,
  createRPCConnection,
  createMultipleRPCConnections,
  sendTransactionWithRetry,
  getNonceWithRetry
};
