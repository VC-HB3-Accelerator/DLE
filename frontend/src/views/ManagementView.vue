<!--
  Copyright (c) 2024-2025 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
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
    <div class="management-container">
      <!-- Заголовок -->
      <div class="management-header">
        <h1>Управление DLE</h1>
        <button class="close-btn" @click="router.push('/')">×</button>
      </div>

      <!-- Деплоированные DLE -->
      <div class="deployed-dles-section">
        <div class="section-header">
          <div class="header-actions">
            <button class="add-dle-btn" @click="openDleManagement()">
              <i class="fas fa-plus"></i>
              Добавить DLE
            </button>
            <button class="refresh-btn" @click="loadDeployedDles" :disabled="isLoadingDles">
              <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoadingDles }"></i>
              {{ isLoadingDles ? 'Загрузка...' : 'Обновить' }}
            </button>
          </div>
        </div>

        <div v-if="isLoadingDles" class="loading-dles">
          <p>Загрузка деплоированных DLE...</p>
        </div>

        <div v-else-if="deployedDles.length === 0" class="no-dles">
          <p>Деплоированных DLE пока нет</p>
          <p>Создайте новый DLE на странице <a href="/settings/dle-v2-deploy" class="link">Деплой DLE</a></p>
        </div>

        <div v-else class="dles-grid">
          <div 
            v-for="dle in deployedDles" 
            :key="dle.dleAddress" 
            class="dle-card"
            :class="{ 'selected': selectedDle && selectedDle.dleAddress === dle.dleAddress }"
            @click="selectDle(dle)"
          >
            <div class="dle-header">
              <h3>{{ dle.name }} ({{ dle.symbol }})</h3>
              <span class="dle-version">{{ dle.version || 'v2' }}</span>
            </div>

            <div class="dle-details">
              <div class="detail-item" v-if="dle.deployedMultichain">
                <strong>🌐 Мультичейн деплой:</strong> 
                <span class="multichain-badge">{{ dle.totalNetworks }}/{{ dle.supportedChainIds?.length || dle.totalNetworks }} сетей</span>
              </div>
              <div class="detail-item" v-if="dle.networks && dle.networks.length">
                <strong>Адреса по сетям:</strong>
                <ul class="networks-list">
                  <li v-for="net in dle.networks" :key="net.chainId" class="network-item">
                    <span class="chain-name">{{ getChainName(net.chainId) }}:</span>
                    <a 
                      :href="getExplorerUrl(net.chainId, net.dleAddress)" 
                      target="_blank" 
                      class="address-link"
                      @click.stop
                    >
                      {{ shortenAddress(net.dleAddress) }}
                      <i class="fas fa-external-link-alt"></i>
                    </a>
                  </li>
                </ul>
              </div>
              <div class="detail-item" v-else>
                <strong>Адрес контракта:</strong> 
                <a 
                  :href="`https://sepolia.etherscan.io/address/${dle.dleAddress}`" 
                  target="_blank" 
                  class="address-link"
                  @click.stop
                >
                  {{ shortenAddress(dle.dleAddress) }}
                  <i class="fas fa-external-link-alt"></i>
                </a>
              </div>
              <div class="detail-item">
                <strong>Местоположение:</strong> {{ dle.location }}
              </div>
              <div class="detail-item">
                <strong>Юрисдикция:</strong> {{ dle.jurisdiction }}
              </div>
              <div class="detail-item">
                <strong>Коды ОКВЭД:</strong> {{ dle.okvedCodes?.join(', ') || 'Не указаны' }}
              </div>
              <div class="detail-item">
                <strong>Партнеры:</strong> {{ dle.participantCount || 0 }} участников
              </div>
              <div class="detail-item">
                <strong>Статус:</strong> 
                <span class="status active">Активен</span>
              </div>
              <div class="detail-item" v-if="verificationStatuses[dle.dleAddress]">
                <strong>Верификация:</strong>
                <ul class="verify-list">
                  <li v-for="(info, chainId) in verificationStatuses[dle.dleAddress].chains" :key="chainId">
                    Chain {{ chainId }}: {{ info.status || '—' }}<span v-if="info.guid"> (guid: {{ info.guid.slice(0,8) }}…)</span>
                  </li>
                </ul>
                <button class="details-btn btn-sm" @click.stop="refreshVerification(dle.dleAddress)">Обновить статус</button>
              </div>
            </div>


          </div>
        </div>
      </div>



      <!-- Блоки управления выбранным DLE -->
      <div v-if="selectedDle" class="management-blocks">

        <!-- Первый ряд -->
        <div class="blocks-row">
          <div class="management-block">
            <h3>Предложения</h3>
            <p>Создание, подписание, выполнение</p>
            <button class="details-btn" @click="openProposalsWithDle">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Токены DLE</h3>
            <p>Балансы, трансферы, распределение</p>
            <button class="details-btn" @click="openTokensWithDle">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Кворум</h3>
            <p>Настройки голосования</p>
            <button class="details-btn" @click="openQuorumWithDle">Подробнее</button>
          </div>
        </div>

        <!-- Второй ряд -->
        <div class="blocks-row">
          <div class="management-block">
            <h3>Модули DLE</h3>
            <p>Установка, настройка, управление</p>
            <button class="details-btn" @click="openModulesWithDle">Подробнее</button>
          </div>
          

          
          <div class="management-block">
            <h3>Аналитика</h3>
            <p>Графики, статистика, отчеты</p>
            <button class="details-btn" @click="openAnalyticsWithDle">Подробнее</button>
          </div>
        </div>

        <!-- Третий ряд -->
        <div class="blocks-row">
          <div class="management-block">
            <h3>История</h3>
            <p>Лог операций, события, транзакции</p>
            <button class="details-btn" @click="openHistoryWithDle">Подробнее</button>
          </div>
          
          <div class="management-block">
            <h3>Настройки</h3>
            <p>Параметры DLE, конфигурация</p>
            <button class="details-btn" @click="openSettingsWithDle">Подробнее</button>
          </div>
          

        </div>
      </div>


    </div>


  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../components/BaseLayout.vue';
