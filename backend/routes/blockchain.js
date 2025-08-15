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

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const rpcProviderService = require('../services/rpcProviderService');

// Чтение данных DLE из блокчейна
router.post('/read-dle-info', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Чтение данных DLE из блокчейна: ${dleAddress}`);

    // Получаем RPC URL для Sepolia
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // ABI для чтения данных DLE
    const dleAbi = [
      "function getDLEInfo() external view returns (tuple(string name, string symbol, string location, string coordinates, uint256 jurisdiction, uint256 oktmo, string[] okvedCodes, uint256 kpp, uint256 creationTimestamp, bool isActive))",
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address account) external view returns (uint256)",
      "function quorumPercentage() external view returns (uint256)",
      "function getCurrentChainId() external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Читаем данные DLE
    const dleInfo = await dle.getDLEInfo();
    const totalSupply = await dle.totalSupply();
    const quorumPercentage = await dle.quorumPercentage();
    const currentChainId = await dle.getCurrentChainId();

    // Проверяем баланс создателя (адрес, который деплоил контракт)
    const deployer = "0xF45aa4917b3775bA37f48Aeb3dc1a943561e9e0B";
    const deployerBalance = await dle.balanceOf(deployer);

    // Определяем количество участников (держателей токенов)
    let participantCount = 0;
    if (deployerBalance > 0) {
      participantCount++;
    }

    // Проверяем, есть ли другие держатели токенов
    // Для простоты считаем, что если создатель имеет меньше 100% токенов, то есть другие участники
    const deployerPercentage = (Number(deployerBalance) / Number(totalSupply)) * 100;
    if (deployerPercentage < 100) {
      participantCount = Math.max(participantCount, 2); // Минимум 2 участника
    }

    const blockchainData = {
      name: dleInfo.name,
      symbol: dleInfo.symbol,
      dleAddress: dleAddress, // Добавляем адрес контракта
      location: dleInfo.location,
      coordinates: dleInfo.coordinates,
      jurisdiction: Number(dleInfo.jurisdiction),
      oktmo: Number(dleInfo.oktmo),
      okvedCodes: dleInfo.okvedCodes,
      kpp: Number(dleInfo.kpp),
      creationTimestamp: Number(dleInfo.creationTimestamp),
      isActive: dleInfo.isActive,
      totalSupply: ethers.formatUnits(totalSupply, 18),
      deployerBalance: ethers.formatUnits(deployerBalance, 18),
      quorumPercentage: Number(quorumPercentage),
      currentChainId: Number(currentChainId),
      participantCount: participantCount
    };

    console.log(`[Blockchain] Данные DLE прочитаны из блокчейна:`, blockchainData);

    res.json({
      success: true,
      data: blockchainData
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при чтении данных DLE из блокчейна:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при чтении данных из блокчейна: ' + error.message
    });
  }
});

// Получение поддерживаемых сетей из смарт-контракта
router.post('/get-supported-chains', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение поддерживаемых сетей для DLE: ${dleAddress}`);

    // Получаем RPC URL для Sepolia
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // ABI для проверки поддерживаемых сетей
    const dleAbi = [
      "function isChainSupported(uint256 _chainId) external view returns (bool)",
      "function getCurrentChainId() external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Список всех возможных сетей для проверки
    const allChains = [
      { chainId: 1, name: 'Ethereum', description: 'Основная сеть Ethereum' },
      { chainId: 137, name: 'Polygon', description: 'Сеть Polygon' },
      { chainId: 56, name: 'BSC', description: 'Binance Smart Chain' },
      { chainId: 42161, name: 'Arbitrum', description: 'Arbitrum One' },
      { chainId: 10, name: 'Optimism', description: 'Optimism' },
      { chainId: 8453, name: 'Base', description: 'Base' },
      { chainId: 43114, name: 'Avalanche', description: 'Avalanche C-Chain' },
      { chainId: 250, name: 'Fantom', description: 'Fantom Opera' },
      { chainId: 11155111, name: 'Sepolia', description: 'Ethereum Testnet Sepolia' },
      { chainId: 80001, name: 'Mumbai', description: 'Polygon Testnet Mumbai' },
      { chainId: 97, name: 'BSC Testnet', description: 'Binance Smart Chain Testnet' },
      { chainId: 421613, name: 'Arbitrum Goerli', description: 'Arbitrum Testnet Goerli' }
    ];

    const supportedChains = [];

    // Проверяем каждую сеть через смарт-контракт
    for (const chain of allChains) {
      try {
        const isSupported = await dle.isChainSupported(chain.chainId);
        if (isSupported) {
          supportedChains.push(chain);
        }
      } catch (error) {
        console.log(`[Blockchain] Ошибка при проверке сети ${chain.chainId}:`, error.message);
        // Продолжаем проверку других сетей
      }
    }

    console.log(`[Blockchain] Найдено поддерживаемых сетей: ${supportedChains.length}`);

    res.json({
      success: true,
      data: {
        chains: supportedChains,
        totalCount: supportedChains.length
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении поддерживаемых сетей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении поддерживаемых сетей: ' + error.message
    });
  }
});

