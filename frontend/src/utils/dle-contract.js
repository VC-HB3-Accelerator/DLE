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
import { ethers } from 'ethers';
import { DLE_ABI, DLE_DEACTIVATION_ABI, TOKEN_ABI } from './dle-abi';

// Функция для переключения сети кошелька
export async function switchToVotingNetwork(chainId) {
  try {
    // Преобразуем chainId в строку для поиска в объекте networks
    const chainIdStr = String(chainId);
    console.log(`🔄 [NETWORK] Пытаемся переключиться на сеть ${chainId} (строка: ${chainIdStr})...`);
    
    // Конфигурации сетей
    const networks = {
      '11155111': { // Sepolia
        chainId: '0xaa36a7',
        chainName: 'Sepolia',
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://1rpc.io/sepolia'],
        blockExplorerUrls: ['https://sepolia.etherscan.io']
      },
      '17000': { // Holesky
        chainId: '0x4268',
        chainName: 'Holesky',
        nativeCurrency: { name: 'Holesky Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://ethereum-holesky.publicnode.com'],
        blockExplorerUrls: ['https://holesky.etherscan.io']
      },
      '421614': { // Arbitrum Sepolia
        chainId: '0x66eee',
        chainName: 'Arbitrum Sepolia',
        nativeCurrency: { name: 'Arbitrum Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://sepolia.arbiscan.io']
      },
      '84532': { // Base Sepolia
        chainId: '0x14a34',
        chainName: 'Base Sepolia',
        nativeCurrency: { name: 'Base Sepolia Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://sepolia.base.org'],
        blockExplorerUrls: ['https://sepolia.basescan.org']
      }
    };
    
    const networkConfig = networks[chainIdStr];
    if (!networkConfig) {
      console.error(`❌ [NETWORK] Неизвестная сеть: ${chainId} (строка: ${chainIdStr})`);
      console.error(`❌ [NETWORK] Доступные сети:`, Object.keys(networks));
      return false;
    }
    
    // Проверяем, подключена ли уже нужная сеть
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log(`🔍 [NETWORK] Текущая сеть: ${currentChainId}, нужная: ${networkConfig.chainId}`);
    if (currentChainId === networkConfig.chainId) {
      console.log(`✅ [NETWORK] Сеть ${chainIdStr} уже подключена`);
      return true;
    }
    
    // Пытаемся переключиться на нужную сеть
    try {
      console.log(`🔄 [NETWORK] Запрашиваем переключение на сеть ${chainIdStr}...`);
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: networkConfig.chainId }]
      });
      console.log(`✅ [NETWORK] Успешно переключились на сеть ${chainIdStr}`);
      return true;
    } catch (switchError) {
      console.error(`⚠️ [NETWORK] Ошибка переключения:`, switchError);
      // Если сеть не добавлена, добавляем её
      if (switchError.code === 4902) {
        console.log(`➕ [NETWORK] Добавляем сеть ${chainIdStr}...`);
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig]
          });
          console.log(`✅ [NETWORK] Сеть ${chainIdStr} добавлена и подключена`);
          return true;
        } catch (addError) {
          console.error(`❌ [NETWORK] Ошибка добавления сети ${chainIdStr}:`, addError);
          return false;
        }
      } else {
        console.error(`❌ [NETWORK] Ошибка переключения на сеть ${chainIdStr}:`, switchError);
        return false;
      }
    }
  } catch (error) {
    console.error(`❌ [NETWORK] Общая ошибка переключения сети ${chainIdStr}:`, error);
    return false;
  }
}

/**
 * Проверить подключение к браузерному кошельку
 * @returns {Promise<Object>} - Информация о подключенном кошельке
 */