import api from '@/api/axios';

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
const isLoadingDles = ref(false);
const selectedDle = ref(null);
const verificationStatuses = ref({}); // { [address]: { address, chains: { [chainId]: { guid, status } } } }
let verifyPollTimer = null;



// Функции для открытия страниц управления
const openProposals = () => {
  router.push('/management/proposals');
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
  try {
    isLoadingDles.value = true;
    console.log('[ManagementView] Начинаем загрузку DLE...');
    
    // Сначала получаем список DLE из API
    const response = await api.get('/dle-v2');
    console.log('[ManagementView] Ответ от API /dle-v2:', response.data);
    
    if (response.data.success) {
      const dlesFromApi = response.data.data || [];
      console.log('[ManagementView] DLE из API:', dlesFromApi);
      
      if (dlesFromApi.length === 0) {
        console.log('[ManagementView] Нет DLE в API, показываем пустой список');
        deployedDles.value = [];
        return;
      }
      
      // Для каждого DLE читаем актуальные данные из блокчейна
      const dlesWithBlockchainData = await Promise.all(
        dlesFromApi.map(async (dle) => {
          try {
            console.log(`[ManagementView] Читаем данные из блокчейна для ${dle.dleAddress}`);
            
            // Читаем данные из блокчейна
            const blockchainResponse = await api.post('/blockchain/read-dle-info', {
              dleAddress: dle.dleAddress
            });
            
            console.log(`[ManagementView] Ответ от блокчейна для ${dle.dleAddress}:`, blockchainResponse.data);
            
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
                oktmo: blockchainData.oktmo || dle.oktmo,
                okvedCodes: blockchainData.okvedCodes || dle.okvedCodes,
                kpp: blockchainData.kpp || dle.kpp,
                // Информация о токенах из блокчейна
                totalSupply: blockchainData.totalSupply,
                deployerBalance: blockchainData.deployerBalance,
                // Количество участников (держателей токенов)
                participantCount: blockchainData.participantCount || 0
              };
              
              console.log(`[ManagementView] Объединенные данные для ${dle.dleAddress}:`, combinedDle);
              return combinedDle;
            } else {
              console.warn(`[ManagementView] Не удалось прочитать данные из блокчейна для ${dle.dleAddress}:`, blockchainResponse.data.error);
              return dle;
            }
          } catch (error) {
            console.warn(`[ManagementView] Ошибка при чтении данных из блокчейна для ${dle.dleAddress}:`, error);
            return dle;
          }
        })
      );
      
      deployedDles.value = dlesWithBlockchainData;
      console.log('[ManagementView] Итоговый список DLE:', deployedDles.value);

      // Подгружаем статусы верификации для всех адресов
      for (const dle of deployedDles.value) {
        try {
          const st = await api.get(`/dle-v2/verify/status/${dle.dleAddress}`);
          if (st.data?.success && st.data.data) {
            verificationStatuses.value[dle.dleAddress] = st.data.data;
          }
        } catch (e) {
          // no-op
        }
      }
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
function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

function getExplorerUrl(chainId, address) {
  const explorers = {
    1: 'https://etherscan.io',
    11155111: 'https://sepolia.etherscan.io',
    17000: 'https://holesky.etherscan.io',
    421614: 'https://sepolia.arbiscan.io',
    84532: 'https://sepolia.basescan.org',
    137: 'https://polygonscan.com',
    56: 'https://bscscan.com',
    42161: 'https://arbiscan.io'
  };
  const baseUrl = explorers[chainId] || 'https://etherscan.io';
  return `${baseUrl}/address/${address}`;
}

function openDleOnEtherscan(address) {
  window.open(`https://sepolia.etherscan.io/address/${address}`, '_blank');
}

function openDleManagement(dleAddress) {
  // Переход к детальному управлению DLE (если нужно)
  router.push(`/management/dle-management?address=${dleAddress}`);
}

function selectDle(dle) {
  selectedDle.value = dle;
  console.log('Выбран DLE:', dle);
}

async function refreshVerification(address) {
  try {
    const resp = await api.post(`/dle-v2/verify/refresh/${address}`, {});
    if (resp.data?.success && resp.data.data) {
      verificationStatuses.value[address] = resp.data.data;
    }
  } catch (e) {
    // no-op
  }
}

function isTerminalStatus(status) {
  if (!status) return false;
  const s = String(status).toLowerCase();
  return s.includes('pass') || s.includes('verified') || s.startsWith('error');
}

async function pollVerifications() {
  try {
    const addresses = Object.keys(verificationStatuses.value || {});
    for (const addr of addresses) {
      const chains = verificationStatuses.value[addr]?.chains || {};
      const hasPending = Object.values(chains).some((c) => !isTerminalStatus(c.status));
      if (hasPending) {
        await refreshVerification(addr);
      }
    }
  } catch {}
}

// function openMultisig() {
//   router.push('/management/multisig');
// }

// Функции с передачей адреса DLE
function openProposalsWithDle() {
  if (selectedDle.value) {
    router.push(`/management/proposals?address=${selectedDle.value.dleAddress}`);
  }
}

function openTokensWithDle() {
  if (selectedDle.value) {
    router.push(`/management/tokens?address=${selectedDle.value.dleAddress}`);
  }
}

function openQuorumWithDle() {
  if (selectedDle.value) {
    router.push(`/management/quorum?address=${selectedDle.value.dleAddress}`);
  }
}

function openModulesWithDle() {
  if (selectedDle.value) {
    router.push(`/management/modules?address=${selectedDle.value.dleAddress}`);
  }
}



function openAnalyticsWithDle() {
  if (selectedDle.value) {
    router.push(`/management/analytics?address=${selectedDle.value.dleAddress}`);
  }
}

function openHistoryWithDle() {
  if (selectedDle.value) {
    router.push(`/management/history?address=${selectedDle.value.dleAddress}`);
  }
}

function openSettingsWithDle() {
  if (selectedDle.value) {
    router.push(`/management/settings?address=${selectedDle.value.dleAddress}`);
  }
}

// function openMultisigWithDle() {
//   if (selectedDle.value) {
//     router.push(`/management/multisig?address=${selectedDle.value.dleAddress}`);
//   }
// }



onMounted(() => {
  loadDeployedDles();
  verifyPollTimer = setInterval(pollVerifications, 15000);
});

onBeforeUnmount(() => {
  if (verifyPollTimer) {
    clearInterval(verifyPollTimer);
    verifyPollTimer = null;
  }
});
</script>

<style scoped>
.management-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.management-header h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

/* Блоки управления */
.management-blocks {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  margin-top: 2rem;
}

.blocks-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.management-block {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.management-block:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

/* Секция деплоированных DLE */
.deployed-dles-section {
  margin-top: 3rem;
}

.section-header {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 2rem;
}

.header-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.add-dle-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.add-dle-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

.add-dle-btn i {
  font-size: 0.875rem;
}

.section-header h2 {
  color: var(--color-primary);
  margin: 0;
}

.refresh-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  transition: background-color 0.2s;
}

.refresh-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}



.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-dles,
.no-dles {
  text-align: center;
  padding: 2rem;
  color: #666;
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
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 1.5rem;
}

.dle-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.dle-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
  cursor: pointer;
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
  margin-bottom: 1rem;
}

.dle-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.25rem;
}

.dle-version {
  background: #e9ecef;
  color: #495057;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

.dle-details {
  margin-bottom: 1.5rem;
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
  padding: 0.25rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.network-item:last-child {
  border-bottom: none;
}

.chain-name {
  font-weight: 600;
  color: #333;
  min-width: 120px;
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
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}

.btn-info {
  background: #17a2b8;
  color: white;
}

.btn-info:hover {
  background: #138496;
}





.management-block h3 {
  color: var(--color-primary);
  margin: 0 0 1rem 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.management-block p {
  color: var(--color-grey-dark);
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
  flex-grow: 1;
}

.details-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;
  margin: 0;
  min-width: 120px;
}

.details-btn:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
}

/* Адаптивность */
@media (max-width: 768px) {
  .blocks-row {
    grid-template-columns: 1fr;
  }
  
  .management-block {
    padding: 1.5rem;
  }
  
  .management-block h3 {
    font-size: 1.3rem;
  }
}




</style> 