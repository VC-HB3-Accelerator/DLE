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
    <div class="proposals-page">
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleAddress }}
        </div>
        <button @click="goBack" class="close-btn">×</button>
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
          <div class="empty-icon">📄</div>
          <h3>{{ t('smartcontracts.proposals.emptyTitle') }}</h3>
          <p>{{ t('smartcontracts.proposals.emptyDescription') }}</p>
          <button @click="loadProposals" class="btn btn-primary">{{ t('common.reload') }}</button>
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
                <span>👤</span>
                <span>{{ t('smartcontracts.proposals.initiator') }} {{ proposal.initiator }}</span>
              </div>
              <div class="meta-item">
                <span>🔗</span>
                <span>ID: {{ proposal.uniqueId }}</span>
              </div>
              <!-- Мульти-чейн информация -->
              <div v-if="proposal.chains && proposal.chains.length > 1" class="meta-item multichain-info">
                <span>🌐</span>
                <span>{{ t('smartcontracts.proposals.chainsCount', { count: proposal.chains.length, names: proposal.chains.map(c => getChainDisplayName(c)).join(', ') }) }}</span>
              </div>
              <div v-else class="meta-item">
                <span>⛓️</span>
                <span>{{ t('smartcontracts.proposals.chainLabel') }} {{ proposal.chainId ? getChainDisplayName(proposal.chains?.[0] || { chainId: proposal.chainId }) : 'N/A' }}</span>
              </div>
              <div class="meta-item">
                <span>📄</span>
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
                      <span v-else>⚪ {{ chain.state }}</span>
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
                        👍 {{ chain.forVotes ? (Number(chain.forVotes) / 1e18).toFixed(2) : '0.00' }} DLE | 
                        👎 {{ chain.againstVotes ? (Number(chain.againstVotes) / 1e18).toFixed(2) : '0.00' }} DLE
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
                      <span v-else>⚪ {{ chain.state }}</span>
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
                        👍 {{ chain.forVotes ? (Number(chain.forVotes) / 1e18).toFixed(2) : '0.00' }} DLE | 
                        👎 {{ chain.againstVotes ? (Number(chain.againstVotes) / 1e18).toFixed(2) : '0.00' }} DLE
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
                class="btn btn-success"
                :disabled="isVoting"
              >
                {{ isVoting ? t('common.voting') : t('common.forVote') }}
              </button>
              <button 
                v-if="proposal.chains && proposal.chains.length > 1 ? canVoteMultichain(proposal) : canVote(proposal)" 
                @click="voteOnProposal(proposal.id, false)" 
                class="btn btn-danger"
                :disabled="isVoting"
              >
                {{ isVoting ? t('common.voting') : t('common.againstVote') }}
              </button>
              <button 
                v-if="proposal.chains && proposal.chains.length > 1 ? canExecuteMultichain(proposal) : canExecute(proposal)" 
                @click="executeProposal(proposal.id)" 
                class="btn btn-primary"
                :disabled="isExecuting"
              >
                {{ isExecuting ? t('common.executing') : t('common.execute') }}
              </button>
              <button 
                v-if="canCancel(proposal)" 
                @click="cancelProposal(proposal.id)" 
                class="btn btn-warning"
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
  min-height: 100vh;
  background: #f0f0f0;
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: white;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #ddd;
}

.header-content h1 {
  color: #333;
  margin: 0;
  font-size: 24px;
  font-weight: bold;
}

.header-content p {
  color: #666;
  margin: 5px 0 0 0;
}

.close-btn {
  background: #ccc;
  border: none;
  color: #333;
  font-size: 18px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
}

.close-btn:hover {
  background: #999;
}

.auth-notice {
  margin-bottom: 20px;
}

.alert {
  padding: 15px;
  border-radius: 5px;
  border: 1px solid;
}

.alert-info {
  background: #e7f3ff;
  border-color: #0dcaf0;
  color: #0dcaf0;
}

.proposals-content {
  background: white;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #ddd;
}


.proposals-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ddd;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.filter-group label {
  font-weight: bold;
  color: #333;
}

.filter-group select,
.filter-group input {
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-size: 14px;
}

.filter-group input {
  min-width: 250px;
}

.loading-state {
  text-align: center;
  padding: 40px;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
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
  padding: 40px;
}

.empty-icon {
  font-size: 48px;
  color: #999;
  margin-bottom: 10px;
}

.empty-state h3 {
  color: #333;
  margin-bottom: 5px;
}

.empty-state p {
  color: #666;
  margin-bottom: 20px;
}

.proposals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.proposal-card {
  background: white;
  border-radius: 10px;
  padding: 20px;
  border: 1px solid #ddd;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.proposal-card:hover {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}

.proposal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.proposal-id {
  font-weight: bold;
  color: #007bff;
  font-size: 16px;
}

.proposal-status {
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 12px;
  font-weight: bold;
}

.status-active {
  background: #d4edda;
  color: #155724;
}

.status-succeeded {
  background: #d1ecf1;
  color: #0c5460;
}

.status-defeated {
  background: #f8d7da;
  color: #721c24;
}

.status-executed {
  background: #cce5ff;
  color: #004085;
}

.status-cancelled {
  background: #f8d7da;
  color: #721c24;
}

.status-ready {
  background: #fff3cd;
  color: #856404;
}

.proposal-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 15px;
  line-height: 1.4;
}

.proposal-meta {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #666;
  font-size: 14px;
}

.proposal-progress {
  margin-bottom: 15px;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 5px;
}

.progress-fill {
  height: 100%;
  background: #28a745;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 14px;
  color: #666;
  font-weight: bold;
}

.votes-info {
  display: flex;
  gap: 15px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.vote-count {
  font-size: 12px;
  color: #555;
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e9ecef;
}

.proposal-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 5px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-warning {
  background: #ffc107;
  color: #333;
}

.multichain-info {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 600;
}

.chains-details {
  margin-top: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.chains-header {
  margin-bottom: 10px;
  color: #333;
  font-size: 14px;
}

.chains-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chain-item {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e9ecef;
  font-size: 13px;
  margin-bottom: 10px;
}

.chain-item:last-child {
  margin-bottom: 0;
}

.chain-item.chain-active {
  border-left: 4px solid #28a745;
}

.chain-item.chain-executed {
  border-left: 4px solid #007bff;
  opacity: 0.7;
}

.chain-item.chain-canceled {
  border-left: 4px solid #dc3545;
  opacity: 0.7;
}

.chain-main-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chain-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.chain-status {
  font-size: 12px;
  color: #666;
}

.chain-details-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid #e9ecef;
}

.chain-detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.detail-label {
  font-weight: 600;
  color: #666;
  margin-right: 10px;
}

.detail-value {
  color: #333;
  text-align: right;
  flex: 1;
}

.detail-value.quorum-reached {
  color: #28a745;
  font-weight: 600;
}

.detail-value.quorum-not-reached {
  color: #dc3545;
}

@media (max-width: 768px) {
  .proposals-page {
    padding: 10px;
  }
  
  .proposals-filters {
    flex-direction: column;
    gap: 10px;
  }
  
  .filter-group input {
    min-width: auto;
    width: 100%;
  }
  
  .proposals-grid {
    grid-template-columns: 1fr;
  }
}
</style>