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

// alignNonce функция удалена - используем nonceManager.alignNonceToTarget() вместо этого

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
 * @param {number} chainId - ID цепочки
 * @param {string} privateKey - Приватный ключ
 * @param {Object} options - Опции соединения
 * @returns {Promise<Object>} - {provider, wallet, network}
 */
async function createRPCConnection(chainId, privateKey, options = {}) {
  const rpcManager = new RPCConnectionManager();
  return await rpcManager.createConnection(chainId, privateKey, options);
}

/**
 * Создает множественные RPC соединения с обработкой ошибок
 * @param {Array} chainIds - Массив chain ID
 * @param {string} privateKey - Приватный ключ
 * @param {Object} options - Опции соединения
 * @returns {Promise<Array>} - Массив успешных соединений
 */
async function createMultipleRPCConnections(chainIds, privateKey, options = {}) {
  const rpcManager = new RPCConnectionManager();
  return await rpcManager.createMultipleConnections(chainIds, privateKey, options);
}

// sendTransactionWithRetry функция удалена - используем RPCConnectionManager напрямую

// getNonceWithRetry функция удалена - используем nonceManager.getNonceWithRetry() вместо этого

module.exports = {
  getFeeOverrides,
  createProviderAndWallet,
  getNetworkInfo,
  getBalance,
  createRPCConnection,
  createMultipleRPCConnections
};