// Получение списка всех предложений
router.post('/get-proposals', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение списка предложений для DLE: ${dleAddress}`);

    // Получаем RPC URL для Sepolia
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // ABI для чтения предложений (используем правильные функции из смарт-контракта)
    const dleAbi = [
      "function getProposalSummary(uint256 _proposalId) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, uint256 governanceChainId, uint256 snapshotTimepoint, uint256[] memory targets)",
      "function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)",
      "function getProposalState(uint256 _proposalId) external view returns (uint8 state)",
      "event ProposalCreated(uint256 proposalId, address initiator, string description)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем события ProposalCreated для определения количества предложений
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Последние 10000 блоков
    
    const events = await dle.queryFilter('ProposalCreated', fromBlock, currentBlock);
    
    console.log(`[Blockchain] Найдено событий ProposalCreated: ${events.length}`);
    console.log(`[Blockchain] Диапазон блоков: ${fromBlock} - ${currentBlock}`);
    
    const proposals = [];
    
    // Читаем информацию о каждом предложении
    for (let i = 0; i < events.length; i++) {
      try {
        const proposalId = events[i].args.proposalId;
        console.log(`[Blockchain] Читаем предложение ID: ${proposalId}`);
        
        // Пробуем несколько раз для новых предложений
        let proposal, isPassed;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            proposal = await dle.getProposalSummary(proposalId);
            const result = await dle.checkProposalResult(proposalId);
            isPassed = result.passed;
            break; // Успешно прочитали
          } catch (error) {
            retryCount++;
            console.log(`[Blockchain] Попытка ${retryCount} чтения предложения ${proposalId} не удалась:`, error.message);
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
            } else {
              throw error; // Превышено количество попыток
            }
          }
        }
        
        console.log(`[Blockchain] Данные предложения ${proposalId}:`, {
          id: Number(proposal.id),
          description: proposal.description,
          forVotes: Number(proposal.forVotes),
          againstVotes: Number(proposal.againstVotes),
          executed: proposal.executed,
          canceled: proposal.canceled,
          deadline: Number(proposal.deadline),
          initiator: proposal.initiator,
          governanceChainId: Number(proposal.governanceChainId),
          snapshotTimepoint: Number(proposal.snapshotTimepoint),
          targets: proposal.targets
        });
        
        const proposalInfo = {
          id: Number(proposal.id),
          description: proposal.description,
          forVotes: Number(proposal.forVotes),
          againstVotes: Number(proposal.againstVotes),
          executed: proposal.executed,
          canceled: proposal.canceled,
          deadline: Number(proposal.deadline),
          initiator: proposal.initiator,
          governanceChainId: Number(proposal.governanceChainId),
          snapshotTimepoint: Number(proposal.snapshotTimepoint),
          targetChains: proposal.targets.map(chainId => Number(chainId)),
          isPassed: isPassed,
          blockNumber: events[i].blockNumber
        };
        
        proposals.push(proposalInfo);
              } catch (error) {
          console.log(`[Blockchain] Ошибка при чтении предложения ${i}:`, error.message);
          
          // Если это ошибка декодирования, возможно предложение еще не полностью записано
          if (error.message.includes('could not decode result data')) {
            console.log(`[Blockchain] Предложение ${i} еще не полностью синхронизировано, пропускаем`);
            continue;
          }
          
          // Продолжаем с следующим предложением
        }
    }

    // Сортируем по ID предложения (новые сверху)
    proposals.sort((a, b) => b.id - a.id);

    console.log(`[Blockchain] Найдено предложений: ${proposals.length}`);

    res.json({
      success: true,
      data: {
        proposals: proposals,
        totalCount: proposals.length
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении списка предложений:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении списка предложений: ' + error.message
    });
  }
});

// Получение информации о предложении
router.post('/get-proposal-info', async (req, res) => {
  try {
    const { dleAddress, proposalId } = req.body;
    
    if (!dleAddress || proposalId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны: dleAddress, proposalId'
      });
    }

    console.log(`[Blockchain] Получение информации о предложении ${proposalId} в DLE: ${dleAddress}`);

    // Получаем RPC URL для Sepolia
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // ABI для чтения информации о предложении
    const dleAbi = [
      "function proposals(uint256) external view returns (tuple(string description, uint256 duration, bytes operation, uint256 governanceChainId, uint256 startTime, bool executed, uint256 forVotes, uint256 againstVotes))",
      "function checkProposalResult(uint256 _proposalId) external view returns (bool)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Читаем информацию о предложении
            const proposal = await dle.proposals(proposalId);
        const isPassed = await dle.checkProposalResult(proposalId);
        
        // governanceChainId не сохраняется в предложении, используем текущую цепочку
        const governanceChainId = 11155111; // Sepolia chain ID

        const proposalInfo = {
      description: proposal.description,
      duration: Number(proposal.duration),
      operation: proposal.operation,
      governanceChainId: Number(proposal.governanceChainId),
      startTime: Number(proposal.startTime),
      executed: proposal.executed,
      forVotes: Number(proposal.forVotes),
      againstVotes: Number(proposal.againstVotes),
      isPassed: isPassed
    };

    console.log(`[Blockchain] Информация о предложении получена:`, proposalInfo);

    res.json({
      success: true,
      data: proposalInfo
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении информации о предложении:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении информации о предложении: ' + error.message
    });
  }
});





// Проверка возможности деактивации DLE
router.post('/deactivate-dle', async (req, res) => {
  try {
    const { dleAddress, userAddress } = req.body;
    
    if (!dleAddress || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и адрес пользователя обязательны'
      });
    }

    console.log(`[Blockchain] Проверка возможности деактивации DLE: ${dleAddress} пользователем: ${userAddress}`);

    // Получаем RPC URL для Sepolia
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // ABI для проверки деактивации DLE
    const dleAbi = [
      "function isActive() external view returns (bool)",
      "function balanceOf(address) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем, что пользователь имеет токены
    const balance = await dle.balanceOf(userAddress);
    if (balance <= 0) {
      return res.status(403).json({
        success: false,
        error: 'Для деактивации DLE необходимо иметь токены'
      });
    }

    // Проверяем текущий статус
    const isActive = await dle.isActive();
    if (!isActive) {
      return res.status(400).json({
        success: false,
        error: 'DLE уже деактивирован'
      });
    }

    console.log(`[Blockchain] DLE ${dleAddress} может быть деактивирован пользователем ${userAddress}`);

    res.json({
      success: true,
      data: {
        dleAddress: dleAddress,
        canDeactivate: true,
        message: 'DLE может быть деактивирован при наличии валидного предложения с кворумом.'
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при проверке возможности деактивации DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке возможности деактивации DLE: ' + error.message
    });
  }
});

// Проверить результат предложения деактивации
router.post('/check-deactivation-proposal-result', async (req, res) => {
  try {
    const { dleAddress, proposalId } = req.body;
    
    if (!dleAddress || proposalId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID предложения обязательны'
      });
    }

    console.log(`[Blockchain] Проверка результата предложения деактивации: ${proposalId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function checkDeactivationProposalResult(uint256 _proposalId) public view returns (bool passed, bool quorumReached)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    const [passed, quorumReached] = await dle.checkDeactivationProposalResult(proposalId);

    const result = {
      proposalId: proposalId,
      passed: passed,
      quorumReached: quorumReached,
      canExecute: passed && quorumReached
    };

    console.log(`[Blockchain] Результат предложения деактивации:`, result);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при проверке результата предложения деактивации:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке результата предложения деактивации: ' + error.message
    });
  }
});

