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
const { MODULE_IDS, MODULE_ID_TO_TYPE, MODULE_NAMES } = require('../constants/moduleIds');
const { getSupportedChainIds } = require('../utils/networkLoader');

// Получить расширенную историю DLE
router.post('/get-extended-history', async (req, res) => {
  try {
    const { dleAddress } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE History] Получение расширенной истории для DLE: ${dleAddress}`);

    // Определяем корректную сеть для данного адреса
    let rpcUrl, targetChainId;
    let candidateChainIds = []; // Будет заполнено из deploy_params
    
    try {
      // Получаем поддерживаемые сети из параметров деплоя
      const latestParams = await deployParamsService.getLatestDeployParams(1);
      if (latestParams.length > 0) {
        const params = latestParams[0];
        candidateChainIds = params.supportedChainIds || candidateChainIds;
      }
    } catch (error) {
      console.error('❌ Ошибка получения параметров деплоя, используем fallback:', error);
    }
    
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
      "function getDLEInfo() external view returns (tuple(string name, string symbol, string location, string coordinates, uint256 jurisdiction, uint256 oktmo, string[] okvedCodes, uint256 kpp, uint256 creationTimestamp, bool isActive))",
      "function getGovernanceParams() external view returns (uint256 quorumPct, uint256 chainId, uint256 supportedCount)",
      "function getCurrentChainId() external view returns (uint256)",
      "function listSupportedChains() external view returns (uint256[] memory)",
      "function getProposalsCount() external view returns (uint256)",
      "event QuorumPercentageUpdated(uint256 oldQuorumPercentage, uint256 newQuorumPercentage)",
      "event DLEInfoUpdated(string name, string symbol, string location, string coordinates, uint256 jurisdiction, string[] okvedCodes, uint256 kpp)",
      "event ModuleAdded(bytes32 moduleId, address moduleAddress)",
      "event ModuleRemoved(bytes32 moduleId)",
      "event ChainAdded(uint256 chainId)",
      "event ChainRemoved(uint256 chainId)",
      "event ProposalExecutionApprovedInChain(uint256 proposalId, uint256 chainId)",
      "event ProposalCreated(uint256 proposalId, address initiator, string description)",
      "event ProposalExecuted(uint256 proposalId, bytes operation)",
      "event ProposalCancelled(uint256 proposalId, string reason)"
    ];

    const dle = new ethers.Contract(dleAddress, dleAbi, provider);

    // Получаем текущие данные для сравнения
    const dleInfo = await dle.getDLEInfo();
    const governanceParams = await dle.getGovernanceParams();
    const currentChainId = await dle.getCurrentChainId();
    const supportedChains = await dle.listSupportedChains();
    const proposalsCount = await dle.getProposalsCount();

    const history = [];

    // 1. Событие создания DLE
    history.push({
      id: 1,
      type: 'dle_created',
      title: 'DLE создан',
      description: `Создан DLE "${dleInfo.name}" (${dleInfo.symbol})`,
      timestamp: Number(dleInfo.creationTimestamp) * 1000,
      blockNumber: 0,
      transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      details: {
        name: dleInfo.name,
        symbol: dleInfo.symbol,
        location: dleInfo.location,
        jurisdiction: Number(dleInfo.jurisdiction),
        supportedChains: supportedChains.map(chain => Number(chain))
      }
    });

    // 2. История изменений настроек (кворум, цепочка)
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000);

    try {
      // События изменения кворума
      const quorumEvents = await dle.queryFilter('QuorumPercentageUpdated', fromBlock, currentBlock);
      for (let i = 0; i < quorumEvents.length; i++) {
        const event = quorumEvents[i];
        history.push({
          id: history.length + 1,
          type: 'quorum_updated',
          title: 'Изменен кворум',
          description: `Кворум изменен с ${Number(event.args.oldQuorumPercentage)}% на ${Number(event.args.newQuorumPercentage)}%`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            oldQuorum: Number(event.args.oldQuorumPercentage),
            newQuorum: Number(event.args.newQuorumPercentage)
          }
        });
      }


      // События обновления информации DLE
      const infoEvents = await dle.queryFilter('DLEInfoUpdated', fromBlock, currentBlock);
      for (let i = 0; i < infoEvents.length; i++) {
        const event = infoEvents[i];
        history.push({
          id: history.length + 1,
          type: 'dle_info_updated',
          title: 'Обновлена информация DLE',
          description: `Обновлена информация: ${event.args.name} (${event.args.symbol})`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            name: event.args.name,
            symbol: event.args.symbol,
            location: event.args.location,
            jurisdiction: Number(event.args.jurisdiction)
          }
        });
      }

      // 3. История модулей
      const moduleAddedEvents = await dle.queryFilter('ModuleAdded', fromBlock, currentBlock);
      for (let i = 0; i < moduleAddedEvents.length; i++) {
        const event = moduleAddedEvents[i];
        const moduleName = getModuleName(event.args.moduleId);
        history.push({
          id: history.length + 1,
          type: 'module_added',
          title: 'Модуль добавлен',
          description: `Добавлен модуль "${moduleName}"`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            moduleId: event.args.moduleId,
            moduleName: moduleName,
            moduleAddress: event.args.moduleAddress
          }
        });
      }

      const moduleRemovedEvents = await dle.queryFilter('ModuleRemoved', fromBlock, currentBlock);
      for (let i = 0; i < moduleRemovedEvents.length; i++) {
        const event = moduleRemovedEvents[i];
        const moduleName = getModuleName(event.args.moduleId);
        history.push({
          id: history.length + 1,
          type: 'module_removed',
          title: 'Модуль удален',
          description: `Удален модуль "${moduleName}"`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            moduleId: event.args.moduleId,
            moduleName: moduleName
          }
        });
      }

      // 4. Мульти-чейн история
      const chainAddedEvents = await dle.queryFilter('ChainAdded', fromBlock, currentBlock);
      for (let i = 0; i < chainAddedEvents.length; i++) {
        const event = chainAddedEvents[i];
        const chainName = getChainName(Number(event.args.chainId));
        history.push({
          id: history.length + 1,
          type: 'chain_added',
          title: 'Сеть добавлена',
          description: `Добавлена сеть "${chainName}" (ID: ${Number(event.args.chainId)})`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            chainId: Number(event.args.chainId),
            chainName: chainName
          }
        });
      }

      const chainRemovedEvents = await dle.queryFilter('ChainRemoved', fromBlock, currentBlock);
      for (let i = 0; i < chainRemovedEvents.length; i++) {
        const event = chainRemovedEvents[i];
        const chainName = getChainName(Number(event.args.chainId));
        history.push({
          id: history.length + 1,
          type: 'chain_removed',
          title: 'Сеть удалена',
          description: `Удалена сеть "${chainName}" (ID: ${Number(event.args.chainId)})`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            chainId: Number(event.args.chainId),
            chainName: chainName
          }
        });
      }

      const executionApprovedEvents = await dle.queryFilter('ProposalExecutionApprovedInChain', fromBlock, currentBlock);
      for (let i = 0; i < executionApprovedEvents.length; i++) {
        const event = executionApprovedEvents[i];
        const chainName = getChainName(Number(event.args.chainId));
        history.push({
          id: history.length + 1,
          type: 'proposal_execution_approved',
          title: 'Исполнение предложения одобрено',
          description: `Исполнение предложения #${Number(event.args.proposalId)} одобрено в сети "${chainName}"`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            proposalId: Number(event.args.proposalId),
            chainId: Number(event.args.chainId),
            chainName: chainName
          }
        });
      }

      // 5. События предложений (базовые)
      const proposalEvents = await dle.queryFilter('ProposalCreated', fromBlock, currentBlock);
      for (let i = 0; i < proposalEvents.length; i++) {
        const event = proposalEvents[i];
        history.push({
          id: history.length + 1,
          type: 'proposal_created',
          title: `Предложение #${Number(event.args.proposalId)} создано`,
          description: event.args.description,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            proposalId: Number(event.args.proposalId),
            initiator: event.args.initiator,
            description: event.args.description
          }
        });
      }

      const proposalExecutedEvents = await dle.queryFilter('ProposalExecuted', fromBlock, currentBlock);
      for (let i = 0; i < proposalExecutedEvents.length; i++) {
        const event = proposalExecutedEvents[i];
        history.push({
          id: history.length + 1,
          type: 'proposal_executed',
          title: `Предложение #${Number(event.args.proposalId)} исполнено`,
          description: `Предложение успешно исполнено`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            proposalId: Number(event.args.proposalId),
            operation: event.args.operation
          }
        });
      }

      const proposalCancelledEvents = await dle.queryFilter('ProposalCancelled', fromBlock, currentBlock);
      for (let i = 0; i < proposalCancelledEvents.length; i++) {
        const event = proposalCancelledEvents[i];
        history.push({
          id: history.length + 1,
          type: 'proposal_cancelled',
          title: `Предложение #${Number(event.args.proposalId)} отменено`,
          description: `Причина: ${event.args.reason}`,
          timestamp: event.blockNumber * 1000,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          details: {
            proposalId: Number(event.args.proposalId),
            reason: event.args.reason
          }
        });
      }

    } catch (error) {
      console.log(`[DLE History] Ошибка при получении событий:`, error.message);
    }

    // Сортируем по времени (новые сверху)
    history.sort((a, b) => b.timestamp - a.timestamp);

    console.log(`[DLE History] Расширенная история получена:`, history.length, 'событий');

    res.json({
      success: true,
      data: {
        history: history,
        totalEvents: history.length,
        dleInfo: {
          name: dleInfo.name,
          symbol: dleInfo.symbol,
          creationTimestamp: Number(dleInfo.creationTimestamp),
          proposalsCount: Number(proposalsCount),
          currentChainId: Number(currentChainId),
          supportedChains: supportedChains.map(chain => Number(chain))
        }
      }
    });

  } catch (error) {
    console.error('[DLE History] Ошибка при получении расширенной истории:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при получении расширенной истории: ' + error.message
    });
  }
});

// Вспомогательные функции
function getModuleName(moduleId) {
  // Проверяем стандартные модули
  if (MODULE_ID_TO_TYPE[moduleId]) {
    const moduleType = MODULE_ID_TO_TYPE[moduleId];
    return MODULE_NAMES[moduleType] || moduleType;
  }
  
  // Дополнительные модули (если появятся в будущем)
  const additionalModuleNames = {
    '0x6d756c7469736967000000000000000000000000000000000000000000000000': 'Multisig',
    '0x646561637469766174696f6e0000000000000000000000000000000000000000': 'Deactivation',
    '0x616e616c79746963730000000000000000000000000000000000000000000000': 'Analytics',
    '0x6e6f74696669636174696f6e7300000000000000000000000000000000000000': 'Notifications'
  };
  
  return additionalModuleNames[moduleId] || `Module ${moduleId}`;
}

function getChainName(chainId) {
  const chainNames = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    137: 'Polygon',
    56: 'BSC',
    42161: 'Arbitrum One',
    17000: 'Holesky Testnet'
  };
  return chainNames[chainId] || `Chain ID: ${chainId}`;
}

// Экспортируем функции для использования в других модулях
module.exports = {
  router,
  getModuleName,
  getChainName
};
