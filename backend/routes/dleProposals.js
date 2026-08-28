/**
 * Copyright (c) 2024-2026 Тарабанов Александр Викторович
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
const { resolveProposalsCount } = require('../utils/dleProposalCount');
const logger = require('../utils/logger');

async function resolveProviderForDle(dleAddress, preferredChainId) {
  const tried = [];
  if (preferredChainId) {
    tried.push(Number(preferredChainId));
  }
  try {
    const fromLoader = await getSupportedChainIds();
    for (const cid of fromLoader || []) {
      if (!tried.includes(Number(cid))) tried.push(Number(cid));
    }
  } catch {
    // ignore
  }

  for (const cid of tried) {
    try {
      const rpcUrl = await rpcProviderService.getRpcUrlByChainId(cid);
      if (!rpcUrl) continue;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const code = await provider.getCode(dleAddress);
      if (code && code !== '0x') {
        return { provider, rpcUrl, chainId: cid };
      }
    } catch {
      // next
    }
  }
  return null;
}

async function requireDleProvider(res, dleAddress, preferredChainId) {
  const resolved = await resolveProviderForDle(dleAddress, preferredChainId);
  if (!resolved) {
    res.status(404).json({
      success: false,
      error: 'DLE не найден ни в одной RPC-сети',
    });
    return null;
  }
  return resolved;
}

router.get('/relayer-status', async (req, res) => {
  res.json({
    success: true,
    configured: false,
    funded: false,
    address: null,
    code: 'relayer_removed',
  });
});

// Получение списка всех предложений
router.post('/get-proposals', async (req, res) => {
  try {
    const { dleAddress, chainId: preferChainId } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE Proposals] Получение списка предложений для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети DLE из контракта
    let supportedChains = [];
    const onlyChain = Number(preferChainId);
    if (Number.isFinite(onlyChain) && onlyChain > 0) {
      supportedChains = [onlyChain];
      console.log(`[DLE Proposals] Только сеть ${onlyChain}`);
    } else {
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
        // НЕ делаем return - продолжаем искать предложения в fallback сетях
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
      if (!supportedChains.length) {
        supportedChains = [11155111, 17000, 421614, 84532];
        console.log(`[DLE Proposals] Используем fallback сети:`, supportedChains);
      }
    }
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
        
        // Проверяем, что контракт существует по этому адресу в текущей сети
        const contractCode = await provider.getCode(dleAddress);
        if (!contractCode || contractCode === '0x') {
          console.log(`[DLE Proposals] Контракт по адресу ${dleAddress} не найден в сети ${chainId}, пропускаем`);
          continue;
        }
        
        const dleAbi = [
          'function getProposalsCount() external view returns (uint256)',
          'function allProposalIds(uint256) external view returns (uint256)',
          'function getProposalState(uint256 _proposalId) external view returns (uint8 state)',
          'function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)',
          'function getProposalSummary(uint256 _proposalId) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, uint256 snapshotTimepoint, uint256[] memory targetChains)',
          'function quorumPercentage() external view returns (uint256)',
          'function getPastTotalSupply(uint256 timepoint) external view returns (uint256)',
          'function totalSupply() external view returns (uint256)',
        ];

        const dle = new ethers.Contract(dleAddress, dleAbi, provider);
        const count = await resolveProposalsCount(dle);
        console.log(`[DLE Proposals] Сеть ${chainId}: proposalsCount=${count}`);

        let quorumPctCached = null;
        let totalSupplyCached = '0';
        try {
          quorumPctCached = Number(await dle.quorumPercentage());
          totalSupplyCached = (await dle.totalSupply()).toString();
        } catch (_) {}

        for (let proposalId = 0; proposalId < count; proposalId++) {
          try {
            const proposalData = await dle.getProposalSummary(proposalId);
            const proposalState = await dle.getProposalState(proposalId);
            const result = await dle.checkProposalResult(proposalId);

            const forVotes = proposalData.forVotes.toString();
            const againstVotes = proposalData.againstVotes.toString();
            const snapshot = Number(proposalData.snapshotTimepoint);
            let quorumRequired = '0';
            try {
              const pastSupply = await dle.getPastTotalSupply(snapshot);
              const quorumPct = quorumPctCached != null ? quorumPctCached : Number(await dle.quorumPercentage());
              quorumRequired = ((pastSupply * BigInt(quorumPct)) / 100n).toString();
            } catch (_) {}

            // snapshotTimepoint часто ≈ момент создания (clock); иначе fallback на deadline
            const deadline = Number(proposalData.deadline);
            const proposalTime =
              snapshot > 1_000_000_000 ? snapshot : deadline > 1_000_000_000 ? deadline : Math.floor(Date.now() / 1000);

            const targetChains = (proposalData.targetChains || []).map((c) => Number(c));
            const stateNum = Number(proposalState);
            const uniqueId = `${chainId}-${proposalId}`;
            const proposalInfo = {
              id: proposalId,
              uniqueId,
              description: proposalData.description,
              state: stateNum,
              isPassed: Boolean(result.passed),
              quorumReached: Boolean(result.quorumReached),
              forVotes,
              againstVotes,
              quorumRequired,
              totalSupply: totalSupplyCached,
              contractQuorumPercentage: quorumPctCached != null ? quorumPctCached : 0,
              initiator: proposalData.initiator,
              blockNumber: null,
              transactionHash: null,
              chainId,
              timestamp: proposalTime,
              createdAt: new Date(proposalTime * 1000).toISOString(),
              deadline,
              executed: stateNum === 3 || Boolean(proposalData.executed),
              canceled: stateNum === 4 || Boolean(proposalData.canceled),
              operation: null,
              governanceChainId: Number(chainId),
              targetChains,
              isMultichain: targetChains.length > 0,
              decodedOperation: null,
              operationDescription: null,
            };

            if (!allProposals.find((p) => p.uniqueId === uniqueId)) {
              allProposals.push(proposalInfo);
            }
          } catch (error) {
            console.log(
              `[DLE Proposals] Ошибка при чтении предложения ${proposalId} в сети ${chainId}:`,
              error.message
            );
          }
        }

        console.log(`[DLE Proposals] Найдено предложений в сети ${chainId}: ${count}`);
      } catch (error) {
        console.log(`[DLE Proposals] Ошибка при поиске предложений в сети ${chainId}:`, error.message);
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

// Отменить предложение (кошелёк держателя)
router.post('/cancel-proposal', async (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'os_cancel_removed',
    error: 'Отмену шлёт кошелёк держателя, не ОС.',
  });
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider, chainId: listChainId } = resolved;
    
    const dleAbi = [
      "function listProposals(uint256 offset, uint256 limit) external view returns (uint256[] memory)",
      "function getProposalSummary(uint256 _proposalId) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, uint256 snapshotTimepoint, uint256[] memory targetChains)",
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
          governanceChainId: Number(listChainId),
          snapshotTimepoint: Number(proposal.snapshotTimepoint),
          targetChains: (proposal.targetChains || []).map(chain => Number(chain)),
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
          governanceChainId: Number(listChainId),
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

/**
 * Служебный отправитель голоса с ОС снят: ключ на сервере — окно кражи комиссии.
 * Голос шлёт кошелёк держателя. Казна не возвращает газ без отдельного предложения.
 */