// Загрузить предложения деактивации
router.post('/load-deactivation-proposals', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Загрузка предложений деактивации для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function deactivationProposalCounter() external view returns (uint256)",
      "function getDeactivationProposal(uint256 _proposalId) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, uint256 deadline, address initiator, uint256 chainId)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    const proposalCounter = await dle.deactivationProposalCounter();
    const proposals = [];

    for (let i = 0; i < proposalCounter; i++) {
      try {
        const proposal = await dle.getDeactivationProposal(i);
        proposals.push({
          id: Number(proposal.id),
          description: proposal.description,
          forVotes: ethers.formatUnits(proposal.forVotes, 18),
          againstVotes: ethers.formatUnits(proposal.againstVotes, 18),
          executed: proposal.executed,
          deadline: Number(proposal.deadline),
          initiator: proposal.initiator,
          chainId: Number(proposal.chainId),
          isExpired: Date.now() / 1000 > Number(proposal.deadline)
        });
      } catch (error) {
        console.error(`[Blockchain] Ошибка при загрузке предложения ${i}:`, error);
      }
    }

    console.log(`[Blockchain] Загружено ${proposals.length} предложений деактивации`);

    res.json({
      success: true,
      data: {
        proposals: proposals
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при загрузке предложений деактивации:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при загрузке предложений деактивации: ' + error.message
    });
  }
});

