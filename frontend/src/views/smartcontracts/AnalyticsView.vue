<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <BaseLayout
    :is-authenticated="isAuthenticated"
    :identities="identities"
    :token-balances="tokenBalances"
    :is-loading-tokens="isLoadingTokens"
    @auth-action-completed="$emit('auth-action-completed')"
  >
    <div class="analytics-container page-with-close">
      <PageCloseButton :on-navigate="goBackToBlocks" />
      <!-- Основная информация -->
      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div v-if="dleAddress" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ dleAddress }}
        </div>
        <div v-else-if="isLoadingDle" style="color: var(--color-grey-dark); font-size: 0.9rem;">
          {{ t('common.loading') }}
        </div>
      </div>
      <div v-if="dleAddress" class="voting-chain-hub">
        <VotingChainSelect
          v-model="votingChain"
          :chains="votingChains"
          :is-loading="isLoadingVotingChains"
          :label="t('smartcontracts.analytics.networkLabel')"
          :placeholder="t('smartcontracts.analytics.networkPlaceholder')"
          :hint="t('smartcontracts.analytics.networkHint')"
          select-id="analyticsChain"
        />
        <p class="voting-chain-hub__note">{{ t('smartcontracts.analytics.networkNote') }}</p>
      </div>
      <div v-if="!hasVotingChain" class="select-network-first">
        <p>{{ t('smartcontracts.analytics.selectNetworkFirst') }}</p>
      </div>
      <template v-else>
      <div class="info-section">
        <h2>{{ t('smartcontracts.analytics.basicInfo') }}</h2>
        <div class="info-grid">
          <div class="info-card">
            <h3>{{ t('smartcontracts.analytics.name') }}</h3>
            <p class="info-value">{{ selectedDle?.name || t('common.loading') }}</p>
          </div>
          <div class="info-card">
            <h3>{{ t('smartcontracts.analytics.symbol') }}</h3>
            <p class="info-value">{{ selectedDle?.symbol || t('common.loading') }}</p>
          </div>
          <div class="info-card">
            <h3>{{ t('smartcontracts.analytics.status') }}</h3>
            <p class="info-value" :class="selectedDle?.isActive ? 'status-active' : 'status-inactive'">
              {{ selectedDle?.isActive ? t('smartcontracts.analytics.active') : t('smartcontracts.analytics.inactive') }}
            </p>
          </div>
          <div class="info-card">
            <h3>{{ t('smartcontracts.analytics.creationDate') }}</h3>
            <p class="info-value">{{ formatDate(selectedDle?.creationTimestamp) }}</p>
          </div>
          <div class="info-card">
            <h3>{{ t('smartcontracts.analytics.location') }}</h3>
            <p class="info-value">{{ selectedDle?.location || t('smartcontracts.analytics.notSpecified') }}</p>
          </div>
          <div class="info-card">
            <h3>{{ t('smartcontracts.analytics.jurisdiction') }}</h3>
            <p class="info-value">{{ selectedDle?.jurisdiction || t('smartcontracts.analytics.notSpecified') }}</p>
          </div>
        </div>
      </div>

      <!-- Токеномика -->
      <div class="tokenomics-section">
        <h2>{{ t('smartcontracts.analytics.tokenomics') }}</h2>
        <div class="tokenomics-grid">
          <div class="tokenomics-card">
            <h3>{{ t('smartcontracts.analytics.totalSupply') }}</h3>
            <p class="tokenomics-value">{{ formatNumber(tokenomics.totalSupply) }}</p>
            <p class="tokenomics-label">{{ t('smartcontracts.analytics.tokensInCirculation') }}</p>
          </div>
          <div class="tokenomics-card">
            <h3>{{ t('smartcontracts.analytics.tokenHolders') }}</h3>
            <p class="tokenomics-value">{{ tokenomics.holdersCount }}</p>
            <p class="tokenomics-label">{{ t('smartcontracts.analytics.activeHolders') }}</p>
          </div>
          <div class="tokenomics-card">
            <h3>{{ t('smartcontracts.analytics.topHolder') }}</h3>
            <p class="tokenomics-value">{{ tokenomics.topHolderPercentage }}%</p>
            <p class="tokenomics-label">{{ formatAddress(tokenomics.topHolderAddress) }}</p>
          </div>
        </div>
      </div>

      <!-- Казна -->
      <div class="treasury-section">
        <h2>{{ t('smartcontracts.analytics.treasuryTitle') }}</h2>
        <div v-if="treasuryHoldings.length === 0" class="treasury-card">
          <p class="no-modules">{{ t('smartcontracts.analytics.treasuryEmpty') }}</p>
        </div>
        <div v-else class="treasury-chains">
          <div
            v-for="chain in treasuryHoldings"
            :key="chain.chainId"
            class="treasury-card"
          >
            <h3>{{ chain.networkName || getChainName(chain.chainId) }}</h3>
            <p v-if="chain.treasuryAddress" class="treasury-addr">{{ chain.treasuryAddress }}</p>
            <p v-if="chain.error" class="treasury-error">{{ chain.error }}</p>
            <div v-else-if="!chain.tokens?.length" class="no-modules">
              {{ t('smartcontracts.analytics.treasuryNoTokens') }}
            </div>
            <div v-else class="treasury-table-wrap">
            <table class="treasury-table">
              <thead>
                <tr>
                  <th>{{ t('smartcontracts.analytics.treasurySymbol') }}</th>
                  <th>{{ t('smartcontracts.analytics.treasuryType') }}</th>
                  <th>{{ t('smartcontracts.analytics.treasuryBalance') }}</th>
                  <th>{{ t('smartcontracts.analytics.treasuryTokenAddress') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="tok in chain.tokens" :key="`${chain.chainId}-${tok.address}`">
                  <td>{{ tok.symbol || '—' }}</td>
                  <td>{{ tok.type === 'native'
                    ? t('smartcontracts.analytics.treasuryTypeNative')
                    : t('smartcontracts.analytics.treasuryTypeErc20') }}</td>
                  <td>{{ tok.balanceHuman }}</td>
                  <td class="treasury-token-addr">{{ tok.isNative || tok.address === '0x0000000000000000000000000000000000000000'
                    ? t('smartcontracts.analytics.treasuryNativeAddress')
                    : formatAddress(tok.address) }}</td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Управление -->
      <div class="governance-section">
        <h2>{{ t('smartcontracts.analytics.governance') }}</h2>
        <div class="governance-grid">
          <div class="governance-card">
            <h3>{{ t('smartcontracts.analytics.totalProposals') }}</h3>
            <p class="governance-value">{{ governance.totalProposals }}</p>
          </div>
          <div class="governance-card">
            <h3>{{ t('smartcontracts.analytics.executed') }}</h3>
            <p class="governance-value">{{ governance.executedProposals }}</p>
          </div>
          <div class="governance-card">
            <h3>{{ t('smartcontracts.analytics.defeated') }}</h3>
            <p class="governance-value">{{ governance.defeatedProposals }}</p>
          </div>
          <div class="governance-card">
            <h3>{{ t('smartcontracts.analytics.quorum') }}</h3>
            <p class="governance-value">{{ governance.quorumPercentage }}%</p>
          </div>
          <div class="governance-card">
            <h3>{{ t('smartcontracts.analytics.supportedChains') }}</h3>
            <p class="governance-value">{{ governance.supportedChainsCount }}</p>
          </div>
          <div class="governance-card">
            <h3>{{ t('smartcontracts.analytics.currentChain') }}</h3>
            <p class="governance-value">{{ getChainName(governance.currentChainId) }}</p>
          </div>
        </div>
      </div>

      <!-- Статистика предложений -->
      <div class="proposals-section">
        <h2>{{ t('smartcontracts.analytics.proposalsStats') }}</h2>
        <div class="proposals-grid">
          <div class="proposals-card">
            <h3>{{ t('smartcontracts.analytics.proposalStatuses') }}</h3>
            <div class="proposals-stats">
              <div class="stat-item">
                <span class="stat-label">{{ t('smartcontracts.analytics.pendingVote') }}</span>
                <span class="stat-value">{{ proposalsStats.pending }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ t('smartcontracts.analytics.succeeded') }}</span>
                <span class="stat-value">{{ proposalsStats.succeeded }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ t('smartcontracts.analytics.defeatedProposals') }}</span>
                <span class="stat-value">{{ proposalsStats.defeated }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ t('smartcontracts.analytics.executedProposals') }}</span>
                <span class="stat-value">{{ proposalsStats.executed }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ t('smartcontracts.analytics.canceled') }}</span>
                <span class="stat-value">{{ proposalsStats.canceled }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">{{ t('smartcontracts.analytics.readyForExecution') }}</span>
                <span class="stat-value">{{ proposalsStats.readyForExecution }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Модули -->
      <div class="modules-section">
        <h2>{{ t('smartcontracts.analytics.modules') }}</h2>
        <div class="modules-grid">
          <div class="modules-card">
            <h3>{{ t('smartcontracts.analytics.activeModules') }}</h3>
            <div class="modules-list">
              <div v-if="modules.length === 0" class="no-modules">
                <p>{{ t('smartcontracts.analytics.noActiveModules') }}</p>
              </div>
              <div 
                v-for="module in modules" 
                :key="module.id || module.moduleId || module.address"
                class="module-item"
              >
                <div class="module-info">
                  <span class="module-id">{{ module.moduleName || module.id || module.moduleType }}</span>
                  <span class="module-address">{{ formatAddress(module.address || module.addresses?.[0]?.address) }}</span>
                </div>
                <div class="module-status">
                  <span class="status-badge">{{ t('smartcontracts.analytics.active') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Мульти-чейн -->
      <div class="multichain-section">
        <h2>{{ t('smartcontracts.analytics.multichain') }}</h2>
        <div class="multichain-grid">
          <div class="multichain-card">
            <h3>{{ t('smartcontracts.analytics.supportedChains') }}</h3>
            <div class="chains-list">
              <div
                v-for="chainId in multichain.supportedChains"
                :key="chainId"
                class="chain-item"
              >
                <span class="chain-name">{{ getChainName(chainId) }}</span>
                <span class="chain-id">{{ t('smartcontracts.analytics.chainIdLabel', { id: chainId }) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Топ держатели -->
      <div class="holders-section">
        <h2>{{ t('smartcontracts.analytics.topHolders') }}</h2>
        <div class="holders-grid">
          <div class="holders-card">
            <div class="holders-list">
              <div
                v-for="(holder, index) in topHolders"
                :key="holder.address"
                class="holder-item"
              >
                <div class="holder-rank">#{{ index + 1 }}</div>
                <div class="holder-info">
                  <div class="holder-address">{{ formatAddress(holder.address) }}</div>
                  <div class="holder-balance">{{ formatNumber(holder.balance) }} {{ t('smartcontracts.analytics.tokensUnit') }}</div>
                </div>
                <div class="holder-percentage">{{ Number(holder.percentage || 0).toFixed(2) }}%</div>
              </div>
              <div v-if="topHolders.length === 0" class="no-holders">
                <p>{{ t('smartcontracts.analytics.noHoldersData') }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </template>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../../components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
import VotingChainSelect from '@/components/VotingChainSelect.vue';
import { useVotingChains } from '@/composables/useVotingChains.js';
import api from '../../api/axios';

const { t, locale } = useI18n();

// Определяем props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();

// Получаем адрес DLE из URL параметров
const dleAddress = ref(route.query.address || '');

const {
  chains: votingChains,
  votingChain,
  isLoading: isLoadingVotingChains,
  hasVotingChain,
} = useVotingChains(dleAddress);

function selectedChainId() {
  const n = Number(votingChain.value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function withChain(extra = {}) {
  const body = { dleAddress: dleAddress.value, ...extra };
  const cid = selectedChainId();
  if (cid) body.chainId = cid;
  return body;
}

function persistChainQuery() {
  const cid = selectedChainId();
  if (!cid) return;
  if (String(route.query.votingChain || '') === String(cid)) return;
  router.replace({
    query: {
      ...route.query,
      address: dleAddress.value,
      votingChain: String(cid),
    },
  });
}

function proposalsForSelectedChain(proposals) {
  const cid = selectedChainId();
  if (!cid) return proposals || [];
  return (proposals || []).filter((p) => Number(p.chainId) === cid);
}

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (dleAddress.value) {
    router.push(`/management/dle-blocks?address=${dleAddress.value}`);
  } else {
    router.push('/management');
  }
};

// Состояние
const selectedDle = ref(null);
const isLoadingDle = ref(false);

// Данные аналитики
const tokenomics = ref({
  totalSupply: 0,
  holdersCount: 0,
  topHolderAddress: '',
  topHolderPercentage: 0
});

const governance = ref({
  totalProposals: 0,
  executedProposals: 0,
  defeatedProposals: 0,
  quorumPercentage: 0,
  supportedChainsCount: 0,
  currentChainId: 0
});

const proposalsStats = ref({
  pending: 0,
  succeeded: 0,
  defeated: 0,
  executed: 0,
  canceled: 0,
  readyForExecution: 0
});

const modules = ref([]);
const multichain = ref({
  supportedChains: []
});

const topHolders = ref([]);
const treasuryHoldings = ref([]);

// Загрузка данных DLE
async function loadDleData() {
  try {
    isLoadingDle.value = true;
    
    if (!dleAddress.value || !selectedChainId()) {
      return;
    }

    // Читаем данные из блокчейна
    const response = await api.post('/blockchain/read-dle-info', withChain());
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
      
      // Загружаем все аналитические данные
      await Promise.all([
        loadTokenomics(),
        loadGovernance(),
        loadProposalsStats(),
        loadModules(),
        loadMultichain(),
        loadTopHolders(),
        loadTreasuryHoldings(),
      ]);
    } else {
      console.error('[AnalyticsView] Ошибка загрузки DLE:', response.data.error);
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

// Загрузка токеномики
async function loadTokenomics() {
  try {
    const response = await api.post('/dle-tokens/get-total-supply', withChain());
    
    if (response.data.success) {
      tokenomics.value.totalSupply = response.data.data.totalSupply;
      
      // Получаем держателей токенов
      const holdersResponse = await api.post('/dle-tokens/get-token-holders', withChain({
        limit: 50
      }));
      
      if (holdersResponse.data.success) {
        const holders = holdersResponse.data.data.holders;
        tokenomics.value.holdersCount = holders.length;
        
        if (holders.length > 0) {
          const topHolder = holders[0];
          tokenomics.value.topHolderAddress = topHolder.address;
          tokenomics.value.topHolderPercentage = topHolder.percentage;
        }
      }
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки токеномики:', error);
  }
}

// Загрузка данных управления
async function loadGovernance() {
  try {
    const response = await api.post('/dle-core/get-governance-params', withChain());
    
    if (response.data.success) {
      const data = response.data.data;
      governance.value.quorumPercentage = data.quorumPct;
      governance.value.currentChainId = selectedChainId() || data.chainId;
      governance.value.supportedChainsCount = data.supportedCount;
    }
    
    // Получаем количество предложений
    const proposalsResponse = await api.post('/dle-proposals/get-proposals-count', withChain());
    
    if (proposalsResponse.data.success) {
      governance.value.totalProposals = proposalsResponse.data.data.count;
    }
    
    // Получаем статистику предложений
    const listResponse = await api.post('/dle-proposals/get-proposals', withChain());
    
    if (listResponse.data.success) {
      const proposals = proposalsForSelectedChain(listResponse.data.data.proposals);
      let executed = 0;
      let defeated = 0;
      
      for (const proposal of proposals) {
        if (proposal.executed) executed++;
        else if (proposal.state === 2) defeated++; // Defeated
      }
      
      governance.value.executedProposals = executed;
      governance.value.defeatedProposals = defeated;
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки управления:', error);
  }
}

// Загрузка статистики предложений
async function loadProposalsStats() {
  try {
    const response = await api.post('/dle-proposals/get-proposals', withChain());
    
    if (response.data.success) {
      const proposals = proposalsForSelectedChain(response.data.data.proposals);
      const stats = {
        pending: 0,
        succeeded: 0,
        defeated: 0,
        executed: 0,
        canceled: 0,
        readyForExecution: 0
      };
      
      for (const proposal of proposals) {
        // Определяем статус предложения по той же логике что и в DleProposalsView
        let status = 'active';
        const now = Math.floor(Date.now() / 1000);
        const deadline = proposal.deadline || 0;
        
        if (proposal.canceled) {
          status = 'canceled';
        } else if (proposal.executed) {
          status = 'executed';
        } else if (deadline > 0 && now >= deadline) {
          // Если дедлайн истек, определяем результат по голосам
          const forVotes = Number(proposal.forVotes) || 0;
          const againstVotes = Number(proposal.againstVotes) || 0;
          
          if (forVotes > againstVotes) {
            status = 'succeeded';
          } else {
            status = 'defeated';
          }
        } else {
          // Если дедлайн не истек, но есть голоса, определяем текущий статус
          const forVotes = Number(proposal.forVotes) || 0;
          const againstVotes = Number(proposal.againstVotes) || 0;
          
          if (forVotes > 0 || againstVotes > 0) {
            if (forVotes > againstVotes) {
              status = 'succeeded';
            } else if (againstVotes > forVotes) {
              status = 'defeated';
            }
          }
        }
        
        switch (status) {
          case 'active': stats.pending++; break;
          case 'succeeded': stats.succeeded++; break;
          case 'defeated': stats.defeated++; break;
          case 'executed': stats.executed++; break;
          case 'canceled': stats.canceled++; break;
          default: stats.pending++; break;
        }
      }
      
      proposalsStats.value = stats;
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки статистики предложений:', error);
  }
}

// Загрузка модулей
async function loadModules() {
  try {
    const response = await api.post('/dle-modules/get-all-modules', withChain());
    
    if (response.data.success) {
      modules.value = (response.data.data.modules || []).filter(
        (m) => m.inBook !== false
      );
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки модулей:', error);
  }
}

// Загрузка мульти-чейн данных
async function loadMultichain() {
  try {
    const response = await api.post('/dle-multichain/get-supported-chains', withChain());
    
    if (response.data.success) {
      multichain.value.supportedChains = response.data.data.chains || [];
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки мульти-чейн данных:', error);
  }
}

// Загрузка топ держателей
async function loadTopHolders() {
  try {
    const response = await api.post('/dle-tokens/get-token-holders', withChain({
      limit: 50
    }));
    
    if (response.data.success) {
      topHolders.value = response.data.data.holders || [];
    }
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки топ держателей:', error);
  }
}

async function loadTreasuryHoldings() {
  const cid = selectedChainId();
  if (!cid || !dleAddress.value) {
    treasuryHoldings.value = [];
    return;
  }
  try {
    const response = await api.post('/dle-modules/get-treasury-holdings', withChain());
    if (response.data.success) {
      const chains = response.data.data.chains || [];
      treasuryHoldings.value = cid
        ? chains.filter((c) => Number(c.chainId) === cid)
        : chains;
      return;
    }
    treasuryHoldings.value = [{
      chainId: cid,
      networkName: getChainName(cid),
      tokens: [],
      error: response.data.error || t('smartcontracts.analytics.treasuryEmpty'),
    }];
  } catch (error) {
    console.error('[AnalyticsView] Ошибка загрузки казны:', error);
    const status = error.response?.status;
    treasuryHoldings.value = [{
      chainId: cid,
      networkName: getChainName(cid),
      treasuryAddress: null,
      tokens: [],
      error: status === 404
        ? t('smartcontracts.analytics.treasuryBackendStale')
        : (error.response?.data?.error || error.message || t('smartcontracts.analytics.treasuryEmpty')),
    }];
  }
}

// Методы
const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

const formatNumber = (number) => {
  if (!number) return '0';
  return Number(number).toLocaleString();
};

const formatDate = (timestamp) => {
  if (!timestamp) return t('smartcontracts.analytics.notSpecified');
  const dateLocale = locale.value === 'en' ? 'en-US' : 'ru-RU';
  return new Date(Number(timestamp) * 1000).toLocaleDateString(dateLocale);
};

const getChainName = (chainId) => {
  const chains = {
    1: t('smartcontracts.analytics.chains.ethereum'),
    11155111: t('smartcontracts.analytics.chains.sepolia'),
    17000: t('smartcontracts.analytics.chains.holesky'),
    84532: t('smartcontracts.analytics.chains.baseSepolia'),
    80002: t('smartcontracts.analytics.chains.polygonAmoy'),
    421614: t('smartcontracts.analytics.chains.arbitrumSepolia'),
    137: t('smartcontracts.analytics.chains.polygon'),
    56: t('smartcontracts.analytics.chains.bsc'),
    42161: t('smartcontracts.analytics.chains.arbitrum')
  };
  return chains[chainId] || t('smartcontracts.analytics.chains.unknown', { id: chainId });
};

// Загружаем данные при монтировании компонента
watch(votingChain, (cid) => {
  if (Number(cid) > 0) {
    persistChainQuery();
    loadDleData();
  }
});
</script>

<style scoped>
.analytics-container {
  position: relative;
  padding: 20px;
  background: transparent;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-grey-light, #e9ecef);
  margin-top: 20px;
  margin-bottom: 20px;
}

.voting-chain-hub {
  max-width: 520px;
  margin: 0 0 1.5rem;
}

.voting-chain-hub__note {
  margin: -8px 0 0;
  font-size: 0.85rem;
  color: var(--color-grey-dark, #555);
}

.select-network-first {
  padding: 12px 0 24px;
  color: var(--color-grey-dark, #555);
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
  flex-shrink: 0;
}

.close-btn:hover {
  background-color: var(--color-grey-light, #e9ecef);
  border-color: var(--color-dark, #333);
}

.info-section,
.tokenomics-section,
.treasury-section,
.governance-section,
.proposals-section,
.modules-section,
.multichain-section,
.holders-section {
  margin-bottom: 32px;
}

.info-section h2,
.tokenomics-section h2,
.treasury-section h2,
.governance-section h2,
.proposals-section h2,
.modules-section h2,
.multichain-section h2,
.holders-section h2 {
  color: var(--color-dark, #333);
  margin-bottom: 16px;
  font-size: 1.25rem;
  font-weight: 600;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.info-card,
.tokenomics-card,
.treasury-card,
.governance-card,
.proposals-card,
.modules-card,
.multichain-card,
.holders-card {
  background: var(--theme-bg, #fff);
  padding: 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-grey-light, #e9ecef);
}

.info-card h3,
.tokenomics-card h3,
.governance-card h3,
.proposals-card h3,
.modules-card h3,
.multichain-card h3 {
  color: var(--color-dark, #333);
  margin-bottom: 10px;
  font-size: 0.9rem;
  font-weight: 600;
}

.info-value {
  font-size: 1.05rem;
  font-weight: 500;
  margin: 0;
  color: var(--color-dark, #333);
}

.status-active,
.status-inactive {
  color: var(--color-dark, #333) !important;
}

.tokenomics-grid,
.governance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.tokenomics-card,
.governance-card {
  text-align: center;
  background: var(--color-white);
}

.tokenomics-value,
.governance-value {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-dark, #333);
  margin: 8px 0;
}

.tokenomics-label {
  color: var(--color-grey-dark, #666);
  font-size: 0.875rem;
  margin: 0;
}

.proposals-grid,
.modules-grid,
.multichain-grid,
.holders-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.proposals-card,
.modules-card,
.multichain-card,
.holders-card {
  background: var(--color-white);
}

.proposals-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--theme-bg, #fff);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-grey-light, #e9ecef);
}

.stat-label {
  color: var(--color-grey-dark, #666);
  font-size: 0.875rem;
}

.stat-value {
  font-weight: 600;
  color: var(--color-dark, #333);
  font-size: 1rem;
}

.modules-list,
.chains-list,
.holders-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.module-item,
.chain-item,
.holder-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--theme-bg, #fff);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-grey-light, #e9ecef);
}

.module-info,
.holder-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.module-id,
.chain-name,
.holder-address {
  font-weight: 600;
  color: var(--color-dark, #333);
}

.module-id,
.module-address,
.holder-address,
.chain-id {
  font-family: monospace;
  font-size: 0.875rem;
}

.module-address,
.chain-id,
.holder-balance {
  color: var(--color-grey-dark, #666);
}

.status-badge {
  padding: 4px 10px;
  border-radius: var(--radius-lg);
  font-size: 0.8rem;
  font-weight: 500;
  background: var(--theme-bg, #fff);
  color: var(--color-dark, #333);
  border: 1px solid var(--color-grey-light, #e4e7ed);
}

.no-modules,
.no-holders {
  text-align: center;
  padding: 20px;
  color: var(--color-grey-dark, #666);
}

.holder-item {
  justify-content: flex-start;
}

.holder-rank {
  font-weight: 600;
  color: var(--color-dark, #333);
  min-width: 32px;
}

.holder-info {
  flex: 1;
}

.holder-percentage {
  font-weight: 600;
  color: var(--color-dark, #333);
  min-width: 56px;
  text-align: right;
}

.treasury-chains {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.treasury-card h3 {
  color: var(--color-dark, #333);
  margin-bottom: 8px;
  font-size: 1rem;
  font-weight: 600;
}

.treasury-addr {
  font-size: 0.8rem;
  color: var(--color-grey, #6c757d);
  margin: 0 0 12px;
  word-break: break-all;
}

.treasury-error {
  color: var(--color-danger, #c0392b);
  margin: 0;
}

.treasury-table-wrap {
  overflow-x: auto;
}

.treasury-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.treasury-table th,
.treasury-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--color-grey-light, #e9ecef);
}

.treasury-table th {
  font-weight: 600;
  color: var(--color-grey, #6c757d);
}

.treasury-token-addr {
  font-family: ui-monospace, monospace;
  font-size: 0.85rem;
}

@media (max-width: 768px) {
  .info-grid,
  .tokenomics-grid,
  .governance-grid,
  .proposals-stats {
    grid-template-columns: 1fr;
  }

  .holder-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .holder-percentage {
    align-self: flex-end;
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