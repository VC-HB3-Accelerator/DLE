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

// Сервис для работы с операциями модулей DLE
import api from '@/api/axios';

/**
 * Получает доступные операции для модулей DLE
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Доступные операции
 */
export const getModuleOperations = async (dleAddress) => {
  try {
    const response = await api.post('/dle-modules/get-module-operations', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении операций модулей:', error);
    throw error;
  }
};

/**
 * Получает операции для конкретного модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleType - Тип модуля
 * @param {string} moduleAddress - Адрес модуля
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Операции модуля
 */
export const getModuleSpecificOperations = async (dleAddress, moduleType, moduleAddress, chainId) => {
  try {
    const response = await api.post('/dle-modules/get-module-specific-operations', {
      dleAddress,
      moduleType,
      moduleAddress,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении операций конкретного модуля:', error);
    throw error;
  }
};

/**
 * Создает предложение для выполнения операции модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} operationData - Данные операции
 * @returns {Promise<Object>} - Результат создания предложения
 */
export const createModuleOperationProposal = async (dleAddress, operationData) => {
  try {
    const response = await api.post('/dle-modules/create-module-operation-proposal', {
      dleAddress,
      ...operationData
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании предложения для операции модуля:', error);
    throw error;
  }
};

/**
 * Получает ABI и интерфейс модуля
 * @param {string} moduleType - Тип модуля
 * @param {string} moduleAddress - Адрес модуля
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - ABI и интерфейс модуля
 */
export const getModuleInterface = async (moduleType, moduleAddress, chainId) => {
  try {
    const response = await api.post('/dle-modules/get-module-interface', {
      moduleType,
      moduleAddress,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении интерфейса модуля:', error);
    throw error;
  }
};

/**
 * Получает доступные функции модуля для создания предложений
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleType - Тип модуля
 * @param {string} moduleAddress - Адрес модуля
 * @param {number} chainId - ID сети
 * @returns {Promise<Object>} - Доступные функции
 */
export const getModuleAvailableFunctions = async (dleAddress, moduleType, moduleAddress, chainId) => {
  try {
    const response = await api.post('/dle-modules/get-module-available-functions', {
      dleAddress,
      moduleType,
      moduleAddress,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении доступных функций модуля:', error);
    throw error;
  }
};

/**
 * Получает параметры функции модуля
 * @param {string} moduleType - Тип модуля
 * @param {string} functionName - Имя функции
 * @returns {Promise<Object>} - Параметры функции
 */
export const getModuleFunctionParameters = async (moduleType, functionName) => {
  try {
    const response = await api.post('/dle-modules/get-module-function-parameters', {
      moduleType,
      functionName
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении параметров функции модуля:', error);
    throw error;
  }
};

/**
 * Валидирует параметры операции модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} operationData - Данные операции
 * @returns {Promise<Object>} - Результат валидации
 */
export const validateModuleOperation = async (dleAddress, operationData) => {
  try {
    const response = await api.post('/dle-modules/validate-module-operation', {
      dleAddress,
      ...operationData
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при валидации операции модуля:', error);
    throw error;
  }
};

/**
 * Получает историю операций модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleType - Тип модуля
 * @param {Object} filters - Фильтры
 * @returns {Promise<Object>} - История операций
 */
export const getModuleOperationsHistory = async (dleAddress, moduleType, filters = {}) => {
  try {
    const response = await api.post('/dle-modules/get-module-operations-history', {
      dleAddress,
      moduleType,
      ...filters
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении истории операций модуля:', error);
    throw error;
  }
};

/**
 * Получает статус выполнения операции модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} operationId - ID операции
 * @returns {Promise<Object>} - Статус операции
 */
export const getModuleOperationStatus = async (dleAddress, operationId) => {
  try {
    const response = await api.post('/dle-modules/get-module-operation-status', {
      dleAddress,
      operationId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статуса операции модуля:', error);
    throw error;
  }
};