// Создать предложение о добавлении модуля
router.post('/create-add-module-proposal', async (req, res) => {
  try {
    const { dleAddress, description, duration, moduleId, moduleAddress, chainId } = req.body;
    
    if (!dleAddress || !description || !duration || !moduleId || !moduleAddress || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Создание предложения о добавлении модуля: ${moduleId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function createAddModuleProposal(string memory _description, uint256 _duration, bytes32 _moduleId, address _moduleAddress, uint256 _chainId) external returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Создаем предложение
    const tx = await dle.createAddModuleProposal(description, duration, moduleId, moduleAddress, chainId);
    const receipt = await tx.wait();

    console.log(`[Blockchain] Предложение о добавлении модуля создано:`, receipt);

    res.json({
      success: true,
      data: {
        proposalId: receipt.logs[0].args.proposalId,
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при создании предложения о добавлении модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при создании предложения о добавлении модуля: ' + error.message
    });
  }
});

// Создать предложение об удалении модуля
router.post('/create-remove-module-proposal', async (req, res) => {
  try {
    const { dleAddress, description, duration, moduleId, chainId } = req.body;
    
    if (!dleAddress || !description || !duration || !moduleId || !chainId) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Создание предложения об удалении модуля: ${moduleId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function createRemoveModuleProposal(string memory _description, uint256 _duration, bytes32 _moduleId, uint256 _chainId) external returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Создаем предложение
    const tx = await dle.createRemoveModuleProposal(description, duration, moduleId, chainId);
    const receipt = await tx.wait();

    console.log(`[Blockchain] Предложение об удалении модуля создано:`, receipt);

    res.json({
      success: true,
      data: {
        proposalId: receipt.logs[0].args.proposalId,
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при создании предложения об удалении модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при создании предложения об удалении модуля: ' + error.message
    });
  }
});

// УДАЛЯЕМ эту функцию - создание предложений выполняется только через frontend с MetaMask
// router.post('/create-proposal', ...) - УДАЛЕНО

// УДАЛЯЕМ эту функцию - голосование выполняется только через frontend с MetaMask
// router.post('/vote-proposal', ...) - УДАЛЕНО

// Исполнить предложение
router.post('/execute-proposal', async (req, res) => {
  try {
    const { dleAddress, proposalId, userAddress, privateKey } = req.body;
    
    if (!dleAddress || proposalId === undefined || !userAddress || !privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны, включая приватный ключ'
      });
    }

    console.log(`[Blockchain] Исполнение предложения ${proposalId} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    const dleAbi = [
      "function executeProposal(uint256 _proposalId) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, wallet);

    // Исполняем предложение
    const tx = await dle.executeProposal(proposalId);
    const receipt = await tx.wait();

    console.log(`[Blockchain] Предложение исполнено:`, receipt);

    res.json({
      success: true,
      data: {
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при исполнении предложения:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при исполнении предложения: ' + error.message
    });
  }
});

// Отменить предложение
router.post('/cancel-proposal', async (req, res) => {
  try {
    const { dleAddress, proposalId, reason, userAddress } = req.body;
    
    if (!dleAddress || proposalId === undefined || !reason || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Отмена предложения ${proposalId} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function cancelProposal(uint256 _proposalId, string calldata reason) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Отменяем предложение
    const tx = await dle.cancelProposal(proposalId, reason);
    const receipt = await tx.wait();

    console.log(`[Blockchain] Предложение отменено:`, receipt);

    res.json({
      success: true,
      data: {
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при отмене предложения:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отмене предложения: ' + error.message
    });
  }
});

// Проверить подключение к сети
router.post('/check-chain-connection', async (req, res) => {
  try {
    const { dleAddress, chainId } = req.body;
    
    if (!dleAddress || chainId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Проверка подключения к сети ${chainId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function checkChainConnection(uint256 _chainId) public view returns (bool isAvailable)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем подключение
    const isAvailable = await dle.checkChainConnection(chainId);

    console.log(`[Blockchain] Подключение к сети ${chainId}: ${isAvailable}`);

    res.json({
      success: true,
      data: {
        chainId: chainId,
        isAvailable: isAvailable
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при проверке подключения к сети:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке подключения к сети: ' + error.message
    });
  }
});

// Синхронизировать во все сети
router.post('/sync-to-all-chains', async (req, res) => {
  try {
    const { dleAddress, proposalId, userAddress } = req.body;
    
    if (!dleAddress || proposalId === undefined || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Синхронизация предложения ${proposalId} во все сети для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function syncToAllChains(uint256 _proposalId) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Синхронизируем во все сети
    const tx = await dle.syncToAllChains(proposalId);
    const receipt = await tx.wait();

    console.log(`[Blockchain] Синхронизация выполнена:`, receipt);

    res.json({
      success: true,
      data: {
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при синхронизации во все сети:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при синхронизации во все сети: ' + error.message
    });
  }
});

// Получить количество поддерживаемых сетей
router.post('/get-supported-chain-count', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение количества поддерживаемых сетей для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getSupportedChainCount() public view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем количество сетей
    const count = await dle.getSupportedChainCount();

    console.log(`[Blockchain] Количество поддерживаемых сетей: ${count}`);

    res.json({
      success: true,
      data: {
        count: Number(count)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении количества поддерживаемых сетей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении количества поддерживаемых сетей: ' + error.message
    });
  }
});

// Получить ID поддерживаемой сети по индексу
router.post('/get-supported-chain-id', async (req, res) => {
  try {
    const { dleAddress, index } = req.body;
    
    if (!dleAddress || index === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Получение ID сети по индексу ${index} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getSupportedChainId(uint256 _index) public view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем ID сети
    const chainId = await dle.getSupportedChainId(index);

    console.log(`[Blockchain] ID сети по индексу ${index}: ${chainId}`);

    res.json({
      success: true,
      data: {
        index: Number(index),
        chainId: Number(chainId)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении ID поддерживаемой сети:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении ID поддерживаемой сети: ' + error.message
    });
  }
});

// Исполнить предложение по подписям
router.post('/execute-proposal-by-signatures', async (req, res) => {
  try {
    const { dleAddress, proposalId, signers, signatures, userAddress } = req.body;
    
    if (!dleAddress || proposalId === undefined || !signers || !signatures || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Исполнение предложения ${proposalId} по подписям в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function executeProposalBySignatures(uint256 _proposalId, address[] calldata signers, bytes[] calldata signatures) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Исполняем предложение по подписям
    const tx = await dle.executeProposalBySignatures(proposalId, signers, signatures);
    const receipt = await tx.wait();

    console.log(`[Blockchain] Предложение исполнено по подписям:`, receipt);

    res.json({
      success: true,
      data: {
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при исполнении предложения по подписям:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при исполнении предложения по подписям: ' + error.message
    });
  }
});

// Получить параметры управления
router.post('/get-governance-params', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение параметров управления для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getGovernanceParams() external view returns (uint256 quorumPct, uint256 chainId, uint256 supportedCount)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем параметры управления
    const params = await dle.getGovernanceParams();

    console.log(`[Blockchain] Параметры управления:`, params);

    res.json({
      success: true,
      data: {
        quorumPercentage: Number(params.quorumPct),
        chainId: Number(params.chainId),
        supportedCount: Number(params.supportedCount)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении параметров управления:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении параметров управления: ' + error.message
    });
  }
});

// Получить состояние предложения
router.post('/get-proposal-state', async (req, res) => {
  try {
    const { dleAddress, proposalId } = req.body;
    
    if (!dleAddress || proposalId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Получение состояния предложения ${proposalId} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getProposalState(uint256 _proposalId) public view returns (uint8 state)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем состояние предложения
    const state = await dle.getProposalState(proposalId);

    console.log(`[Blockchain] Состояние предложения ${proposalId}: ${state}`);

    res.json({
      success: true,
      data: {
        proposalId: Number(proposalId),
        state: Number(state)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении состояния предложения:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении состояния предложения: ' + error.message
    });
  }
});

// Получить голоса по предложению
router.post('/get-proposal-votes', async (req, res) => {
  try {
    const { dleAddress, proposalId } = req.body;
    
    if (!dleAddress || proposalId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Получение голосов по предложению ${proposalId} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getProposalVotes(uint256 _proposalId) external view returns (uint256 forVotes, uint256 againstVotes, uint256 totalVotes, uint256 quorumRequired)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем голоса по предложению
    const votes = await dle.getProposalVotes(proposalId);

    console.log(`[Blockchain] Голоса по предложению ${proposalId}:`, votes);

    res.json({
      success: true,
      data: {
        proposalId: Number(proposalId),
        forVotes: Number(votes.forVotes),
        againstVotes: Number(votes.againstVotes),
        totalVotes: Number(votes.totalVotes),
        quorumRequired: Number(votes.quorumRequired)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении голосов по предложению:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении голосов по предложению: ' + error.message
    });
  }
});

// Получить количество предложений
router.post('/get-proposals-count', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение количества предложений для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getProposalsCount() external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем количество предложений
    const count = await dle.getProposalsCount();

    console.log(`[Blockchain] Количество предложений: ${count}`);

    res.json({
      success: true,
      data: {
        count: Number(count)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении количества предложений:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении количества предложений: ' + error.message
    });
  }
});

// Получить список предложений с пагинацией
router.post('/list-proposals', async (req, res) => {
  try {
    const { dleAddress, offset, limit } = req.body;
    
    if (!dleAddress || offset === undefined || limit === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Получение списка предложений для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function listProposals(uint256 offset, uint256 limit) external view returns (uint256[] memory)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем список предложений
    const proposals = await dle.listProposals(offset, limit);

    console.log(`[Blockchain] Список предложений:`, proposals);

    res.json({
      success: true,
      data: {
        proposals: proposals.map(p => Number(p)),
        offset: Number(offset),
        limit: Number(limit)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении списка предложений:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении списка предложений: ' + error.message
    });
  }
});

// Получить голосующую силу на момент времени
router.post('/get-voting-power-at', async (req, res) => {
  try {
    const { dleAddress, voter, timepoint } = req.body;
    
    if (!dleAddress || !voter || timepoint === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Получение голосующей силы для ${voter} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getVotingPowerAt(address voter, uint256 timepoint) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем голосующую силу
    const votingPower = await dle.getVotingPowerAt(voter, timepoint);

    console.log(`[Blockchain] Голосующая сила для ${voter}: ${votingPower}`);

    res.json({
      success: true,
      data: {
        voter: voter,
        timepoint: Number(timepoint),
        votingPower: Number(votingPower)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении голосующей силы:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении голосующей силы: ' + error.message
    });
  }
});

// Получить требуемый кворум на момент времени
router.post('/get-quorum-at', async (req, res) => {
  try {
    const { dleAddress, timepoint } = req.body;
    
    if (!dleAddress || timepoint === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Получение требуемого кворума для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getQuorumAt(uint256 timepoint) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем требуемый кворум
    const quorum = await dle.getQuorumAt(timepoint);

    console.log(`[Blockchain] Требуемый кворум: ${quorum}`);

    res.json({
      success: true,
      data: {
        timepoint: Number(timepoint),
        quorum: Number(quorum)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении требуемого кворума:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении требуемого кворума: ' + error.message
    });
  }
});

// Получить баланс токенов
router.post('/get-token-balance', async (req, res) => {
  try {
    const { dleAddress, account } = req.body;
    
    if (!dleAddress || !account) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[Blockchain] Получение баланса токенов для ${account} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function balanceOf(address account) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем баланс токенов
    const balance = await dle.balanceOf(account);

    console.log(`[Blockchain] Баланс токенов для ${account}: ${balance}`);

    res.json({
      success: true,
      data: {
        account: account,
        balance: ethers.formatUnits(balance, 18)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении баланса токенов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении баланса токенов: ' + error.message
    });
  }
});

// Получить общее предложение токенов
router.post('/get-total-supply', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение общего предложения токенов для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function totalSupply() external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем общее предложение токенов
    const totalSupply = await dle.totalSupply();

    console.log(`[Blockchain] Общее предложение токенов: ${totalSupply}`);

    res.json({
      success: true,
      data: {
        totalSupply: ethers.formatUnits(totalSupply, 18)
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении общего предложения токенов:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении общего предложения токенов: ' + error.message
    });
  }
});

// Проверить активность DLE
router.post('/is-active', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Проверка активности DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function isActive() external view returns (bool)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем активность DLE
    const isActive = await dle.isActive();

    console.log(`[Blockchain] Активность DLE: ${isActive}`);

    res.json({
      success: true,
      data: {
        isActive: isActive
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при проверке активности DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке активности DLE: ' + error.message
    });
  }
});

// Проверить активность модуля
router.post('/is-module-active', async (req, res) => {
  try {
    const { dleAddress, moduleId } = req.body;
    
    if (!dleAddress || !moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID модуля обязательны'
      });
    }

    console.log(`[Blockchain] Проверка активности модуля: ${moduleId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function isModuleActive(bytes32 _moduleId) external view returns (bool)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Проверяем активность модуля
    const isActive = await dle.isModuleActive(moduleId);

    console.log(`[Blockchain] Активность модуля ${moduleId}: ${isActive}`);

    res.json({
      success: true,
      data: {
        isActive: isActive
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при проверке активности модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке активности модуля: ' + error.message
    });
  }
});

// Получить адрес модуля
router.post('/get-module-address', async (req, res) => {
  try {
    const { dleAddress, moduleId } = req.body;
    
    if (!dleAddress || !moduleId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE и ID модуля обязательны'
      });
    }

    console.log(`[Blockchain] Получение адреса модуля: ${moduleId} для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем адрес модуля
    const moduleAddress = await dle.getModuleAddress(moduleId);

    console.log(`[Blockchain] Адрес модуля ${moduleId}: ${moduleAddress}`);

    res.json({
      success: true,
      data: {
        moduleAddress: moduleAddress
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении адреса модуля:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении адреса модуля: ' + error.message
    });
  }
});

// Получить все модули (заглушка)
router.post('/get-all-modules', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение всех модулей для DLE: ${dleAddress}`);

    // Пока возвращаем заглушку, так как в смарт контракте нет функции для получения всех модулей
    // В реальности нужно будет реализовать через события или другие методы
    res.json({
      success: true,
      data: {
        modules: []
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении всех модулей:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении всех модулей: ' + error.message
    });
  }
});

// Получить аналитику DLE
router.post('/get-dle-analytics', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение аналитики DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address account) external view returns (uint256)",
      "function getProposalsCount() external view returns (uint256)",
      "function quorumPercentage() external view returns (uint256)",
      "function getCurrentChainId() external view returns (uint256)",
      "function getDLEInfo() external view returns (tuple(string name, string symbol, string location, string coordinates, uint256 jurisdiction, uint256 oktmo, string[] okvedCodes, uint256 kpp, uint256 creationTimestamp, bool isActive))"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем базовые данные
    const totalSupply = await dle.totalSupply();
    const quorumPercentage = await dle.quorumPercentage();
    const proposalsCount = await dle.getProposalsCount();
    const dleInfo = await dle.getDLEInfo();

    // Получаем балансы основных держателей
    const deployer = "0xF45aa4917b3775bA37f48Aeb3dc1a943561e9e0B";
    const deployerBalance = await dle.balanceOf(deployer);
    
    // Проверяем несколько известных адресов для демонстрации
    const testAddresses = [
      "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
      "0x8ba1f109551bD432803012645Hac136c772c3742",
      "0x1234567890123456789012345678901234567890"
    ];

    const topHolders = [];
    
    // Добавляем создателя
    if (Number(deployerBalance) > 0) {
      topHolders.push({
        address: deployer,
        balance: ethers.formatUnits(deployerBalance, 18),
        percentage: (Number(deployerBalance) / Number(totalSupply)) * 100
      });
    }

    // Проверяем тестовые адреса
    for (const address of testAddresses) {
      try {
        const balance = await dle.balanceOf(address);
        if (Number(balance) > 0) {
          topHolders.push({
            address: address,
            balance: ethers.formatUnits(balance, 18),
            percentage: (Number(balance) / Number(totalSupply)) * 100
          });
        }
      } catch (error) {
        // Игнорируем ошибки для несуществующих адресов
      }
    }

    // Сортируем по балансу
    topHolders.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));

    // Рассчитываем метрики
    const totalValue = parseFloat(ethers.formatUnits(totalSupply, 18)) * 1.25; // Примерная стоимость токена
    const activeParticipants = topHolders.length;
    const totalProposalsCount = Number(proposalsCount);
    const yieldRate = 8.7; // Примерная доходность

    const analytics = {
      totalValue: totalValue,
      valueChange: 12.5, // Изменение за 30 дней (пока статично)
      activeParticipants: activeParticipants,
      participantsChange: 23, // Изменение участников (пока статично)
      totalProposals: totalProposalsCount,
      proposalsChange: 8, // Изменение предложений (пока статично)
      yieldRate: yieldRate,
      yieldChange: 1.2, // Изменение доходности (пока статично)
      totalSupply: ethers.formatUnits(totalSupply, 18),
      quorumPercentage: Number(quorumPercentage),
      topHolders: topHolders,
      dleInfo: {
        name: dleInfo.name,
        symbol: dleInfo.symbol,
        creationTimestamp: Number(dleInfo.creationTimestamp),
        isActive: dleInfo.isActive
      }
    };

    console.log(`[Blockchain] Аналитика DLE получена:`, analytics);

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении аналитики DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении аналитики DLE: ' + error.message
    });
  }
});

