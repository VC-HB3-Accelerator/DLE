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
    <AdminPageShell :show-close="true" fallback="/">
      <div class="management-layout">
      <!-- Деплоированные DLE -->
      <div class="deployed-dles-section">


        <div
          v-if="isLoadingDles"
          class="dle-card dle-card--placeholder"
          role="status"
          aria-live="polite"
        >
          <UiGlyph name="sync" :spin="true" :size="28" />
          <p>{{ t('smartcontracts.management.loadingDles') }}</p>
        </div>

        <div v-else-if="deployedDles.length === 0" class="dle-card dle-card--placeholder no-dles">
          <p>{{ t('smartcontracts.management.noDeployedDles') }}</p>
          <i18n-t keypath="smartcontracts.management.createDleHint" tag="p">
            <template #link>
              <a href="/settings/dle-v2-deploy" class="link">{{ t('smartcontracts.management.deployDleLink') }}</a>
            </template>
            <template #auth>
              <a href="/settings/security/auth" class="link">{{ t('smartcontracts.management.attachAuthLink') }}</a>
            </template>
          </i18n-t>
        </div>

        <div v-else class="dles-grid">
          <div 
            v-for="dle in deployedDles" 
            :key="dle.dleAddress" 
            class="dle-card"
            :class="{ 'dle-card--busy': isDleCardPending(dle) }"
            @click="openDleManagement(dle.dleAddress)"
          >
            <div
              v-if="isDleCardPending(dle)"
              class="dle-card__veil"
              role="status"
              aria-live="polite"
            >
              <UiGlyph name="sync" :spin="true" :size="28" />
              <p>{{ t('smartcontracts.management.loadingDles') }}</p>
            </div>
            <div class="dle-card__fill">
            <div class="dle-header">
              <div class="dle-title-section">
                <img 
                  v-if="dle.logoURI" 
                  :src="dle.logoURI" 
                  :alt="dle.name" 
                  class="dle-logo"
                  @error="handleLogoError"
                />
                <div class="default-logo" v-else>DLE</div>
                <div class="dle-title">
                  <h3>{{ dle.name }} ({{ dle.symbol }})</h3>
                </div>
              </div>
            </div>

            <div class="dle-card-body">
            <div
              class="dle-card-panels"
              :style="{ gridTemplateColumns: `repeat(${1 + (dle.insightNetworks?.length || 0)}, minmax(0, 1fr))` }"
            >
            <section class="dle-identity">
              <h4 class="dle-identity__title">{{ t('smartcontracts.management.location') }}</h4>
              <p class="dle-identity__location">{{ dle.location }}</p>
              <div class="dle-identity__meta">
                <div class="detail-item" v-if="dle.deployedMultichain">
                  <strong>{{ t('smartcontracts.management.multichainDeploy') }}</strong>
                  <span class="multichain-badge">{{ t('smartcontracts.management.networksCount', { deployed: dle.totalNetworks, total: dle.supportedChainIds?.length || dle.totalNetworks }) }}</span>
                </div>
                <div class="detail-item" v-if="!(dle.insightNetworks && dle.insightNetworks.length)">
                  <strong>{{ t('smartcontracts.management.contractAddresses') }}</strong>
                  <span class="address-missing">Адрес ещё не записан (деплой не завершён)</span>
                </div>
                <div class="detail-item">
                  <strong>{{ t('smartcontracts.management.jurisdiction') }}</strong> {{ dle.jurisdiction }}
                </div>
                <div class="detail-item">
                  <strong>{{ activityCodesLabel(dle) }}</strong> {{ dle.okvedCodes?.join(', ') || t('common.notSpecified') }}
                </div>
                <div class="detail-item">
                  <strong>{{ t('smartcontracts.management.status') }}</strong>
                  <span class="status active">{{ t('common.active') }}</span>
                </div>
                <div class="detail-item">
                  <strong>{{ t('smartcontracts.management.creationDate') }}</strong>
                  <span class="creation-date">{{ formatTimestamp(dle.creationTimestamp || dle.createdAt) }}</span>
                </div>
              </div>
            </section>
            <DleHubInsights
              :dle-address="dle.dleAddress"
              :networks="dle.insightNetworks || []"
              :quorum-percentage="dle.quorumPercentage"
              :token-symbol="dle.symbol"
              @loading="markInsightsLoading"
              @loaded="markInsightsLoaded"
            />
            </div>
            <div class="dle-card-more">
              <button
                type="button"
                class="btn btn-primary"
                @click.stop="openDleManagement(dle.dleAddress)"
              >
                {{ t('common.details') }}
              </button>
            </div>
            </div>
            </div>
          </div>
        </div>
      </div>
      <div class="management-hub">
        <AdminHubCards />
      </div>
      </div>
    </AdminPageShell>
  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import BaseLayout from '../components/BaseLayout.vue';
