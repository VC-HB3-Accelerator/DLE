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

import api from '@/api/axios';

/**
 * Сервис для работы с DLE v2 (Digital Legal Entity)
 * Современный подход с единым контрактом
 */
class DLEV2Service {
  /**
   * Создает новое DLE v2
   * @param {Object} dleParams - Параметры DLE
   * @returns {Promise<Object>} - Результат создания
   */
  async createDLE(dleParams) {
    try {
      const response = await api.post('/dle-v2', dleParams);
      return response.data;
    } catch (error) {
      console.error('Ошибка при создании DLE v2:', error);
      throw error;
    }
  }

  /**
   * Получает список всех DLE v2
   * @returns {Promise<Array>} - Список DLE v2
   */
  async getAllDLEs() {
    try {
      const response = await api.get('/dle-v2');
      return response.data.data || [];
    } catch (error) {
      console.error('Ошибка при получении списка DLE v2:', error);
      return [];
    }
  }

  /**
   * Получает настройки по умолчанию для DLE v2
   * @returns {Promise<Object>} - Настройки по умолчанию
   */
  async getDefaults() {
    try {
      const response = await api.get('/dle-v2/defaults');
      return response.data.data;
    } catch (error) {
      console.error('Ошибка при получении настроек по умолчанию DLE v2:', error);
      return {
        votingDelay: 1,
        votingPeriod: 45818,
        proposalThreshold: '100000',
        quorumPercentage: 4,
        minTimelockDelay: 2
      };
    }
  }

  /**
   * Удаляет DLE v2 по адресу
   * @param {string} dleAddress - Адрес DLE
   * @returns {Promise<Object>} - Результат удаления
   */
  async deleteDLE(dleAddress) {
    try {
      const response = await api.delete(`/dle-v2/${dleAddress}`);
      return response.data;
    } catch (error) {
      console.error('Ошибка при удалении DLE v2:', error);
      throw error;
    }
  }
}

export default new DLEV2Service(); 