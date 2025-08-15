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

// Импортируем WebSocket функции из wsHub
const { broadcastProposalCreated, broadcastProposalVoted, broadcastProposalExecuted } = require('../wsHub');

// Экспортируем router как основной экспорт
module.exports = router; 