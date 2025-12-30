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

// Сервис для работы с предложениями DLE
import api from '@/api/axios';

/**
 * Получает список всех предложений
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Список предложений
 */
export const getProposals = async (dleAddress) => {
  try {
    console.log(`🌐 [API] Запрашиваем предложения для DLE: ${dleAddress}`);
    const response = await api.post('/dle-proposals/get-proposals', { dleAddress });
    
    console.log(`🌐 [API] Ответ от backend:`, {
      success: response.data.success,
      proposalsCount: response.data.data?.proposals?.length || 0,
      fullResponse: response.data
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении предложений:', error);
    throw error;
  }
};

/**
 * Получает информацию о конкретном предложении
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Информация о предложении
 */
export const getProposalInfo = async (dleAddress, proposalId) => {
  try {
    const response = await api.post('/dle-proposals/get-proposal-info', { 
      dleAddress, 
      proposalId 
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении информации о предложении:', error);
    throw error;
  }
};

/**
 * Создает новое предложение
 * @param {string} dleAddress - Адрес DLE
 * @param {Object} proposalData - Данные предложения
 * @returns {Promise<Object>} - Результат создания
 */
export const createProposal = async (dleAddress, proposalData) => {
  try {
    const response = await api.post('/dle-proposals/create-proposal', {
      dleAddress,
      ...proposalData
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании предложения:', error);
    throw error;
  }
};

/**
 * Голосует за предложение
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @param {boolean} support - Поддержка предложения
 * @returns {Promise<Object>} - Результат голосования
 */
export const voteOnProposal = async (dleAddress, proposalId, support, userAddress) => {
  try {
    const requestData = {
      dleAddress,
      proposalId,
      support,
      voterAddress: userAddress
    };
    
    console.log('📤 [SERVICE] Отправляем запрос на голосование:', requestData);
    
    const response = await api.post('/dle-proposals/vote-proposal', requestData);
    
    console.log('📥 [SERVICE] Ответ от бэкенда:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при голосовании:', error);
    throw error;
  }
};

/**
 * Исполняет предложение
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат исполнения
 */
export const executeProposal = async (dleAddress, proposalId) => {
  try {
    const response = await api.post('/dle-proposals/execute-proposal', {
      dleAddress,
      proposalId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при исполнении предложения:', error);
    throw error;
  }
};

/**
 * Отменяет предложение
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @param {string} reason - Причина отмены
 * @returns {Promise<Object>} - Результат отмены
 */
export const cancelProposal = async (dleAddress, proposalId, reason) => {
  try {
    const response = await api.post('/dle-proposals/cancel-proposal', {
      dleAddress,
      proposalId,
      reason
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при отмене предложения:', error);
    throw error;
  }
};

/**
 * Получает состояние предложения
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Состояние предложения
 */
export const getProposalState = async (dleAddress, proposalId) => {
  try {
    const response = await api.post('/dle-proposals/get-proposal-state', {
      dleAddress,
      proposalId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении состояния предложения:', error);
    throw error;
  }
};

/**
 * Получает голоса по предложению
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Голоса по предложению
 */
export const getProposalVotes = async (dleAddress, proposalId) => {
  try {
    const response = await api.post('/dle-proposals/get-proposal-votes', {
      dleAddress,
      proposalId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении голосов:', error);
    throw error;
  }
};

/**
 * Проверяет результат предложения
 * @param {string} dleAddress - Адрес DLE
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат проверки
 */
export const checkProposalResult = async (dleAddress, proposalId) => {
  try {
    const response = await api.post('/dle-proposals/check-proposal-result', {
      dleAddress,
      proposalId
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке результата предложения:', error);
    throw error;
  }
};

/**
 * Получает количество предложений
 * @param {string} dleAddress - Адрес DLE
 * @returns {Promise<Object>} - Количество предложений
 */
export const getProposalsCount = async (dleAddress) => {
  try {
    const response = await api.post('/dle-proposals/get-proposals-count', {
      dleAddress
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении количества предложений:', error);
    throw error;
  }
};

/**
 * Получает список предложений с пагинацией
 * @param {string} dleAddress - Адрес DLE
 * @param {number} offset - Смещение
 * @param {number} limit - Лимит
 * @returns {Promise<Object>} - Список предложений
 */
export const listProposals = async (dleAddress, offset = 0, limit = 10) => {
  try {
    const response = await api.post('/dle-proposals/list-proposals', {
      dleAddress,
      offset,
      limit
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении списка предложений:', error);
    throw error;
  }
};

/**
 * Получает голосующую силу на момент времени
 * @param {string} dleAddress - Адрес DLE
 * @param {string} voter - Адрес голосующего
 * @param {number} timepoint - Временная точка
 * @returns {Promise<Object>} - Голосующая сила
 */
export const getVotingPowerAt = async (dleAddress, voter, timepoint) => {
  try {
    const response = await api.post('/dle-proposals/get-voting-power-at', {
      dleAddress,
      voter,
      timepoint
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении голосующей силы:', error);
    throw error;
  }
};

/**
 * Получает требуемый кворум на момент времени
 * @param {string} dleAddress - Адрес DLE
 * @param {number} timepoint - Временная точка
 * @returns {Promise<Object>} - Требуемый кворум
 */
export const getQuorumAt = async (dleAddress, timepoint) => {
  try {
    const response = await api.post('/dle-proposals/get-quorum-at', {
      dleAddress,
      timepoint
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении требуемого кворума:', error);
    throw error;
  }
};

/**
 * Декодирует данные предложения о добавлении модуля
 * @param {string} transactionHash - Хеш транзакции создания предложения
 * @returns {Promise<Object>} - Декодированные данные предложения
 */
export const decodeProposalData = async (transactionHash) => {
  try {
    const response = await api.post('/dle-proposals/decode-proposal-data', {
      transactionHash
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при декодировании данных предложения:', error);
    throw error;
  }
};
