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

// Сервис для работы с мульти-чейн функциональностью DLE
import axios from 'axios';

/**
 * Получает список поддерживаемых сетей
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Список сетей
 */
export const getSupportedChains = async (dleAddress) => {
  try {
    const response = await axios.post('/dle-multichain/get-supported-chains', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении поддерживаемых сетей:', error);
    throw error;
  }
};

/**
 * Проверяет поддержку сети
 * @param {string} dleAddress - Адрес DLE
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Статус поддержки
 */
export const isChainSupported = async (dleAddress, chainId) => {
  try {
    const response = await axios.post('/dle-multichain/is-chain-supported', {
      dleAddress,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке поддержки сети:', error);
    throw error;
  }
};

/**
 * Получает текущую сеть
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Текущая сеть
 */
export const getCurrentChainId = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-current-chain-id', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении текущей сети:', error);
    throw error;
  }
};

/**
 * Исполняет предложение по подписям
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} executionData - Данные исполнения
 * @returns {Promise<Object>} - Результат исполнения
 */
export const executeProposalBySignatures = async (dleAddress, executionData) => {
  try {
    const response = await axios.post('/dle-multichain/execute-proposal-by-signatures', {
      dleAddress,
      ...executionData
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при исполнении предложения по подписям:', error);
    throw error;
  }
};

/**
 * Проверяет готовность синхронизации
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Готовность синхронизации
 */
export const checkSyncReadiness = async (dleAddress, proposalId) => {
  try {
    const response = await axios.post('/dle-multichain/check-sync-readiness', {
      dleAddress,
      proposalId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке готовности синхронизации:', error);
    throw error;
  }
};

/**
 * Синхронизирует предложение во все сети
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат синхронизации
 */
export const syncToAllChains = async (dleAddress, proposalId) => {
  try {
    const response = await axios.post('/dle-multichain/sync-to-all-chains', {
      dleAddress,
      proposalId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при синхронизации во все сети:', error);
    throw error;
  }
};

/**
 * Получает статус синхронизации
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Статус синхронизации
 */
export const getSyncStatus = async (dleAddress, proposalId) => {
  try {
    const response = await axios.post('/blockchain/get-sync-status', {
      dleAddress,
      proposalId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статуса синхронизации:', error);
    throw error;
  }
};

/**
 * Получает информацию о сети
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Информация о сети
 */
export const getChainInfo = async (chainId) => {
  try {
    const response = await axios.post('/blockchain/get-chain-info', {
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении информации о сети:', error);
    throw error;
  }
};

/**
 * Получает RPC URL для сети
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - RPC URL
 */
export const getRpcUrl = async (chainId) => {
  try {
    const response = await axios.post('/blockchain/get-rpc-url', {
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении RPC URL:', error);
    throw error;
  }
};

/**
 * Проверяет подключение к сети
 * @param {string} dleAddress - Адрес DLE
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Статус подключения
 */
export const checkChainConnection = async (dleAddress, chainId) => {
  try {
    const response = await axios.post('/dle-multichain/check-chain-connection', {
      dleAddress,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке подключения к сети:', error);
    throw error;
  }
};

/**
 * Получает баланс в сети
 * @param {string} dleAddress - Адрес DLE
 * @param {string} userAddress - Адрес пользователя
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Баланс в сети
 */
export const getChainBalance = async (dleAddress, userAddress, chainId) => {
  try {
    const response = await axios.post('/blockchain/get-chain-balance', {
      dleAddress,
      userAddress,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении баланса в сети:', error);
    throw error;
  }
};

/**
 * Получает предложения в сети
 * @param {string} dleAddress - Адрес DLE
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Предложения в сети
 */
export const getChainProposals = async (dleAddress, chainId) => {
  try {
    const response = await axios.post('/blockchain/get-chain-proposals', {
      dleAddress,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении предложений в сети:', error);
    throw error;
  }
};

/**
 * Получает модули в сети
 * @param {string} dleAddress - Адрес DLE
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Модули в сети
 */
export const getChainModules = async (dleAddress, chainId) => {
  try {
    const response = await axios.post('/blockchain/get-chain-modules', {
      dleAddress,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении модулей в сети:', error);
    throw error;
  }
};

/**
 * Получает статистику по сетям
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Статистика по сетям
 */
export const getChainsStats = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-chains-stats', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики по сетям:', error);
    throw error;
  }
};

/**
 * Получает события синхронизации
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} filters - Фильтры
 * @returns {Promise<Object>} - События синхронизации
 */
export const getSyncEvents = async (dleAddress, filters = {}) => {
  try {
    const response = await axios.post('/blockchain/get-sync-events', {
      dleAddress,
      ...filters
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении событий синхронизации:', error);
    throw error;
  }
};

/**
 * Получает подписи для исполнения
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Подписи для исполнения
 */
export const getExecutionSignatures = async (dleAddress, proposalId, chainId) => {
  try {
    const response = await axios.post('/blockchain/get-execution-signatures', {
      dleAddress,
      proposalId,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении подписей для исполнения:', error);
    throw error;
  }
};

/**
 * Создает подпись для исполнения
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @param {number} chainId - ID сети
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат создания подписи
 */
export const createExecutionSignature = async (dleAddress, proposalId, chainId, userAddress) => {
  try {
    const response = await axios.post('/blockchain/create-execution-signature', {
      dleAddress,
      proposalId,
      chainId,
      userAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании подписи для исполнения:', error);
    throw error;
  }
};

/**
 * Получает аналитику по сетям
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Аналитика по сетям
 */
export const getChainsAnalytics = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-chains-analytics', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении аналитики по сетям:', error);
    throw error;
  }
};
