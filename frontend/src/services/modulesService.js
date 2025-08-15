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
import axios from 'axios';

/**
 * Создает предложение о добавлении модуля
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} moduleData - Данные модуля
 * @returns {Promise<Object>} - Результат создания
 */
export const createAddModuleProposal = async (dleAddress, moduleData) => {
  try {
    const response = await axios.post('/dle-modules/create-add-module-proposal', {
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
    const response = await axios.post('/dle-modules/create-remove-module-proposal', {
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
    const response = await axios.post('/dle-modules/is-module-active', {
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
export const getModuleAddress = async (dleAddress, moduleId) => {
  try {
    const response = await axios.post('/dle-modules/get-module-address', {
      dleAddress,
      moduleId
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
    const response = await axios.post('/dle-modules/get-all-modules', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении списка модулей:', error);
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
    const response = await axios.post('/blockchain/get-module-info', {
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
    const response = await axios.post('/blockchain/get-modules-stats', {
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
    const response = await axios.post('/blockchain/get-modules-history', {
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
    const response = await axios.post('/blockchain/get-active-modules', {
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
    const response = await axios.post('/blockchain/get-inactive-modules', {
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
    const response = await axios.post('/blockchain/check-module-compatibility', {
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
    const response = await axios.post('/blockchain/get-module-config', {
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
    const response = await axios.post('/blockchain/update-module-config', {
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
    const response = await axios.post('/blockchain/get-module-events', {
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
    const response = await axios.post('/blockchain/get-module-performance', {
      dleAddress,
      moduleId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении производительности модуля:', error);
    throw error;
  }
};
