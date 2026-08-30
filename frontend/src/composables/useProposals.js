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

import { ref, unref, watch } from 'vue';
import { getProposals } from '@/services/proposalsService';
import { ethers } from 'ethers';
import { useProposalValidation } from './useProposalValidation';
import { voteForProposal, executeProposal as executeProposalUtil, cancelProposal as cancelProposalUtil, checkTokenBalance, switchToVotingNetwork, messageForVoteRevert, messageForProposalRevert } from '@/utils/dle-contract';
import api from '@/api/axios';
import { i18n } from '@/locales/index.js';
import { usePermissions } from './usePermissions';

const t = (key, params) => i18n.global.t(key, params);

const PROPOSAL_STATUS_KEYS = {
  0: 'smartcontracts.proposals.status.active',
  1: 'smartcontracts.proposals.status.succeeded',
  2: 'smartcontracts.proposals.status.defeated',
  3: 'smartcontracts.proposals.status.executed',
  4: 'smartcontracts.proposals.status.cancelled',
  5: 'smartcontracts.proposals.status.ready'
};

// hasVoted есть в DLE.sol; кнопка «за» не скрывается по нему (см. voteForProposal precheck).
// Функция checkTokenBalance перенесена в useDleContract.js

// Функция sendTransactionToWallet удалена - теперь используется прямое взаимодействие с контрактом

// Вспомогательная функция для получения имени цепочки
function toVoteWei(value) {
  if (value == null || value === '') return 0n;
  try {
    return BigInt(value);
  } catch {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0n;
    return BigInt(Math.trunc(n));
  }
}

function formatVoteTokens(value) {
  try {
    const asEther = ethers.formatEther(toVoteWei(value));
    const [whole, frac = ''] = asEther.split('.');
    const trimmedFrac = frac.replace(/0+$/, '').slice(0, 4);
    return trimmedFrac ? `${whole}.${trimmedFrac}` : whole;
  } catch {
    return '0';
  }
}

function voteSharePercent(part, whole) {
  const p = toVoteWei(part);
  const w = toVoteWei(whole);
  if (w === 0n) return '0';
  return (Number((p * 1000n) / w) / 10).toFixed(1);
}

function votesCastTotal(src) {
  return (toVoteWei(src?.forVotes) + toVoteWei(src?.againstVotes)).toString();
}

function getChainName(chainId) {
  const chainNames = {
    1: 'Ethereum',
    11155111: 'Sepolia',
    17000: 'Holesky',
    421614: 'Arbitrum Sepolia',
    84532: 'Base Sepolia',
    137: 'Polygon',
    56: 'BSC',
    42161: 'Arbitrum'
  };
  return chainNames[chainId] || `Chain ${chainId}`;
}

function proposalChainId(proposal) {
  return Number(proposal?.chainId || proposal?.chains?.[0]?.chainId || 0);
}

function sortProposalQueue(list) {
  return list.sort((a, b) => {
    const idDiff = Number(b.id ?? 0) - Number(a.id ?? 0);
    if (idDiff !== 0) return idDiff;
    return Number(b.createdAt || 0) - Number(a.createdAt || 0);
  });
}

