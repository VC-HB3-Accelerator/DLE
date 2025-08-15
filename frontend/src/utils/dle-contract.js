import axios from 'axios';
import { ethers } from 'ethers';

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
    const response = await axios.post('http://localhost:8000/api/blockchain/read-dle-info', {
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

    // ABI для создания предложения
  const dleAbi = [
      "function createProposal(string memory _description, uint256 _duration, bytes memory _operation, uint256 _governanceChainId, uint256[] memory _targetChains, uint256 _timelockDelay) external returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, signer);

    // Создаем предложение
  const tx = await dle.createProposal(
      proposalData.description,
      proposalData.duration,
      proposalData.operation,
      proposalData.governanceChainId,
      proposalData.targetChains || [],
      proposalData.timelockDelay || 0
    );

    // Ждем подтверждения транзакции
    const receipt = await tx.wait();

    console.log('Предложение создано, tx hash:', tx.hash);

    return {
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

    // ABI для голосования
    const dleAbi = [
      "function vote(uint256 _proposalId, bool _support) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, signer);

    // Голосуем за предложение
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

    // ABI для исполнения предложения
    const dleAbi = [
      "function executeProposal(uint256 _proposalId) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, signer);

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
 * Создать предложение о добавлении модуля
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {string} description - Описание предложения
 * @param {number} duration - Длительность голосования в секундах
 * @param {string} moduleId - ID модуля
 * @param {string} moduleAddress - Адрес модуля
 * @param {number} chainId - ID цепочки для голосования
 * @returns {Promise<Object>} - Результат создания предложения
 */
export async function createAddModuleProposal(dleAddress, description, duration, moduleId, moduleAddress, chainId) {
  try {
    const response = await axios.post('/blockchain/create-add-module-proposal', {
      dleAddress: dleAddress,
      description: description,
      duration: duration,
      moduleId: moduleId,
      moduleAddress: moduleAddress,
      chainId: chainId
    });
    
    if (response.data.success) {
      return response.data.data;
    } else {
      throw new Error(response.data.message || 'Не удалось создать предложение о добавлении модуля');
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
    const response = await axios.post('/blockchain/create-remove-module-proposal', {
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
    const response = await axios.post('/blockchain/is-module-active', {
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
 * Проверить, поддерживается ли цепочка
 * @param {string} dleAddress - Адрес DLE контракта
 * @param {number} chainId - ID цепочки
 * @returns {Promise<boolean>} - Поддерживается ли цепочка
 */
export async function isChainSupported(dleAddress, chainId) {
  try {
    const response = await axios.post('/blockchain/is-chain-supported', {
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
    const response = await axios.post('/blockchain/get-current-chain-id', {
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
    const response = await axios.post('/blockchain/check-proposal-result', {
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
    const response = await axios.post('http://localhost:8000/api/blockchain/get-proposals', {
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
    const response = await axios.post('http://localhost:8000/api/blockchain/get-supported-chains', {
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

    // ABI для деактивации DLE
    const dleAbi = [
      "function deactivate() external",
      "function balanceOf(address) external view returns (uint256)",
      "function totalSupply() external view returns (uint256)",
      "function createDeactivationProposal(string memory _description, uint256 _duration, uint256 _chainId) external returns (uint256)",
      "function voteDeactivation(uint256 _proposalId, bool _support) external",
      "function checkDeactivationProposalResult(uint256 _proposalId) public view returns (bool passed, bool quorumReached)",
      "function executeDeactivationProposal(uint256 _proposalId) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, signer);

    // Проверяем, что пользователь имеет токены
    const balance = await dle.balanceOf(userAddress);
    if (balance <= 0) {
      throw new Error('Для деактивации DLE необходимо иметь токены');
    }

    // Проверяем, что DLE не пустой (есть токены)
    const totalSupply = await dle.totalSupply();
    if (totalSupply <= 0) {
      throw new Error('DLE не имеет токенов');
    }

    // Выполняем деактивацию (функция проверит наличие валидного предложения с кворумом)
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
    throw error;
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
export async function createDeactivationProposal(dleAddress, description, duration, chainId) {
  try {
    // Проверяем наличие браузерного кошелька
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const dleAbi = [
      "function createDeactivationProposal(string memory _description, uint256 _duration, uint256 _chainId) external returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, signer);

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
export async function voteDeactivationProposal(dleAddress, proposalId, support) {
  try {
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const dleAbi = [
      "function voteDeactivation(uint256 _proposalId, bool _support) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, signer);

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
    const response = await axios.post('http://localhost:8000/api/blockchain/check-deactivation-proposal-result', {
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
export async function executeDeactivationProposal(dleAddress, proposalId) {
  try {
    if (!window.ethereum) {
      throw new Error('Браузерный кошелек не установлен');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const dleAbi = [
      "function executeDeactivationProposal(uint256 _proposalId) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, signer);

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
    const response = await axios.post('http://localhost:8000/api/blockchain/load-deactivation-proposals', {
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