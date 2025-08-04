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

// Сервис для работы с DLE v2
import axios from 'axios';

/**
 * Создает новое DLE v2
 * @param {Object} dleParams - Параметры DLE
 * @returns {Promise<Object>} - Результат создания
 */
export const createDLE = async (dleParams) => {
  try {
    const response = await axios.post('/api/dle-v2', dleParams);
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
    const response = await axios.get('/api/dle-v2');
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
    const response = await axios.get(`/api/dle-v2/${dleAddress}`);
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
    const response = await axios.get('/api/dle-v2/default-params');
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении параметров по умолчанию:', error);
    throw error;
  }
}; 