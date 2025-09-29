import { ref, computed } from 'vue';
import { getProposals } from '@/services/proposalsService';
import { ethers } from 'ethers';
import { useProposalValidation } from './useProposalValidation';
import { voteForProposal, executeProposal as executeProposalUtil, cancelProposal as cancelProposalUtil, checkTokenBalance } from '@/utils/dle-contract';

// Функция checkVoteStatus удалена - в контракте DLE нет публичной функции hasVoted
// Функция checkTokenBalance перенесена в useDleContract.js

// Функция sendTransactionToWallet удалена - теперь используется прямое взаимодействие с контрактом

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
    if (!dleAddress.value) {
      console.warn('Адрес DLE не найден');
      return;
    }
    
    try {
      isLoading.value = true;
      const response = await getProposals(dleAddress.value);
      
      if (response.success) {
        const rawProposals = response.data.proposals || [];
        
        console.log(`[Proposals] Загружено предложений: ${rawProposals.length}`);
        console.log(`[Proposals] Полные данные из блокчейна:`, rawProposals);
        
        // Детальная информация о каждом предложении
        rawProposals.forEach((proposal, index) => {
          console.log(`[Proposals] Предложение ${index}:`, {
            id: proposal.id,
            description: proposal.description,
            state: proposal.state,
            forVotes: proposal.forVotes,
            againstVotes: proposal.againstVotes,
            quorumRequired: proposal.quorumRequired,
            quorumReached: proposal.quorumReached,
            executed: proposal.executed,
            canceled: proposal.canceled,
            initiator: proposal.initiator,
            chainId: proposal.chainId,
            transactionHash: proposal.transactionHash
          });
        });
        
        // Применяем валидацию предложений
        const validationResult = validateProposals(rawProposals);
        
        // Фильтруем только реальные предложения
        const realProposals = filterRealProposals(validationResult.validProposals);
        
        // Фильтруем только активные предложения (исключаем выполненные и отмененные)
        const activeProposals = filterActiveProposals(realProposals);
        
        console.log(`[Proposals] Валидных предложений: ${validationResult.validCount}`);
        console.log(`[Proposals] Реальных предложений: ${realProposals.length}`);
        console.log(`[Proposals] Активных предложений: ${activeProposals.length}`);
        
        if (validationResult.errorCount > 0) {
          console.warn(`[Proposals] Найдено ${validationResult.errorCount} предложений с ошибками валидации`);
        }
        
        proposals.value = activeProposals;
        filterProposals();
      }
    } catch (error) {
      console.error('Ошибка загрузки предложений:', error);
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
        deadline: proposal.deadline
      });
      
      // Проверяем, что предложение можно отменить
      if (proposal.executed) {
        throw new Error('Предложение уже выполнено. Отмена невозможна.');
      }
      
      if (proposal.canceled) {
        throw new Error('Предложение уже отменено. Повторная отмена невозможна.');
      }
      
      // Проверяем, что предложение активно (Pending)
      if (proposal.state !== 0) {
        const statusText = getProposalStatusText(proposal.state);
        throw new Error(`Предложение не активно (статус: ${statusText}). Отмена возможна только для активных предложений.`);
      }
      
      // Проверяем, что пользователь является инициатором
      if (proposal.initiator !== userAddress.value) {
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
      
      // Отменяем предложение через готовую функцию из utils/dle-contract.js
      const result = await cancelProposalUtil(dleAddress.value, proposalId, reason);
      
      console.log('✅ Предложение успешно отменено:', result.txHash);
      alert(`Предложение успешно отменено! Хеш транзакции: ${result.txHash}`);
      
      // Принудительно обновляем состояние предложения в UI
      updateProposalState(proposalId, {
        canceled: true,
        state: 2, // Отменено
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
    return proposal.state === 0; // Pending - только активные предложения
  };

  const canExecute = (proposal) => {
    return proposal.state === 5; // ReadyForExecution - готово к выполнению
  };

  const canCancel = (proposal) => {
    // Можно отменить только активные предложения (Pending)
    return proposal.state === 0 && 
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

  return {
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
    executeProposal,
    cancelProposal,
    getProposalStatusClass,
    getProposalStatusText,
    getQuorumPercentage,
    getRequiredQuorumPercentage,
    canVote,
    canExecute,
    canCancel,
    updateProposalState,
    // Валидация
    validationStats,
    isValidating
  };
}