export async function checkWalletConnection() {
  try {
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const network = await provider.getNetwork();

    return {
      connected: true,
      address: address,
      chainId: Number(network.chainId),
      provider: window.ethereum.isMetaMask ? 'MetaMask' : 'Other Wallet'
    };
  } catch (error) {
    console.error('Ошибка подключения к кошельку:', error);
    
    // Улучшенная обработка ошибок MetaMask
    let errorMessage = 'Ошибка подключения к кошельку.';
    
    if (error.message && error.message.includes('MetaMask extension not found')) {
      errorMessage = 'Расширение MetaMask не найдено. Пожалуйста, установите MetaMask и обновите страницу.';
    } else if (error.message && error.message.includes('Failed to connect to MetaMask')) {
      errorMessage = 'Не удалось подключиться к MetaMask. Проверьте, что расширение установлено и активно.';
    } else if (error.message && error.message.includes('Браузерный кошелек не установлен')) {
      errorMessage = 'Браузерный кошелек не установлен. Пожалуйста, установите MetaMask.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Утилита для работы с реальными функциями смарт-контракта DLE
 * Используется только система голосования (proposals)
 */



/**
 * Получить информацию о DLE из блокчейна
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Object>} - Информация о DLE
 */
export async function getDLEInfo(dleAddress) {
  try {
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Не удалось прочитать данные из блокчейна');
    }
  } catch (error) {
    console.error('Ошибка получения информации о DLE:', error);
    throw error;
  }
}

/**
 * Загружает данные DLE из блокчейна (алиас для getDLEInfo)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Object>} - Данные DLE из блокчейна
 */
export async function loadDleDataFromBlockchain(dleAddress) {
  return getDLEInfo(dleAddress);
}

/**
 * Создать новое предложение для голосования через браузерный кошелек
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {Object} proposalData - Данные предложения
 * @returns {Promise<Object>} - Результат создания
 */
export async function createProposal(dleAddress, proposalData) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI
    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Создаем предложение
    // Правильный порядок параметров: description, duration, operation, targetChains, timelockDelay
    const tx = await dle.createProposal(
      proposalData.description,
      proposalData.duration,
      proposalData.operation,
      proposalData.targetChains || [],
      proposalData.timelockDelay || 0
    );

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение создано, tx hash:', tx.hash);

    return {
      success: true,
      proposalId: receipt.logs[0]?.topics[1] || '0', // Извлекаем ID предложения из события
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    console.error('Ошибка создания предложения:', error);
    throw error;
  }
}

/**
 * Голосовать за предложение через браузерный кошелек
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {boolean} support - Поддержка предложения
 * @returns {Promise<Object>} - Результат голосования
 */
export async function voteForProposal(dleAddress, proposalId, support) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI
    let dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Дополнительная диагностика перед голосованием
    try {
      console.log('🔍 [VOTE DEBUG] Проверяем состояние предложения...');
      const proposalState = await dle.getProposalState(proposalId);
      console.log('🔍 [VOTE DEBUG] Состояние предложения:', proposalState);
      
      // Проверяем, можно ли голосовать (состояние должно быть 0 = Pending)
      if (Number(proposalState) !== 0) {
        throw new Error(`Предложение в состоянии ${proposalState}, голосование невозможно`);
      }
      
      console.log('🔍 [VOTE DEBUG] Предложение в правильном состоянии для голосования');
      
      // Проверяем право голоса (если доступно)
      try {
        const proposal = await dle.proposals(proposalId);
        if (proposal.snapshotTimepoint) {
          const votingPower = await dle.getPastVotes(signer.address, proposal.snapshotTimepoint);
          console.log('🔍 [VOTE DEBUG] Право голоса:', votingPower.toString());
          if (votingPower === 0n) {
            throw new Error('У пользователя нет права голоса (votingPower = 0)');
          }
          console.log('🔍 [VOTE DEBUG] У пользователя есть право голоса');
        }
      } catch (votingPowerError) {
        console.warn('⚠️ [VOTE DEBUG] Не удалось проверить право голоса (продолжаем):', votingPowerError.message);
      }
      
    } catch (debugError) {
      console.warn('⚠️ [VOTE DEBUG] Ошибка диагностики (продолжаем):', debugError.message);
    }

    // Голосуем за предложение
    console.log('🗳️ [VOTE] Отправляем транзакцию голосования...');
    const tx = await dle.vote(proposalId, support);

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Голосование выполнено, tx hash:', tx.hash);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };

    } catch (error) {
      console.error('Ошибка голосования:', error);
      
      // Детальная диагностика ошибки
      if (error.code === 'CALL_EXCEPTION' && error.data) {
        console.error('🔍 [ERROR DEBUG] Детали ошибки:', {
          code: error.code,
          data: error.data,
          reason: error.reason,
          action: error.action
        });
        
        // Расшифровка кода ошибки
        if (error.data === '0x2eaf0f6d') {
          console.error('❌ [ERROR DEBUG] Ошибка: ErrWrongChain - неправильная сеть для голосования');
        } else if (error.data === '0xe7005635') {
          console.error('❌ [ERROR DEBUG] Ошибка: ErrAlreadyVoted - пользователь уже голосовал по этому предложению');
        } else if (error.data === '0x21c19873') {
          console.error('❌ [ERROR DEBUG] Ошибка: ErrNoPower - у пользователя нет права голоса');
        } else if (error.data === '0x834d7b85') {
          console.error('❌ [ERROR DEBUG] Ошибка: ErrProposalMissing - предложение не найдено');
        } else if (error.data === '0xd6792fad') {
          console.error('❌ [ERROR DEBUG] Ошибка: ErrProposalEnded - время голосования истекло');
        } else if (error.data === '0x2d686f73') {
          console.error('❌ [ERROR DEBUG] Ошибка: ErrProposalExecuted - предложение уже исполнено');
        } else if (error.data === '0xc7567e07') {
          console.error('❌ [ERROR DEBUG] Ошибка: ErrProposalCanceled - предложение отменено');
        } else {
          console.error('❌ [ERROR DEBUG] Неизвестная ошибка:', error.data);
        }
      }
      
      throw error;
    }
}

