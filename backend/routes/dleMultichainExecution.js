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
const DeployParamsService = require('../services/deployParamsService');

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

    const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
    
    const dleAbi = [
      "function proposals(uint256) external view returns (uint256 id, string memory description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, bytes memory operation, uint256 governanceChainId, uint256 snapshotTimepoint, uint256[] memory targetChains)",
      "function getProposalState(uint256 _proposalId) external view returns (uint8 state)",
      "function checkProposalResult(uint256 _proposalId) external view returns (bool passed, bool quorumReached)",
      "function getSupportedChainCount() external view returns (uint256)",
      "function getSupportedChainId(uint256 _index) external view returns (uint256)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем данные предложения
    const proposal = await dle.proposals(proposalId);
    const state = await dle.getProposalState(proposalId);
    const result = await dle.checkProposalResult(proposalId);

    // Получаем поддерживаемые сети
    const chainCount = await dle.getSupportedChainCount();
    const supportedChains = [];
    for (let i = 0; i < chainCount; i++) {
      const chainId = await dle.getSupportedChainId(i);
      supportedChains.push(Number(chainId));
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
      operation: proposal.operation,
      governanceChainId: Number(proposal.governanceChainId),
      targetChains: proposal.targetChains.map(chain => Number(chain)),
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
  try {
    const { dleAddress, proposalId, deploymentId, userAddress } = req.body;
    
    if (!dleAddress || proposalId === undefined || !deploymentId || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[DLE Multichain] Исполнение предложения ${proposalId} во всех целевых сетях для DLE: ${dleAddress}`);

    // Получаем параметры деплоя
    const deployParamsService = new DeployParamsService();
    const deployParams = await deployParamsService.getDeployParams(deploymentId);
    
    if (!deployParams || !deployParams.privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Приватный ключ не найден в параметрах деплоя'
      });
    }

    // Получаем информацию о предложении
    const proposalInfoResponse = await fetch(`${req.protocol}://${req.get('host')}/api/dle-multichain/get-proposal-multichain-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dleAddress,
        proposalId,
        governanceChainId: deployParams.currentChainId
      })
    });

    const proposalInfo = await proposalInfoResponse.json();
    
    if (!proposalInfo.success) {
      return res.status(400).json({
        success: false,
        error: 'Не удалось получить информацию о предложении'
      });
    }

    const { targetChains, canExecuteInTargetChains } = proposalInfo.data;

    if (!canExecuteInTargetChains) {
      return res.status(400).json({
        success: false,
        error: 'Предложение не готово к исполнению в целевых сетях'
      });
    }

    if (targetChains.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'У предложения нет целевых сетей для исполнения'
      });
    }

    // Исполняем в каждой целевой сети
    const executionResults = [];
    
    for (const targetChainId of targetChains) {
      try {
        console.log(`[DLE Multichain] Исполнение в сети ${targetChainId}`);
        
        const result = await executeProposalInChain(
          dleAddress,
          proposalId,
          targetChainId,
          deployParams.privateKey,
          userAddress
        );
        
        executionResults.push({
          chainId: targetChainId,
          success: true,
          transactionHash: result.transactionHash
        });
        
      } catch (error) {
        console.error(`[DLE Multichain] Ошибка исполнения в сети ${targetChainId}:`, error.message);
        executionResults.push({
          chainId: targetChainId,
          success: false,
          error: error.message
        });
      }
    }

    const successCount = executionResults.filter(r => r.success).length;
    const totalCount = executionResults.length;

    console.log(`[DLE Multichain] Исполнение завершено: ${successCount}/${totalCount} успешно`);

    res.json({
      success: true,
      data: {
        proposalId,
        targetChains,
        executionResults,
        summary: {
          total: totalCount,
          successful: successCount,
          failed: totalCount - successCount
        }
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при исполнении во всех целевых сетях:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при исполнении во всех целевых сетях: ' + error.message
    });
  }
});

/**
 * Исполнить предложение в конкретной целевой сети
 * @route POST /api/dle-multichain/execute-in-target-chain
 */
router.post('/execute-in-target-chain', async (req, res) => {
  try {
    const { dleAddress, proposalId, targetChainId, deploymentId, userAddress } = req.body;
    
    if (!dleAddress || proposalId === undefined || !targetChainId || !deploymentId || !userAddress) {
      return res.status(400).json({
        success: false,
        error: 'Все поля обязательны'
      });
    }

    console.log(`[DLE Multichain] Исполнение предложения ${proposalId} в сети ${targetChainId} для DLE: ${dleAddress}`);

    // Получаем параметры деплоя
    const deployParamsService = new DeployParamsService();
    const deployParams = await deployParamsService.getDeployParams(deploymentId);
    
    if (!deployParams || !deployParams.privateKey) {
      return res.status(400).json({
        success: false,
        error: 'Приватный ключ не найден в параметрах деплоя'
      });
    }

    // Исполняем в целевой сети
    const result = await executeProposalInChain(
      dleAddress,
      proposalId,
      targetChainId,
      deployParams.privateKey,
      userAddress
    );

    res.json({
      success: true,
      data: {
        proposalId,
        targetChainId,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber
      }
    });

  } catch (error) {
    console.error('[DLE Multichain] Ошибка при исполнении в целевой сети:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при исполнении в целевой сети: ' + error.message
    });
  }
});

/**
 * Вспомогательная функция для исполнения предложения в конкретной сети
 */
async function executeProposalInChain(dleAddress, proposalId, chainId, privateKey, userAddress) {
  // Получаем RPC URL для целевой сети
  const rpcUrl = await rpcProviderService.getRpcUrlByChainId(chainId);
  if (!rpcUrl) {
    throw new Error(`RPC URL для сети ${chainId} не найден`);
  }

  const provider = new ethers.JsonRpcProvider(await rpcProviderService.getRpcUrlByChainId(chainId));
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const dleAbi = [
    "function executeProposalBySignatures(uint256 _proposalId, address[] calldata signers, bytes[] calldata signatures) external"
  ];

  const dle = new ethers.Contract(dleAddress, dleAbi, wallet);

  // Для простоты используем подпись от одного адреса (кошелька с приватным ключом)
  // В реальности нужно собрать подписи от держателей токенов
  const signers = [wallet.address];
  const signatures = []; // TODO: Реализовать сбор подписей

  // Временная заглушка - используем прямое исполнение если это возможно
  // В реальности нужно реализовать сбор подписей от держателей токенов
  try {
    // Пытаемся исполнить напрямую (если это сеть голосования)
    const directExecuteAbi = [
      "function executeProposal(uint256 _proposalId) external"
    ];
    
    const directDle = new ethers.Contract(dleAddress, directExecuteAbi, wallet);
    const tx = await directDle.executeProposal(proposalId);
    const receipt = await tx.wait();

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
    
  } catch (directError) {
    // Если прямое исполнение невозможно, используем подписи
    if (signatures.length === 0) {
      throw new Error('Необходимо собрать подписи от держателей токенов для исполнения в целевой сети');
    }

    const tx = await dle.executeProposalBySignatures(proposalId, signers, signatures);
    const receipt = await tx.wait();

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber
    };
  }
}

module.exports = router;


