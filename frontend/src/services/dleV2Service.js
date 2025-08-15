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

// Сервис для работы с DLE v2 - основные функции
import axios from 'axios';

// ===== ОСНОВНЫЕ ФУНКЦИИ DLE =====

/**
 * Создает новое DLE v2
 * @param {Object} dleParams - Параметры DLE
 * @returns {Promise<Object>} - Результат создания
 */
export const createDLE = async (dleParams) => {
  try {
    const response = await axios.post('/dle-v2', dleParams);
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании DLE:', error);
    throw error;
  }
};

/**
 * Получает список всех DLE v2
 * @returns {Promise<Object>} - Список DLE
 */
export const getAllDLEs = async () => {
  try {
    const response = await axios.get('/dle-v2');
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении списка DLE:', error);
    throw error;
  }
};

/**
 * Получает информацию о конкретном DLE v2
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Информация о DLE
 */
export const getDLEInfo = async (dleAddress) => {
  try {
    const response = await axios.get(`/dle-v2/${dleAddress}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении информации о DLE:', error);
    throw error;
  }
};

/**
 * Получает параметры по умолчанию для создания DLE v2
 * @returns {Promise<Object>} - Параметры по умолчанию
 */
export const getDefaultParams = async () => {
  try {
    const response = await axios.get('/dle-v2/default-params');
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении параметров по умолчанию:', error);
    throw error;
  }
};

/**
 * Читает данные DLE из блокчейна
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Данные из блокчейна
 */
export const readDLEFromBlockchain = async (dleAddress) => {
  try {
    const response = await axios.post('/dle-core/read-dle-info', { dleAddress });
    return response.data;
  } catch (error) {
    console.error('Ошибка при чтении DLE из блокчейна:', error);
    throw error;
  }
};

/**
 * Получает параметры управления DLE
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Параметры управления
 */
export const getGovernanceParams = async (dleAddress) => {
  try {
    const response = await axios.post('/dle-core/get-governance-params', { dleAddress });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении параметров управления:', error);
    throw error;
  }
};

// ===== МУЛЬТИ-ЧЕЙН ФУНКЦИОНАЛЬНОСТЬ =====

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

// ===== ИСТОРИЯ И СОБЫТИЯ =====

/**
 * Получает историю событий
 * @param {string} dleAddress - Адрес DLE
 * @param {string} eventType - Тип события
 * @param {number} fromBlock - Начальный блок
 * @param {number} toBlock - Конечный блок
 * @returns {Promise<Object>} - История событий
 */
export const getEventHistory = async (dleAddress, eventType, fromBlock, toBlock) => {
  try {
    const response = await axios.post('/blockchain/get-event-history', {
      dleAddress,
      eventType,
      fromBlock,
      toBlock
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении истории событий:', error);
    throw error;
  }
};

/**
 * Получает статистику DLE
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Статистика
 */
export const getDLEStats = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-dle-stats', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики DLE:', error);
    throw error;
  }
}; 