<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<!--
  DLE Proposals View
  Компонент для отображения предложений DLE контракта
  
  Author: HB3 Accelerator
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/HB3-ACCELERATOR
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="proposals-page page-with-close">
      <PageCloseButton :on-navigate="goBack" />
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleAddress }}
        </div>
      </div>

      <!-- Уведомление о необходимости авторизации -->
      <div v-if="!isAuthenticated" class="auth-notice">
        <div class="alert alert-info">
          <strong>{{ t('smartcontracts.proposals.authNoticeTitle') }}</strong> {{ t('smartcontracts.proposals.authNoticeMessage') }}
        </div>
      </div>

      <!-- Основной контент -->
      <div v-else class="proposals-content">

        <!-- Фильтры и поиск -->
        <div class="proposals-filters">
          <div class="filter-group">
            <label>{{ t('smartcontracts.proposals.statusLabel') }}</label>
            <select v-model="statusFilter" @change="filterProposals">
              <option value="">{{ t('common.all') }}</option>
              <option value="active">{{ t('smartcontracts.proposals.filter.active') }}</option>
              <option value="succeeded">{{ t('smartcontracts.proposals.filter.succeeded') }}</option>
              <option value="defeated">{{ t('smartcontracts.proposals.filter.defeated') }}</option>
              <option value="executed">{{ t('smartcontracts.proposals.filter.executed') }}</option>
              <option value="cancelled">{{ t('smartcontracts.proposals.filter.cancelled') }}</option>
              <option value="ready">{{ t('smartcontracts.proposals.filter.ready') }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>{{ t('smartcontracts.proposals.searchLabel') }}</label>
            <input
              v-model="searchQuery"
              @input="filterProposals"
              type="text"
              :placeholder="t('smartcontracts.proposals.searchPlaceholder')"
            />
          </div>
        </div>

        <!-- Состояние загрузки -->
        <div v-if="isLoading" class="loading-state">
          <div class="spinner"></div>
          <p>{{ t('smartcontracts.proposals.loading') }}</p>
        </div>

        <!-- Пустое состояние -->
        <div v-else-if="filteredProposals.length === 0" class="empty-state">
          <h3>{{ t('smartcontracts.proposals.emptyTitle') }}</h3>
          <p>{{ t('smartcontracts.proposals.emptyDescription') }}</p>
          <button @click="loadProposals" class="btn-action">{{ t('common.reload') }}</button>
        </div>

        <!-- Список предложений -->
        <div v-else class="proposals-grid">
          <div v-for="proposal in filteredProposals" :key="proposal.uniqueId" class="proposal-card">
            <div class="proposal-header">
              <div class="proposal-id">{{ t('smartcontracts.proposals.proposalNumber', { number: proposal.id + 1 }) }}</div>
              <div class="proposal-status" :class="getProposalStatusClass(proposal.state)">
                {{ getProposalStatusTextI18n(proposal.state) }}
              </div>
            </div>
            
            <div class="proposal-title">{{ proposal.description }}</div>
            
            <div class="proposal-meta">
              <div class="meta-item">
                <span>{{ t('smartcontracts.proposals.initiator') }} {{ proposal.initiator }}</span>
              </div>
              <div class="meta-item">
                <span>ID: {{ proposal.uniqueId }}</span>
              </div>
              <!-- Мульти-чейн информация -->
              <div v-if="proposal.chains && proposal.chains.length > 1" class="meta-item multichain-info">
                <span>{{ t('smartcontracts.proposals.chainsCount', { count: proposal.chains.length, names: proposal.chains.map(c => getChainDisplayName(c)).join(', ') }) }}</span>
              </div>
              <div v-else class="meta-item">
                <span>{{ t('smartcontracts.proposals.chainLabel') }} {{ proposal.chainId ? getChainDisplayName(proposal.chains?.[0] || { chainId: proposal.chainId }) : 'N/A' }}</span>
              </div>
              <div class="meta-item">
                <span>{{ t('smartcontracts.proposals.hashLabel') }} {{ ((proposal.transactionHash || proposal.chains?.[0]?.transactionHash || '')).substring(0, 10) }}...</span>
              </div>
            </div>
            
            <!-- Детали по цепочкам для мульти-чейн предложений -->
            <div v-if="proposal.chains && proposal.chains.length > 1" class="chains-details">
              <div class="chains-header">
                <strong>{{ t('smartcontracts.proposals.statusByChains') }}</strong>
              </div>
              <div class="chains-list">
                <div 
                  v-for="chain in proposal.chains" 
                  :key="chain.chainId" 
                  class="chain-item"
                  :class="{ 
                    'chain-active': Number(chain.state) === 0,
                    'chain-executed': chain.executed,
                    'chain-canceled': chain.canceled
                  }"
                >
                  <div class="chain-main-info">
                    <span class="chain-name">{{ getChainDisplayName(chain) }}</span>
                    <span class="chain-status">
                      <span v-if="chain.executed">{{ t('smartcontracts.proposals.chainStatus.executed') }}</span>
                      <span v-else-if="chain.canceled">{{ t('smartcontracts.proposals.chainStatus.cancelled') }}</span>
                      <span v-else-if="chain.deadline && chain.deadline < Date.now() / 1000">{{ t('smartcontracts.proposals.chainStatus.expired') }}</span>
                      <span v-else-if="Number(chain.state) === 5">{{ t('smartcontracts.proposals.chainStatus.ready') }}</span>
                      <span v-else-if="Number(chain.state) === 0">{{ t('smartcontracts.proposals.chainStatus.active') }}</span>
                      <span v-else>{{ chain.state }}</span>
                    </span>
                  </div>
                  <div class="chain-details-info">
                    <div class="chain-detail-item">
                      <span class="detail-label">{{ t('smartcontracts.proposals.proposalIdLabel') }}</span>
                      <span class="detail-value">#{{ chain.id !== undefined && chain.id !== null ? chain.id : 'N/A' }}</span>
                    </div>
                    <div class="chain-detail-item">
                      <span class="detail-label">{{ t('smartcontracts.proposals.votesLabel') }}</span>
                      <span class="detail-value">
                        {{ t('common.forVote') }} {{ chain.forVotes ? (Number(chain.forVotes) / 1e18).toFixed(2) : '0.00' }} DLE |
                        {{ t('common.againstVote') }} {{ chain.againstVotes ? (Number(chain.againstVotes) / 1e18).toFixed(2) : '0.00' }} DLE
                      </span>
                    </div>
                    <div class="chain-detail-item">
                      <span class="detail-label">{{ t('smartcontracts.proposals.quorumLabel') }}</span>
                      <span class="detail-value" :class="{ 'quorum-reached': chain.forVotes && chain.quorumRequired && Number(chain.forVotes) >= Number(chain.quorumRequired), 'quorum-not-reached': chain.forVotes && chain.quorumRequired && Number(chain.forVotes) < Number(chain.quorumRequired) }">
                        {{ chain.forVotes && chain.quorumRequired ? 
                          (Number(chain.forVotes) >= Number(chain.quorumRequired) ? t('smartcontracts.proposals.quorumReached') : t('smartcontracts.proposals.quorumNotReached')) : 
                          'N/A' }}
                        {{ t('smartcontracts.proposals.quorumRequired', { amount: chain.quorumRequired ? (Number(chain.quorumRequired) / 1e18).toFixed(2) : '0.00' }) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Для одиночных предложений тоже показываем детали -->
            <div v-else-if="proposal.chains && proposal.chains.length === 1" class="chains-details">
              <div class="chains-header">
                <strong>{{ t('smartcontracts.proposals.chainDetails') }}</strong>
              </div>
              <div class="chains-list">
                <div 
                  v-for="chain in proposal.chains" 
                  :key="chain.chainId" 
                  class="chain-item"
                  :class="{ 
                    'chain-active': Number(chain.state) === 0,
                    'chain-executed': chain.executed,
                    'chain-canceled': chain.canceled
                  }"
                >
                  <div class="chain-main-info">
                    <span class="chain-name">{{ getChainDisplayName(chain) }}</span>
                    <span class="chain-status">
                      <span v-if="chain.executed">{{ t('smartcontracts.proposals.chainStatus.executed') }}</span>
                      <span v-else-if="chain.canceled">{{ t('smartcontracts.proposals.chainStatus.cancelled') }}</span>
                      <span v-else-if="chain.state === 5">{{ t('smartcontracts.proposals.chainStatus.ready') }}</span>
                      <span v-else-if="Number(chain.state) === 0">{{ t('smartcontracts.proposals.chainStatus.active') }}</span>
                      <span v-else>{{ chain.state }}</span>
                    </span>
                  </div>
                  <div class="chain-details-info">
                    <div class="chain-detail-item">
                      <span class="detail-label">{{ t('smartcontracts.proposals.proposalIdLabel') }}</span>
                      <span class="detail-value">#{{ chain.id !== undefined && chain.id !== null ? chain.id : proposal.id }}</span>
                    </div>
                    <div class="chain-detail-item">
                      <span class="detail-label">{{ t('smartcontracts.proposals.votesLabel') }}</span>
                      <span class="detail-value">
                        {{ t('common.forVote') }} {{ chain.forVotes ? (Number(chain.forVotes) / 1e18).toFixed(2) : '0.00' }} DLE |
                        {{ t('common.againstVote') }} {{ chain.againstVotes ? (Number(chain.againstVotes) / 1e18).toFixed(2) : '0.00' }} DLE
                      </span>
                    </div>
                    <div class="chain-detail-item">
                      <span class="detail-label">{{ t('smartcontracts.proposals.quorumLabel') }}</span>
                      <span class="detail-value" :class="{ 'quorum-reached': chain.forVotes && chain.quorumRequired && Number(chain.forVotes) >= Number(chain.quorumRequired), 'quorum-not-reached': chain.forVotes && chain.quorumRequired && Number(chain.forVotes) < Number(chain.quorumRequired) }">
                        {{ chain.forVotes && chain.quorumRequired ? 
                          (Number(chain.forVotes) >= Number(chain.quorumRequired) ? t('smartcontracts.proposals.quorumReached') : t('smartcontracts.proposals.quorumNotReached')) : 
                          'N/A' }}
                        {{ t('smartcontracts.proposals.quorumRequired', { amount: chain.quorumRequired ? (Number(chain.quorumRequired) / 1e18).toFixed(2) : '0.00' }) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="proposal-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: getQuorumPercentage(proposal) + '%' }"></div>
              </div>
              <div class="progress-text">
                {{ t('smartcontracts.proposals.quorumProgress', { current: getQuorumPercentage(proposal), required: getRequiredQuorumPercentage(proposal) }) }}
              </div>
              <div class="votes-info">
                <span class="vote-count">{{ t('smartcontracts.proposals.votesFor', { count: proposal.forVotes || 0 }) }}</span>
                <span class="vote-count">{{ t('smartcontracts.proposals.votesAgainst', { count: proposal.againstVotes || 0 }) }}</span>
                <span class="vote-count">{{ t('smartcontracts.proposals.votesTotal', { count: (Number(proposal.forVotes || 0) + Number(proposal.againstVotes || 0)) }) }}</span>
              </div>
            </div>
            
            <div class="proposal-actions">
              <button 
                v-if="proposal.chains && proposal.chains.length > 1 ? canVoteMultichain(proposal) : canVote(proposal)" 
                @click="voteOnProposal(proposal.id, true)" 
                class="btn-action"
                :disabled="isVoting"
              >
                {{ isVoting ? t('common.voting') : t('common.forVote') }}
              </button>
              <button 
                v-if="proposal.chains && proposal.chains.length > 1 ? canVoteMultichain(proposal) : canVote(proposal)" 
                @click="voteOnProposal(proposal.id, false)" 
                class="btn-action"
                :disabled="isVoting"
              >
                {{ isVoting ? t('common.voting') : t('common.againstVote') }}
              </button>
              <button 
                v-if="proposal.chains && proposal.chains.length > 1 ? canExecuteMultichain(proposal) : canExecute(proposal)" 
                @click="executeProposal(proposal.id)" 
                class="btn-action"
                :disabled="isExecuting"
              >
                {{ isExecuting ? t('common.executing') : t('common.execute') }}
              </button>
              <button 
                v-if="canCancel(proposal)" 
                @click="cancelProposal(proposal.id)" 
                class="btn-action"
                :disabled="isCancelling"
              >
                {{ isCancelling ? t('common.cancelling') : t('common.cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthContext } from '@/composables/useAuth';
import { useProposals } from '@/composables/useProposals';
import BaseLayout from '@/components/BaseLayout.vue';

export default {
  name: 'DleProposalsView',
  components: {
    BaseLayout
  },
  props: {
    isAuthenticated: {
      type: Boolean,
      default: false
    },
    identities: {
      type: Array,
      default: () => []
    },
    tokenBalances: {
      type: Array,
      default: () => []
    },
    isLoadingTokens: {
      type: Boolean,
      default: false
    }
  },
  emits: ['auth-action-completed'],
  setup(props) {
    const router = useRouter();
    const route = useRoute();
    const { address } = useAuthContext();
    const { t } = useI18n();

    const dleAddress = computed(() => {
      return route.query.address;
    });

    const {
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
      getQuorumPercentage,
      getRequiredQuorumPercentage,
      canVote,
      canVoteMultichain,
      canExecute,
      canExecuteMultichain,
      canCancel
    } = useProposals(dleAddress, computed(() => props.isAuthenticated), address);

    const proposalStatusKeys = {
      0: 'smartcontracts.proposals.status.active',
      1: 'smartcontracts.proposals.status.succeeded',
      2: 'smartcontracts.proposals.status.defeated',
      3: 'smartcontracts.proposals.status.executed',
      4: 'smartcontracts.proposals.status.cancelled',
      5: 'smartcontracts.proposals.status.ready'
    };

    const getProposalStatusTextI18n = (state) => {
      return t(proposalStatusKeys[state] || 'common.status.unknown');
    };

    const getChainDisplayName = (chain) => {
      if (!chain) return 'N/A';
      return chain.networkName || t('common.chainFallback', { chainId: chain.chainId });
    };

    const goBack = () => {
      router.push('/management/dle-blocks');
    };

    onMounted(() => {
      if (props.isAuthenticated && dleAddress.value) {
        loadProposals();
      }
    });

    watch(() => props.isAuthenticated, (newValue) => {
      if (newValue && dleAddress.value) {
        loadProposals();
      }
    });

    watch(dleAddress, (newAddress) => {
      if (newAddress && props.isAuthenticated) {
        loadProposals();
      }
    });

    return {
      t,
      proposals,
      filteredProposals,
      isLoading,
      isVoting,
      isExecuting,
      isCancelling,
      statusFilter,
      searchQuery,
      dleAddress,
      isAuthenticated: props.isAuthenticated,
      loadProposals,
      filterProposals,
      voteOnProposal,
      executeProposal,
      cancelProposal,
      goBack,
      getProposalStatusClass,
      getProposalStatusTextI18n,
      getChainDisplayName,
      getQuorumPercentage,
      getRequiredQuorumPercentage,
      canVote,
      canVoteMultichain,
      canExecute,
      canExecuteMultichain,
      canCancel
    };
  }
};
</script>

<style scoped>
.proposals-page {
  position: relative;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-grey-light, #e9ecef);
  margin-top: 20px;
  margin-bottom: 20px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.close-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  background-color: var(--color-white);
  color: var(--color-dark, #333);
  border: 1px solid var(--color-grey, #ced4da);
  border-radius: var(--radius-lg);
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: background-color 0.2s, border-color 0.2s;
}

.close-btn:hover {
  background-color: var(--color-grey-light, #e9ecef);
  border-color: var(--color-dark, #333);
}

.auth-notice {
  margin-bottom: 16px;
}

.alert {
  padding: 14px 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-grey-light, #e4e7ed);
  background: var(--color-light, #f8f9fa);
  color: var(--color-dark, #333);
}

.alert-info {
  background: var(--color-light, #f8f9fa);
  border-color: var(--color-grey-light, #e4e7ed);
  color: var(--color-dark, #333);
}

.proposals-content {
  background: transparent;
  padding: 0;
  border: none;
}

.proposals-filters {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-grey-light, #e9ecef);
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-group label {
  font-weight: 600;
  color: var(--color-dark, #333);
  font-size: 0.9rem;
}

.filter-group select,
.filter-group input {
  padding: 10px 12px;
  border: 1px solid var(--color-grey-light, #e4e7ed);
  border-radius: var(--radius-lg);
  font-size: 0.95rem;
  background: var(--color-white);
  color: var(--color-dark, #333);
}

.filter-group input {
  min-width: 250px;
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: var(--color-grey-dark, #666);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--color-grey-light, #e9ecef);
  border-top: 2px solid var(--color-dark, #333);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: var(--color-light, #f8f9fa);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-grey, #ced4da);
}

.empty-state h3 {
  color: var(--color-dark, #333);
  margin: 0 0 6px;
  font-size: 1.1rem;
}

.empty-state p {
  color: var(--color-grey-dark, #666);
  margin: 0 0 16px;
}

.proposals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 350px), 1fr));
  gap: 14px;
  width: 100%;
  min-width: 0;
}

.proposal-card {
  background: var(--color-white);
  border-radius: var(--radius-md);
  padding: 18px;
  border: 1px solid var(--color-grey-light, #e9ecef);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.proposal-id {
  font-weight: 600;
  color: var(--color-dark, #333);
  font-size: 0.95rem;
}

.proposal-status {
  padding: 4px 10px;
  border-radius: var(--radius-lg);
  font-size: 0.8rem;
  font-weight: 500;
  background: var(--color-light, #f8f9fa);
  color: var(--color-dark, #333);
  border: 1px solid var(--color-grey-light, #e4e7ed);
  white-space: nowrap;
}

.status-active,
.status-succeeded,
.status-defeated,
.status-executed,
.status-cancelled,
.status-ready {
  background: var(--color-light, #f8f9fa);
  color: var(--color-dark, #333);
  border: 1px solid var(--color-grey-light, #e4e7ed);
}

.proposal-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-dark, #333);
  margin-bottom: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}

.proposal-meta {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.meta-item {
  color: var(--color-grey-dark, #666);
  font-size: 0.875rem;
}

.multichain-info {
  background: var(--color-light, #f8f9fa);
  color: var(--color-dark, #333);
  padding: 4px 10px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-grey-light, #e4e7ed);
  font-weight: 500;
}

.proposal-progress {
  margin-bottom: 14px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--color-grey-light, #e9ecef);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-fill {
  height: 100%;
  background: var(--color-dark, #555);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--color-grey-dark, #666);
  font-weight: 500;
}

.votes-info {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.vote-count {
  font-size: 0.8rem;
  color: var(--color-dark, #333);
  background: var(--color-light, #f8f9fa);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-grey-light, #e9ecef);
}

.proposal-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-action {
  height: 40px;
  background-color: var(--color-light, #f8f9fa);
  color: var(--color-dark, #333);
  border: 1px solid var(--color-grey-light, #e4e7ed);
  border-radius: var(--radius-lg);
  padding: 0 16px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: background-color 0.2s, border-color 0.2s;
}

.btn-action:hover:not(:disabled) {
  background-color: var(--color-grey-light, #e9ecef);
  border-color: var(--color-grey, #ced4da);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chains-details {
  margin-top: 12px;
  padding: 12px;
  background: var(--color-light, #f8f9fa);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-grey-light, #e9ecef);
}

.chains-header {
  margin-bottom: 8px;
  color: var(--color-dark, #333);
  font-size: 0.875rem;
}

.chains-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chain-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--color-white);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-grey-light, #e9ecef);
  font-size: 0.8125rem;
}

.chain-item.chain-active,
.chain-item.chain-executed,
.chain-item.chain-canceled {
  opacity: 1;
  border-left: 3px solid var(--color-grey, #ced4da);
}

.chain-main-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.chain-name {
  font-weight: 600;
  color: var(--color-dark, #333);
  font-size: 0.875rem;
}

.chain-status {
  font-size: 0.75rem;
  color: var(--color-grey-dark, #666);
}

.chain-details-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--color-grey-light, #e9ecef);
}

.chain-detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
}

.detail-label {
  font-weight: 600;
  color: var(--color-grey-dark, #666);
}

.detail-value {
  color: var(--color-dark, #333);
  text-align: right;
  flex: 1;
}

.detail-value.quorum-reached,
.detail-value.quorum-not-reached {
  color: var(--color-dark, #333);
  font-weight: 500;
}

@media (max-width: 768px) {
  .proposals-page {
    padding: 12px;
  }

  .proposals-filters {
    flex-direction: column;
    gap: 10px;
  }

  .filter-group input {
    min-width: auto;
    width: 100%;
    box-sizing: border-box;
  }

  .proposals-grid {
    grid-template-columns: 1fr;
  }
}


/* TZ package G/SC stack */
@media (max-width: 768px) {
  [class*="grid"], .form-row, .management-blocks {
    grid-template-columns: 1fr !important;
  }
  .row, .actions, .toolbar, .filters, .form-actions {
    flex-wrap: wrap;
  }
}
</style>