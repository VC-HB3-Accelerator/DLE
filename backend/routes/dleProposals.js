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

const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const rpcProviderService = require('../services/rpcProviderService');
const { getSupportedChainIds } = require('../utils/networkLoader');

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

    console.log(`[DLE Proposals] Получение списка предложений для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети DLE из контракта
    let supportedChains = [];
    try {
      // Определяем корректную сеть для данного адреса
      let rpcUrl, targetChainId;
      // Получаем поддерживаемые сети из deploy_params
      const candidateChainIds = await getSupportedChainIds();
      
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
        console.log(`[DLE Proposals] Не удалось найти сеть для адреса ${dleAddress}`);
        // Fallback к известным сетям из deploy_params или базовые
        supportedChains = candidateChainIds.length > 0 ? candidateChainIds : [11155111, 17000, 421614, 84532];
        console.log(`[DLE Proposals] Используем fallback сети:`, supportedChains);
        return;
      }
      if (rpcUrl) {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const dleAbi = [
          "function getSupportedChainCount() external view returns (uint256)",
          "function getSupportedChainId(uint256 _index) external view returns (uint256)"
        ];
        const dle = new ethers.Contract(dleAddress, dleAbi, provider);
        
        const chainCount = await dle.getSupportedChainCount();
        console.log(`[DLE Proposals] Количество поддерживаемых сетей: ${chainCount}`);
        
        for (let i = 0; i < Number(chainCount); i++) {
          const chainId = await dle.getSupportedChainId(i);
          supportedChains.push(Number(chainId));
        }
        
        console.log(`[DLE Proposals] Поддерживаемые сети из контракта:`, supportedChains);
      }
    } catch (error) {
      console.log(`[DLE Proposals] Ошибка получения поддерживаемых сетей из контракта:`, error.message);
      // Fallback к известным сетям
      supportedChains = [11155111, 17000, 421614, 84532];
      console.log(`[DLE Proposals] Используем fallback сети:`, supportedChains);
    }
    
    const allProposals = [];
    
    // Ищем предложения во всех поддерживаемых сетях
    for (const chainId of supportedChains) {
      try {
        console.log(`[DLE Proposals] Поиск предложений в сети ${chainId}...`);
        
        const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
        if (!rpcUrl) {
          console.log(`[DLE Proposals] RPC URL для сети ${chainId} не найден, пропускаем`);
          continue;
        }

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // ABI для чтения предложений (используем getProposalSummary для мультиконтрактов)
        const dleAbi = [
          "function getProposalState(uint256 _proposalId) external view returns (uint8 state)",
          "function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)",
          "function getProposalSummary(uint256 _proposalId) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, uint256 governanceChainId, uint256 snapshotTimepoint, uint256[] memory targetChains)",
          "function quorumPercentage() external view returns (uint256)",
          "function getPastTotalSupply(uint256 timepoint) external view returns (uint256)",
          "function totalSupply() external view returns (uint256)",
          "event ProposalCreated(uint256 proposalId, address initiator, string description)"
        ];

        const dle = new ethers.Contract(dleAddress, dleAbi, provider);

        // Получаем события ProposalCreated для определения количества предложений
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 10000); // Последние 10000 блоков
        
        const events = await dle.queryFilter('ProposalCreated', fromBlock, currentBlock);
        
        console.log(`[DLE Proposals] Найдено событий ProposalCreated в сети ${chainId}: ${events.length}`);
        console.log(`[DLE Proposals] Диапазон блоков: ${fromBlock} - ${currentBlock}`);
        
        // Читаем информацию о каждом предложении
        for (let i = 0; i < events.length; i++) {
          try {
            const proposalId = events[i].args.proposalId;
            console.log(`[DLE Proposals] Читаем предложение ID: ${proposalId}`);
            
              // Пробуем несколько раз для новых предложений
              let proposalState, isPassed, quorumReached, forVotes, againstVotes, quorumRequired, currentTotalSupply, quorumPct;
              let retryCount = 0;
              const maxRetries = 1;
            
            while (retryCount < maxRetries) {
              try {
                proposalState = await dle.getProposalState(proposalId);
                const result = await dle.checkProposalResult(proposalId);
                isPassed = result.passed;
                quorumReached = result.quorumReached;
                
                // Получаем данные о голосах из структуры Proposal (включая мультиконтрактные поля)
                try {
                  const proposalData = await dle.getProposalSummary(proposalId);
                  forVotes = Number(proposalData.forVotes);
                  againstVotes = Number(proposalData.againstVotes);
                  
                  // Вычисляем требуемый кворум
                  quorumPct = Number(await dle.quorumPercentage());
                  const pastSupply = Number(await dle.getPastTotalSupply(proposalData.snapshotTimepoint));
                  quorumRequired = Math.floor((pastSupply * quorumPct) / 100);
                  
                    // Получаем текущий totalSupply для отображения
                    currentTotalSupply = Number(await dle.totalSupply());
                  
                  console.log(`[DLE Proposals] Кворум для предложения ${proposalId}:`, {
                    quorumPercentage: quorumPct,
                    pastSupply: pastSupply,
                    quorumRequired: quorumRequired,
                    quorumPercentageFormatted: `${quorumPct}%`,
                    snapshotTimepoint: proposalData.snapshotTimepoint,
                    pastSupplyFormatted: `${(pastSupply / 10**18).toFixed(2)} DLE`,
                    quorumRequiredFormatted: `${(quorumRequired / 10**18).toFixed(2)} DLE`
                  });
                } catch (voteError) {
                  console.log(`[DLE Proposals] Ошибка получения голосов для предложения ${proposalId}:`, voteError.message);
                  forVotes = 0;
                    againstVotes = 0;
                    quorumRequired = 0;
                    currentTotalSupply = 0;
                    quorumPct = 0;
                }
                
                break; // Успешно прочитали
              } catch (error) {
                retryCount++;
                console.log(`[DLE Proposals] Попытка ${retryCount} чтения предложения ${proposalId} не удалась:`, error.message);
                if (retryCount < maxRetries) {
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
                } else {
                  throw error; // Превышено количество попыток
                }
              }
            }
            
            console.log(`[DLE Proposals] Данные предложения ${proposalId}:`, {
              id: Number(proposalId),
              description: events[i].args.description,
              state: Number(proposalState),
              isPassed: isPassed,
              quorumReached: quorumReached,
              forVotes: Number(forVotes),
              againstVotes: Number(againstVotes),
              quorumRequired: Number(quorumRequired),
              initiator: events[i].args.initiator
            });
            
            // Фильтруем предложения по времени - только за последние 30 дней
            const block = await provider.getBlock(events[i].blockNumber);
            const proposalTime = block.timestamp;
            const currentTime = Math.floor(Date.now() / 1000);
            const thirtyDaysAgo = currentTime - (30 * 24 * 60 * 60); // 30 дней назад
            
            if (proposalTime < thirtyDaysAgo) {
              console.log(`[DLE Proposals] Пропускаем старое предложение ${proposalId} (${new Date(proposalTime * 1000).toISOString()})`);
              continue;
            }
            
        // Показываем все предложения, включая выполненные и отмененные
        // Согласно контракту: 0=Pending, 1=Succeeded, 2=Defeated, 3=Executed, 4=Canceled, 5=ReadyForExecution
        // Убрали фильтрацию выполненных и отмененных предложений для отображения в UI
            
            // Создаем уникальный ID, включающий chainId
            const uniqueId = `${chainId}-${proposalId}`;
            
            // Получаем мультиконтрактные данные из proposalData (если доступны)
            let operation = null;
            let governanceChainId = null;
            let targetChains = [];
            let decodedOperation = null;
            let operationDescription = null;
            
            try {
              const proposalData = await dle.getProposalSummary(proposalId);
              governanceChainId = Number(proposalData.governanceChainId);
              targetChains = proposalData.targetChains.map(chain => Number(chain));
              
              // Получаем operation из отдельного вызова (если нужно)
              // operation не возвращается в getProposalSummary, но это не критично для мультиконтрактов
              operation = null; // Пока не реализовано
              
              // Декодируем операцию (если доступна)
              if (operation && operation !== '0x') {
                const { decodeOperation, formatOperation } = require('../utils/operationDecoder');
                decodedOperation = decodeOperation(operation);
                operationDescription = formatOperation(decodedOperation);
              }
            } catch (error) {
              console.log(`[DLE Proposals] Не удалось получить мультиконтрактные данные для предложения ${proposalId}:`, error.message);
            }

            const proposalInfo = {
              id: Number(proposalId),
              uniqueId: uniqueId,
              description: events[i].args.description,
              state: Number(proposalState),
              isPassed: isPassed,
              quorumReached: quorumReached,
              forVotes: Number(forVotes),
              againstVotes: Number(againstVotes),
              quorumRequired: Number(quorumRequired),
              totalSupply: Number(currentTotalSupply || 0), // Добавляем totalSupply
              contractQuorumPercentage: Number(quorumPct), // Добавляем процент кворума из контракта
              initiator: events[i].args.initiator,
              blockNumber: events[i].blockNumber,
              transactionHash: events[i].transactionHash,
              chainId: chainId, // Добавляем информацию о сети
              timestamp: proposalTime,
              createdAt: new Date(proposalTime * 1000).toISOString(),
              executed: Number(proposalState) === 3, // 3 = Executed
              canceled: Number(proposalState) === 4,  // 4 = Canceled
              // Мультиконтрактные поля
              operation: operation,
              governanceChainId: governanceChainId,
              targetChains: targetChains,
              isMultichain: targetChains && targetChains.length > 0,
              decodedOperation: decodedOperation,
              operationDescription: operationDescription
            };
            
            // Проверяем, нет ли уже такого предложения (по уникальному ID)
            const existingProposal = allProposals.find(p => p.uniqueId === uniqueId);
            if (!existingProposal) {
              allProposals.push(proposalInfo);
            } else {
              console.log(`[DLE Proposals] Пропускаем дубликат предложения ${uniqueId}`);
            }
          } catch (error) {
            console.log(`[DLE Proposals] Ошибка при чтении предложения ${i}:`, error.message);
            
            // Если это ошибка декодирования, возможно предложение еще не полностью записано
            if (error.message.includes('could not decode result data')) {
              console.log(`[DLE Proposals] Предложение ${i} еще не полностью синхронизировано, пропускаем`);
              continue;
            }
            
            // Продолжаем с следующим предложением
          }
        }
        
        console.log(`[DLE Proposals] Найдено предложений в сети ${chainId}: ${events.length}`);
        
      } catch (error) {
        console.log(`[DLE Proposals] Ошибка при поиске предложений в сети ${chainId}:`, error.message);
        // Продолжаем с следующей сетью
      }
    }

    // Сортируем по времени создания (новые сверху), затем по ID
    allProposals.sort((a, b) => {
      if (a.timestamp !== b.timestamp) {
        return b.timestamp - a.timestamp;
      }
      return b.id - a.id;
    });

    console.log(`[DLE Proposals] Найдено предложений: ${allProposals.length}`);

    res.json({
      success: true,
      data: {
        proposals: allProposals,
        totalCount: allProposals.length
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении списка предложений:', error);
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

    console.log(`[DLE Proposals] Получение информации о предложении ${proposalId} в DLE: ${dleAddress}`);

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    // Получаем поддерживаемые сети из deploy_params
    const candidateChainIds = await getSupportedChainIds();
    
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

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // ABI для чтения информации о предложении
    const dleAbi = [
      "function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)",
      "function getProposalState(uint256 _proposalId) external view returns (uint8 state)",
      "event ProposalCreated(uint256 proposalId, address initiator, string description)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Ищем событие ProposalCreated для этого предложения
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000);
    
    const events = await dle.queryFilter('ProposalCreated', fromBlock, currentBlock);
    const proposalEvent = events.find(event => Number(event.args.proposalId) === proposalId);
    
    if (!proposalEvent) {
      return res.status(404).json({
        success: false,
        error: 'Предложение не найдено'
      });
    }
    
    // Получаем состояние и результат предложения
    const result = await dle.checkProposalResult(proposalId);
    const state = await dle.getProposalState(proposalId);
    
    const proposalInfo = {
      id: Number(proposalId),
      description: proposalEvent.args.description,
      initiator: proposalEvent.args.initiator,
      blockNumber: proposalEvent.blockNumber,
      transactionHash: proposalEvent.transactionHash,
      state: Number(state),
      isPassed: result.passed,
      quorumReached: result.quorumReached
    };

    console.log(`[DLE Proposals] Информация о предложении получена:`, proposalInfo);

    res.json({
      success: true,
      data: proposalInfo
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении информации о предложении:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении информации о предложении: ' + error.message
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

    console.log(`[DLE Proposals] Получение состояния предложения ${proposalId} в DLE: ${dleAddress}`);

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

    console.log(`[DLE Proposals] Состояние предложения ${proposalId}: ${state}`);

    res.json({
      success: true,
      data: {
        proposalId: Number(proposalId),
        state: Number(state)
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении состояния предложения:', error);
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

    console.log(`[DLE Proposals] Получение голосов по предложению ${proposalId} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)",
      "function getProposalState(uint256 _proposalId) external view returns (uint8 state)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем результат предложения
    const result = await dle.checkProposalResult(proposalId);
    const state = await dle.getProposalState(proposalId);

    console.log(`[DLE Proposals] Результат предложения ${proposalId}:`, { result, state });

    res.json({
      success: true,
      data: {
        proposalId: Number(proposalId),
        isPassed: result.passed,
        quorumReached: result.quorumReached,
        state: Number(state),
        // Пока не можем получить точные голоса, так как функция не существует в контракте
        forVotes: 0,
        againstVotes: 0,
        totalVotes: 0,
        quorumRequired: 0
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении голосов по предложению:', error);
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

    console.log(`[DLE Proposals] Получение количества предложений для DLE: ${dleAddress}`);

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

    console.log(`[DLE Proposals] Количество предложений: ${count}`);

    res.json({
      success: true,
      data: {
        count: Number(count)
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении количества предложений:', error);
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

    console.log(`[DLE Proposals] Получение списка предложений для DLE: ${dleAddress}`);

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

    console.log(`[DLE Proposals] Список предложений:`, proposals);

    res.json({
      success: true,
      data: {
        proposals: proposals.map(p => Number(p)),
        offset: Number(offset),
        limit: Number(limit)
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении списка предложений:', error);
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

    console.log(`[DLE Proposals] Получение голосующей силы для ${voter} в DLE: ${dleAddress}`);

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

    console.log(`[DLE Proposals] Голосующая сила для ${voter}: ${votingPower}`);

    res.json({
      success: true,
      data: {
        voter: voter,
        timepoint: Number(timepoint),
        votingPower: Number(votingPower)
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении голосующей силы:', error);
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

    console.log(`[DLE Proposals] Получение требуемого кворума для DLE: ${dleAddress}`);

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

    console.log(`[DLE Proposals] Требуемый кворум: ${quorum}`);

    res.json({
      success: true,
      data: {
        timepoint: Number(timepoint),
        quorum: Number(quorum)
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении требуемого кворума:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении требуемого кворума: ' + error.message
    });
  }
});

// Исполнить предложение (подготовка транзакции для MetaMask)
router.post('/execute-proposal', async (req, res) => {
  try {
    console.log('[DLE Proposals] Получен запрос на исполнение предложения:', req.body);
    
    const { dleAddress, proposalId } = req.body;
    
    if (!dleAddress || proposalId === undefined) {
      console.log('[DLE Proposals] Ошибка валидации: отсутствуют обязательные поля');
      return res.status(400).json({
        success: false,
        error: 'Необходимы dleAddress и proposalId'
      });
    }

    console.log(`[DLE Proposals] Подготовка исполнения предложения ${proposalId} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function executeProposal(uint256 _proposalId) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Подготавливаем данные для транзакции (не отправляем)
    const txData = await dle.executeProposal.populateTransaction(proposalId);

    console.log(`[DLE Proposals] Данные транзакции исполнения подготовлены:`, txData);

    res.json({
      success: true,
      data: {
        to: dleAddress,
        data: txData.data,
        value: "0x0",
        gasLimit: "0x1e8480", // 2,000,000 gas
        message: `Подготовлены данные для исполнения предложения ${proposalId}. Отправьте транзакцию через MetaMask.`
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при подготовке исполнения предложения:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при подготовке исполнения предложения: ' + error.message
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

    console.log(`[DLE Proposals] Отмена предложения ${proposalId} в DLE: ${dleAddress}`);

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

    console.log(`[DLE Proposals] Предложение отменено:`, receipt);

    res.json({
      success: true,
      data: {
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при отмене предложения:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отмене предложения: ' + error.message
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

    console.log(`[DLE Proposals] Получение количества предложений для DLE: ${dleAddress}`);

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

    const count = await dle.getProposalsCount();

    console.log(`[DLE Proposals] Количество предложений: ${count}`);

    res.json({
      success: true,
      data: {
        count: Number(count)
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении количества предложений:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении количества предложений: ' + error.message
    });
  }
});

// Получить список предложений с пагинацией
router.post('/list-proposals', async (req, res) => {
  try {
    const { dleAddress, offset = 0, limit = 10 } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Proposals] Получение списка предложений для DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function listProposals(uint256 offset, uint256 limit) external view returns (uint256[] memory)",
      "function getProposalSummary(uint256 _proposalId) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, uint256 governanceChainId, uint256 snapshotTimepoint, uint256[] memory targets)",
      "function getProposalState(uint256 _proposalId) external view returns (uint8 state)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем список ID предложений
    const proposalIds = await dle.listProposals(offset, limit);
    
    console.log(`[DLE Proposals] Получены ID предложений:`, proposalIds);
    console.log(`[DLE Proposals] Количество ID:`, proposalIds.length);
    
    const proposals = [];
    
    // Получаем детали каждого предложения
    console.log(`[DLE Proposals] Начинаем обработку предложений...`);
    for (const proposalId of proposalIds) {
      try {
        const proposal = await dle.getProposalSummary(proposalId);
        const state = await dle.getProposalState(proposalId);
        
        proposals.push({
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
          targetChains: proposal.targets.map(chain => Number(chain)),
          state: Number(state)
        });
      } catch (error) {
        console.log(`[DLE Proposals] Ошибка при получении деталей предложения ${proposalId}:`, error.message);
        // Добавляем базовую информацию о предложении
        proposals.push({
          id: Number(proposalId),
          description: `Предложение #${Number(proposalId)}`,
          forVotes: 0,
          againstVotes: 0,
          executed: false,
          canceled: false,
          deadline: 0,
          initiator: '0x0000000000000000000000000000000000000000',
          governanceChainId: 0,
          snapshotTimepoint: 0,
          targetChains: [],
          state: 0
        });
      }
    }

    console.log(`[DLE Proposals] Получено предложений: ${proposals.length}`);

    res.json({
      success: true,
      data: {
        proposals: proposals,
        offset: Number(offset),
        limit: Number(limit)
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при получении списка предложений:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении списка предложений: ' + error.message
    });
  }
});

// Голосовать за предложение
router.post('/vote-proposal', async (req, res) => {
  try {
    const { dleAddress, proposalId, support } = req.body;
    
    if (!dleAddress || proposalId === undefined || support === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Необходимы dleAddress, proposalId и support'
      });
    }

    console.log(`[DLE Proposals] Голосование за предложение ${proposalId} в DLE: ${dleAddress}, поддержка: ${support}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      "function vote(uint256 _proposalId, bool _support) external"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Пропускаем проверку hasVoted - функция не существует в контракте
    console.log(`[DLE Proposals] Пропускаем проверку hasVoted - полагаемся на смарт-контракт`);

    // Подготавливаем данные для транзакции (не отправляем)
    const txData = await dle.vote.populateTransaction(proposalId, support);

    console.log(`[DLE Proposals] Данные транзакции голосования подготовлены:`, txData);

    res.json({
      success: true,
      data: {
        to: dleAddress,
        data: txData.data,
        value: "0x0",
        gasLimit: "0x1e8480", // 2,000,000 gas
        message: `Подготовлены данные для голосования ${support ? 'за' : 'против'} предложения ${proposalId}. Отправьте транзакцию через MetaMask.`
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при подготовке голосования:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при подготовке голосования: ' + error.message
    });
  }
});

// Проверить статус голосования пользователя
router.post('/check-vote-status', async (req, res) => {
  try {
    const { dleAddress, proposalId, voterAddress } = req.body;
    
    if (!dleAddress || proposalId === undefined || !voterAddress) {
      return res.status(400).json({
        success: false,
        error: 'Необходимы dleAddress, proposalId и voterAddress'
      });
    }

    console.log(`[DLE Proposals] Проверка статуса голосования для ${voterAddress} по предложению ${proposalId} в DLE: ${dleAddress}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Функция hasVoted не существует в контракте DLE
    console.log(`[DLE Proposals] Функция hasVoted не поддерживается в контракте DLE`);
    
    const hasVoted = false; // Всегда возвращаем false, так как функция не существует

    res.json({
      success: true,
      data: {
        hasVoted: hasVoted,
        voterAddress: voterAddress,
        proposalId: proposalId
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при проверке статуса голосования:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при проверке статуса голосования: ' + error.message
    });
  }
});

// Endpoint для отслеживания подтверждения транзакций голосования
router.post('/track-vote-transaction', async (req, res) => {
  try {
    const { txHash, dleAddress, proposalId, support } = req.body;
    
    if (!txHash || !dleAddress || proposalId === undefined || support === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Необходимы txHash, dleAddress, proposalId и support'
      });
    }

    console.log(`[DLE Proposals] Отслеживание транзакции голосования: ${txHash}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Ждем подтверждения транзакции
    const receipt = await provider.waitForTransaction(txHash, 1, 60000); // 60 секунд таймаут
    
    if (receipt && receipt.status === 1) {
      console.log(`[DLE Proposals] Транзакция голосования подтверждена: ${txHash}`);
      
      // Отправляем WebSocket уведомление
      const wsHub = require('../wsHub');
      wsHub.broadcastProposalVoted(dleAddress, proposalId, support, txHash);
      
      res.json({
        success: true,
        data: {
          txHash: txHash,
          status: 'confirmed',
          receipt: receipt
        }
      });
    } else {
      res.json({
        success: false,
        error: 'Транзакция не подтверждена или провалилась'
      });
    }

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при отслеживании транзакции:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отслеживании транзакции: ' + error.message
    });
  }
});

// Endpoint для отслеживания подтверждения транзакций исполнения
router.post('/track-execution-transaction', async (req, res) => {
  try {
    const { txHash, dleAddress, proposalId } = req.body;
    
    if (!txHash || !dleAddress || proposalId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Необходимы txHash, dleAddress и proposalId'
      });
    }

    console.log(`[DLE Proposals] Отслеживание транзакции исполнения: ${txHash}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Ждем подтверждения транзакции
    const receipt = await provider.waitForTransaction(txHash, 1, 60000); // 60 секунд таймаут
    
    if (receipt && receipt.status === 1) {
      console.log(`[DLE Proposals] Транзакция исполнения подтверждена: ${txHash}`);
      
      // Отправляем WebSocket уведомление
      const wsHub = require('../wsHub');
const { getSupportedChainIds } = require('../utils/networkLoader');
      wsHub.broadcastProposalExecuted(dleAddress, proposalId, txHash);
      
      res.json({
        success: true,
        data: {
          txHash: txHash,
          status: 'confirmed',
          receipt: receipt
        }
      });
    } else {
      res.json({
        success: false,
        error: 'Транзакция не подтверждена или провалилась'
      });
    }

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при отслеживании транзакции исполнения:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при отслеживании транзакции исполнения: ' + error.message
    });
  }
});

// Декодировать данные предложения о добавлении модуля
router.post('/decode-proposal-data', async (req, res) => {
  try {
    const { transactionHash } = req.body;
    
    if (!transactionHash) {
      return res.status(400).json({
        success: false,
        error: 'Хеш транзакции обязателен'
      });
    }

    console.log(`[DLE Proposals] Декодирование данных транзакции: ${transactionHash}`);

    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(11155111);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: 'RPC URL для Sepolia не найден'
      });
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Получаем данные транзакции
    const tx = await provider.getTransaction(transactionHash);
    if (!tx) {
      return res.status(404).json({
        success: false,
        error: 'Транзакция не найдена'
      });
    }

    // Декодируем данные транзакции
    const iface = new ethers.Interface([
      "function createAddModuleProposal(string memory _description, uint256 _duration, bytes32 _moduleId, address _moduleAddress, uint256 _chainId) external returns (uint256)"
    ]);

    try {
      const decoded = iface.parseTransaction({ data: tx.data });
      
      const proposalData = {
        description: decoded.args._description,
        duration: Number(decoded.args._duration),
        moduleId: decoded.args._moduleId,
        moduleAddress: decoded.args._moduleAddress,
        chainId: Number(decoded.args._chainId)
      };

      console.log(`[DLE Proposals] Декодированные данные:`, proposalData);

      res.json({
        success: true,
        data: proposalData
      });

    } catch (decodeError) {
      console.log(`[DLE Proposals] Ошибка декодирования:`, decodeError.message);
      res.status(400).json({
        success: false,
        error: 'Не удалось декодировать данные транзакции: ' + decodeError.message
      });
    }

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при декодировании данных предложения:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при декодировании данных предложения: ' + error.message
    });
  }
});

module.exports = router;