import AdminPageShell from '../components/admin/AdminPageShell.vue';
import AdminHubCards from '../components/admin/AdminHubCards.vue';
import DleHubInsights from '../components/admin/DleHubInsights.vue';
import api from '@/api/axios';
import UiGlyph from '../components/UiGlyph.vue';

const { t } = useI18n();

/** ISO 3166-1 numeric: РФ — ОКВЭД, остальные юрисдикции — ISIC (поле контракта одно). */
const RF_ISO_NUMERIC = 643;

function isRfJurisdiction(jurisdiction) {
  const n = Number(jurisdiction);
  return Number.isFinite(n) && n === RF_ISO_NUMERIC;
}

function activityCodesLabel(dle) {
  return isRfJurisdiction(dle?.jurisdiction)
    ? t('smartcontracts.management.okvedCodes')
    : t('smartcontracts.management.isicCodes');
}

function dleInsightNetworks(dle) {
  const fromNet = dle?.networks || dle?.deployedNetworks || [];
  if (Array.isArray(fromNet) && fromNet.length) {
    return fromNet
      .map((n) => ({
        chainId: Number(n.chainId),
        address: n.address || dle.dleAddress,
      }))
      .filter((n) => Number.isFinite(n.chainId) && n.chainId > 0);
  }
  const ids = dle?.supportedChainIds || [];
  return ids
    .map((id) => ({ chainId: Number(id), address: dle.dleAddress }))
    .filter((n) => Number.isFinite(n.chainId) && n.chainId > 0);
}

function withInsightNetworks(dle) {
  if (!dle) return null;
  return { ...dle, insightNetworks: dleInsightNetworks(dle) };
}

// Определяем props
const props = defineProps({
  isAuthenticated: { type: Boolean, default: false },
  identities: { type: Array, default: () => [] },
  tokenBalances: { type: Object, default: () => ({}) },
  isLoadingTokens: { type: Boolean, default: false }
});

// Определяем emits
const emit = defineEmits(['auth-action-completed']);

const router = useRouter();

// Состояние для DLE
const deployedDles = ref([]);
const isLoadingDles = ref(true);
const insightsPending = ref({});

function markInsightsLoading(address) {
  if (!address || insightsPending.value[address] === true) return;
  insightsPending.value = { ...insightsPending.value, [address]: true };
}

function markInsightsLoaded(address) {
  if (!address || insightsPending.value[address] === false) return;
  insightsPending.value = { ...insightsPending.value, [address]: false };
}

function isDleCardPending(dle) {
  if (!dle?.insightNetworks?.length) return false;
  return insightsPending.value[dle.dleAddress] !== false;
}



// Функции для открытия страниц управления
const openProposals = () => {
  router.push('/management/proposals');
};

// Обработка ошибки загрузки логотипа
const handleLogoError = (event) => {
  event.target.style.display = 'none';
  const defaultLogo = event.target.parentElement.querySelector('.default-logo');
  if (defaultLogo) {
    defaultLogo.style.display = 'flex';
  }
};

const openTokens = () => {
  router.push('/management/tokens');
};

const openQuorum = () => {
  router.push('/management/quorum');
};

const openModules = () => {
  router.push('/management/modules');
};

const openDle = () => {
  router.push('/management/dle-management');
};



const openAnalytics = () => {
  router.push('/management/analytics');
};

const openHistory = () => {
  router.push('/management/history');
};

const openSettings = () => {
  router.push('/management/settings');
};