/**
 * Исполнить предложение через браузерный кошелек
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат исполнения
 */
export async function executeProposal(dleAddress, proposalId) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI

    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Исполняем предложение
    const tx = await dle.executeProposal(proposalId);

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение исполнено, tx hash:', tx.hash);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    console.error('Ошибка исполнения предложения:', error);
    throw error;
  }
}

/**
 * Отменить предложение
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {string} reason - Причина отмены
 * @returns {Promise<Object>} - Результат отмены
 */
export async function cancelProposal(dleAddress, proposalId, reason) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI
    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Отменяем предложение
    const tx = await dle.cancelProposal(proposalId, reason);

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение отменено, tx hash:', tx.hash);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };
  } catch (error) {
    console.error('Ошибка отмены предложения:', error);
    throw error;
  }
}

/**
 * Проверить баланс токенов пользователя
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Баланс токенов
 */
export async function checkTokenBalance(dleAddress, userAddress) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    // Создаем провайдер (только для чтения)
    const provider = new ethers.BrowserProvider(window.ethereum);
    const dle = new ethers.Contract(dleAddress, DLE_ABI, provider);

    // Получаем баланс токенов
    const balance = await dle.balanceOf(userAddress);
    const balanceFormatted = ethers.formatEther(balance);
    
    console.log(`💰 Баланс токенов для ${userAddress}: ${balanceFormatted}`);

    return {
      balance: balanceFormatted,
      hasTokens: balance > 0,
      rawBalance: balance.toString()
    };
  } catch (error) {
    console.error('Ошибка проверки баланса токенов:', error);
    throw error;
  }
}

/**
 * Создать предложение о добавлении модуля (с автоматической оплатой газа)
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} description - Описание предложения
 * @param {number} duration - Длительность голосования в секундах
 * @param {string} moduleId - ID модуля
 * @param {string} moduleAddress - Адрес модуля
 * @param {number} chainId - ID цепочки для голосования
 * @param {string} deploymentId - ID деплоя для получения приватного ключа (опционально)
 * @returns {Promise<Object>} - Результат создания предложения
 */
export async function createAddModuleProposal(dleAddress, description, duration, moduleId, moduleAddress, chainId, deploymentId = null) {
  try {
    const requestData = {
      dleAddress: dleAddress,
      description: description,
      duration: duration,
      moduleId: moduleId,
      moduleAddress: moduleAddress,
      chainId: chainId
    };

    // Добавляем deploymentId если он передан
    if (deploymentId) {
      requestData.deploymentId = deploymentId;
    }

    const response = await api.post('/dle-modules/create-add-module-proposal', requestData);
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.error || 'Не удалось создать предложение о добавлении модуля');
    }
  } catch (error) {
    console.error('Ошибка создания предложения о добавлении модуля:', error);
    throw error;
  }
}

