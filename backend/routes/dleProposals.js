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
    
    console.log(`[DLE Proposals] Найдено событий ProposalCreated: ${events.length}`);
    console.log(`[DLE Proposals] Диапазон блоков: ${fromBlock} - ${currentBlock}`);
    
    const proposals = [];
    
    // Читаем информацию о каждом предложении
    for (let i = 0; i < events.length; i++) {
      try {
        const proposalId = events[i].args.proposalId;
        console.log(`[DLE Proposals] Читаем предложение ID: ${proposalId}`);
        
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
            console.log(`[DLE Proposals] Попытка ${retryCount} чтения предложения ${proposalId} не удалась:`, error.message);
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды
            } else {
              throw error; // Превышено количество попыток
            }
          }
        }
        
        console.log(`[DLE Proposals] Данные предложения ${proposalId}:`, {
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
      "function getProposalVotes(uint256 _proposalId) external view returns (uint256 forVotes, uint256 againstVotes, uint256 totalVotes, uint256 quorumRequired)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем голоса по предложению
    const votes = await dle.getProposalVotes(proposalId);

    console.log(`[DLE Proposals] Голоса по предложению ${proposalId}:`, votes);

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

    console.log(`[DLE Proposals] Исполнение предложения ${proposalId} в DLE: ${dleAddress}`);

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

    console.log(`[DLE Proposals] Предложение исполнено:`, receipt);

    res.json({
      success: true,
      data: {
        transactionHash: receipt.hash
      }
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при исполнении предложения:', error);
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

module.exports = router;
