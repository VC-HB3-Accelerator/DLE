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
      "function getProposalState(uint256 _proposalId) external view returns (uint8 state)",
      "function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)",
      "function proposals(uint256) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, bytes memory operation, uint256 governanceChainId, uint256 snapshotTimepoint)",
      "function quorumPercentage() external view returns (uint256)",
      "function getPastTotalSupply(uint256 timepoint) external view returns (uint256)",
      "event ProposalCreated(uint256 proposalId, address initiator, string description)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем события ProposalCreated для определения количества предложений
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Последние 10000 блоков
    
    const events = await dle.queryFilter('ProposalCreated', fromBlock, currentBlock);
    
    console.log(`[DLE Proposals] Найдено событий ProposalCreated: ${events.length}`);
    console.log(`[DLE Proposals] Диапазон блоков: ${fromBlock} - ${currentBlock}`);
    
    const proposals = [];
    
    // Читаем информацию о каждом предложении
    for (let i = 0; i < events.length; i++) {
      try {
        const proposalId = events[i].args.proposalId;
        console.log(`[DLE Proposals] Читаем предложение ID: ${proposalId}`);
        
        // Пробуем несколько раз для новых предложений
        let proposalState, isPassed, quorumReached, forVotes, againstVotes, quorumRequired;
        let retryCount = 0;
        const maxRetries = 1;
        
        while (retryCount < maxRetries) {
          try {
            proposalState = await dle.getProposalState(proposalId);
            const result = await dle.checkProposalResult(proposalId);
            isPassed = result.passed;
            quorumReached = result.quorumReached;
            
            // Получаем данные о голосах из структуры Proposal
            try {
              const proposalData = await dle.proposals(proposalId);
              forVotes = Number(proposalData.forVotes);
              againstVotes = Number(proposalData.againstVotes);
              
              // Вычисляем требуемый кворум
              const quorumPct = Number(await dle.quorumPercentage());
              const pastSupply = Number(await dle.getPastTotalSupply(proposalData.snapshotTimepoint));
              quorumRequired = Math.floor((pastSupply * quorumPct) / 100);
            } catch (voteError) {
              console.log(`[DLE Proposals] Ошибка получения голосов для предложения ${proposalId}:`, voteError.message);
              forVotes = 0;
              againstVotes = 0;
              quorumRequired = 0;
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
        
        const proposalInfo = {
          id: Number(proposalId),
          description: events[i].args.description,
          state: Number(proposalState),
          isPassed: isPassed,
          quorumReached: quorumReached,
          forVotes: Number(forVotes),
          againstVotes: Number(againstVotes),
          quorumRequired: Number(quorumRequired),
          initiator: events[i].args.initiator,
          blockNumber: events[i].blockNumber,
          transactionHash: events[i].transactionHash
        };
        
        proposals.push(proposalInfo);
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

    // Сортируем по ID предложения (новые сверху)
    proposals.sort((a, b) => b.id - a.id);

    console.log(`[DLE Proposals] Найдено предложений: ${proposals.length}`);

    res.json({
      success: true,
      data: {
        proposals: proposals,
        totalCount: proposals.length
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