router.post('/vote-by-signature', async (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'relayer_removed',
    error: 'Голос отправляет кошелёк держателя. Служебного ключа на ОС нет.',
  });
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

    const resolved = await resolveProviderForDle(dleAddress, req.body.chainId);
    if (!resolved) {
      return res.status(400).json({
        success: false,
        error: 'Не удалось найти сеть, где по адресу есть контракт'
      });
    }

    const provider = resolved.provider;
    
    const dle = new ethers.Contract(dleAddress, [
      'function hasVoted(uint256 _proposalId, address _voter) view returns (bool)',
    ], provider);

    let hasVoted = false;
    try {
      hasVoted = await dle.hasVoted(proposalId, voterAddress);
    } catch (e) {
      logger.info(`[DLE Proposals] hasVoted недоступен (старое поколение): ${e.message}`);
      hasVoted = false;
    }

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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    const resolved = await requireDleProvider(res, dleAddress, req.body.chainId);
    if (!resolved) return;
    const { provider } = resolved;
    
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

    let tx = null;
    const candidateChainIds = await getSupportedChainIds();
    for (const cid of candidateChainIds) {
      try {
        const url = await rpcProviderService.getRpcUrlByChainId(cid);
        if (!url) continue;
        const p = new ethers.JsonRpcProvider(url);
        const found = await p.getTransaction(transactionHash);
        if (found) {
          tx = found;
          break;
        }
      } catch (_) {}
    }
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

