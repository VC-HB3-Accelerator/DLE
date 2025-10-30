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

// Сервис для работы с токенами DLE
import axios from 'axios';

/**
 * Получает балансы токенов для пользователя
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Балансы токенов
 */
export const getTokenBalances = async (userAddress) => {
  try {
    const response = await axios.get(`/tokens/balances/${userAddress}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении балансов токенов:', error);
    throw error;
  }
};

/**
 * Получает баланс токенов конкретного DLE
 * @param {string} dleAddress - Адрес DLE
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Баланс токенов
 */
export const getDLEBalance = async (dleAddress, userAddress) => {
  try {
    const response = await axios.post('/blockchain/get-token-balance', {
      dleAddress,
      account: userAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении баланса DLE:', error);
    throw error;
  }
};

/**
 * Получает общее предложение токенов DLE
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Общее предложение
 */
export const getDLETotalSupply = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-total-supply', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении общего предложения DLE:', error);
    throw error;
  }
};

/**
 * Получает список держателей токенов DLE
 * @param {string} dleAddress - Адрес DLE
 * @param {number} offset - Смещение
 * @param {number} limit - Лимит
 * @returns {Promise<Object>} - Список держателей
 */
export const getDLETokenHolders = async (dleAddress, offset = 0, limit = 10) => {
  try {
    const response = await axios.post('/blockchain/get-token-holders', {
      dleAddress,
      offset,
      limit
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении держателей токенов DLE:', error);
    throw error;
  }
};

/**
 * Получает голосующую силу пользователя на момент времени
 * @param {string} dleAddress - Адрес DLE
 * @param {string} userAddress - Адрес пользователя
 * @param {number} timepoint - Временная точка
 * @returns {Promise<Object>} - Голосующая сила
 */
export const getVotingPower = async (dleAddress, userAddress, timepoint) => {
  try {
    const response = await axios.post('/blockchain/get-voting-power-at', {
      dleAddress,
      voter: userAddress,
      timepoint
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении голосующей силы:', error);
    throw error;
  }
};

/**
 * Получает требуемый кворум на момент времени
 * @param {string} dleAddress - Адрес DLE
 * @param {number} timepoint - Временная точка
 * @returns {Promise<Object>} - Требуемый кворум
 */
export const getQuorumRequirement = async (dleAddress, timepoint) => {
  try {
    const response = await axios.post('/blockchain/get-quorum-at', {
      dleAddress,
      timepoint
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении требуемого кворума:', error);
    throw error;
  }
};

/**
 * Получает статистику токенов DLE
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Статистика токенов
 */
export const getTokenStats = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-token-stats', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики токенов:', error);
    throw error;
  }
};

/**
 * Получает историю транзакций токенов
 * @param {string} dleAddress - Адрес DLE
 * @param {string} userAddress - Адрес пользователя (опционально)
 * @param {number} fromBlock - Начальный блок
 * @param {number} toBlock - Конечный блок
 * @returns {Promise<Object>} - История транзакций
 */
export const getTokenTransactionHistory = async (dleAddress, userAddress = null, fromBlock = null, toBlock = null) => {
  try {
    const response = await axios.post('/blockchain/get-token-transactions', {
      dleAddress,
      userAddress,
      fromBlock,
      toBlock
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении истории транзакций токенов:', error);
    throw error;
  }
};

/**
 * Получает распределение токенов
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Распределение токенов
 */
export const getTokenDistribution = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-token-distribution', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении распределения токенов:', error);
    throw error;
  }
};
