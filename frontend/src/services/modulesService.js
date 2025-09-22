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

// Сервис для работы с модулями DLE
import api from '@/api/axios';

/**
 * Создает предложение о добавлении модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} moduleData - Данные модуля
 * @returns {Promise<Object>} - Результат создания
 */
export const createAddModuleProposal = async (dleAddress, moduleData) => {
  try {
    const response = await api.post('/dle-modules/create-add-module-proposal', {
      dleAddress,
      ...moduleData
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании предложения добавления модуля:', error);
    throw error;
  }
};

/**
 * Создает предложение об удалении модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} moduleData - Данные модуля
 * @returns {Promise<Object>} - Результат создания
 */
export const createRemoveModuleProposal = async (dleAddress, moduleData) => {
  try {
    const response = await api.post('/dle-modules/create-remove-module-proposal', {
      dleAddress,
      ...moduleData
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании предложения удаления модуля:', error);
    throw error;
  }
};

/**
 * Проверяет активность модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleId - ID модуля
 * @returns {Promise<Object>} - Статус активности
 */
export const isModuleActive = async (dleAddress, moduleId) => {
  try {
    const response = await api.post('/dle-modules/is-module-active', {
      dleAddress,
      moduleId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке активности модуля:', error);
    throw error;
  }
};

/**
 * Получает адрес модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleId - ID модуля
 * @returns {Promise<Object>} - Адрес модуля
 */
export const getModuleAddress = async (dleAddress, moduleId, chainId) => {
  try {
    const response = await api.post('/dle-modules/get-module-address', {
      dleAddress,
      moduleId,
      chainId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении адреса модуля:', error);
    throw error;
  }
};

/**
 * Получает список всех модулей
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Список модулей
 */
export const getAllModules = async (dleAddress) => {
  try {
    const response = await api.post('/dle-modules/get-all-modules', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении списка модулей:', error);
    throw error;
  }
};

/**
 * Получает информацию о поддерживаемых сетях
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Информация о сетях
 */
export const getNetworksInfo = async (dleAddress) => {
  try {
    const response = await api.post('/dle-modules/get-networks-info', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении информации о сетях:', error);
    throw error;
  }
};

/**
 * Получает информацию о модуле
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleId - ID модуля
 * @returns {Promise<Object>} - Информация о модуле
 */
export const getModuleInfo = async (dleAddress, moduleId) => {
  try {
    const response = await api.post('/blockchain/get-module-info', {
      dleAddress,
      moduleId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении информации о модуле:', error);
    throw error;
  }
};

/**
 * Получает статистику модулей
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Статистика модулей
 */
export const getModulesStats = async (dleAddress) => {
  try {
    const response = await api.post('/blockchain/get-modules-stats', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики модулей:', error);
    throw error;
  }
};

/**
 * Получает историю модулей
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} filters - Фильтры
 * @returns {Promise<Object>} - История модулей
 */
export const getModulesHistory = async (dleAddress, filters = {}) => {
  try {
    const response = await api.post('/blockchain/get-modules-history', {
      dleAddress,
      ...filters
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении истории модулей:', error);
    throw error;
  }
};

/**
 * Получает активные модули
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Активные модули
 */
export const getActiveModules = async (dleAddress) => {
  try {
    const response = await api.post('/blockchain/get-active-modules', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении активных модулей:', error);
    throw error;
  }
};

/**
 * Получает неактивные модули
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Неактивные модули
 */
export const getInactiveModules = async (dleAddress) => {
  try {
    const response = await api.post('/blockchain/get-inactive-modules', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении неактивных модулей:', error);
    throw error;
  }
};

/**
 * Проверяет совместимость модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleId - ID модуля
 * @param {string} moduleAddress - Адрес модуля
 * @returns {Promise<Object>} - Совместимость модуля
 */
export const checkModuleCompatibility = async (dleAddress, moduleId, moduleAddress) => {
  try {
    const response = await api.post('/blockchain/check-module-compatibility', {
      dleAddress,
      moduleId,
      moduleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке совместимости модуля:', error);
    throw error;
  }
};

/**
 * Получает конфигурацию модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleId - ID модуля
 * @returns {Promise<Object>} - Конфигурация модуля
 */
export const getModuleConfig = async (dleAddress, moduleId) => {
  try {
    const response = await api.post('/blockchain/get-module-config', {
      dleAddress,
      moduleId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении конфигурации модуля:', error);
    throw error;
  }
};

/**
 * Обновляет конфигурацию модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleId - ID модуля
 * @param {Object} config - Новая конфигурация
 * @returns {Promise<Object>} - Результат обновления
 */
export const updateModuleConfig = async (dleAddress, moduleId, config) => {
  try {
    const response = await api.post('/blockchain/update-module-config', {
      dleAddress,
      moduleId,
      config
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при обновлении конфигурации модуля:', error);
    throw error;
  }
};

/**
 * Получает события модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleId - ID модуля
 * @param {Object} filters - Фильтры
 * @returns {Promise<Object>} - События модуля
 */
export const getModuleEvents = async (dleAddress, moduleId, filters = {}) => {
  try {
    const response = await api.post('/blockchain/get-module-events', {
      dleAddress,
      moduleId,
      ...filters
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении событий модуля:', error);
    throw error;
  }
};

/**
 * Получает производительность модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleId - ID модуля
 * @returns {Promise<Object>} - Производительность модуля
 */
export const getModulePerformance = async (dleAddress, moduleId) => {
  try {
    const response = await api.post('/blockchain/get-module-performance', {
      dleAddress,
      moduleId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении производительности модуля:', error);
    throw error;
  }
};

/**
 * Инициализирует модули во всех сетях
 * @param {string} dleAddress - Адрес DLE
 * @param {string} privateKey - Приватный ключ
 * @returns {Promise<Object>} - Результат инициализации
 */
export const initializeModulesAllNetworks = async (dleAddress, privateKey) => {
  try {
    const response = await api.post('/dle-modules/initialize-modules-all-networks', {
      dleAddress,
      privateKey
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при инициализации модулей во всех сетях:', error);
    throw error;
  }
};

/**
 * Верифицирует модули во всех сетях
 * @param {string} dleAddress - Адрес DLE
 * @param {string} privateKey - Приватный ключ
 * @returns {Promise<Object>} - Результат верификации
 */
export const verifyModulesAllNetworks = async (dleAddress, privateKey) => {
  try {
    const response = await api.post('/dle-modules/verify-modules-all-networks', {
      dleAddress,
      privateKey
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при верификации модулей во всех сетях:', error);
    throw error;
  }
};

/**
 * Проверяет статус деплоя DLE контракта
 * @param {string} dleAddress - Адрес DLE
 * @param {Array<number>} chainIds - Список ID сетей
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<Object>} - Статус деплоя DLE
 */
export const checkDLEDeploymentStatus = async (dleAddress, chainIds, maxRetries = 3, retryDelay = 30000) => {
  try {
    const response = await api.post('/dle-modules/check-dle-deployment-status', {
      dleAddress,
      chainIds,
      maxRetries,
      retryDelay
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке статуса деплоя DLE:', error);
    throw error;
  }
};

/**
 * Проверяет статус деплоя модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleType - Тип модуля (treasury, timelock, reader)
 * @param {Array<number>} chainIds - Список ID сетей
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<Object>} - Статус деплоя модуля
 */
export const checkModuleDeploymentStatus = async (dleAddress, moduleType, chainIds, maxRetries = 3, retryDelay = 30000) => {
  try {
    const response = await api.post('/dle-modules/check-module-deployment-status', {
      dleAddress,
      moduleType,
      chainIds,
      maxRetries,
      retryDelay
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке статуса деплоя модуля:', error);
    throw error;
  }
};

/**
 * Деплоит модуль во всех сетях
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleType - Тип модуля (treasury, timelock, reader)
 * @param {string} privateKey - Приватный ключ
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<Object>} - Результат деплоя модуля
 */
export const deployModuleAllNetworks = async (dleAddress, moduleType, privateKey, maxRetries = 3, retryDelay = 45000) => {
  try {
    const response = await api.post('/dle-modules/deploy-module-all-networks', {
      dleAddress,
      moduleType,
      privateKey,
      maxRetries,
      retryDelay
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при деплое модуля во всех сетях:', error);
    throw error;
  }
};

/**
 * Верифицирует DLE контракт во всех сетях
 * @param {string} dleAddress - Адрес DLE
 * @param {string} privateKey - Приватный ключ
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<Object>} - Результат верификации DLE
 */
export const verifyDLEAllNetworks = async (dleAddress, privateKey, maxRetries = 3, retryDelay = 60000) => {
  try {
    const response = await api.post('/dle-modules/verify-dle-all-networks', {
      dleAddress,
      privateKey,
      maxRetries,
      retryDelay
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при верификации DLE во всех сетях:', error);
    throw error;
  }
};

/**
 * Верифицирует модуль во всех сетях
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleType - Тип модуля (treasury, timelock, reader)
 * @param {string} privateKey - Приватный ключ
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<Object>} - Результат верификации модуля
 */
export const verifyModuleAllNetworks = async (dleAddress, moduleType, privateKey, maxRetries = 3, retryDelay = 60000) => {
  try {
    const response = await api.post('/dle-modules/verify-module-all-networks', {
      dleAddress,
      moduleType,
      privateKey,
      maxRetries,
      retryDelay
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при верификации модуля во всех сетях:', error);
    throw error;
  }
};

/**
 * Инициализирует модуль во всех сетях
 * @param {string} dleAddress - Адрес DLE
 * @param {string} moduleType - Тип модуля (treasury, timelock, reader)
 * @param {string} privateKey - Приватный ключ
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<Object>} - Результат инициализации модуля
 */
export const initializeModuleAllNetworks = async (dleAddress, moduleType, privateKey, maxRetries = 3, retryDelay = 30000) => {
  try {
    const response = await api.post('/dle-modules/initialize-module-all-networks', {
      dleAddress,
      moduleType,
      privateKey,
      maxRetries,
      retryDelay
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при инициализации модуля во всех сетях:', error);
    throw error;
  }
};

/**
 * Выполняет финальную проверку готовности деплоя
 * @param {string} dleAddress - Адрес DLE
 * @param {Array<number>} chainIds - Список ID сетей
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<Object>} - Результат финальной проверки
 */
export const finalDeploymentCheck = async (dleAddress, chainIds, maxRetries = 3, retryDelay = 30000) => {
  try {
    const response = await api.post('/dle-modules/final-deployment-check', {
      dleAddress,
      chainIds,
      maxRetries,
      retryDelay
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при финальной проверке деплоя:', error);
    throw error;
  }
};

/**
 * Получает общий статус деплоя
 * @param {string} dleAddress - Адрес DLE
 * @param {number} maxRetries - Максимальное количество попыток
 * @param {number} retryDelay - Задержка между попытками (мс)
 * @returns {Promise<Object>} - Статус деплоя
 */
export const getDeploymentStatus = async (dleAddress, maxRetries = 3, retryDelay = 30000) => {
  try {
    const response = await api.post('/dle-modules/get-deployment-status', {
      dleAddress,
      maxRetries,
      retryDelay
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статуса деплоя:', error);
    throw error;
  }
};