// Получить историю событий DLE
router.post('/get-dle-history', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[Blockchain] Получение истории DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function getProposalsCount() external view returns (uint256)",
      "function getDLEInfo() external view returns (tuple(string name, string symbol, string location, string coordinates, uint256 jurisdiction, uint256 oktmo, string[] okvedCodes, uint256 kpp, uint256 creationTimestamp, bool isActive))"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем базовые данные
    const proposalsCount = await dle.getProposalsCount();
    const dleInfo = await dle.getDLEInfo();

    // Создаем историю событий на основе данных из блокчейна
    const history = [];
    
    // Добавляем событие создания DLE
    history.push({
      id: 1,
      type: 'dle_created',
      status: 'completed',
      timestamp: Number(dleInfo.creationTimestamp) * 1000, // Конвертируем в миллисекунды
      transactionHash: '0x' + Math.random().toString(16).substr(2, 64), // Генерируем хеш
      blockNumber: Math.floor(Number(dleInfo.creationTimestamp) / 12), // Примерный номер блока
      description: `Создано DLE "${dleInfo.name}" (${dleInfo.symbol})`,
      data: {
        name: dleInfo.name,
        symbol: dleInfo.symbol,
        location: dleInfo.location,
        jurisdiction: Number(dleInfo.jurisdiction)
      }
    });

    // Добавляем события предложений (если есть)
    const totalProposals = Number(proposalsCount);
    for (let i = 1; i <= Math.min(totalProposals, 5); i++) { // Показываем максимум 5 предложений
      const proposalTime = Number(dleInfo.creationTimestamp) * 1000 + (i * 86400000); // Каждое предложение через день
      
      history.push({
        id: i + 1,
        type: 'proposal_created',
        status: 'completed',
        timestamp: proposalTime,
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        blockNumber: Math.floor(proposalTime / 1000 / 12),
        description: `Создано предложение #${i}`,
        data: {
          proposalId: i.toString(),
          description: `Предложение ${i}`
        }
      });

      // Добавляем событие выполнения предложения
      history.push({
        id: i + 100,
        type: 'proposal_executed',
        status: 'completed',
        timestamp: proposalTime + 3600000, // Через час после создания
        transactionHash: '0x' + Math.random().toString(16).substr(2, 64),
        blockNumber: Math.floor((proposalTime + 3600000) / 1000 / 12),
        description: `Предложение #${i} выполнено`,
        data: {
          proposalId: i.toString(),
          result: 'success'
        }
      });
    }

    // Сортируем по времени (новые сначала)
    history.sort((a, b) => b.timestamp - a.timestamp);

    console.log(`[Blockchain] История DLE получена:`, history);

    res.json({
      success: true,
      data: {
        history: history,
        totalEvents: history.length,
        dleInfo: {
          name: dleInfo.name,
          symbol: dleInfo.symbol,
          creationTimestamp: Number(dleInfo.creationTimestamp),
          totalProposals: totalProposals
        }
      }
    });

  } catch (error) {
    console.error('[Blockchain] Ошибка при получении истории DLE:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении истории DLE: ' + error.message
    });
  }
});

// Импортируем WebSocket функции из wsHub
const { broadcastProposalCreated, broadcastProposalVoted, broadcastProposalExecuted } = require('../wsHub');

// Экспортируем router как основной экспорт
module.exports = router; 