// Загрузка деплоированных DLE из блокчейна
async function loadDeployedDles() {
  isLoadingDles.value = true;
  try {
    const response = await api.get('/dle-v2');

    if (response.data.success) {
      const dlesFromApi = response.data.data || [];

      if (dlesFromApi.length === 0) {
        deployedDles.value = [];
        return;
      }

      // Для каждого DLE читаем актуальные данные из блокчейна
      const dlesWithBlockchainData = await Promise.all(
        dlesFromApi.map(async (dle) => {
          try {
            // Используем адрес из deployedNetworks если dleAddress null
            const dleAddress = dle.dleAddress || (dle.deployedNetworks && dle.deployedNetworks.length > 0 ? dle.deployedNetworks[0].address : null);

            if (!dleAddress) {
              return null;
            }

            const blockchainResponse = await api.post('/blockchain/read-dle-info', {
              dleAddress: dleAddress
            });

            if (blockchainResponse.data.success) {
              const blockchainData = blockchainResponse.data.data;

              // Объединяем данные из API с данными из блокчейна
              const combinedDle = {
                ...dle,
                // Данные из блокчейна (приоритет)
                name: blockchainData.name || dle.name,
                symbol: blockchainData.symbol || dle.symbol,
                location: blockchainData.location || dle.location,
                coordinates: blockchainData.coordinates || dle.coordinates,
                jurisdiction: blockchainData.jurisdiction || dle.jurisdiction,
                okvedCodes: blockchainData.okvedCodes || dle.okvedCodes,
                kpp: blockchainData.kpp || dle.kpp,
                // Информация о токенах из блокчейна
                totalSupply: blockchainData.totalSupply,
                partnerBalances: blockchainData.partnerBalances || [], // Информация о партнерах
                logoURI: blockchainData.logoURI || '', // URL логотипа
                // Количество участников (держателей токенов)
                participantCount: blockchainData.participantCount || 0
              };

              return withInsightNetworks(combinedDle);
            } else {
              return withInsightNetworks(dle);
            }
          } catch (error) {
            return withInsightNetworks(dle);
          }
        })
      );

      deployedDles.value = dlesWithBlockchainData.filter(Boolean);
    } else {
      console.error('[ManagementView] Ошибка при загрузке DLE:', response.data.message);
      deployedDles.value = [];
    }
  } catch (error) {
    console.error('[ManagementView] Ошибка при загрузке DLE:', error);
    deployedDles.value = [];
  } finally {
    isLoadingDles.value = false;
  }
}

// Функции для работы с DLE
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  let date;
  if (typeof timestamp === 'number') {
    // Unix timestamp
    date = new Date(timestamp * 1000);
  } else if (typeof timestamp === 'string') {
    // ISO string
    date = new Date(timestamp);
  } else {
    return '';
  }
  
  return date.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function openDleOnEtherscan(address) {
  window.open(`https://sepolia.etherscan.io/address/${address}`, '_blank');
}

function openDleManagement(dleAddress) {
  // Переход к блокам управления DLE
  router.push(`/management/dle-blocks?address=${dleAddress}`);
}



// function openMultisig() {
//   router.push('/management/multisig');
// }




onMounted(() => {
  loadDeployedDles();
});
</script>

<style scoped>
.management-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
}

.management-hub {
  width: 100%;
  min-width: 0;
}

.deployed-dles-section {
  width: 100%;
  min-width: 0;
  margin-top: 0;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--color-border, #f0f0f0);
}

.management-header h1 {
  color: var(--color-dark);
  font-size: 2.5rem;
  margin: 0;
}

.no-dles {
  color: var(--theme-text-muted, #666);
}

.no-dles .link {
  color: var(--color-primary);
  text-decoration: none;
}

.no-dles .link:hover {
  text-decoration: underline;
}

.dles-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
  width: 100%;
  min-width: 0;
}

