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
 * Получает баланс токенов
 * @param {string} dleAddress - Адрес DLE
 * @param {string} account - Адрес аккаунта
 * @returns {Promise<Object>} - Баланс токенов
 */
export const getTokenBalance = async (dleAddress, account) => {
  try {
    const response = await axios.post('/dle-tokens/get-token-balance', {
      dleAddress,
      account
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении баланса токенов:', error);
    throw error;
  }
};

/**
 * Получает общее предложение токенов
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Общее предложение
 */
export const getTotalSupply = async (dleAddress) => {
  try {
    const response = await axios.post('/dle-tokens/get-total-supply', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении общего предложения:', error);
    throw error;
  }
};

/**
 * Получает список держателей токенов
 * @param {string} dleAddress - Адрес DLE
 * @param {number} offset - Смещение
 * @param {number} limit - Лимит
 * @returns {Promise<Object>} - Список держателей
 */
export const getTokenHolders = async (dleAddress, offset = 0, limit = 10) => {
  try {
    const response = await axios.post('/dle-tokens/get-token-holders', {
      dleAddress,
      offset,
      limit
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении держателей токенов:', error);
    throw error;
  }
};
