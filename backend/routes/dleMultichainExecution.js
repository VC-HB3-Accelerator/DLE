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

/**
 * Получить информацию о мультиконтрактном предложении
 * @route POST /api/dle-multichain/get-proposal-multichain-info
 */
router.post('/get-proposal-multichain-info', async (req, res) => {
  try {
    const { dleAddress, proposalId, governanceChainId } = req.body;
    
    if (!dleAddress || proposalId === undefined || !governanceChainId) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE, ID предложения и ID сети голосования обязательны'
      });
    }

    console.log(`[DLE Multichain] Получение информации о предложении ${proposalId} для DLE: ${dleAddress}`);

    // Получаем RPC URL для сети голосования
    const rpcUrl = await rpcProviderService.getRpcUrlByChainId(governanceChainId);
    if (!rpcUrl) {
      return res.status(500).json({
        success: false,
        error: `RPC URL для сети ${governanceChainId} не найден`
      });
    }

    const {
      DLE_GET_PROPOSAL_SUMMARY,
      DLE_PROPOSALS_GETTER,
      DLE_GET_PROPOSAL_STATE,
      DLE_CHECK_PROPOSAL_RESULT,
      DLE_GET_CURRENT_CHAIN_ID,
    } = require('../constants/dleReadAbi');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    const dleAbi = [
      DLE_GET_PROPOSAL_SUMMARY,
      DLE_PROPOSALS_GETTER,
      DLE_GET_PROPOSAL_STATE,
      DLE_CHECK_PROPOSAL_RESULT,
      DLE_GET_CURRENT_CHAIN_ID,
      "function getSupportedChainCount() external view returns (uint256)",
      "function getSupportedChainId(uint256 _index) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем данные предложения
    const proposal = await dle.getProposalSummary(proposalId);
    const rawProposal = await dle.proposals(proposalId);
    const state = await dle.getProposalState(proposalId);
    const result = await dle.checkProposalResult(proposalId);
    const currentChainId = Number(await dle.getCurrentChainId());

    // Получаем поддерживаемые сети
    const chainCount = await dle.getSupportedChainCount();
    const supportedChains = [];
    for (let i = 0; i < chainCount; i++) {
      const supportedChainId = await dle.getSupportedChainId(i);
      supportedChains.push(Number(supportedChainId));
    }

    const proposalInfo = {
      id: Number(proposal.id),
      description: proposal.description,
      forVotes: Number(proposal.forVotes),
      againstVotes: Number(proposal.againstVotes),
      executed: proposal.executed,
      canceled: proposal.canceled,
      deadline: Number(proposal.deadline),
      initiator: proposal.initiator,
      operation: rawProposal.operation,
      // Сеть, с которой читаем (в Proposal нет поля governanceChainId)
      governanceChainId: currentChainId,
      targetChains: (proposal.targetChains || []).map((c) => Number(c)),
      snapshotTimepoint: Number(proposal.snapshotTimepoint),
      state: Number(state),
      isPassed: result.passed,
      quorumReached: result.quorumReached,
      supportedChains: supportedChains,
      canExecuteInTargetChains: result.passed && result.quorumReached && !proposal.executed && !proposal.canceled
    };

    console.log(`[DLE Multichain] Информация о предложении получена:`, proposalInfo);

    res.json({
      success: true,
      data: proposalInfo
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при получении информации о предложении:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении информации о предложении: ' + error.message
    });
  }
});

/**
 * Исполнить предложение во всех целевых сетях
 * @route POST /api/dle-multichain/execute-in-all-target-chains
 */
router.post('/execute-in-all-target-chains', async (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'os_execute_removed',
    error: 'Исполнение шлёт кошелёк держателя, не ключ ОС. Используйте кнопку исполнения в панели.',
  });
});

/**
 * Исполнить предложение в конкретной целевой сети
 * @route POST /api/dle-multichain/execute-in-target-chain
 */
router.post('/execute-in-target-chain', async (req, res) => {
  return res.status(410).json({
    success: false,
    code: 'os_execute_removed',
    error: 'Исполнение шлёт кошелёк держателя, не ключ ОС. Используйте кнопку исполнения в панели.',
  });
});

module.exports = router;
