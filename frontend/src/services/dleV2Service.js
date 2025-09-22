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

/**
 * Получает текущую сеть
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Текущая сеть
 */

/**
 * Исполняет предложение по подписям
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} executionData - Данные исполнения
 * @returns {Promise<Object>} - Результат исполнения
 */

// ===== ИСТОРИЯ И СОБЫТИЯ =====

/**
 * Получает историю событий
 * @param {string} dleAddress - Адрес DLE
 * @param {string} eventType - Тип события
 * @param {number} fromBlock - Начальный блок
 * @param {number} toBlock - Конечный блок
 * @returns {Promise<Object>} - История событий
 */

/**
 * Получает статистику DLE
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Статистика
 */