/* Мобильная адаптивность для сетки */
@media (max-width: 768px) {
  .dles-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
  
  .dle-card {
    padding: 1rem;
    margin: 0;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }

  .dle-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .dle-header h3 {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .network-item {
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .chain-name {
    min-width: 0;
  }

  .address-link {
    overflow-wrap: anywhere;
    word-break: break-all;
    max-width: 100%;
  }

  .dle-actions {
    flex-wrap: wrap;
  }
}

.dle-card {
  position: relative;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.dle-card:hover:not(.dle-card--placeholder):not(.dle-card--busy) {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
  cursor: pointer;
}

.dle-card--busy {
  min-height: 14rem;
  cursor: default;
}

.dle-card--busy .dle-card__fill {
  visibility: hidden;
}

.dle-card__veil {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: #fff;
  border-radius: inherit;
  color: var(--theme-text-muted, #666);
}

.dle-card__veil p {
  margin: 0;
}

.dle-card--placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 12rem;
  text-align: center;
  color: var(--theme-text-muted, #666);
  cursor: default;
}

.dle-card--placeholder p {
  margin: 0;
}

.dle-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
  background: #f8f9ff;
}

.dle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.dle-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.25rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.dle-version {
  background: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.dle-card-body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.dle-card-panels {
  display: grid;
  gap: 0.75rem;
  align-items: stretch;
}

.dle-identity {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  padding: 0.75rem 0.85rem 0.85rem;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

.dle-identity__title {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-dark, #1f2937);
}

.dle-identity__location {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.45;
  color: var(--color-dark, #1f2937);
}

.dle-identity__meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.dle-card-more {
  display: flex;
  justify-content: center;
}

.dle-details {
  margin-bottom: 0;
  min-width: 0;
}

@media (max-width: 1024px) {
  .dle-card-panels {
    grid-template-columns: minmax(0, 1fr) !important;
  }
}

.detail-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.detail-item strong {
  color: #333;
}

.address {
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-size: 0.875rem;
}

.address-link {
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.125rem 0.25rem;
  border-radius: 3px;
  font-size: 0.875rem;
  color: var(--color-primary);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  transition: all 0.2s;
  overflow-wrap: anywhere;
  word-break: break-all;
  max-width: 100%;
  min-width: 0;
}

.address-link:hover {
  background: #e3f2fd;
  color: var(--color-primary-dark);
  text-decoration: none;
}

.address-link i {
  font-size: 0.75rem;
  opacity: 0.7;
}

.multichain-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-block;
}

.networks-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0;
}

.network-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #f0f0f0;
  min-width: 0;
}

.network-item:last-child {
  border-bottom: none;
}

.chain-name {
  font-weight: 600;
  color: #333;
  min-width: 0;
  flex-shrink: 0;
}

.status {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.status.active {
  background: #d4edda;
  color: #155724;
}

.dle-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn-sm {
  /* размер — global .btn-sm */
}

.management-block h3 {
  color: var(--color-primary);
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.management-block p {
  color: var(--theme-text-muted);
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
  flex-grow: 1;
}

/* Стили для отображения логотипа */
.dle-title-section {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.dle-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: contain;
  border: 2px solid #e9ecef;
  background: white;
}

.default-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  border: 2px solid #e9ecef;
}

.dle-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dle-title h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--color-primary);
}

.dle-version {
  font-size: 0.8rem;
  color: #6c757d;
  background: #f8f9fa;
  padding: 2px 6px;
  border-radius: 4px;
  align-self: flex-start;
}


/* Стили для новых элементов */
.token-supply {
  color: var(--color-primary);
  font-weight: 600;
}

.logo-info {
  color: var(--color-primary);
  font-weight: 600;
}

.quorum-info {
  color: #fd7e14;
  font-weight: 600;
}

.creation-date {
  color: #6c757d;
  font-weight: 500;
}



/* Адаптивность */
@media (max-width: 768px) {
  .dle-title-section {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .dle-logo,
  .default-logo {
    width: 40px;
    height: 40px;
    font-size: 12px;
  }
  
  .dle-header h3 {
    font-size: 1.1rem;
  }
  
  .detail-item {
    font-size: 0.85rem;
  }
  
  .address {
    font-size: 0.8rem;
    word-break: break-all;
  }
  
  .networks-list {
    font-size: 0.8rem;
  }
}






/* TZ package R stack */
@media (max-width: 768px) {
  [class*="grid"], .form-row, .management-blocks, .cards-grid {
    grid-template-columns: 1fr !important;
  }
  .row, .actions, .toolbar, .filters, .form-actions {
    flex-wrap: wrap;
  }
}
</style> 