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

const { ethers } = require('ethers');

/**
 * Декодирует операцию из формата abi.encodeWithSelector
 * @param {string} operation - Закодированная операция (hex string)
 * @returns {Object} - Декодированная операция
 */
function decodeOperation(operation) {
  try {
    if (!operation || operation.length < 4) {
      return {
        type: 'unknown',
        selector: null,
        data: null,
        decoded: null,
        error: 'Invalid operation format'
      };
    }

    // Извлекаем селектор (первые 4 байта)
    const selector = operation.slice(0, 10); // 0x + 4 байта
    const data = operation.slice(10); // Остальные данные

    // Определяем тип операции по селектору
    const operationType = getOperationType(selector);
    
    if (operationType === 'unknown') {
      return {
        type: 'unknown',
        selector: selector,
        data: data,
        decoded: null,
        error: 'Unknown operation selector'
      };
    }

    // Декодируем данные в зависимости от типа операции
    let decoded = null;
    try {
      decoded = decodeOperationData(operationType, data);
    } catch (decodeError) {
      return {
        type: operationType,
        selector: selector,
        data: data,
        decoded: null,
        error: `Failed to decode ${operationType}: ${decodeError.message}`
      };
    }

    return {
      type: operationType,
      selector: selector,
      data: data,
      decoded: decoded,
      error: null
    };

  } catch (error) {
    return {
      type: 'error',
      selector: null,
      data: null,
      decoded: null,
      error: error.message
    };
  }
}

/**
 * Определяет тип операции по селектору
 * @param {string} selector - Селектор функции (0x + 4 байта)
 * @returns {string} - Тип операции
 */
function getOperationType(selector) {
  const selectors = {
    '0x12345678': '_addModule', // Пример селектора
    '0x87654321': '_removeModule', // Пример селектора
    '0xabcdef12': '_addSupportedChain', // Пример селектора
    '0x21fedcba': '_removeSupportedChain', // Пример селектора
    '0x1234abcd': '_transferTokens', // Пример селектора
    '0xabcd1234': '_updateVotingDurations', // Пример селектора
    '0x5678efgh': '_setLogoURI', // Пример селектора
    '0xefgh5678': '_updateQuorumPercentage', // Пример селектора
    '0x9abc1234': '_updateDLEInfo', // Пример селектора
    '0x12349abc': 'offchainAction' // Пример селектора
  };

  // Вычисляем реальные селекторы
  const realSelectors = {
    [ethers.id('_addModule(bytes32,address)').slice(0, 10)]: '_addModule',
    [ethers.id('_removeModule(bytes32)').slice(0, 10)]: '_removeModule',
    [ethers.id('_addSupportedChain(uint256)').slice(0, 10)]: '_addSupportedChain',
    [ethers.id('_removeSupportedChain(uint256)').slice(0, 10)]: '_removeSupportedChain',
    [ethers.id('_transferTokens(address,uint256)').slice(0, 10)]: '_transferTokens',
    [ethers.id('_updateVotingDurations(uint256,uint256)').slice(0, 10)]: '_updateVotingDurations',
    [ethers.id('_setLogoURI(string)').slice(0, 10)]: '_setLogoURI',
    [ethers.id('_updateQuorumPercentage(uint256)').slice(0, 10)]: '_updateQuorumPercentage',
    [ethers.id('_updateDLEInfo(string,string,string,string,uint256,string[],uint256)').slice(0, 10)]: '_updateDLEInfo',
    [ethers.id('offchainAction(bytes32,string,bytes32)').slice(0, 10)]: 'offchainAction'
  };

  return realSelectors[selector] || 'unknown';
}

/**
 * Декодирует данные операции в зависимости от типа
 * @param {string} operationType - Тип операции
 * @param {string} data - Закодированные данные
 * @returns {Object} - Декодированные данные
 */