export function useProposals(dleAddress, isAuthenticated, userAddress, selectedChainId) {
  const proposals = ref([]);
  const filteredProposals = ref([]);
  const isLoading = ref(false);
  const isVoting = ref(false);
  const isExecuting = ref(false);
  const isCancelling = ref(false);
  const statusFilter = ref('');
  const searchQuery = ref('');
  
  // Используем готовые функции из utils/dle-contract.js
  
  // Инициализируем валидацию
  const {
    validateProposals,
    filterRealProposals,
    filterActiveProposals,
    validationStats,
    isValidating
  } = useProposalValidation();
  const { canGovern } = usePermissions();

  const loadProposals = async () => {
    try {
      isLoading.value = true;

      const queryAddr = String(dleAddress.value || '').trim();
      let allDles = [];

      if (queryAddr) {
        allDles = [{
          dleAddress: queryAddr,
          networks: [{ address: queryAddr }],
          deployedNetworks: [{ address: queryAddr }],
        }];
      } else {
        console.log('[Proposals] Получаем информацию о всех DLE...');
        const dleResponse = await api.get('/dle-v2');
        if (!dleResponse.data.success) {
          console.error('Не удалось получить список DLE');
          return;
        }
        allDles = dleResponse.data.data || [];
      }

      console.log(`[Proposals] Найдено DLE: ${allDles.length}`, allDles);

      // Группируем предложения по описанию для создания мульти-чейн представлений
        // Одна карточка = одна сеть + один on-chain id.
        // Описание одинаковое у add-module в разных сетях — это разные предложения,
        // склеивать их нельзя (нет execute, чужой state, голос не в ту сеть).
        const proposalsByChainSlot = new Map();

      const getTimestamp = (p) => {
        if (p?.timestamp) return Number(p.timestamp);
        if (p?.createdAt) {
          if (typeof p.createdAt === 'string') {
            return Math.floor(new Date(p.createdAt).getTime() / 1000);
          }
          return Number(p.createdAt);
        }
        return Math.floor(Date.now() / 1000);
      };

      // Один запрос на адрес: бэкенд уже читает все сети контракта
      const seenAddresses = new Set();
      for (const dle of allDles) {
        const networks = dle.networks || dle.deployedNetworks || [];
        if (networks.length === 0) continue;

        const hasMatchingAddress = networks.some(
          (network) =>
            network.address &&
            network.address.toLowerCase() === (dleAddress.value || '').toLowerCase()
        );

        if (dleAddress.value && !hasMatchingAddress) {
          console.log(
            `[Proposals] Пропускаем DLE ${dle.dleAddress || 'N/A'}: адрес ${dleAddress.value} не найден в networks`
          );
          continue;
        }

        const addr =
          (dleAddress.value && hasMatchingAddress ? dleAddress.value : null) ||
          dle.dleAddress ||
          networks[0]?.address;
        if (!addr) continue;
        const keyAddr = addr.toLowerCase();
        if (seenAddresses.has(keyAddr)) continue;
        seenAddresses.add(keyAddr);

        try {
          console.log(`[Proposals] Загружаем предложения одним запросом для ${addr}`);
          const response = await getProposals(addr);

          console.log(`[Proposals] Ответ:`, {
            success: response.success,
            proposalsCount: response.data?.proposals?.length || 0,
            hasError: !!response.error,
          });

          if (!response.success) continue;

          const chainProposals = response.data?.proposals || response.data?.data?.proposals || [];
          console.log(`[Proposals] Получено предложений: ${chainProposals.length}`);

          chainProposals.forEach((proposal) => {
            const netChainId = Number(proposal.chainId);
            proposal.chainId = netChainId;
            proposal.contractAddress = addr;
            proposal.networkName = getChainName(netChainId);

            const proposalTimestamp = getTimestamp(proposal);
            const normalizedState =
              typeof proposal.state === 'string'
                ? proposal.state === 'active'
                  ? 0
                  : NaN
                : Number(proposal.state);
            const proposalId =
              proposal.id !== undefined && proposal.id !== null
                ? Number(proposal.id)
                : proposal.proposalId !== undefined
                  ? Number(proposal.proposalId)
                  : null;
            const slotId = proposalId !== null ? proposalId : 0;
            const key = `${keyAddr}:${netChainId}:${slotId}`;

            if (!proposalsByChainSlot.has(key)) {
              proposalsByChainSlot.set(key, {
                id: slotId,
                description: proposal.description,
                initiator: proposal.initiator,
                deadline: proposal.deadline,
                chains: new Map(),
                createdAt: proposalTimestamp,
                uniqueId: key,
              });
            }

            const group = proposalsByChainSlot.get(key);
            const existingChainData = group.chains.get(netChainId);

            const chainEntry = {
              ...proposal,
              id: slotId,
              chainId: netChainId,
              contractAddress: addr,
              networkName: getChainName(netChainId),
              state: isNaN(normalizedState) ? 0 : normalizedState,
              timestamp: proposalTimestamp,
            };

            if (!existingChainData || proposalTimestamp >= getTimestamp(existingChainData)) {
              group.chains.set(netChainId, chainEntry);
              group.id = slotId;
              group.description = proposal.description;
              group.initiator = proposal.initiator;
              group.deadline = proposal.deadline;
            }

            const allChainTimes = Array.from(group.chains.values()).map((c) => getTimestamp(c));
            group.createdAt = Math.min(...allChainTimes, proposalTimestamp);
          });
        } catch (error) {
          console.error(`[Proposals] Ошибка загрузки предложений для ${addr}:`, error);
        }
      }

      // Преобразуем в массив для отображения
      const rawProposals = Array.from(proposalsByChainSlot.values()).map(group => {
        const chainsArray = Array.from(group.chains.values()).map(chain => {
          // Унифицируем state для каждого chain - всегда число
          const normalizedState = typeof chain.state === 'string' 
            ? (chain.state === 'active' ? 0 : NaN) 
            : Number(chain.state);
          
          // Убеждаемся, что id есть (fallback)
          const chainId = chain.id !== undefined && chain.id !== null 
            ? Number(chain.id) 
            : (chain.proposalId !== undefined ? Number(chain.proposalId) : null);
          
          return {
            ...chain,
            id: chainId !== null ? chainId : 0, // Fallback к 0, если id отсутствует
            state: isNaN(normalizedState) ? 0 : normalizedState // Всегда число, fallback к 0
          };
        });
        
        // Определяем общий state группы (число) - минимальный state из всех chains
        const groupState = chainsArray.length > 0 
          ? Math.min(...chainsArray.map(c => Number(c.state || 0)))
          : 0;
        const primary = chainsArray[0];
        
        return {
          ...group,
          chains: chainsArray,
          state: groupState,
          executed: chainsArray.length > 0 && chainsArray.every(c => c.executed),
          canceled: chainsArray.some(c => c.canceled),
          forVotes: primary?.forVotes ?? 0,
          againstVotes: primary?.againstVotes ?? 0,
          quorumRequired: primary?.quorumRequired ?? 0,
          totalSupply: primary?.totalSupply ?? 0,
          contractQuorumPercentage: primary?.contractQuorumPercentage ?? 0,
          chainId: primary?.chainId,
          transactionHash: primary?.transactionHash ?? null,
        };
      });

      console.log(`[Proposals] Карт предложений (по сети+id): ${rawProposals.length}`);
      console.log(`[Proposals] Детали карточек:`, rawProposals);

      // Валидация — предупреждения, не отсев: on-chain список не должен исчезать из-за string wei.
      const validationResult = validateProposals(rawProposals);
      const realProposals = filterRealProposals(rawProposals);

      console.log(`[Proposals] Валидных предложений: ${validationResult.validCount}`);
      console.log(`[Proposals] Реальных предложений: ${realProposals.length}`);
      
      // Считаем активные только для статистики/логов (не выкидываем остальные из списка,
      // иначе фильтр "Все/Выполненные/Отмененные" в UI никогда не покажет эти статусы).
      const activeProposals = filterActiveProposals(realProposals);
      console.log(`[Proposals] Активных предложений: ${activeProposals.length}`);

      if (validationResult.errorCount > 0) {
        console.warn(`[Proposals] Найдено ${validationResult.errorCount} предложений с ошибками валидации`);
      }

      // В UI должны попадать ВСЕ реальные предложения; дальше их фильтрует statusFilter/searchQuery
      proposals.value = realProposals;
      filterProposals();
    } catch (error) {
      console.error('Ошибка загрузки предложений:', error);
      proposals.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const filterProposals = () => {
    if (!proposals.value || proposals.value.length === 0) {
      filteredProposals.value = [];
      return;
    }

    const cid = Number(unref(selectedChainId) || 0);
    if (!Number.isFinite(cid) || cid <= 0) {
      filteredProposals.value = [];
      return;
    }

    let filtered = proposals.value.filter((proposal) => proposalChainId(proposal) === cid);

    if (statusFilter.value) {
      filtered = filtered.filter(proposal => {
        switch (statusFilter.value) {
          case 'active': return proposal.state === 0; // Pending
          case 'succeeded': return proposal.state === 1; // Succeeded
          case 'defeated': return proposal.state === 2; // Defeated
          case 'executed': return proposal.state === 3; // Executed
          case 'cancelled': return proposal.state === 4; // Canceled
          case 'ready': return proposal.state === 5; // ReadyForExecution
          default: return true;
        }
      });
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(proposal =>
        proposal.description.toLowerCase().includes(query) ||
        proposal.initiator.toLowerCase().includes(query) ||
        proposal.uniqueId.toLowerCase().includes(query)
      );
    }

    filteredProposals.value = sortProposalQueue(filtered);
  };

  watch(() => Number(unref(selectedChainId) || 0), filterProposals);

  /** Карточка по uniqueId (сеть+id) или по on-chain id, если он один в списке. */
  const findProposal = (ref) => {
    if (ref == null) return null;
    if (typeof ref === 'object') return ref;
    const byUnique = proposals.value.find((p) => p.uniqueId === ref);
    if (byUnique) return byUnique;
    const matches = proposals.value.filter(
      (p) => p.id === ref || Number(p.id) === Number(ref)
    );
    return matches.length === 1 ? matches[0] : null;
  };

  const voteOnProposal = async (proposalId, support) => {
    try {
      isVoting.value = true;
      if (!canGovern.value) {
        throw new Error(t('smartcontracts.proposals.tokenHolderVoteHint'));
      }
      
      // Проверяем наличие MetaMask
      if (!window.ethereum) {
        throw new Error(t('smartcontracts.proposals.composableErrors.metamaskNotFound'));
      }
      
      // Проверяем состояние предложения
      console.log('🔍 [DEBUG] Проверяем состояние предложения...');
      const proposal = findProposal(proposalId);
      if (!proposal) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalNotFound'));
      }
      const onChainProposalId = Number(proposal.id);
      
      // targetChains — сети исполнения, не сети, куда слать vote().
      // Голос только в той сети, где создана запись предложения.

      console.log('📊 [DEBUG] Данные предложения:', {
        id: proposal.id,
        state: proposal.state,
        deadline: proposal.deadline,
        forVotes: proposal.forVotes,
        againstVotes: proposal.againstVotes,
        executed: proposal.executed,
        canceled: proposal.canceled
      });
      
      // Проверяем, что предложение активно (Pending)
      if (proposal.state !== 0) {
        const statusText = getProposalStatusText(proposal.state);
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalNotActiveForVote', { status: statusText }));
      }
      
      // Проверяем, что предложение не выполнено и не отменено
      if (proposal.executed) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalAlreadyExecutedNoVote'));
      }
      
      if (proposal.canceled) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalCancelledNoVote'));
      }
      
      // Проверяем deadline
      const currentTime = Math.floor(Date.now() / 1000);
      if (proposal.deadline && currentTime > proposal.deadline) {
        throw new Error(t('smartcontracts.proposals.composableErrors.votingDeadlineExpired'));
      }
      
      // Проверяем баланс токенов пользователя
      console.log('💰 [DEBUG] Проверяем баланс токенов...');
      try {
        const balanceCheck = await checkTokenBalance(dleAddress.value, userAddress.value);
        console.log('💰 [DEBUG] Баланс токенов:', balanceCheck);
        
        if (!balanceCheck.hasTokens) {
          throw new Error(t('smartcontracts.proposals.composableErrors.noTokensForVoting'));
        }
      } catch (balanceError) {
        console.warn('⚠️ [DEBUG] Ошибка проверки баланса (продолжаем):', balanceError.message);
        // Не останавливаем голосование, если не удалось проверить баланс
      }
      
      // Голос только в сети, где создано предложение (не в targetChains исполнения).
      const voteChainId = Number(
        proposal.governanceChainId
        || proposal.chainId
        || proposal.chains?.[0]?.governanceChainId
        || proposal.chains?.[0]?.chainId
      );
      if (!Number.isFinite(voteChainId) || voteChainId <= 0) {
        throw new Error(t('smartcontracts.proposals.composableErrors.wrongNetwork', {
          currentChainId: 'unknown',
          requiredChainId: 'unknown',
        }));
      }

      const switched = await switchToVotingNetwork(voteChainId);
      if (!switched) {
        throw new Error(t('smartcontracts.proposals.composableErrors.networkSwitchFailed', {
          networkName: String(voteChainId),
          chainId: voteChainId,
        }));
      }

      console.log('🗳️ Отправляем голосование через смарт-контракт...');
      const result = await voteForProposal(dleAddress.value, onChainProposalId, support, voteChainId);
      
      console.log('✅ Голосование успешно отправлено:', result.txHash);
      alert(t('smartcontracts.proposals.composableAlerts.voteSuccess', { txHash: result.txHash }));
      
      // Принудительно обновляем данные предложения
      console.log('🔄 [VOTE] Обновляем данные после голосования...');
      await loadProposals();
      
      // Дополнительная задержка для подтверждения в блокчейне
      setTimeout(async () => {
        console.log('🔄 [VOTE] Повторное обновление через 3 секунды...');
        await loadProposals();
      }, 3000);
    } catch (error) {
      console.error('❌ Ошибка голосования:', error);
      
      let errorMessage = messageForVoteRevert(error) || error.message;

      if (errorMessage === error.message && String(error.message || '').includes('execution reverted')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.transactionRejectedByContract', {
          code: error.revertSelector || error.data || '',
        });
      } else if (String(error.message || '').includes('user rejected')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.transactionRejectedByUser');
      } else if (String(error.message || '').includes('insufficient funds')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.insufficientFundsForGas');
      }
      
      alert(t('smartcontracts.proposals.composableAlerts.voteError', { message: errorMessage }));
    } finally {
      isVoting.value = false;
    }
  };

  const executeProposal = async (proposalId) => {
    try {
      console.log('⚡ [EXECUTE] Исполняем предложение через DLE контракт:', { proposalId, dleAddress: dleAddress.value });
      isExecuting.value = true;
      
      // Проверяем состояние предложения перед выполнением
      console.log('🔍 [DEBUG] Проверяем состояние предложения для выполнения...');
      const proposal = findProposal(proposalId);
      if (!proposal) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalNotFound'));
      }
      const onChainProposalId = Number(proposal.id);
      
      // КРИТИЧЕСКИ ВАЖНО: Если предложение мультичейн, используем executeMultichainProposal
      if (proposal.chains && proposal.chains.length > 1) {
        console.log('🌐 [EXECUTE] Обнаружено мультичейн предложение, используем executeMultichainProposal');
        return await executeMultichainProposal(proposal);
      }
      
      console.log('📊 [DEBUG] Данные предложения для выполнения:', {
        id: proposal.id,
        state: proposal.state,
        executed: proposal.executed,
        canceled: proposal.canceled,
        quorumReached: proposal.quorumReached
      });
      
      // Проверяем, что предложение можно выполнить
      if (proposal.executed) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalAlreadyExecutedNoReExecute'));
      }
      
      if (proposal.canceled) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalCancelledNoExecute'));
      }
      
      // Проверяем, что предложение готово к выполнению
      if (proposal.state !== 5) {
        const statusText = getProposalStatusText(proposal.state);
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalNotReadyForExecute', { status: statusText }));
      }
      
      const execChainId = Number(
        proposal.chainId
        || proposal.chains?.[0]?.chainId
      );
      if (!Number.isFinite(execChainId) || execChainId <= 0) {
        throw new Error(t('smartcontracts.proposals.composableErrors.wrongNetwork', {
          currentChainId: 'unknown',
          requiredChainId: 'unknown',
        }));
      }
      const switched = await switchToVotingNetwork(execChainId);
      if (!switched) {
        throw new Error(t('smartcontracts.proposals.composableErrors.networkSwitchFailed', {
          networkName: proposal.networkName || String(execChainId),
          chainId: execChainId,
        }));
      }

      // Исполняем предложение через готовую функцию из utils/dle-contract.js
      const result = await executeProposalUtil(dleAddress.value, onChainProposalId);
      
      console.log('✅ Предложение успешно исполнено:', result.txHash);
      alert(t('smartcontracts.proposals.composableAlerts.executeSuccess', { txHash: result.txHash }));
      
      // Принудительно обновляем состояние предложения в UI
      updateProposalState(proposal.uniqueId, {
        executed: true,
        state: 3,
        canceled: false
      });
      
      await loadProposals(); // Перезагружаем данные
    } catch (error) {
      console.error('❌ Ошибка выполнения предложения:', error);
      
      // Улучшенная обработка ошибок
      let errorMessage = messageForProposalRevert(error) || error.message;
      
      if (errorMessage === error.message && String(error.message || '').includes('execution reverted')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.executeRejectedByContract');
      } else if (String(error.message || '').includes('user rejected')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.transactionRejectedByUser');
      } else if (String(error.message || '').includes('insufficient funds')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.insufficientFundsForGas');
      }
      
      alert(t('smartcontracts.proposals.composableAlerts.executeError', { message: errorMessage }));
    } finally {
      isExecuting.value = false;
    }
  };

  const cancelProposal = async (proposalId, reason = t('smartcontracts.proposals.composableErrors.defaultCancelReason')) => {
    try {
      console.log('❌ [CANCEL] Отменяем предложение через DLE контракт:', { proposalId, reason, dleAddress: dleAddress.value });
      isCancelling.value = true;
      
      // Проверяем состояние предложения перед отменой
      console.log('🔍 [DEBUG] Проверяем состояние предложения для отмены...');
      const proposal = findProposal(proposalId);
      if (!proposal) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalNotFound'));
      }
      
      console.log('📊 [DEBUG] Данные предложения для отмены:', {
        id: proposal.id,
        state: proposal.state,
        executed: proposal.executed,
        canceled: proposal.canceled,
        deadline: proposal.deadline,
        chains: proposal.chains?.length || 0
      });
      
      // Проверяем, что предложение можно отменить
      if (proposal.executed) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalAlreadyExecutedNoCancel'));
      }
      
      if (proposal.canceled) {
        throw new Error(t('smartcontracts.proposals.composableErrors.proposalAlreadyCancelled'));
      }
      
      // Проверяем, что пользователь является инициатором
      if (proposal.initiator?.toLowerCase() !== userAddress.value?.toLowerCase()) {
        throw new Error(t('smartcontracts.proposals.composableErrors.onlyInitiatorCanCancel'));
      }
      
      // Проверяем deadline (нужен запас 15 минут)
      const currentTime = Math.floor(Date.now() / 1000);
      if (proposal.deadline) {
        const timeRemaining = proposal.deadline - currentTime;
        if (timeRemaining <= 900) { // 15 минут запас
          throw new Error(t('smartcontracts.proposals.composableErrors.cancelDeadlineExpired'));
        }
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Мультичейн отмена - последовательно во всех активных сетях
      if (proposal.chains && proposal.chains.length > 0) {
        // Фильтруем только активные цепочки (можно отменить)
        const activeChains = proposal.chains.filter(chain => 
          canCancel(chain) && !chain.canceled && !chain.executed
        );
        
        if (activeChains.length === 0) {
          throw new Error(t('smartcontracts.proposals.composableErrors.noActiveChainsForCancel'));
        }
        
        console.log(`🚀 [MULTI-CANCEL] Начинаем отмену в ${activeChains.length} цепочках последовательно...`);
        
        const { switchToVotingNetwork } = await import('@/utils/dle-contract');
        const results = [];
        
        // КРИТИЧЕСКИ ВАЖНО: Отменяем ПОСЛЕДОВАТЕЛЬНО, а не параллельно!
        // MetaMask может работать только с одной сетью одновременно
        for (let index = 0; index < activeChains.length; index++) {
          const chain = activeChains[index];
          console.log(`📝 [${index + 1}/${activeChains.length}] Отмена в цепочке ${chain.networkName} (${chain.chainId})`);
          
          try {
            // Переключаемся на нужную сеть
            console.log(`🔄 [${index + 1}/${activeChains.length}] Переключаемся на сеть ${chain.chainId}...`);
            const switched = await switchToVotingNetwork(chain.chainId);
            if (!switched) {
              throw new Error(t('smartcontracts.proposals.composableErrors.networkSwitchFailed', {
                networkName: chain.networkName,
                chainId: chain.chainId
              }));
            }
            
            // Задержка после переключения сети
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const contractAddress = chain.contractAddress || chain.address || dleAddress.value;
            // Используем ID предложения из конкретной цепочки (с fallback)
            let chainProposalId = chain.id !== undefined && chain.id !== null 
              ? Number(chain.id) 
              : (chain.proposalId !== undefined ? Number(chain.proposalId) : null);
            
            // Fallback к proposalId, если chain.id отсутствует
            if (chainProposalId === null || isNaN(chainProposalId)) {
              chainProposalId = Number(proposal.id);
            }
            
            if (chainProposalId === null || isNaN(chainProposalId)) {
              throw new Error(t('smartcontracts.proposals.composableErrors.invalidProposalIdForChainCancel', {
                networkName: chain.networkName,
                chainId: chain.chainId,
                chainIdValue: chain.id,
                proposalId
              }));
            }
            
            chainProposalId = Number(chainProposalId); // Убеждаемся, что это число
            
            console.log(`🔍 [${index + 1}/${activeChains.length}] Используем ID предложения: ${chainProposalId} для отмены в цепочке ${chain.chainId}`);
            
            // Отменяем предложение
            console.log(`❌ [${index + 1}/${activeChains.length}] Отправляем отмену...`);
            const result = await cancelProposalUtil(contractAddress, chainProposalId, reason);
            
            console.log(`✅ [${index + 1}/${activeChains.length}] Предложение успешно отменено в ${chain.networkName}:`, result.txHash);
            
            // Задержка после подтверждения транзакции (для Base Sepolia больше)
            const delay = chain.chainId === 84532 ? 5000 : 3000;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            results.push({
              chainId: chain.chainId,
              networkName: chain.networkName,
              success: true,
              txHash: result.txHash
            });
          } catch (error) {
            console.error(`❌ [${index + 1}/${activeChains.length}] Ошибка отмены в ${chain.networkName}:`, error);
            results.push({
              chainId: chain.chainId,
              networkName: chain.networkName,
              success: false,
              error: error.message
            });
            // Продолжаем отменять в других цепочках даже при ошибке
          }
        }
        
        // Подводим итоги
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        console.log(`📊 [MULTI-CANCEL] Отмена завершена: успешно в ${successful.length} из ${activeChains.length} цепочек`);
        
        if (successful.length > 0) {
          const alertMessage = [
            t('smartcontracts.proposals.composableAlerts.cancelMultiSuccess', {
              successful: successful.length,
              total: activeChains.length
            }),
            failed.length > 0
              ? t('smartcontracts.proposals.composableAlerts.cancelMultiPartialErrors', { failed: failed.length })
              : ''
          ].filter(Boolean).join('\n');
          alert(alertMessage);
        } else {
          throw new Error(t('smartcontracts.proposals.composableErrors.cancelFailedAllChains'));
        }
      } else {
        // Одиночное предложение (без мультичейн)
        const result = await cancelProposalUtil(dleAddress.value, proposalId, reason);
        console.log('✅ Предложение успешно отменено:', result.txHash);
        alert(t('smartcontracts.proposals.composableAlerts.cancelSuccess', { txHash: result.txHash }));
      }
      
      // Принудительно обновляем состояние предложения в UI
      updateProposalState(proposalId, {
        canceled: true,
        state: 4, // Canceled
        executed: false
      });
      
      await loadProposals(); // Перезагружаем данные
    } catch (error) {
      console.error('❌ Ошибка отмены предложения:', error);
      
      // Улучшенная обработка ошибок
      let errorMessage = error.message;
      
      if (error.message.includes('execution reverted')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.cancelRejectedByContract');
      } else if (error.message.includes('user rejected')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.transactionRejectedByUser');
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = t('smartcontracts.proposals.composableErrors.insufficientFundsForGas');
      }
      
      alert(t('smartcontracts.proposals.composableAlerts.cancelError', { message: errorMessage }));
    } finally {
      isCancelling.value = false;
    }
  };

  const getProposalStatusClass = (state) => {
    switch (state) {
      case 0: return 'status-active';        // Pending
      case 1: return 'status-succeeded';      // Succeeded
      case 2: return 'status-defeated';       // Defeated
      case 3: return 'status-executed';       // Executed
      case 4: return 'status-cancelled';     // Canceled
      case 5: return 'status-ready';          // ReadyForExecution
      default: return 'status-active';
    }
  };

  const getProposalStatusText = (state) => {
    const key = PROPOSAL_STATUS_KEYS[state];
    return key ? t(key) : t('smartcontracts.proposals.status.active');
  };

  const getQuorumPercentage = (proposal) => {
    const src = proposal?.chains?.[0] || proposal || {};
    const supply = toVoteWei(src.totalSupply);
    const voted = toVoteWei(src.forVotes) + toVoteWei(src.againstVotes);
    if (supply === 0n) return '0.0';
    return (Number((voted * 1000n) / supply) / 10).toFixed(1);
  };

  const getRequiredQuorumPercentage = (proposal) => {
    const src = proposal?.chains?.[0] || proposal || {};
    const fromContract = Number(src.contractQuorumPercentage);
    if (Number.isFinite(fromContract) && fromContract > 0) {
      return String(fromContract);
    }
    const supply = toVoteWei(src.totalSupply);
    const required = toVoteWei(src.quorumRequired);
    if (supply === 0n) return '0';
    return (Number((required * 1000n) / supply) / 10).toFixed(1);
  };

  const canVote = (proposal) => {
    // Для мультичейн предложений используем canVoteMultichain
    if (proposal.chains && proposal.chains.length > 1) {
      return canVoteMultichain(proposal);
    }
    // Унифицируем state - всегда число
    const state = typeof proposal.state === 'string' 
      ? (proposal.state === 'active' ? 0 : NaN) 
      : Number(proposal.state);
    return state === 0; // Pending - только активные предложения
  };

  const canExecute = (proposal) => {
    if (proposal?.executed) return false;
    const state = typeof proposal.state === 'string' 
      ? (proposal.state === 'active' ? 0 : NaN) 
      : Number(proposal.state);
    return state === 5;
  };

  const canCancel = (proposal) => {
    // Унифицируем state - всегда число
    const state = typeof proposal.state === 'string' 
      ? (proposal.state === 'active' ? 0 : NaN) 
      : Number(proposal.state);
    // Можно отменить только активные предложения (Pending)
    return state === 0 && 
           !proposal.executed && 
           !proposal.canceled;
  };

  // Принудительное обновление состояния предложения в UI
  const updateProposalState = (proposalId, updates) => {
    const proposal = findProposal(proposalId);
    if (proposal) {
      Object.assign(proposal, updates);
      if (Array.isArray(proposal.chains)) {
        proposal.chains.forEach((chain) => Object.assign(chain, updates));
      }
      console.log(`🔄 [UI] Обновлено состояние предложения ${proposalId}:`, updates);

      // Принудительно обновляем фильтрацию
      filterProposals();
    }
  };

  // Мульти-чейн функции
  const voteOnMultichainProposal = async (proposal, support) => {
    try {
      isVoting.value = true;

      // Фильтруем только активные цепочки (state === 0 или 'active', не выполнены, не отменены)
      const activeChains = proposal.chains.filter(chain => canVote(chain));
      
      if (activeChains.length === 0) {
        throw new Error(t('smartcontracts.proposals.composableErrors.noActiveChainsForVote'));
      }

      console.log(`🌐 [MULTI-VOTE] Начинаем голосование в ${activeChains.length} цепочках последовательно...`);

      const { switchToVotingNetwork } = await import('@/utils/dle-contract');
      const results = [];

      // КРИТИЧЕСКИ ВАЖНО: Голосуем ПОСЛЕДОВАТЕЛЬНО, а не параллельно!
      // MetaMask может работать только с одной сетью одновременно
      for (let index = 0; index < activeChains.length; index++) {
        const chain = activeChains[index];
        console.log(`📝 [${index + 1}/${activeChains.length}] Голосование в цепочке ${chain.networkName} (${chain.chainId})`);
        
        try {
          // Переключаемся на нужную сеть
          console.log(`🔄 [${index + 1}/${activeChains.length}] Переключаемся на сеть ${chain.chainId}...`);
          const switched = await switchToVotingNetwork(chain.chainId);
          if (!switched) {
            throw new Error(t('smartcontracts.proposals.composableErrors.networkSwitchFailed', {
              networkName: chain.networkName,
              chainId: chain.chainId
            }));
          }
          
          // Задержка после переключения сети
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const contractAddress = chain.contractAddress || chain.address || dleAddress.value;
          // Используем ID предложения из конкретной цепочки (с fallback)
          let chainProposalId = chain.id !== undefined && chain.id !== null 
            ? Number(chain.id) 
            : (chain.proposalId !== undefined ? Number(chain.proposalId) : null);
          
          // Fallback к proposal.id, если chain.id отсутствует
          if (chainProposalId === null || isNaN(chainProposalId)) {
            chainProposalId = proposal.id !== undefined && proposal.id !== null ? Number(proposal.id) : null;
          }
          
          if (chainProposalId === null || isNaN(chainProposalId)) {
            throw new Error(t('smartcontracts.proposals.composableErrors.invalidProposalIdForChain', {
              networkName: chain.networkName,
              chainId: chain.chainId,
              chainIdValue: chain.id,
              proposalId: proposal.id
            }));
          }
          
          chainProposalId = Number(chainProposalId); // Убеждаемся, что это число
          
          console.log(`🔍 [${index + 1}/${activeChains.length}] Используем ID предложения: ${chainProposalId} для голосования в цепочке ${chain.chainId}`);
          
          // Проверяем баланс токенов в каждой сети (балансы могут отличаться в разных сетях)
          console.log(`💰 [${index + 1}/${activeChains.length}] Проверяем баланс токенов в ${chain.networkName}...`);
          try {
            const balanceCheck = await checkTokenBalance(contractAddress, userAddress.value);
            console.log(`💰 [${index + 1}/${activeChains.length}] Баланс токенов в ${chain.networkName}:`, balanceCheck);
            
            if (!balanceCheck.hasTokens) {
              console.warn(`⚠️ [${index + 1}/${activeChains.length}] Нет токенов в ${chain.networkName}, пропускаем голосование в этой сети`);
              results.push({
                chainId: chain.chainId,
                networkName: chain.networkName,
                success: false,
                error: t('smartcontracts.proposals.composableErrors.noTokensInNetwork', { networkName: chain.networkName })
              });
              // Продолжаем с следующей сетью
              continue;
            }
          } catch (balanceError) {
            console.warn(`⚠️ [${index + 1}/${activeChains.length}] Ошибка проверки баланса в ${chain.networkName} (продолжаем):`, balanceError.message);
            // При ошибке проверки баланса продолжаем попытку голосования
            // Контракт сам проверит баланс и вернет ошибку, если токенов нет
          }
          
          // Голосуем
          console.log(`🗳️ [${index + 1}/${activeChains.length}] Отправляем голосование для proposalId=${chainProposalId} в ${chain.networkName}...`);
          const result = await voteForProposal(contractAddress, chainProposalId, support, chain.chainId);
          
          console.log(`✅ [${index + 1}/${activeChains.length}] Голосование успешно в ${chain.networkName}:`, result.txHash);
          
          // Задержка после подтверждения транзакции (для Base Sepolia больше)
          const delay = chain.chainId === 84532 ? 5000 : 3000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          results.push({
            chainId: chain.chainId,
            networkName: chain.networkName,
            success: true,
            txHash: result.txHash
          });
        } catch (error) {
          console.error(`❌ [${index + 1}/${activeChains.length}] Ошибка голосования в ${chain.networkName}:`, error);
          results.push({
            chainId: chain.chainId,
            networkName: chain.networkName,
            success: false,
            error: error.message
          });
          // Продолжаем голосовать в других цепочках даже при ошибке
        }
      }

      // Подводим итоги
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log(`📊 [MULTI-VOTE] Голосование завершено: успешно в ${successful.length} из ${activeChains.length} цепочек`);

      // Перезагружаем предложения
      await loadProposals();

    } catch (error) {
      console.error('[MULTI-VOTE] Критическая ошибка:', error);
      throw error;
    } finally {
      isVoting.value = false;
    }
  };

  const executeMultichainProposal = async (proposal) => {
    try {
      isExecuting.value = true;

      // Фильтруем только готовые к выполнению цепочки
      const readyChains = proposal.chains.filter(chain => canExecute(chain));
      
      if (readyChains.length === 0) {
        throw new Error(t('smartcontracts.proposals.composableErrors.noChainsReadyForExecute'));
      }

      console.log(`🚀 [MULTI-EXECUTE] Начинаем исполнение в ${readyChains.length} цепочках последовательно...`);

      const { switchToVotingNetwork } = await import('@/utils/dle-contract');
      const results = [];

      // КРИТИЧЕСКИ ВАЖНО: Исполняем ПОСЛЕДОВАТЕЛЬНО, а не параллельно!
      // MetaMask может работать только с одной сетью одновременно
      for (let index = 0; index < readyChains.length; index++) {
        const chain = readyChains[index];
        console.log(`📝 [${index + 1}/${readyChains.length}] Выполнение в цепочке ${chain.networkName} (${chain.chainId})`);
        
        try {
          // Переключаемся на нужную сеть
          console.log(`🔄 [${index + 1}/${readyChains.length}] Переключаемся на сеть ${chain.chainId}...`);
          const switched = await switchToVotingNetwork(chain.chainId);
          if (!switched) {
            throw new Error(t('smartcontracts.proposals.composableErrors.networkSwitchFailed', {
              networkName: chain.networkName,
              chainId: chain.chainId
            }));
          }
          
          // Задержка после переключения сети
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const contractAddress = chain.contractAddress || chain.address || dleAddress.value;
          // Используем ID предложения из конкретной цепочки (с fallback)
          let chainProposalId = chain.id !== undefined && chain.id !== null 
            ? Number(chain.id) 
            : (chain.proposalId !== undefined ? Number(chain.proposalId) : null);
          
          // Fallback к proposal.id, если chain.id отсутствует
          if (chainProposalId === null || isNaN(chainProposalId)) {
            chainProposalId = proposal.id !== undefined && proposal.id !== null ? Number(proposal.id) : null;
          }
          
          if (chainProposalId === null || isNaN(chainProposalId)) {
            throw new Error(t('smartcontracts.proposals.composableErrors.invalidProposalIdForChain', {
              networkName: chain.networkName,
              chainId: chain.chainId,
              chainIdValue: chain.id,
              proposalId: proposal.id
            }));
          }
          
          chainProposalId = Number(chainProposalId); // Убеждаемся, что это число
          
          console.log(`🔍 [${index + 1}/${readyChains.length}] Используем ID предложения: ${chainProposalId} для выполнения в цепочке ${chain.chainId}`);
          
          // Выполняем предложение
          console.log(`⚡ [${index + 1}/${readyChains.length}] Отправляем выполнение...`);
          const result = await executeProposalUtil(contractAddress, chainProposalId);
          
          console.log(`✅ [${index + 1}/${readyChains.length}] Предложение успешно выполнено в ${chain.networkName}:`, result.txHash);
          
          // Задержка после подтверждения транзакции (для Base Sepolia больше)
          const delay = chain.chainId === 84532 ? 5000 : 3000;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          results.push({
            chainId: chain.chainId,
            networkName: chain.networkName,
            success: true,
            txHash: result.txHash
          });
        } catch (error) {
          console.error(`❌ [${index + 1}/${readyChains.length}] Ошибка выполнения в ${chain.networkName}:`, error);
          results.push({
            chainId: chain.chainId,
            networkName: chain.networkName,
            success: false,
            error: error.message
          });
          // Продолжаем выполнять в других цепочках даже при ошибке
        }
      }

      // Подводим итоги
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      console.log(`📊 [MULTI-EXECUTE] Выполнение завершено: успешно в ${successful.length} из ${readyChains.length} цепочек`);

      // Перезагружаем предложения
      await loadProposals();

    } catch (error) {
      console.error('[MULTI-EXECUTE] Критическая ошибка:', error);
      throw error;
    } finally {
      isExecuting.value = false;
    }
  };

  const canVoteMultichain = (proposal) => {
    // Можно голосовать если есть хотя бы одна активная цепочка
    return proposal.chains.some(chain => canVote(chain));
  };

  const canExecuteMultichain = (proposal) => {
    // Исполнение локальное: достаточно одной сети в состоянии ReadyForExecution
    return proposal.chains.some(chain => canExecute(chain));
  };

  const getChainStatusClass = (chain) => {
    if (chain.executed) return 'executed';
    if (chain.state === 'active') return 'active';
    if (chain.deadline && chain.deadline < Date.now() / 1000) return 'expired';
    return 'inactive';
  };

  const getChainStatusText = (chain) => {
    if (chain.executed) return t('smartcontracts.proposals.chainStatus.executed');
    if (chain.state === 'active') return t('smartcontracts.proposals.chainStatus.active');
    if (chain.deadline && chain.deadline < Date.now() / 1000) return t('smartcontracts.proposals.chainStatus.expired');
    return t('smartcontracts.proposals.chainStatus.inactive');
  };

  return {
    // ... существующие поля
    proposals,
    filteredProposals,
    isLoading,
    isVoting,
    isExecuting,
    isCancelling,
    statusFilter,
    searchQuery,
    loadProposals,
    filterProposals,
    voteOnProposal,
    voteOnMultichainProposal,
    executeProposal,
    executeMultichainProposal,
    cancelProposal,
    getProposalStatusClass,
    getProposalStatusText,
    getQuorumPercentage,
    getRequiredQuorumPercentage,
    formatVoteTokens,
    voteSharePercent,
    votesCastTotal,
    canVote,
    canVoteMultichain,
    canExecute,
    canExecuteMultichain,
    canCancel,
    getChainStatusClass,
    getChainStatusText,
    updateProposalState,
    // Валидация
    validationStats,
    isValidating
  };
}