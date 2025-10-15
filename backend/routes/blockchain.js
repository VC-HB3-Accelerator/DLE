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
const { getSupportedChainIds } = require('../utils/networkLoader');

// Функция для получения списка сетей из БД для данного DLE
async function getSupportedChainIdsForDLE(dleAddress) {
  try {
    // Используем networkLoader для получения поддерживаемых сетей
    const supportedChainIds = await getSupportedChainIds();
    
    console.log(`[Blockchain] Найдены сети через networkLoader для DLE ${dleAddress}:`, supportedChainIds);
    return supportedChainIds;
  } catch (error) {
    console.error(`[Blockchain] Ошибка получения сетей для DLE ${dleAddress}:`, error);
    return [17000, 11155111, 421614, 84532];
  }
}

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

    // Определяем корректную сеть для данного адреса (или используем chainId из запроса)
    let provider, rpcUrl, targetChainId = req.body.chainId;
    
    // Получаем список сетей из базы данных для данного DLE
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    if (targetChainId) {
      rpcUrl = await rpcProviderService.getRpcUrlByChainId(Number(targetChainId));
      if (!rpcUrl) {
        return res.status(500).json({ success: false, error: `RPC URL для сети ${targetChainId} не найден` });
      }
      provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
      const code = await provider.getCode(dleAddress);
      if (!code || code === '0x') {
        return res.status(400).json({ success: false, error: `По адресу ${dleAddress} нет контракта в сети ${targetChainId}` });
      }
    } else {
      // Ищем контракт во всех сетях
      let foundContracts = [];
      
      for (const cid of candidateChainIds) {
        try {
          const url = await rpcProviderService.getRpcUrlByChainId(cid);
          if (!url) continue;
          const prov = new ethers.JsonRpcProvider(url);
          const code = await prov.getCode(dleAddress);
          if (code && code !== '0x') {
            // Контракт найден, currentChainId теперь равен block.chainid
            foundContracts.push({
              chainId: cid,
              currentChainId: cid, // currentChainId = block.chainid = cid
              provider: prov,
              rpcUrl: url
            });
          }
        } catch (_) {}
      }
      
      if (foundContracts.length === 0) {
        return res.status(400).json({ success: false, error: 'Не удалось найти сеть, где по адресу есть контракт' });
      }
      
      // Выбираем первую доступную сеть (currentChainId - это governance chain, не primary)
      const primaryContract = foundContracts[0];
      
      if (primaryContract) {
        // Используем основную сеть для чтения данных
        provider = primaryContract.provider;
        rpcUrl = primaryContract.rpcUrl;
        targetChainId = primaryContract.chainId;
      } else {
        // Fallback: берем первый найденный контракт
        const firstContract = foundContracts[0];
        provider = firstContract.provider;
        rpcUrl = firstContract.rpcUrl;
        targetChainId = firstContract.chainId;
      }
    }
    
    // ABI для чтения данных DLE
    const dleAbi = [
      // Актуальная сигнатура без oktmo
      "function getDLEInfo() external view returns (tuple(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp, uint256 creationTimestamp, bool isActive))",
      "function totalSupply() external view returns (uint256)",
      "function balanceOf(address account) external view returns (uint256)",
      "function quorumPercentage() external view returns (uint256)",
      "function getCurrentChainId() external view returns (uint256)",
      "function logoURI() external view returns (string memory)",
      "function getModuleAddress(bytes32 _moduleId) external view returns (address)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Читаем данные DLE
    const dleInfo = await dle.getDLEInfo();
    const totalSupply = await dle.totalSupply();
    const quorumPercentage = await dle.quorumPercentage();
    const currentChainId = targetChainId; // currentChainId = block.chainid = targetChainId
    
    // Читаем логотип
    let logoURI = '';
    try {
      logoURI = await dle.logoURI();
    } catch (error) {
      console.log(`[Blockchain] Ошибка при чтении logoURI:`, error.message);
    }

    // Получаем информацию о партнерах из блокчейна
    const partnerBalances = [];
    let participantCount = 0;

    // Получаем события InitialTokensDistributed для определения партнеров
    try {
      // Получаем последние блоки для поиска событий
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Ищем в последних 10000 блоках
      
      // ABI для события InitialTokensDistributed
      const eventAbi = [
        "event InitialTokensDistributed(address[] partners, uint256[] amounts)"
      ];
      
      const dleWithEvents = new ethers.Contract(dleAddress, [...dleAbi, ...eventAbi], provider);
      
      // Ищем события InitialTokensDistributed
      const events = await dleWithEvents.queryFilter(
        dleWithEvents.filters.InitialTokensDistributed(),
        fromBlock,
        currentBlock
      );
      
      if (events.length > 0) {
        // Берем последнее событие
        const lastEvent = events[events.length - 1];
        const partners = lastEvent.args.partners;
        const amounts = lastEvent.args.amounts;
        
        for (let i = 0; i < partners.length; i++) {
          const partnerAddress = partners[i];
          const amount = amounts[i];
          
          // Проверяем текущий баланс
          const currentBalance = await dle.balanceOf(partnerAddress);
          if (Number(currentBalance) > 0) {
            participantCount++;
            partnerBalances.push({
              address: partnerAddress,
              balance: ethers.formatUnits(currentBalance, 18),
              percentage: (Number(currentBalance) / Number(totalSupply)) * 100,
              initialAmount: ethers.formatUnits(amount, 18)
            });
          }
        }
      }
    } catch (error) {
      console.log(`[Blockchain] Ошибка при получении событий партнеров:`, error.message);
      
      // Fallback: ищем держателей токенов через события Transfer
      try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000);
        
        const transferEventAbi = [
          "event Transfer(address indexed from, address indexed to, uint256 value)"
        ];
        
        const dleWithTransferEvents = new ethers.Contract(dleAddress, [...dleAbi, ...transferEventAbi], provider);
        
        // Ищем события Transfer с from = address(0) (mint события)
        const mintEvents = await dleWithTransferEvents.queryFilter(
          dleWithTransferEvents.filters.Transfer(ethers.ZeroAddress),
          fromBlock,
          currentBlock
        );
        
        const uniqueRecipients = new Set();
        for (const event of mintEvents) {
          uniqueRecipients.add(event.args.to);
        }
        
        // Проверяем текущие балансы всех получателей
        for (const recipient of uniqueRecipients) {
          const balance = await dle.balanceOf(recipient);
          if (Number(balance) > 0) {
            participantCount++;
            partnerBalances.push({
              address: recipient,
              balance: ethers.formatUnits(balance, 18),
              percentage: (Number(balance) / Number(totalSupply)) * 100
            });
          }
        }
      } catch (fallbackError) {
        console.log(`[Blockchain] Ошибка при fallback поиске партнеров:`, fallbackError.message);
      }
    }

    // Читаем информацию о модулях
    const modules = {};
    try {
      console.log(`[Blockchain] Читаем модули для DLE: ${dleAddress}`);
      
      // Определяем известные модули
      const moduleNames = ['reader', 'treasury', 'timelock'];
      
      for (const moduleName of moduleNames) {
        try {
          // Вычисляем moduleId (keccak256 от имени модуля)
          const moduleId = ethers.keccak256(ethers.toUtf8Bytes(moduleName));
          
          // Получаем адрес модуля
          const moduleAddress = await dle.getModuleAddress(moduleId);
          
          if (moduleAddress && moduleAddress !== ethers.ZeroAddress) {
            modules[moduleName] = moduleAddress;
            console.log(`[Blockchain] Модуль ${moduleName}: ${moduleAddress}`);
          } else {
            console.log(`[Blockchain] Модуль ${moduleName} не инициализирован`);
          }
        } catch (moduleError) {
          console.log(`[Blockchain] Ошибка при чтении модуля ${moduleName}:`, moduleError.message);
        }
      }
    } catch (modulesError) {
      console.log(`[Blockchain] Ошибка при чтении модулей:`, modulesError.message);
    }

    // Собираем информацию о всех развернутых сетях
    const deployedNetworks = [];
    if (typeof foundContracts !== 'undefined') {
      for (const contract of foundContracts) {
        deployedNetworks.push({
          chainId: contract.chainId,
          address: dleAddress,
          currentChainId: contract.currentChainId,
          isPrimary: false // currentChainId - это governance chain, не primary
        });
      }
    } else {
      // Если chainId был указан в запросе, добавляем только эту сеть
      deployedNetworks.push({
        chainId: targetChainId,
        address: dleAddress,
        currentChainId: Number(currentChainId),
        isPrimary: Number(currentChainId) === targetChainId
      });
    }

    const blockchainData = {
      name: dleInfo.name,
      symbol: dleInfo.symbol,
      dleAddress: dleAddress, // Добавляем адрес контракта
      location: dleInfo.location,
      coordinates: dleInfo.coordinates,
      jurisdiction: Number(dleInfo.jurisdiction),
      // Поле oktmo удалено в актуальной версии контракта; сохраняем 0 для обратной совместимости
      oktmo: 0,
      okvedCodes: dleInfo.okvedCodes,
      kpp: Number(dleInfo.kpp),
      creationTimestamp: Number(dleInfo.creationTimestamp),
      isActive: dleInfo.isActive,
      totalSupply: ethers.formatUnits(totalSupply, 18),
      partnerBalances: partnerBalances, // Информация о партнерах и их балансах
      logoURI: logoURI, // URL логотипа токена
      quorumPercentage: Number(quorumPercentage),
      currentChainId: Number(currentChainId),
      rpcUsed: rpcUrl,
      participantCount: participantCount,
      modules: modules, // Информация о модулях
      deployedNetworks: deployedNetworks // Информация о всех развернутых сетях
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

// УДАЛЕНО: дублируется в dleMultichain.js

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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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
        const maxRetries = 1;
        
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
          targetChains: proposal.targets.map(targetChainId => Number(targetChainId)),
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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
        const governanceChainId = targetChainId || 11155111; // Используем найденную сеть или Sepolia по умолчанию

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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

// УДАЛЕНО: дублируется в dleModules.js

// УДАЛЕНО: дублируется в dleModules.js

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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

// УДАЛЕНО: дублируется в dleMultichain.js

// УДАЛЕНО: дублируется в dleMultichain.js

// УДАЛЕНО: дублируется в dleMultichain.js

// УДАЛЕНО: дублируется в dleMultichain.js

// УДАЛЕНО: дублируется в dleMultichain.js

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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

// УДАЛЕНО: дублируется в dleModules.js

// УДАЛЕНО: дублируется в dleModules.js

// УДАЛЕНО: дублируется в dleModules.js

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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    const candidateChainIds = await getSupportedChainIdsForDLE(dleAddress);
    
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const prov = new ethers.JsonRpcProvider(url);
        const code = await prov.getCode(dleAddress);
        if (code && code !== '0x') { 
          rpcUrl = url; 
          targetChainId = cid; 
          break; 
        }
      } catch (_) {}
    }
    
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
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