function decodeOperationData(operationType, data) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  switch (operationType) {
    case '_addModule':
      const [moduleId, moduleAddress] = abiCoder.decode(['bytes32', 'address'], '0x' + data);
      return {
        moduleId: moduleId,
        moduleAddress: moduleAddress
      };

    case '_removeModule':
      const [moduleIdToRemove] = abiCoder.decode(['bytes32'], '0x' + data);
      return {
        moduleId: moduleIdToRemove
      };

    case '_addSupportedChain':
      const [chainIdToAdd] = abiCoder.decode(['uint256'], '0x' + data);
      return {
        chainId: Number(chainIdToAdd)
      };

    case '_removeSupportedChain':
      const [chainIdToRemove] = abiCoder.decode(['uint256'], '0x' + data);
      return {
        chainId: Number(chainIdToRemove)
      };

    case '_transferTokens':
      const [recipient, amount] = abiCoder.decode(['address', 'uint256'], '0x' + data);
      return {
        recipient: recipient,
        amount: amount.toString(),
        amountFormatted: ethers.formatEther(amount)
      };

    case '_updateVotingDurations':
      const [minDuration, maxDuration] = abiCoder.decode(['uint256', 'uint256'], '0x' + data);
      return {
        minDuration: Number(minDuration),
        maxDuration: Number(maxDuration)
      };

    case '_setLogoURI':
      const [logoURI] = abiCoder.decode(['string'], '0x' + data);
      return {
        logoURI: logoURI
      };

    case '_updateQuorumPercentage':
      const [quorumPercentage] = abiCoder.decode(['uint256'], '0x' + data);
      return {
        quorumPercentage: Number(quorumPercentage)
      };

    case '_updateDLEInfo':
      const [name, symbol, location, coordinates, jurisdiction, okvedCodes, kpp] = abiCoder.decode(
        ['string', 'string', 'string', 'string', 'uint256', 'string[]', 'uint256'], 
        '0x' + data
      );
      return {
        name: name,
        symbol: symbol,
        location: location,
        coordinates: coordinates,
        jurisdiction: Number(jurisdiction),
        okvedCodes: okvedCodes,
        kpp: Number(kpp)
      };

    case 'offchainAction':
      const [actionId, kind, payloadHash] = abiCoder.decode(['bytes32', 'string', 'bytes32'], '0x' + data);
      return {
        actionId: actionId,
        kind: kind,
        payloadHash: payloadHash
      };

    default:
      throw new Error(`Unknown operation type: ${operationType}`);
  }
}

/**
 * Форматирует декодированную операцию для отображения
 * @param {Object} decodedOperation - Декодированная операция
 * @returns {string} - Отформатированное описание
 */
function formatOperation(decodedOperation) {
  if (decodedOperation.error) {
    return `Ошибка: ${decodedOperation.error}`;
  }

  const { type, decoded } = decodedOperation;

  switch (type) {
    case '_addModule':
      return `Добавить модуль: ${decoded.moduleId} (${decoded.moduleAddress})`;

    case '_removeModule':
      return `Удалить модуль: ${decoded.moduleId}`;

    case '_addSupportedChain':
      return `Добавить поддерживаемую сеть: ${decoded.chainId}`;

    case '_removeSupportedChain':
      return `Удалить поддерживаемую сеть: ${decoded.chainId}`;

    case '_transferTokens':
      return `Перевести токены: ${decoded.amountFormatted} DLE на адрес ${decoded.recipient}`;

    case '_updateVotingDurations':
      return `Обновить длительность голосования: ${decoded.minDuration}-${decoded.maxDuration} секунд`;

    case '_setLogoURI':
      return `Обновить логотип: ${decoded.logoURI}`;

    case '_updateQuorumPercentage':
      return `Обновить процент кворума: ${decoded.quorumPercentage}%`;

    case '_updateDLEInfo':
      return `Обновить информацию DLE: ${decoded.name} (${decoded.symbol})`;

    case 'offchainAction':
      return `Оффчейн действие: ${decoded.kind} (${decoded.actionId})`;

    default:
      return `Неизвестная операция: ${type}`;
  }
}

/**
 * Получает название сети по ID
 * @param {number} chainId - ID сети
 * @returns {string} - Название сети
 */
function getChainName(chainId) {
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

module.exports = {
  decodeOperation,
  formatOperation,
  getChainName
};
