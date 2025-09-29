/**
 * Composable для валидации предложений DLE
 * Проверяет реальность предложений по хешам транзакций
 */

import { ref, computed } from 'vue';

export function useProposalValidation() {
  const validatedProposals = ref([]);
  const validationErrors = ref([]);
  const isValidating = ref(false);

  // Проверка формата хеша транзакции
  const isValidTransactionHash = (hash) => {
    if (!hash) return false;
    return /^0x[a-fA-F0-9]{64}$/.test(hash);
  };

  // Проверка формата адреса
  const isValidAddress = (address) => {
    if (!address) return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  // Проверка chainId
  const isValidChainId = (chainId) => {
    const validChainIds = [1, 11155111, 17000, 421614, 84532, 8453]; // Mainnet, Sepolia, Holesky, Arbitrum Sepolia, Base Sepolia, Base
    return validChainIds.includes(Number(chainId));
  };

  // Валидация предложения
  const validateProposal = (proposal) => {
    const errors = [];

    // Проверка обязательных полей
    if (!proposal.id && proposal.id !== 0) {
      errors.push('Отсутствует ID предложения');
    }

    if (!proposal.description || proposal.description.trim() === '') {
      errors.push('Отсутствует описание предложения');
    }

    if (!proposal.transactionHash) {
      errors.push('Отсутствует хеш транзакции');
    } else if (!isValidTransactionHash(proposal.transactionHash)) {
      errors.push('Неверный формат хеша транзакции');
    }

    if (!proposal.initiator) {
      errors.push('Отсутствует инициатор предложения');
    } else if (!isValidAddress(proposal.initiator)) {
      errors.push('Неверный формат адреса инициатора');
    }

    if (!proposal.chainId) {
      errors.push('Отсутствует chainId');
    } else if (!isValidChainId(proposal.chainId)) {
      errors.push('Неподдерживаемый chainId');
    }

    if (proposal.state === undefined || proposal.state === null) {
      errors.push('Отсутствует статус предложения');
    }

    // Проверка числовых значений
    if (typeof proposal.forVotes !== 'number' || proposal.forVotes < 0) {
      errors.push('Неверное значение голосов "за"');
    }

    if (typeof proposal.againstVotes !== 'number' || proposal.againstVotes < 0) {
      errors.push('Неверное значение голосов "против"');
    }

    if (typeof proposal.quorumRequired !== 'number' || proposal.quorumRequired < 0) {
      errors.push('Неверное значение требуемого кворума');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Валидация массива предложений
  const validateProposals = (proposals) => {
    isValidating.value = true;
    validationErrors.value = [];
    validatedProposals.value = [];

    const validProposals = [];
    const allErrors = [];

    proposals.forEach((proposal, index) => {
      const validation = validateProposal(proposal);
      
      if (validation.isValid) {
        validProposals.push(proposal);
      } else {
        allErrors.push({
          proposalIndex: index,
          proposalId: proposal.id,
          errors: validation.errors
        });
      }
    });

    validatedProposals.value = validProposals;
    validationErrors.value = allErrors;
    isValidating.value = false;

    console.log(`[Proposal Validation] Проверено предложений: ${proposals.length}`);
    console.log(`[Proposal Validation] Валидных: ${validProposals.length}`);
    console.log(`[Proposal Validation] С ошибками: ${allErrors.length}`);

    return {
      validProposals,
      errors: allErrors,
      totalCount: proposals.length,
      validCount: validProposals.length,
      errorCount: allErrors.length
    };
  };

  // Получение статистики валидации
  const validationStats = computed(() => {
    const total = validatedProposals.value.length + validationErrors.value.length;
    const valid = validatedProposals.value.length;
    const invalid = validationErrors.value.length;
    
    return {
      total,
      valid,
      invalid,
      validPercentage: total > 0 ? Math.round((valid / total) * 100) : 0,
      invalidPercentage: total > 0 ? Math.round((invalid / total) * 100) : 0
    };
  });

  // Проверка, является ли предложение реальным (на основе хеша транзакции)
  const isRealProposal = (proposal) => {
    if (!proposal.transactionHash) return false;
    
    // Проверяем, что хеш имеет правильный формат
    if (!isValidTransactionHash(proposal.transactionHash)) return false;
    
    // Проверяем, что это не тестовые/фейковые хеши
    const fakeHashes = [
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    ];
    
    if (fakeHashes.includes(proposal.transactionHash.toLowerCase())) return false;
    
    // Проверяем, что хеш не начинается с нулей (подозрительно)
    if (proposal.transactionHash.startsWith('0x0000')) return false;
    
    return true;
  };

  // Фильтрация только реальных предложений
  const filterRealProposals = (proposals) => {
    return proposals.filter(proposal => isRealProposal(proposal));
  };

  // Фильтрация активных предложений (исключает выполненные и отмененные)
  const filterActiveProposals = (proposals) => {
    return proposals.filter(proposal => {
      // Исключаем выполненные и отмененные предложения
      if (proposal.executed || proposal.canceled) {
        console.log(`🚫 [FILTER] Исключаем предложение ${proposal.id}: executed=${proposal.executed}, canceled=${proposal.canceled}`);
        return false;
      }
      
      // Исключаем предложения с истекшим deadline
      if (proposal.deadline) {
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime > proposal.deadline) {
          console.log(`⏰ [FILTER] Исключаем предложение ${proposal.id}: deadline истек`);
          return false;
        }
      }
      
      return true;
    });
  };

  return {
    // Данные
    validatedProposals,
    validationErrors,
    isValidating,
    validationStats,
    
    // Методы
    validateProposal,
    validateProposals,
    isRealProposal,
    filterRealProposals,
    filterActiveProposals,
    
    // Вспомогательные функции
    isValidTransactionHash,
    isValidAddress,
    isValidChainId
  };
}
