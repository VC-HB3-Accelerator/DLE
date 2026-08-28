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
const { MODULE_ID_TO_TYPE, MODULE_NAMES, moduleTypeFromId } = require('../constants/moduleIds');
const {
  DLE_GET_DLE_INFO,
  DLE_GET_CURRENT_CHAIN_ID,
  DLE_GET_PROPOSALS_COUNT,
} = require('../constants/dleReadAbi');
const {
  fetchSupportedChains,
  ReaderNotFoundError,
} = require('../services/dleReaderResolveService');
const { resolveDleProvider } = require('../services/dleNetworkResolveService');
const { getChainName } = require('../utils/chainNames');

// Получить расширенную историю DLE
router.post('/get-extended-history', async (req, res) => {
  try {
    const { dleAddress, chainId: preferChainId } = req.body;
    
    if (!dleAddress) {
      return res.status(400).json({
        success: false,
        error: 'Адрес DLE обязателен'
      });
    }

    console.log(`[DLE History] Получение расширенной истории для DLE: ${dleAddress}`);

    let provider, targetChainId;
    try {
      ({ provider, chainId: targetChainId } = await resolveDleProvider(dleAddress, {
        preferChainId,
      }));
    } catch (e) {
      return res.status(500).json({
        success: false,
        error: e.message || 'Не удалось найти сеть, где по адресу есть контракт',
        code: e.code,
      });
    }

    const dleAbi = [
      DLE_GET_DLE_INFO,
      DLE_GET_CURRENT_CHAIN_ID,
      DLE_GET_PROPOSALS_COUNT,
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

    // Паспорт/счётчики — с DLE; список сетей — с Reader
    const dleInfo = await dle.getDLEInfo();
    const currentChainId = await dle.getCurrentChainId();
    const proposalsCount = await dle.getProposalsCount();
    const { chains: supportedChains } = await fetchSupportedChains({
      dleAddress,
      provider,
      chainId: targetChainId,
    });

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
        supportedChains: supportedChains,
      },
    });

    async function fillProposalsFromSummary(seenIds) {
      if (Number(proposalsCount) <= 0) return;
      const summaryAbi = [
        'function getProposalSummary(uint256) view returns (uint256 id, string description, uint256 forVotes, uint256 againstVotes, bool executed, bool canceled, uint256 deadline, address initiator, uint256 snapshotTimepoint, uint256[] targetChains)',
        'function getProposalState(uint256) view returns (uint8)',
      ];
      const dleSum = new ethers.Contract(dleAddress, summaryAbi, provider);
      const n = Number(proposalsCount);
      for (let i = 0; i < n; i++) {
        if (seenIds.has(i)) continue;
        try {
          const s = await dleSum.getProposalSummary(i);
          const st = Number(await dleSum.getProposalState(i));
          const snap = Number(s.snapshotTimepoint);
          const ts = snap > 1e9 ? snap * 1000 : Number(s.deadline) > 1e9 ? Number(s.deadline) * 1000 : Date.now();
          history.push({
            id: history.length + 1,
            type: s.executed || st === 3 ? 'proposal_executed' : 'proposal_created',
            title:
              s.executed || st === 3
                ? `Предложение #${i} исполнено`
                : `Предложение #${i} создано`,
            description: s.description,
            timestamp: ts,
            blockNumber: null,
            transactionHash: null,
            details: {
              proposalId: i,
              initiator: s.initiator,
              state: st,
              fromSummary: true,
            },
          });
          seenIds.add(i);
        } catch (e) {
          console.log(`[DLE History] summary ${i}:`, e.message);
        }
      }
    }

    const seenProposalIds = new Set();
    await fillProposalsFromSummary(seenProposalIds);

    // Логи только в последних чанках RPC (лимит eth_getLogs ~1500–2000 блоков).
    const currentBlock = await provider.getBlockNumber();
    const chunkSize = 1_500;
    const logChunks = 4;
    const fromBlock = Math.max(0, currentBlock - chunkSize * logChunks);

    async function queryEventChunks(eventName) {
      const out = [];
      for (let start = fromBlock; start <= currentBlock; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, currentBlock);
        try {
          const part = await dle.queryFilter(eventName, start, end);
          out.push(...part);
        } catch (e) {
          console.log(
            `[DLE History] ${eventName} ${start}-${end} skip:`,
            e.shortMessage || e.message
          );
        }
      }
      return out;
    }

    function pushEvent(type, title, description, event, details) {
      history.push({
        id: history.length + 1,
        type,
        title,
        description,
        timestamp: Number(event.blockNumber) || 0,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        details,
      });
    }

    async function attachBlockTimes() {
      const nums = [...new Set(
        history.filter((h) => Number(h.blockNumber) > 0).map((h) => Number(h.blockNumber))
      )];
      const times = new Map();
      for (const n of nums) {
        try {
          const block = await provider.getBlock(n);
          if (block?.timestamp) times.set(n, Number(block.timestamp) * 1000);
        } catch (_) {
          /* skip */
        }
      }
      for (const h of history) {
        const ms = times.get(Number(h.blockNumber));
        if (ms) h.timestamp = ms;
      }
    }

    try {
      const quorumEvents = await queryEventChunks('QuorumPercentageUpdated');
      for (const event of quorumEvents) {
        pushEvent(
          'quorum_updated',
          'Изменен кворум',
          `Кворум изменен с ${Number(event.args.oldQuorumPercentage)}% на ${Number(event.args.newQuorumPercentage)}%`,
          event,
          {
            oldQuorum: Number(event.args.oldQuorumPercentage),
            newQuorum: Number(event.args.newQuorumPercentage),
          }
        );
      }

      const infoEvents = await queryEventChunks('DLEInfoUpdated');
      for (const event of infoEvents) {
        pushEvent(
          'dle_info_updated',
          'Обновлена информация DLE',
          `Обновлена информация: ${event.args.name} (${event.args.symbol})`,
          event,
          {
            name: event.args.name,
            symbol: event.args.symbol,
            location: event.args.location,
            jurisdiction: Number(event.args.jurisdiction),
          }
        );
      }

      const moduleAddedEvents = await queryEventChunks('ModuleAdded');
      for (const event of moduleAddedEvents) {
        const moduleName = getModuleName(event.args.moduleId);
        const hex = (() => {
          try {
            return typeof event.args.moduleId === 'string'
              ? event.args.moduleId
              : ethers.hexlify(event.args.moduleId);
          } catch (_) {
            return String(event.args.moduleId);
          }
        })();
        const moduleType = moduleTypeFromId(hex) || MODULE_ID_TO_TYPE[hex] || null;
        pushEvent('module_added', 'Модуль добавлен', `Добавлен модуль "${moduleName}"`, event, {
          moduleId: event.args.moduleId,
          moduleType,
          moduleName,
          moduleAddress: event.args.moduleAddress,
        });
      }

      const moduleRemovedEvents = await queryEventChunks('ModuleRemoved');
      for (const event of moduleRemovedEvents) {
        const moduleName = getModuleName(event.args.moduleId);
        const hex = (() => {
          try {
            return typeof event.args.moduleId === 'string'
              ? event.args.moduleId
              : ethers.hexlify(event.args.moduleId);
          } catch (_) {
            return String(event.args.moduleId);
          }
        })();
        const moduleType = moduleTypeFromId(hex) || MODULE_ID_TO_TYPE[hex] || null;
        pushEvent('module_removed', 'Модуль удален', `Удален модуль "${moduleName}"`, event, {
          moduleId: event.args.moduleId,
          moduleType,
          moduleName,
        });
      }

      const chainAddedEvents = await queryEventChunks('ChainAdded');
      for (const event of chainAddedEvents) {
        const chainName = getChainName(Number(event.args.chainId));
        pushEvent(
          'chain_added',
          'Сеть добавлена',
          `Добавлена сеть "${chainName}" (ID: ${Number(event.args.chainId)})`,
          event,
          { chainId: Number(event.args.chainId), chainName }
        );
      }

      const chainRemovedEvents = await queryEventChunks('ChainRemoved');
      for (const event of chainRemovedEvents) {
        const chainName = getChainName(Number(event.args.chainId));
        pushEvent(
          'chain_removed',
          'Сеть удалена',
          `Удалена сеть "${chainName}" (ID: ${Number(event.args.chainId)})`,
          event,
          { chainId: Number(event.args.chainId), chainName }
        );
      }

      const executionApprovedEvents = await queryEventChunks('ProposalExecutionApprovedInChain');
      for (const event of executionApprovedEvents) {
        const chainName = getChainName(Number(event.args.chainId));
        pushEvent(
          'proposal_execution_approved',
          'Исполнение предложения одобрено',
          `Исполнение предложения #${Number(event.args.proposalId)} одобрено в сети "${chainName}"`,
          event,
          {
            proposalId: Number(event.args.proposalId),
            chainId: Number(event.args.chainId),
            chainName,
          }
        );
      }

      const proposalEvents = await queryEventChunks('ProposalCreated');
      for (const event of proposalEvents) {
        const proposalId = Number(event.args.proposalId);
        if (seenProposalIds.has(proposalId)) continue;
        seenProposalIds.add(proposalId);
        pushEvent(
          'proposal_created',
          `Предложение #${Number(event.args.proposalId)} создано`,
          event.args.description,
          event,
          {
            proposalId: Number(event.args.proposalId),
            initiator: event.args.initiator,
            description: event.args.description,
          }
        );
      }

      const proposalExecutedEvents = await queryEventChunks('ProposalExecuted');
      for (const event of proposalExecutedEvents) {
        const proposalId = Number(event.args.proposalId);
        if (seenProposalIds.has(proposalId)) continue;
        seenProposalIds.add(proposalId);
        pushEvent(
          'proposal_executed',
          `Предложение #${Number(event.args.proposalId)} исполнено`,
          'Предложение успешно исполнено',
          event,
          { proposalId: Number(event.args.proposalId), operation: event.args.operation }
        );
      }

      const proposalCancelledEvents = await queryEventChunks('ProposalCancelled');
      for (const event of proposalCancelledEvents) {
        const proposalId = Number(event.args.proposalId);
        if (seenProposalIds.has(proposalId)) continue;
        seenProposalIds.add(proposalId);
        pushEvent(
          'proposal_cancelled',
          `Предложение #${Number(event.args.proposalId)} отменено`,
          `Причина: ${event.args.reason}`,
          event,
          { proposalId: Number(event.args.proposalId), reason: event.args.reason }
        );
      }
    } catch (error) {
      console.log(`[DLE History] Ошибка при получении событий:`, error.message);
    }

    await attachBlockTimes();

    history.sort((a, b) => {
      const bt = Number(b.timestamp) || 0;
      const at = Number(a.timestamp) || 0;
      if (bt !== at) return bt - at;
      return (Number(b.blockNumber) || 0) - (Number(a.blockNumber) || 0);
    });

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
          supportedChains: supportedChains,
        },
      },
    });

  } catch (error) {
    console.error('[DLE History] Ошибка при получении расширенной истории:', error);
    const status = error instanceof ReaderNotFoundError ? 404 : 500;
    res.status(status).json({
      success: false,
      error: 'Ошибка при получении расширенной истории: ' + error.message,
      code: error.code || undefined,
    });
  }
});

// Вспомогательные функции
function getModuleName(moduleId) {
  let hex = moduleId;
  try {
    hex = typeof moduleId === 'string' ? moduleId : ethers.hexlify(moduleId);
  } catch (_) {
    hex = String(moduleId);
  }
  const moduleType = moduleTypeFromId(hex) || MODULE_ID_TO_TYPE[hex];
  if (moduleType) {
    return MODULE_NAMES[moduleType] || moduleType;
  }
  return `Module ${hex}`;
}

// Экспортируем функции для использования в других модулях
module.exports = {
  router,
  getModuleName,
  getChainName
};
