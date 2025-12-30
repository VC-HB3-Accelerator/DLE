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

import { ref, computed } from 'vue';
import { getProposals } from '@/services/proposalsService';
import { ethers } from 'ethers';
import { useProposalValidation } from './useProposalValidation';
import { voteForProposal, executeProposal as executeProposalUtil, cancelProposal as cancelProposalUtil, checkTokenBalance } from '@/utils/dle-contract';
import api from '@/api/axios';

// Функция checkVoteStatus удалена - в контракте DLE нет публичной функции hasVoted
// Функция checkTokenBalance перенесена в useDleContract.js

// Функция sendTransactionToWallet удалена - теперь используется прямое взаимодействие с контрактом

// Вспомогательная функция для получения имени цепочки
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

export function useProposals(dleAddress, isAuthenticated, userAddress) {
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

  const loadProposals = async () => {
    try {
      isLoading.value = true;

      // Получаем информацию о всех DLE в разных цепочках
      console.log('[Proposals] Получаем информацию о всех DLE...');
      const dleResponse = await api.get('/dle-v2');

      if (!dleResponse.data.success) {
        console.error('Не удалось получить список DLE');
        return;
      }

      const allDles = dleResponse.data.data || [];
      console.log(`[Proposals] Найдено DLE: ${allDles.length}`, allDles);

      // Группируем предложения по описанию для создания мульти-чейн представлений
      const proposalsByDescription = new Map();

      // Загружаем предложения из каждой цепочки
      for (const dle of allDles) {
        if (!dle.networks || dle.networks.length === 0) continue;

        // КРИТИЧНО: Пропускаем DLE, если ни один из его адресов не совпадает с запрошенным dleAddress
        const hasMatchingAddress = dle.networks.some(network => 
          network.address && network.address.toLowerCase() === (dleAddress.value || '').toLowerCase()
        );
        
        if (dleAddress.value && !hasMatchingAddress) {
          console.log(`[Proposals] Пропускаем DLE ${dle.dleAddress || 'N/A'}: адрес ${dleAddress.value} не найден в networks`);
          continue;
        }

        for (const network of dle.networks) {
          try {
            console.log(`[Proposals] Загружаем предложения из цепочки ${network.chainId}, адрес: ${network.address}`);
            const response = await getProposals(network.address);

            console.log(`[Proposals] Ответ для цепочки ${network.chainId}:`, {
              success: response.success,
              proposalsCount: response.data?.proposals?.length || 0,
              hasError: !!response.error
            });

            if (response.success) {
              // Бэкенд возвращает: { success: true, data: { proposals: [...], totalCount: ... } }
              const chainProposals = (response.data?.data?.proposals || response.data?.proposals || []);
              console.log(`[Proposals] Получено предложений для цепочки ${network.chainId}: ${chainProposals.length}`, chainProposals);

              // Добавляем информацию о цепочке к каждому предложению
              chainProposals.forEach(proposal => {
                proposal.chainId = network.chainId;
                proposal.contractAddress = network.address;
                proposal.networkName = getChainName(network.chainId);

                // Группируем предложения по описанию и инициатору
                const key = `${proposal.description}_${proposal.initiator}`;
                
                // Преобразуем время создания в число для сравнения
                // createdAt может быть ISO строкой или числом, timestamp - число в секундах
                const getTimestamp = (proposal) => {
                  if (proposal.timestamp) return Number(proposal.timestamp); // timestamp в секундах
                  if (proposal.createdAt) {
                    if (typeof proposal.createdAt === 'string') {
                      return Math.floor(new Date(proposal.createdAt).getTime() / 1000); // ISO строка -> секунды
                    }
                    return Number(proposal.createdAt);
                  }
                  return Math.floor(Date.now() / 1000);
                };
                
                const proposalTimestamp = getTimestamp(proposal);
                
                if (!proposalsByDescription.has(key)) {
                  proposalsByDescription.set(key, {
                    id: proposal.id, // ID из первой найденной сети
                    description: proposal.description,
                    initiator: proposal.initiator,
                    deadline: proposal.deadline,
                    chains: new Map(),
                    createdAt: proposalTimestamp, // Время создания в секундах
                    uniqueId: key
                  });
                }

                // Добавляем информацию о цепочке
                const group = proposalsByDescription.get(key);
                // Если в этой сети уже есть предложение с таким ключом, выбираем более позднее (актуальное)
                const existingChainData = group.chains.get(network.chainId);
                
                // Унифицируем state - всегда число
                const normalizedState = typeof proposal.state === 'string' 
                  ? (proposal.state === 'active' ? 0 : NaN) 
                  : Number(proposal.state);
                
                // Убеждаемся, что id есть (fallback к proposalId из события, если id отсутствует)
                const proposalId = proposal.id !== undefined && proposal.id !== null 
                  ? Number(proposal.id) 
                  : (proposal.proposalId !== undefined ? Number(proposal.proposalId) : null);
                
                if (existingChainData) {
                  // Если уже есть предложение в этой сети, сравниваем по времени создания
                  const existingTime = getTimestamp(existingChainData);
                  // Оставляем более позднее предложение (актуальное)
                  if (proposalTimestamp > existingTime) {
                    group.chains.set(network.chainId, {
                      ...proposal,
                      id: proposalId !== null ? proposalId : existingChainData.id, // Используем id с fallback
                      chainId: network.chainId,
                      contractAddress: network.address,
                      networkName: getChainName(network.chainId),
                      state: normalizedState, // Унифицированный state (число)
                      timestamp: proposalTimestamp // Сохраняем числовой timestamp для удобства
                    });
                  }
                  // Иначе оставляем существующее
                } else {
                  // Первое предложение в этой сети для данной группы
                  group.chains.set(network.chainId, {
                    ...proposal,
                    id: proposalId !== null ? proposalId : 0, // Fallback к 0, если id отсутствует
                    chainId: network.chainId,
                    contractAddress: network.address,
                    networkName: getChainName(network.chainId),
                    state: normalizedState, // Унифицированный state (число)
                    timestamp: proposalTimestamp // Сохраняем числовой timestamp для удобства
                  });
                }
                
                // Обновляем createdAt группы - минимальное время из всех предложений
                // После добавления нового предложения пересчитываем минимальное время
                const allChainTimes = Array.from(group.chains.values())
                  .map(c => getTimestamp(c));
                group.createdAt = Math.min(...allChainTimes, proposalTimestamp);
              });
            }
            } catch (error) {
            console.error(`Ошибка загрузки предложений из цепочки ${network.chainId}:`, error);
            console.error(`Детали ошибки для цепочки ${network.chainId}:`, {
              chainId: network.chainId,
              address: network.address,
              errorMessage: error.message,
              errorStack: error.stack
            });
          }
        }
      }

      // Преобразуем в массив для отображения
      const rawProposals = Array.from(proposalsByDescription.values()).map(group => {
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
        
        return {
          ...group,
          chains: chainsArray,
          // Общий статус - число (0 = Active, 3 = Executed, 4 = Canceled, 5 = ReadyForExecution)
          state: groupState,
          // Общий executed - выполнен если выполнен во всех цепочках
          executed: chainsArray.length > 0 && chainsArray.every(c => c.executed),
          // Общий canceled - отменен если отменен в любой цепочке
          canceled: chainsArray.some(c => c.canceled)
        };
      });

      console.log(`[Proposals] Сгруппировано предложений: ${rawProposals.length}`);
      console.log(`[Proposals] Детали группировки:`, rawProposals);

      // Применяем валидацию предложений
      const validationResult = validateProposals(rawProposals);

      // Фильтруем только реальные предложения
      const realProposals = filterRealProposals(validationResult.validProposals);

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
    
    let filtered = [...proposals.value];

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

    filteredProposals.value = filtered;
  };

  const voteOnProposal = async (proposalId, support) => {
    try {
      console.log('🚀 [VOTE] Начинаем голосование через DLE контракт:', { proposalId, support, dleAddress: dleAddress.value, userAddress: userAddress.value });
      isVoting.value = true;
      
      // Проверяем наличие MetaMask
      if (!window.ethereum) {
        throw new Error('MetaMask не найден. Пожалуйста, установите MetaMask.');
      }
      
      // Проверяем состояние предложения
      console.log('🔍 [DEBUG] Проверяем состояние предложения...');
      const proposal = proposals.value.find(p => p.id === proposalId);
      if (!proposal) {
        throw new Error('Предложение не найдено');
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Если предложение мультичейн, используем voteOnMultichainProposal
      if (proposal.chains && proposal.chains.length > 1) {
        console.log('🌐 [VOTE] Обнаружено мультичейн предложение, используем voteOnMultichainProposal');
        return await voteOnMultichainProposal(proposal, support);
      }
      
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
        throw new Error(`Предложение не активно (статус: ${statusText}). Голосование возможно только для активных предложений.`);
      }
      
      // Проверяем, что предложение не выполнено и не отменено
      if (proposal.executed) {
        throw new Error('Предложение уже выполнено. Голосование невозможно.');
      }
      
      if (proposal.canceled) {
        throw new Error('Предложение отменено. Голосование невозможно.');
      }
      
      // Проверяем deadline
      const currentTime = Math.floor(Date.now() / 1000);
      if (proposal.deadline && currentTime > proposal.deadline) {
        throw new Error('Время голосования истекло. Голосование невозможно.');
      }
      
      // Проверяем баланс токенов пользователя
      console.log('💰 [DEBUG] Проверяем баланс токенов...');
      try {
        const balanceCheck = await checkTokenBalance(dleAddress.value, userAddress.value);
        console.log('💰 [DEBUG] Баланс токенов:', balanceCheck);
        
        if (!balanceCheck.hasTokens) {
          throw new Error('У вас нет токенов для голосования. Необходимо иметь токены DLE для участия в голосовании.');
        }
      } catch (balanceError) {
        console.warn('⚠️ [DEBUG] Ошибка проверки баланса (продолжаем):', balanceError.message);
        // Не останавливаем голосование, если не удалось проверить баланс
      }
      
      // Проверяем сеть кошелька
      console.log('🌐 [DEBUG] Проверяем сеть кошелька...');
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        console.log('🌐 [DEBUG] Текущая сеть:', chainId);
        console.log('🌐 [DEBUG] Сеть предложения:', proposal.chainId);
        
        if (chainId !== proposal.chainId) {
          throw new Error(`Неправильная сеть! Текущая сеть: ${chainId}, требуется: ${proposal.chainId}`);
        }
      } catch (networkError) {
        console.warn('⚠️ [DEBUG] Ошибка проверки сети (продолжаем):', networkError.message);
      }
      
      // Голосуем через готовую функцию из utils/dle-contract.js
      console.log('🗳️ Отправляем голосование через смарт-контракт...');
      const result = await voteForProposal(dleAddress.value, proposalId, support);
      
      console.log('✅ Голосование успешно отправлено:', result.txHash);
      alert(`Голосование успешно отправлено! Хеш транзакции: ${result.txHash}`);
      
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
      
      // Улучшенная обработка ошибок
      let errorMessage = error.message;
      
      if (error.message.includes('execution reverted')) {
        if (error.data === '0xe7005635') {
          errorMessage = 'Голосование отклонено смарт-контрактом. Возможные причины:\n' +
            '• Вы уже голосовали за это предложение\n' +
            '• У вас нет токенов для голосования\n' +
            '• Предложение не активно\n' +
            '• Время голосования истекло';
        } else if (error.data === '0xc7567e07') {
          errorMessage = 'Голосование отклонено смарт-контрактом. Возможные причины:\n' +
            '• Вы уже голосовали за это предложение\n' +
            '• У вас нет токенов для голосования\n' +
            '• Предложение не активно\n' +
            '• Время голосования истекло\n' +
            '• Неправильная сеть для голосования';
        } else {
          errorMessage = `Транзакция отклонена смарт-контрактом (код: ${error.data}). Проверьте условия голосования.`;
        }
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Транзакция отклонена пользователем';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Недостаточно средств для оплаты газа';
      }
      
      alert('Ошибка при голосовании: ' + errorMessage);
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
      const proposal = proposals.value.find(p => p.id === proposalId);
      if (!proposal) {
        throw new Error('Предложение не найдено');
      }
      
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
        throw new Error('Предложение уже выполнено. Повторное выполнение невозможно.');
      }
      
      if (proposal.canceled) {
        throw new Error('Предложение отменено. Выполнение невозможно.');
      }
      
      // Проверяем, что предложение готово к выполнению
      if (proposal.state !== 5) {
        const statusText = getProposalStatusText(proposal.state);
        throw new Error(`Предложение не готово к выполнению (статус: ${statusText}). Выполнение возможно только для предложений в статусе "Готово к выполнению".`);
      }
      
      // Исполняем предложение через готовую функцию из utils/dle-contract.js
      const result = await executeProposalUtil(dleAddress.value, proposalId);
      
      console.log('✅ Предложение успешно исполнено:', result.txHash);
      alert(`Предложение успешно исполнено! Хеш транзакции: ${result.txHash}`);
      
      // Принудительно обновляем состояние предложения в UI
      updateProposalState(proposalId, {
        executed: true,
        state: 1, // Выполнено
        canceled: false
      });
      
      await loadProposals(); // Перезагружаем данные
    } catch (error) {
      console.error('❌ Ошибка выполнения предложения:', error);
      
      // Улучшенная обработка ошибок
      let errorMessage = error.message;
      
      if (error.message.includes('execution reverted')) {
        errorMessage = 'Выполнение отклонено смарт-контрактом. Возможные причины:\n' +
          '• Предложение уже выполнено\n' +
          '• Предложение отменено\n' +
          '• Кворум не достигнут\n' +
          '• Предложение не активно';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Транзакция отклонена пользователем';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Недостаточно средств для оплаты газа';
      }
      
      alert('Ошибка при исполнении предложения: ' + errorMessage);
    } finally {
      isExecuting.value = false;
    }
  };

  const cancelProposal = async (proposalId, reason = 'Отменено пользователем') => {
    try {
      console.log('❌ [CANCEL] Отменяем предложение через DLE контракт:', { proposalId, reason, dleAddress: dleAddress.value });
      isCancelling.value = true;
      
      // Проверяем состояние предложения перед отменой
      console.log('🔍 [DEBUG] Проверяем состояние предложения для отмены...');
      const proposal = proposals.value.find(p => p.id === proposalId);
      if (!proposal) {
        throw new Error('Предложение не найдено');
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
        throw new Error('Предложение уже выполнено. Отмена невозможна.');
      }
      
      if (proposal.canceled) {
        throw new Error('Предложение уже отменено. Повторная отмена невозможна.');
      }
      
      // Проверяем, что пользователь является инициатором
      if (proposal.initiator?.toLowerCase() !== userAddress.value?.toLowerCase()) {
        throw new Error('Только инициатор предложения может его отменить.');
      }
      
      // Проверяем deadline (нужен запас 15 минут)
      const currentTime = Math.floor(Date.now() / 1000);
      if (proposal.deadline) {
        const timeRemaining = proposal.deadline - currentTime;
        if (timeRemaining <= 900) { // 15 минут запас
          throw new Error('Время для отмены истекло. Отмена возможна только за 15 минут до окончания голосования.');
        }
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Мультичейн отмена - последовательно во всех активных сетях
      if (proposal.chains && proposal.chains.length > 0) {
        // Фильтруем только активные цепочки (можно отменить)
        const activeChains = proposal.chains.filter(chain => 
          canCancel(chain) && !chain.canceled && !chain.executed
        );
        
        if (activeChains.length === 0) {
          throw new Error('Не найдено ни одной активной цепочки для отмены');
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
              throw new Error(`Не удалось переключиться на сеть ${chain.networkName} (${chain.chainId})`);
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
              chainProposalId = proposalId !== undefined && proposalId !== null ? Number(proposalId) : null;
            }
            
            if (chainProposalId === null || isNaN(chainProposalId)) {
              throw new Error(`Неверный ID предложения для цепочки ${chain.networkName} (${chain.chainId}). chain.id=${chain.id}, proposalId=${proposalId}`);
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
          alert(`Предложение отменено в ${successful.length} из ${activeChains.length} цепочек!\n${failed.length > 0 ? `Ошибки в ${failed.length} цепочках.` : ''}`);
        } else {
          throw new Error('Не удалось отменить предложение ни в одной цепочке');
        }
      } else {
        // Одиночное предложение (без мультичейн)
        const result = await cancelProposalUtil(dleAddress.value, proposalId, reason);
        console.log('✅ Предложение успешно отменено:', result.txHash);
        alert(`Предложение успешно отменено! Хеш транзакции: ${result.txHash}`);
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
        errorMessage = 'Отмена отклонена смарт-контрактом. Возможные причины:\n' +
          '• Предложение уже отменено\n' +
          '• Предложение уже выполнено\n' +
          '• Предложение не активно\n' +
          '• Недостаточно прав для отмены';
      } else if (error.message.includes('user rejected')) {
        errorMessage = 'Транзакция отклонена пользователем';
      } else if (error.message.includes('insufficient funds')) {
        errorMessage = 'Недостаточно средств для оплаты газа';
      }
      
      alert('Ошибка при отмене предложения: ' + errorMessage);
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
    switch (state) {
      case 0: return 'Активное';
      case 1: return 'Успешное';
      case 2: return 'Отклоненное';
      case 3: return 'Выполнено';
      case 4: return 'Отменено';
      case 5: return 'Готово к выполнению';
      default: return 'Неизвестно';
    }
  };

  const getQuorumPercentage = (proposal) => {
    // Получаем реальные данные из предложения
    const forVotes = Number(proposal.forVotes || 0);
    const againstVotes = Number(proposal.againstVotes || 0);
    const totalVotes = forVotes + againstVotes;
    
    // Используем реальный totalSupply из предложения или fallback
    const totalSupply = Number(proposal.totalSupply || 3e+24); // Fallback к 3M DLE
    
    console.log(`📊 [QUORUM] Предложение ${proposal.id}:`, {
      forVotes: forVotes,
      againstVotes: againstVotes,
      totalVotes: totalVotes,
      totalSupply: totalSupply,
      forVotesFormatted: `${(forVotes / 1e+18).toFixed(2)} DLE`,
      againstVotesFormatted: `${(againstVotes / 1e+18).toFixed(2)} DLE`,
      totalVotesFormatted: `${(totalVotes / 1e+18).toFixed(2)} DLE`,
      totalSupplyFormatted: `${(totalSupply / 1e+18).toFixed(2)} DLE`
    });
    
    const percentage = totalSupply > 0 ? (totalVotes / totalSupply) * 100 : 0;
    return percentage.toFixed(2);
  };

  const getRequiredQuorumPercentage = (proposal) => {
    // Получаем требуемый кворум из предложения
    const requiredQuorum = Number(proposal.quorumRequired || 0);
    
    // Используем реальный totalSupply из предложения или fallback
    const totalSupply = Number(proposal.totalSupply || 3e+24); // Fallback к 3M DLE
    
    console.log(`📊 [REQUIRED QUORUM] Предложение ${proposal.id}:`, {
      requiredQuorum: requiredQuorum,
      totalSupply: totalSupply,
      requiredQuorumFormatted: `${(requiredQuorum / 1e+18).toFixed(2)} DLE`,
      totalSupplyFormatted: `${(totalSupply / 1e+18).toFixed(2)} DLE`
    });
    
    const percentage = totalSupply > 0 ? (requiredQuorum / totalSupply) * 100 : 0;
    return percentage.toFixed(2);
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
    // Унифицируем state - всегда число
    const state = typeof proposal.state === 'string' 
      ? (proposal.state === 'active' ? 0 : NaN) 
      : Number(proposal.state);
    return state === 5; // ReadyForExecution - готово к выполнению
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
    const proposal = proposals.value.find(p => p.id === proposalId);
    if (proposal) {
      Object.assign(proposal, updates);
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
        throw new Error('Не найдено ни одной активной цепочки для голосования');
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
            throw new Error(`Не удалось переключиться на сеть ${chain.networkName} (${chain.chainId})`);
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
            throw new Error(`Неверный ID предложения для цепочки ${chain.networkName} (${chain.chainId}). chain.id=${chain.id}, proposal.id=${proposal.id}`);
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
                error: `Нет токенов DLE в сети ${chain.networkName} для голосования`
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
          const result = await voteForProposal(contractAddress, chainProposalId, support);
          
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
        throw new Error('Нет цепочек, готовых к выполнению');
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
            throw new Error(`Не удалось переключиться на сеть ${chain.networkName} (${chain.chainId})`);
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
            throw new Error(`Неверный ID предложения для цепочки ${chain.networkName} (${chain.chainId}). chain.id=${chain.id}, proposal.id=${proposal.id}`);
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
    // Можно исполнить только если кворум достигнут во ВСЕХ цепочках
    return proposal.chains.every(chain => canExecute(chain));
  };

  const getChainStatusClass = (chain) => {
    if (chain.executed) return 'executed';
    if (chain.state === 'active') return 'active';
    if (chain.deadline && chain.deadline < Date.now() / 1000) return 'expired';
    return 'inactive';
  };

  const getChainStatusText = (chain) => {
    if (chain.executed) return 'Исполнено';
    if (chain.state === 'active') return 'Активно';
    if (chain.deadline && chain.deadline < Date.now() / 1000) return 'Истекло';
    return 'Неактивно';
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