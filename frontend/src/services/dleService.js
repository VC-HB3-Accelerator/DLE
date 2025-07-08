import api from '@/api/axios';

/**
 * Сервис для работы с DLE (Digital Legal Entity)
 */
class DLEService {
  /**
   * Получает настройки по умолчанию для создания DLE
   * @returns {Promise<Object>} - Настройки по умолчанию
   */
  async getDefaultSettings() {
    try {
      const response = await api.get('/dle/settings');
      return response.data.data;
    } catch (error) {
      console.error('Ошибка при получении настроек DLE:', error);
      throw error;
    }
  }

  /**
   * Создает новое DLE с указанными параметрами
   * @param {Object} dleParams - Параметры для создания DLE
   * @returns {Promise<Object>} - Результат создания DLE
   */
  async createDLE(dleParams) {
    try {
      const response = await api.post('/dle', dleParams);
      return response.data;
    } catch (error) {
      console.error('Ошибка при создании DLE:', error);
      throw error;
    }
  }

  /**
   * Получает список всех DLE
   * @returns {Promise<Array>} - Список DLE
   */
  async getAllDLEs() {
    try {
      const response = await api.get('/dle');
      
      // Проверяем и нормализуем поля isicCodes для всех DLE
      if (response.data.data && Array.isArray(response.data.data)) {
        response.data.data.forEach(dle => {
          // Если isicCodes отсутствует или не является массивом, инициализируем пустым массивом
          if (!dle.isicCodes || !Array.isArray(dle.isicCodes)) {
            dle.isicCodes = [];
          }
        });
      }
      
      return response.data.data;
    } catch (error) {
      console.error('Ошибка при получении списка DLE:', error);
      throw error;
    }
  }

  /**
   * Удаляет DLE по адресу токена
   * @param {string} tokenAddress - Адрес токена DLE
   * @returns {Promise<Object>} - Результат удаления
   */
  async deleteDLE(tokenAddress) {
    try {
      const response = await api.delete(`/dle/${tokenAddress}`);
      return response.data;
    } catch (error) {
      console.error('Ошибка при удалении DLE:', error);
      throw error;
    }
  }

  /**
   * Удаляет пустое DLE по имени файла
   * @param {string} fileName - Имя файла DLE
   * @returns {Promise<Object>} - Результат удаления
   */
  async deleteEmptyDLE(fileName) {
    try {
      const response = await api.delete(`/dle/empty/${fileName}`);
      return response.data;
    } catch (error) {
      console.error('Ошибка при удалении пустого DLE:', error);
      throw error;
    }
  }
}

export default new DLEService(); 