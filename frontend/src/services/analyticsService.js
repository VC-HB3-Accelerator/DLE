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

// Сервис для работы с аналитикой DLE
import axios from 'axios';

/**
 * Получает общую статистику DLE
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Общая статистика
 */
export const getDLEStats = async (dleAddress) => {
  try {
    const response = await axios.post('/dle-analytics/get-dle-stats', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики DLE:', error);
    throw error;
  }
};

/**
 * Получает статистику предложений
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Статистика предложений
 */
export const getProposalsStats = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-proposals-stats', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики предложений:', error);
    throw error;
  }
};

/**
 * Получает статистику токенов
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
 * Получает статистику голосования
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Статистика голосования
 */
export const getVotingStats = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-voting-stats', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении статистики голосования:', error);
    throw error;
  }
};

/**
 * Получает активность DLE по времени
 * @param {string} dleAddress - Адрес DLE
 * @param {string} period - Период (day, week, month, year)
 * @returns {Promise<Object>} - Активность по времени
 */
export const getDLEActivity = async (dleAddress, period = 'month') => {
  try {
    const response = await axios.post('/dle-analytics/get-dle-activity', {
      dleAddress,
      period
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении активности DLE:', error);
    throw error;
  }
};

/**
 * Получает топ держателей токенов
 * @param {string} dleAddress - Адрес DLE
 * @param {number} limit - Количество записей
 * @returns {Promise<Object>} - Топ держателей
 */
export const getTopTokenHolders = async (dleAddress, limit = 10) => {
  try {
    const response = await axios.post('/blockchain/get-top-token-holders', {
      dleAddress,
      limit
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении топ держателей токенов:', error);
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
    const response = await axios.post('/dle-analytics/get-event-history', {
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
 * Получает метрики производительности
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Метрики производительности
 */
export const getPerformanceMetrics = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-performance-metrics', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении метрик производительности:', error);
    throw error;
  }
};

/**
 * Получает аналитику по сетям
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Аналитика по сетям
 */
export const getNetworkAnalytics = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-network-analytics', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении аналитики по сетям:', error);
    throw error;
  }
};

/**
 * Получает отчет о деятельности
 * @param {string} dleAddress - Адрес DLE
 * @param {string} reportType - Тип отчета
 * @param {Object} filters - Фильтры
 * @returns {Promise<Object>} - Отчет о деятельности
 */
export const getActivityReport = async (dleAddress, reportType, filters = {}) => {
  try {
    const response = await axios.post('/blockchain/get-activity-report', {
      dleAddress,
      reportType,
      ...filters
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении отчета о деятельности:', error);
    throw error;
  }
};

/**
 * Получает сравнительную аналитику
 * @param {string} dleAddress - Адрес DLE
 * @param {string} comparisonType - Тип сравнения
 * @returns {Promise<Object>} - Сравнительная аналитика
 */
export const getComparativeAnalytics = async (dleAddress, comparisonType) => {
  try {
    const response = await axios.post('/blockchain/get-comparative-analytics', {
      dleAddress,
      comparisonType
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении сравнительной аналитики:', error);
    throw error;
  }
};

/**
 * Получает прогнозы и тренды
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Прогнозы и тренды
 */
export const getTrendsAndForecasts = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-trends-forecasts', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении прогнозов и трендов:', error);
    throw error;
  }
};

/**
 * Получает аналитику рисков
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Аналитика рисков
 */
export const getRiskAnalytics = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-risk-analytics', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении аналитики рисков:', error);
    throw error;
  }
};

/**
 * Получает ключевые показатели эффективности
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Ключевые показатели эффективности
 */
export const getKPIs = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-kpis', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении ключевых показателей эффективности:', error);
    throw error;
  }
};

/**
 * Получает дашборд аналитики
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Дашборд аналитики
 */
export const getAnalyticsDashboard = async (dleAddress) => {
  try {
    const response = await axios.post('/blockchain/get-analytics-dashboard', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении дашборда аналитики:', error);
    throw error;
  }
};
