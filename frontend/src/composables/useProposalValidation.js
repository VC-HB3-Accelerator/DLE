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

/**
 * Composable для валидации предложений DLE
 * Проверяет реальность предложений по хешам транзакций
 */

import { ref, computed } from 'vue';
import { i18n } from '@/locales/index.js';

const t = (key, params) => i18n.global.t(key, params);

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

  // Проверка chainId: любая положительная сеть из RPC книги, без хардкода Ethereum-only.
  const isValidChainId = (chainId) => {
    const n = Number(chainId);
    return Number.isFinite(n) && n > 0;
  };

  // Бэкенд отдаёт forVotes/againstVotes/quorum как string (wei), не number.
  const isNonNegativeNumeric = (value) => {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
    try {
      const raw = typeof value === 'bigint' ? value : String(value).split('.')[0];
      return BigInt(raw) >= 0n;
    } catch {
      return false;
    }
  };

  // Валидация предложения
  const validateProposal = (proposal) => {
    const errors = [];

    // Проверка обязательных полей
    if (!proposal.id && proposal.id !== 0) {
      errors.push(t('proposalValidation.missingProposalId'));
    }

    if (!proposal.description || proposal.description.trim() === '') {
      errors.push(t('proposalValidation.missingDescription'));
    }

    // Для мультичейн предложений проверяем chains
    // Если есть chains массив (даже с одним элементом), используем валидацию через chains
    const hasChains = proposal.chains && Array.isArray(proposal.chains) && proposal.chains.length > 0;
    
    if (hasChains) {
      // Для мультичейн предложений проверяем, что есть хотя бы одна валидная цепочка
      if (proposal.chains.length === 0) {
        errors.push(t('proposalValidation.multichainNoChains'));
      } else {
        // Проверяем каждую цепочку
        let validChainsCount = 0;
        proposal.chains.forEach((chain, chainIndex) => {
          const chainErrors = [];
          
          if (!chain.id && chain.id !== 0) {
            chainErrors.push(t('proposalValidation.chainMissingId', { index: chainIndex }));
          }
          
          if (!chain.chainId) {
            chainErrors.push(t('proposalValidation.chainMissingChainId', { index: chainIndex }));
          } else if (!isValidChainId(chain.chainId)) {
            chainErrors.push(t('proposalValidation.chainUnsupportedChainId', { index: chainIndex, chainId: chain.chainId }));
          }

          if (chain.transactionHash && !isValidTransactionHash(chain.transactionHash)) {
            chainErrors.push(t('proposalValidation.chainInvalidTxHash', { index: chainIndex }));
          }
          
          if (chain.state === undefined || chain.state === null) {
            chainErrors.push(t('proposalValidation.chainMissingStatus', { index: chainIndex }));
          }
          
          if (!isNonNegativeNumeric(chain.forVotes)) {
            chainErrors.push(t('proposalValidation.chainInvalidForVotes', { index: chainIndex }));
          }
          
          if (!isNonNegativeNumeric(chain.againstVotes)) {
            chainErrors.push(t('proposalValidation.chainInvalidAgainstVotes', { index: chainIndex }));
          }
          
          if (!isNonNegativeNumeric(chain.quorumRequired)) {
            chainErrors.push(t('proposalValidation.chainInvalidQuorum', { index: chainIndex }));
          }
          
          if (chainErrors.length === 0) {
            validChainsCount++;
          } else {
            errors.push(...chainErrors);
          }
        });
        
        if (validChainsCount === 0) {
          errors.push(t('proposalValidation.multichainNoValidChains'));
        }
      }
    } else {
      // Для одиночных предложений проверяем стандартные поля
      if (proposal.transactionHash && !isValidTransactionHash(proposal.transactionHash)) {
        errors.push(t('proposalValidation.invalidTxHash'));
      }

      if (!proposal.chainId) {
        errors.push(t('proposalValidation.missingChainId'));
      } else if (!isValidChainId(proposal.chainId)) {
        errors.push(t('proposalValidation.unsupportedChainId'));
      }

      if (!isNonNegativeNumeric(proposal.forVotes)) {
        errors.push(t('proposalValidation.invalidForVotes'));
      }

      if (!isNonNegativeNumeric(proposal.againstVotes)) {
        errors.push(t('proposalValidation.invalidAgainstVotes'));
      }

      if (!isNonNegativeNumeric(proposal.quorumRequired)) {
        errors.push(t('proposalValidation.invalidQuorum'));
      }
    }

    if (!proposal.initiator) {
      errors.push(t('proposalValidation.missingInitiator'));
    } else if (!isValidAddress(proposal.initiator)) {
      errors.push(t('proposalValidation.invalidInitiatorAddress'));
    }

    if (proposal.state === undefined || proposal.state === null) {
      errors.push(t('proposalValidation.missingStatus'));
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

  // Реальное предложение: слот в книге (getProposalSummary). Хеш tx не обязателен —
  // список читается по индексу, логи RPC часто недоступны.
  const isRealProposal = (proposal) => {
    const isRealTxHash = (txHash) => {
      if (!txHash || typeof txHash !== 'string') return false;
      if (!isValidTransactionHash(txHash)) return false;
      const lower = txHash.toLowerCase();
      const fakeHashes = [
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      ];
      return !fakeHashes.includes(lower);
    };

    if (isRealTxHash(proposal?.transactionHash)) return true;
    if (proposal?.chains && Array.isArray(proposal.chains) && proposal.chains.length > 0) {
      if (proposal.chains.some((chain) => isRealTxHash(chain?.transactionHash))) return true;
      return proposal.chains.some(
        (chain) =>
          (chain?.id === 0 || Number(chain?.id) > 0 || chain?.id) &&
          Number(chain?.chainId) > 0 &&
          Boolean(chain?.initiator || proposal?.initiator)
      );
    }

    const hasId = proposal?.id === 0 || Number(proposal?.id) >= 0;
    return Boolean(hasId && proposal?.initiator && Number(proposal?.chainId) > 0);
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
