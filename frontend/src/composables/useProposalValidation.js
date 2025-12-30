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

    // Для мультичейн предложений проверяем chains
    // Если есть chains массив (даже с одним элементом), используем валидацию через chains
    const hasChains = proposal.chains && Array.isArray(proposal.chains) && proposal.chains.length > 0;
    
    if (hasChains) {
      // Для мультичейн предложений проверяем, что есть хотя бы одна валидная цепочка
      if (proposal.chains.length === 0) {
        errors.push('Мультичейн предложение не содержит цепочек');
      } else {
        // Проверяем каждую цепочку
        let validChainsCount = 0;
        proposal.chains.forEach((chain, chainIndex) => {
          const chainErrors = [];
          
          if (!chain.id && chain.id !== 0) {
            chainErrors.push(`Цепочка ${chainIndex}: отсутствует ID`);
          }
          
          if (!chain.chainId) {
            chainErrors.push(`Цепочка ${chainIndex}: отсутствует chainId`);
          } else if (!isValidChainId(chain.chainId)) {
            chainErrors.push(`Цепочка ${chainIndex}: неподдерживаемый chainId ${chain.chainId}`);
          }
          
          if (!chain.transactionHash) {
            chainErrors.push(`Цепочка ${chainIndex}: отсутствует хеш транзакции`);
          } else if (!isValidTransactionHash(chain.transactionHash)) {
            chainErrors.push(`Цепочка ${chainIndex}: неверный формат хеша транзакции`);
          }
          
          if (chain.state === undefined || chain.state === null) {
            chainErrors.push(`Цепочка ${chainIndex}: отсутствует статус`);
          }
          
          if (typeof chain.forVotes !== 'number' || chain.forVotes < 0) {
            chainErrors.push(`Цепочка ${chainIndex}: неверное значение голосов "за"`);
          }
          
          if (typeof chain.againstVotes !== 'number' || chain.againstVotes < 0) {
            chainErrors.push(`Цепочка ${chainIndex}: неверное значение голосов "против"`);
          }
          
          if (typeof chain.quorumRequired !== 'number' || chain.quorumRequired < 0) {
            chainErrors.push(`Цепочка ${chainIndex}: неверное значение требуемого кворума`);
          }
          
          if (chainErrors.length === 0) {
            validChainsCount++;
          } else {
            errors.push(...chainErrors);
          }
        });
        
        if (validChainsCount === 0) {
          errors.push('Мультичейн предложение не содержит валидных цепочек');
        }
      }
    } else {
      // Для одиночных предложений проверяем стандартные поля
      if (!proposal.transactionHash) {
        errors.push('Отсутствует хеш транзакции');
      } else if (!isValidTransactionHash(proposal.transactionHash)) {
        errors.push('Неверный формат хеша транзакции');
      }

      if (!proposal.chainId) {
        errors.push('Отсутствует chainId');
      } else if (!isValidChainId(proposal.chainId)) {
        errors.push('Неподдерживаемый chainId');
      }

      // Проверка числовых значений для одиночных предложений
      if (typeof proposal.forVotes !== 'number' || proposal.forVotes < 0) {
        errors.push('Неверное значение голосов "за"');
      }

      if (typeof proposal.againstVotes !== 'number' || proposal.againstVotes < 0) {
        errors.push('Неверное значение голосов "против"');
      }

      if (typeof proposal.quorumRequired !== 'number' || proposal.quorumRequired < 0) {
        errors.push('Неверное значение требуемого кворума');
      }
    }

    if (!proposal.initiator) {
      errors.push('Отсутствует инициатор предложения');
    } else if (!isValidAddress(proposal.initiator)) {
      errors.push('Неверный формат адреса инициатора');
    }

    if (proposal.state === undefined || proposal.state === null) {
      errors.push('Отсутствует статус предложения');
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
          description: proposal.description,
          hasChains: !!(proposal.chains && Array.isArray(proposal.chains)),
          chainsCount: proposal.chains?.length || 0,
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
    
    // Логируем ошибки для отладки
    if (allErrors.length > 0) {
      console.log(`[Proposal Validation] Детали ошибок:`, allErrors);
      allErrors.forEach((error, idx) => {
        console.log(`[Proposal Validation] Предложение ${idx + 1} (ID: ${error.proposalId}, описание: "${error.description || 'N/A'}"):`, {
          hasChains: error.hasChains,
          chainsCount: error.chainsCount,
          errors: error.errors
        });
      });
    }

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
  // Важно: после группировки мультичейн-предложений хеши транзакций могут жить только в proposal.chains[].transactionHash,
  // поэтому проверяем и верхний уровень, и цепочки.
  const isRealProposal = (proposal) => {
    const isRealTxHash = (txHash) => {
      if (!txHash || typeof txHash !== 'string') return false;

      // Проверяем, что хеш имеет правильный формат
      if (!isValidTransactionHash(txHash)) return false;

      const lower = txHash.toLowerCase();

      // Проверяем, что это не тестовые/фейковые хеши
      const fakeHashes = [
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      ];

      if (fakeHashes.includes(lower)) return false;

      return true;
    };

    // 1) Одиночные предложения (или если бэкенд положил хеш на верхний уровень)
    if (isRealTxHash(proposal?.transactionHash)) return true;

    // 2) Сгруппированные предложения: проверяем любую цепочку
    if (proposal?.chains && Array.isArray(proposal.chains) && proposal.chains.length > 0) {
      return proposal.chains.some(chain => isRealTxHash(chain?.transactionHash));
    }

    return false;
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