// Поиск предложения по transaction hash
router.post('/find-proposal-by-tx', async (req, res) => {
  try {
    const { transactionHash, dleAddress } = req.body;
    
    if (!transactionHash || !dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'transactionHash и dleAddress обязательны'
      });
    }

    console.log(`[DLE Proposals] Поиск предложения по транзакции: ${transactionHash} для DLE: ${dleAddress}`);

    // Получаем поддерживаемые сети DLE
    let supportedChains = [];
    try {
      const candidateChainIds = await getSupportedChainIds();
      
      for (const cid of candidateChainIds) {
        try {
          const url = await rpcProviderService.getRpcUrlByChainId(cid);
          if (!url) continue;
          const prov = new ethers.JsonRpcProvider(url);
          const code = await prov.getCode(dleAddress);
          if (code && code !== '0x') {
            supportedChains.push(cid);
          }
        } catch (_) {}
      }
      
      if (supportedChains.length === 0) {
        supportedChains = [11155111, 17000, 421614, 84532];
      }
    } catch (error) {
      supportedChains = [11155111, 17000, 421614, 84532];
    }

    // Ищем транзакцию во всех поддерживаемых сетях
    for (const chainId of supportedChains) {
      try {
        const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
        if (!rpcUrl) continue;

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Получаем receipt транзакции
        const receipt = await provider.getTransactionReceipt(transactionHash);
        if (!receipt) {
          console.log(`[DLE Proposals] Транзакция ${transactionHash} не найдена в сети ${chainId}`);
          continue;
        }

        console.log(`[DLE Proposals] Транзакция найдена в сети ${chainId}, блок: ${receipt.blockNumber}`);

        // Ищем событие ProposalCreated в логах транзакции
        const dleAbi = [
          "event ProposalCreated(uint256 proposalId, address initiator, string description)"
        ];
        const dle = new ethers.Contract(dleAddress, dleAbi, provider);
        
        const iface = new ethers.Interface(dleAbi);
        const proposalCreatedTopic = iface.getEvent('ProposalCreated').topicHash;

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== dleAddress.toLowerCase()) continue;
          if (log.topics[0] !== proposalCreatedTopic) continue;

          try {
            const parsedLog = iface.parseLog(log);
            const proposalId = parsedLog.args.proposalId;
            
            console.log(`[DLE Proposals] ✅ Найдено предложение ID: ${proposalId} в сети ${chainId}`);

            // Получаем полную информацию о предложении
            const fullDleAbi = [
              "function getProposalState(uint256 _proposalId) external view returns (uint8 state)",
              "function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)",
              "function getProposalSummary(uint256 _proposalId) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, uint256 snapshotTimepoint, uint256[] memory targetChains)"
            ];
            const fullDle = new ethers.Contract(dleAddress, fullDleAbi, provider);
            
            const proposalState = await fullDle.getProposalState(proposalId);
            const result = await fullDle.checkProposalResult(proposalId);
            const proposalData = await fullDle.getProposalSummary(proposalId);

            return res.json({
              success: true,
              data: {
                proposalId: Number(proposalId),
                chainId: chainId,
                description: parsedLog.args.description,
                initiator: parsedLog.args.initiator,
                transactionHash: transactionHash,
                blockNumber: receipt.blockNumber,
                state: Number(proposalState),
                isPassed: result.passed,
                quorumReached: result.quorumReached,
                forVotes: Number(proposalData.forVotes),
                againstVotes: Number(proposalData.againstVotes),
                executed: proposalData.executed,
                canceled: proposalData.canceled,
                deadline: Number(proposalData.deadline)
              }
            });
          } catch (parseError) {
            console.log(`[DLE Proposals] Ошибка парсинга лога:`, parseError.message);
          }
        }
      } catch (error) {
        console.log(`[DLE Proposals] Ошибка поиска в сети ${chainId}:`, error.message);
        continue;
      }
    }

    return res.status(404).json({
      success: false,
      error: 'Предложение не найдено по данной транзакции'
    });

  } catch (error) {
    console.error('[DLE Proposals] Ошибка при поиске предложения по транзакции:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при поиске предложения: ' + error.message
    });
  }
});

module.exports = router;
