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

import api from '@/api/axios';

/**
 * Получить информацию о мультиконтрактном предложении
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {number} governanceChainId - ID сети голосования
 * @returns {Promise<Object>} - Информация о предложении
 */
export async function getProposalMultichainInfo(dleAddress, proposalId, governanceChainId) {
  try {
    const response = await api.post('/dle-multichain-execution/get-proposal-multichain-info', {
      dleAddress,
      proposalId,
      governanceChainId
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Не удалось получить информацию о мультиконтрактном предложении');
    }
  } catch (error) {
    console.error('Ошибка получения информации о мультиконтрактном предложении:', error);
    throw error;
  }
}

/**
 * Исполнить предложение во всех целевых сетях
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {string} deploymentId - ID деплоя
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат исполнения
 */
export async function executeInAllTargetChains(dleAddress, proposalId, deploymentId, userAddress) {
  try {
    const response = await api.post('/dle-multichain-execution/execute-in-all-target-chains', {
      dleAddress,
      proposalId,
      deploymentId,
      userAddress
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Не удалось исполнить предложение во всех целевых сетях');
    }
  } catch (error) {
    console.error('Ошибка исполнения во всех целевых сетях:', error);
    throw error;
  }
}

/**
 * Исполнить предложение в конкретной целевой сети
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {number} targetChainId - ID целевой сети
 * @param {string} deploymentId - ID деплоя
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат исполнения
 */
export async function executeInTargetChain(dleAddress, proposalId, targetChainId, deploymentId, userAddress) {
  try {
    const response = await api.post('/dle-multichain-execution/execute-in-target-chain', {
      dleAddress,
      proposalId,
      targetChainId,
      deploymentId,
      userAddress
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Не удалось исполнить предложение в целевой сети');
    }
  } catch (error) {
    console.error('Ошибка исполнения в целевой сети:', error);
    throw error;
  }
}

/**
 * Получить deploymentId по адресу DLE
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<string>} - ID деплоя
 */
export async function getDeploymentId(dleAddress) {
  try {
    const response = await api.post('/dle-modules/get-deployment-id', {
      dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.deploymentId;
    } else {
      throw new Error(response.data.error || 'Не удалось получить ID деплоя');
    }
  } catch (error) {
    console.error('Ошибка получения ID деплоя:', error);
    throw error;
  }
}

/**
 * Проверить, является ли предложение мультиконтрактным
 * @param {Object} proposal - Предложение
 * @returns {boolean} - Является ли мультиконтрактным
 */
export function isMultichainProposal(proposal) {
  return proposal.targetChains && proposal.targetChains.length > 0;
}

/**
 * Получить название сети по ID
 * @param {number} chainId - ID сети
 * @returns {string} - Название сети
 */
export function getChainName(chainId) {
  const chainNames = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia',
    17000: 'Holesky',
    421614: 'Arbitrum Sepolia',
    84532: 'Base Sepolia',
    137: 'Polygon',
    80001: 'Polygon Mumbai',
    56: 'BSC',
    97: 'BSC Testnet'
  };
  
  return chainNames[chainId] || `Chain ${chainId}`;
}

/**
 * Форматировать результат исполнения
 * @param {Object} result - Результат исполнения
 * @returns {string} - Отформатированный результат
 */
export function formatExecutionResult(result) {
  const { summary, executionResults } = result;
  
  if (summary.successful === summary.total) {
    return `✅ Успешно исполнено во всех ${summary.total} сетях`;
  } else if (summary.successful > 0) {
    return `⚠️ Частично исполнено: ${summary.successful}/${summary.total} сетей`;
  } else {
    return `❌ Не удалось исполнить ни в одной сети`;
  }
}

/**
 * Получить детали ошибок исполнения
 * @param {Object} result - Результат исполнения
 * @returns {Array} - Массив ошибок
 */
export function getExecutionErrors(result) {
  return result.executionResults
    .filter(r => !r.success)
    .map(r => ({
      chainId: r.chainId,
      chainName: getChainName(r.chainId),
      error: r.error
    }));
}