/**
 * Создать предложение об удалении модуля
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} description - Описание предложения
 * @param {number} duration - Длительность голосования в секундах
 * @param {string} moduleId - ID модуля
 * @param {number} chainId - ID цепочки для голосования
 * @returns {Promise<Object>} - Результат создания предложения
 */
export async function createRemoveModuleProposal(dleAddress, description, duration, moduleId, chainId) {
  try {
    const response = await api.post('/blockchain/create-remove-module-proposal', {
      dleAddress: dleAddress,
      description: description,
      duration: duration,
      moduleId: moduleId,
      chainId: chainId
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Не удалось создать предложение об удалении модуля');
    }
  } catch (error) {
    console.error('Ошибка создания предложения об удалении модуля:', error);
    throw error;
  }
}

/**
 * Проверить, активен ли модуль
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} moduleId - ID модуля
 * @returns {Promise<boolean>} - Активен ли модуль
 */
export async function isModuleActive(dleAddress, moduleId) {
  try {
    const response = await api.post('/blockchain/is-module-active', {
      dleAddress: dleAddress,
      moduleId: moduleId
    });
    
    if (response.data.success) {
      return response.data.data.isActive;
    } else {
      throw new Error(response.data.message || 'Не удалось проверить активность модуля');
    }
  } catch (error) {
    console.error('Ошибка проверки активности модуля:', error);
    return false;
  }
}

/**
 * Получить адрес модуля
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} moduleId - ID модуля
 * @returns {Promise<string>} - Адрес модуля
 */
export async function getModuleAddress(dleAddress, moduleId, chainId) {
  try {
    const response = await api.post('/dle-modules/get-module-address', {
      dleAddress: dleAddress,
      moduleId: moduleId,
      chainId: chainId
    });
    
    if (response.data.success) {
      return response.data.data.moduleAddress;
    } else {
      throw new Error(response.data.message || 'Не удалось получить адрес модуля');
    }
  } catch (error) {
    console.error('Ошибка получения адреса модуля:', error);
    return '';
  }
}

/**
 * Проверить, поддерживается ли цепочка
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} chainId - ID цепочки
 * @returns {Promise<boolean>} - Поддерживается ли цепочка
 */
export async function isChainSupported(dleAddress, chainId) {
  try {
    const response = await api.post('/blockchain/is-chain-supported', {
      dleAddress: dleAddress,
      chainId: chainId
    });
    
    if (response.data.success) {
      return response.data.data.isSupported;
    } else {
      throw new Error(response.data.message || 'Не удалось проверить поддержку цепочки');
    }
  } catch (error) {
    console.error('Ошибка проверки поддержки цепочки:', error);
    return false;
  }
}

/**
 * Получить текущий ID цепочки
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<number>} - Текущий ID цепочки
 */
export async function getCurrentChainId(dleAddress) {
  try {
    const response = await api.post('/blockchain/get-current-chain-id', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.chainId;
    } else {
      throw new Error(response.data.message || 'Не удалось получить текущий ID цепочки');
    }
  } catch (error) {
    console.error('Ошибка получения текущего ID цепочки:', error);
    return 0;
  }
}

/**
 * Проверить результат предложения
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат проверки
 */
export async function checkProposalResult(dleAddress, proposalId) {
  try {
    const response = await api.post('/blockchain/check-proposal-result', {
      dleAddress: dleAddress,
      proposalId: proposalId
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Не удалось проверить результат предложения');
    }
  } catch (error) {
    console.error('Ошибка проверки результата предложения:', error);
    return { passed: false, quorumReached: false };
  }
}

// Заглушки для совместимости с существующими компонентами
// Эти функции не существуют в реальном контракте, но используются в UI

/**
 * Загружает предложения DLE из блокчейна
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список предложений
 */
export async function loadProposals(dleAddress) {
  try {
    const response = await api.post('/blockchain/get-proposals', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.proposals;
    } else {
      throw new Error(response.data.message || 'Не удалось загрузить предложения');
    }
  } catch (error) {
    console.error('Ошибка загрузки предложений:', error);
    return [];
  }
}

/**
 * Загружает держателей токенов DLE (заглушка для UI)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список держателей токенов
 */
export async function loadTokenHolders(dleAddress) {
  try {
    // В реальности нужно сканировать события Transfer из блокчейна
    return [];
  } catch (error) {
    console.error('Ошибка загрузки держателей токенов:', error);
    return [];
  }
}

/**
 * Загружает историю операций DLE (заглушка для UI)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список операций
 */
export async function loadHistory(dleAddress) {
  try {
    // В реальности нужно читать все события из блокчейна
    return [];
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
    return [];
  }
}

/**
 * Загружает активы казны DLE (заглушка для UI)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список активов
 */
export async function loadTreasuryAssets(dleAddress) {
  try {
    // В реальности нужно читать балансы токенов из блокчейна
    return [];
  } catch (error) {
    console.error('Ошибка загрузки активов казны:', error);
    return [];
  }
}

/**
 * Загружает аналитику DLE (заглушка для UI)
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Object>} - Данные аналитики
 */
export async function loadAnalytics(dleAddress) {
  try {
    // В реальности нужно агрегировать данные из блокчейна
    return {
      topParticipants: [],
      totalSupply: 0,
      participantCount: 0,
      activeProposals: 0
    };
  } catch (error) {
    console.error('Ошибка загрузки аналитики:', error);
    return {
      topParticipants: [],
      totalSupply: 0,
      participantCount: 0,
      activeProposals: 0
    };
  }
}

/**
 * Получить поддерживаемые цепочки из смарт-контракта
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список поддерживаемых цепочек
 */
export async function getSupportedChains(dleAddress) {
  try {
    const response = await api.post('/blockchain/get-supported-chains', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.chains;
    } else {
      throw new Error(response.data.message || 'Не удалось получить поддерживаемые цепочки');
    }
  } catch (error) {
    console.error('Ошибка получения поддерживаемых цепочек:', error);
    // Возвращаем пустой массив если API недоступен
    return [];
  }
}

/**
 * Деактивировать DLE (только при достижении кворума)
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат деактивации
 */
// ФУНКЦИЯ НЕ СУЩЕСТВУЕТ В КОНТРАКТЕ
export async function deactivateDLE(dleAddress, userAddress) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Проверяем, что подключенный адрес совпадает с userAddress
    const connectedAddress = await signer.getAddress();
    if (connectedAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error('Подключенный кошелек не совпадает с адресом пользователя');
    }

    // Сначала проверяем возможность деактивации через API
    console.log('Проверяем возможность деактивации DLE через API...');
    const checkResponse = await api.post('/blockchain/deactivate-dle', {
      dleAddress: dleAddress,
      userAddress: userAddress
    });

    if (!checkResponse.data.success) {
      throw new Error(checkResponse.data.error || 'Не удалось проверить возможность деактивации');
    }

    console.log('Проверка деактивации прошла успешно, выполняем деактивацию...');

    // Используем общий ABI для деактивации

    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Дополнительные проверки перед деактивацией
    const balance = await dle.balanceOf(userAddress);
    if (balance <= 0) {
      throw new Error('Для деактивации DLE необходимо иметь токены');
    }

    const totalSupply = await dle.totalSupply();
    if (totalSupply <= 0) {
      throw new Error('DLE не имеет токенов');
    }

    const isActive = await dle.isActive();
    if (!isActive) {
      throw new Error('DLE уже деактивирован');
    }

    // Выполняем деактивацию
    console.log('Выполняем деактивацию DLE...');
    const tx = await dle.deactivate();
    const receipt = await tx.wait();

    console.log('DLE деактивирован, tx hash:', tx.hash);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: 'DLE успешно деактивирован'
    };

  } catch (error) {
    console.error('Ошибка деактивации DLE:', error);
    
    // Улучшенная обработка ошибок
    let errorMessage = 'Ошибка при деактивации DLE';
    
    if (error.message.includes('execution reverted')) {
      errorMessage = '❌ Деактивация невозможна: не выполнены условия смарт-контракта. Возможно, требуется голосование участников или DLE уже деактивирован.';
    } else if (error.message.includes('владелец')) {
      errorMessage = '❌ Только владелец DLE может его деактивировать';
    } else if (error.message.includes('кошелек')) {
      errorMessage = '❌ Необходимо подключить кошелек';
    } else if (error.message.includes('деактивирован')) {
      errorMessage = '❌ DLE уже деактивирован';
    } else if (error.message.includes('токены')) {
      errorMessage = '❌ Для деактивации DLE необходимо иметь токены';
    } else {
      errorMessage = `❌ Ошибка: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Создать предложение о деактивации DLE
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} description - Описание предложения
 * @param {number} duration - Длительность голосования в секундах
 * @param {number} chainId - ID цепочки для деактивации
 * @returns {Promise<Object>} - Результат создания предложения
 */
// ФУНКЦИЯ НЕ СУЩЕСТВУЕТ В КОНТРАКТЕ
export async function createDeactivationProposal(dleAddress, description, duration, chainId) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI для деактивации

    const dle = new ethers.Contract(dleAddress, DLE_DEACTIVATION_ABI, signer);

    const tx = await dle.createDeactivationProposal(description, duration, chainId);
    const receipt = await tx.wait();

    console.log('Предложение о деактивации создано, tx hash:', tx.hash);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: 'Предложение о деактивации создано'
    };

  } catch (error) {
    console.error('Ошибка создания предложения о деактивации:', error);
    throw error;
  }
}

/**
 * Голосовать за предложение деактивации
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {boolean} support - Поддержка предложения
 * @returns {Promise<Object>} - Результат голосования
 */
// ФУНКЦИЯ НЕ СУЩЕСТВУЕТ В КОНТРАКТЕ
export async function voteDeactivationProposal(dleAddress, proposalId, support) {
  try {
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI для деактивации

    const dle = new ethers.Contract(dleAddress, DLE_DEACTIVATION_ABI, signer);

    const tx = await dle.voteDeactivation(proposalId, support);
    const receipt = await tx.wait();

    console.log('Голосование за предложение деактивации, tx hash:', tx.hash);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: `Голосование ${support ? 'за' : 'против'} предложения деактивации`
    };

  } catch (error) {
    console.error('Ошибка голосования за предложение деактивации:', error);
    throw error;
  }
}

/**
 * Проверить результат предложения деактивации
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат проверки
 */
export async function checkDeactivationProposalResult(dleAddress, proposalId) {
  try {
    const response = await api.post('/blockchain/check-deactivation-proposal-result', {
      dleAddress: dleAddress,
      proposalId: proposalId
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Не удалось проверить результат предложения деактивации');
    }
  } catch (error) {
    console.error('Ошибка проверки результата предложения деактивации:', error);
    throw error;
  }
}

/**
 * Исполнить предложение деактивации
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @returns {Promise<Object>} - Результат исполнения
 */
// ФУНКЦИЯ НЕ СУЩЕСТВУЕТ В КОНТРАКТЕ
export async function executeDeactivationProposal(dleAddress, proposalId) {
  try {
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI для деактивации

    const dle = new ethers.Contract(dleAddress, DLE_DEACTIVATION_ABI, signer);

    const tx = await dle.executeDeactivationProposal(proposalId);
    const receipt = await tx.wait();

    console.log('Предложение деактивации исполнено, tx hash:', tx.hash);

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      message: 'Предложение деактивации успешно исполнено'
    };

  } catch (error) {
    console.error('Ошибка исполнения предложения деактивации:', error);
    throw error;
  }
}

/**
 * Загрузить предложения деактивации
 * @param {string} dleAddress - Адрес DLE контракта
 * @returns {Promise<Array>} - Список предложений деактивации
 */
export async function loadDeactivationProposals(dleAddress) {
  try {
    const response = await api.post('/blockchain/load-deactivation-proposals', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      return response.data.data.proposals;
    } else {
      throw new Error(response.data.message || 'Не удалось загрузить предложения деактивации');
    }
  } catch (error) {
    console.error('Ошибка загрузки предложений деактивации:', error);
    return [];
  }
} 

/**
 * Создать предложение о переводе токенов через governance
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {Object} transferData - Данные перевода
 * @param {string} transferData.recipient - Адрес получателя
 * @param {number} transferData.amount - Количество токенов
 * @param {string} transferData.description - Описание предложения
 * @param {number} transferData.duration - Длительность голосования в секундах
 * @param {Array<number>} transferData.targetChains - Целевые сети для исполнения
 * @returns {Promise<Object>} - Результат создания предложения
 */
export async function createTransferTokensProposal(dleAddress, transferData) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    // Запрашиваем подключение к кошельку
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    // Используем общий ABI

    const dle = new ethers.Contract(dleAddress, DLE_ABI, signer);

    // Получаем адрес отправителя (инициатора предложения)
    const senderAddress = await signer.getAddress();

    // Кодируем операцию перевода токенов
    // Правильная сигнатура: _transferTokens(address,address,uint256)
    // Параметры: sender (инициатор), recipient (получатель), amount (в wei)
    const functionSignature = '_transferTokens(address,address,uint256)';
    const iface = new ethers.Interface([`function ${functionSignature}`]);
    const operation = iface.encodeFunctionData('_transferTokens', [
      senderAddress,      // адрес инициатора
      transferData.recipient,   // адрес получателя
      ethers.parseUnits(transferData.amount.toString(), 18) // количество в wei
    ]);

    console.log('Создание предложения о переводе токенов:', {
      recipient: transferData.recipient,
      amount: transferData.amount,
      description: transferData.description,
      operation: operation
    });

    // Создаем предложение
    // Правильный порядок параметров: description, duration, operation, targetChains, timelockDelay
    const tx = await dle.createProposal(
      transferData.description,
      transferData.duration,
      operation,
      transferData.targetChains || [],
      0 // timelockDelay
    );

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение о переводе токенов создано, tx hash:', tx.hash);

    return {
      proposalId: receipt.logs[0]?.topics[1] || '0', // Извлекаем ID предложения из события
      txHash: tx.hash,
      blockNumber: receipt.blockNumber
    };

  } catch (error) {
    console.error('Ошибка создания предложения о переводе токенов:', error);
    throw error;
  }
}

/**
 * Исполнить мультиконтрактное предложение во всех целевых сетях
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат исполнения
 */
export async function executeMultichainProposal(dleAddress, proposalId, userAddress) {
  try {
    // Импортируем сервис мультиконтрактного исполнения
    const { 
      executeInAllTargetChains, 
      getDeploymentId,
      formatExecutionResult,
      getExecutionErrors 
    } = await import('@/services/multichainExecutionService');

    // Получаем ID деплоя
    const deploymentId = await getDeploymentId(dleAddress);
    
    // Исполняем во всех целевых сетях
    const result = await executeInAllTargetChains(dleAddress, proposalId, deploymentId, userAddress);
    
    return {
      success: true,
      result,
      summary: formatExecutionResult(result),
      errors: getExecutionErrors(result)
    };

  } catch (error) {
    console.error('Ошибка исполнения мультиконтрактного предложения:', error);
    throw error;
  }
}

/**
 * Исполнить мультиконтрактное предложение в конкретной сети
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} proposalId - ID предложения
 * @param {number} targetChainId - ID целевой сети
 * @param {string} userAddress - Адрес пользователя
 * @returns {Promise<Object>} - Результат исполнения
 */
export async function executeMultichainProposalInChain(dleAddress, proposalId, targetChainId, userAddress) {
  try {
    // Импортируем сервис мультиконтрактного исполнения
    const { 
      executeInTargetChain, 
      getDeploymentId,
      getChainName 
    } = await import('@/services/multichainExecutionService');

    // Получаем ID деплоя
    const deploymentId = await getDeploymentId(dleAddress);
    
    // Исполняем в конкретной сети
    const result = await executeInTargetChain(dleAddress, proposalId, targetChainId, deploymentId, userAddress);
    
    return {
      success: true,
      result,
      chainName: getChainName(targetChainId)
    };

  } catch (error) {
    console.error('Ошибка исполнения мультиконтрактного предложения в сети:', error);
    throw error;
  }
} 