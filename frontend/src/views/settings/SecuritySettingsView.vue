<template>
  <div class="security-settings settings-panel">
    <button class="close-btn" @click="goBack">×</button>
    <h2>Настройки безопасности и подключения к блокчейну</h2>

    <!-- Индикатор загрузки -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <div>Загрузка настроек...</div>
    </div>

    <div v-else class="settings-cards">
      <!-- Блок RPC Провайдеры -->
      <div class="info-card">
        <h3>RPC Провайдеры</h3>
        <div class="info-row">
          <span class="info-label">Провайдеры:</span>
          <span class="info-value">{{ securitySettings.rpcConfigs.length > 0 ? `${securitySettings.rpcConfigs.length} настроено` : 'Не настроено' }}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-info" @click="showRpcSettings = !showRpcSettings">
            <i class="fas fa-info-circle"></i> Подробнее
          </button>
        </div>
      </div>

      <!-- Блок Аутентификация -->
      <div class="info-card">
        <h3>Аутентификация</h3>
        <div class="info-row">
          <span class="info-label">Токены:</span>
          <span class="info-value">{{ securitySettings.authTokens.length > 0 ? `${securitySettings.authTokens.length} настроено` : 'Не настроено' }}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-info" @click="showAuthSettings = !showAuthSettings">
            <i class="fas fa-info-circle"></i> Подробнее
          </button>
        </div>
      </div>
    </div>
    
    <RpcProvidersSettings
      v-if="showRpcSettings"
      :rpcConfigs="securitySettings.rpcConfigs"
      @update="loadSettings"
      @test="testRpcHandler"
    />
    <AuthTokensSettings
      v-if="showAuthSettings"
      :authTokens="securitySettings.authTokens"
      @update="loadSettings"
    />
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed, provide } from 'vue';
import api from '@/api/axios';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks';
import eventBus from '@/utils/eventBus';
import RpcProvidersSettings from './RpcProvidersSettings.vue';
import AuthTokensSettings from './AuthTokensSettings.vue';
import { useRouter } from 'vue-router';

// Состояние для отображения/скрытия дополнительных настроек
const showRpcSettings = ref(false);
const showAuthSettings = ref(false);
const isLoading = ref(true);
const isSaving = ref(false);

// Настройки безопасности
const securitySettings = reactive({
  rpcConfigs: [],
  authTokens: []
});

// Инициализация composable для работы с сетями блокчейн
const { 
  networkGroups, 
  networkEntry, 
  validateAndPrepareNetworkConfig,
  resetNetworkEntry,
  testRpcConnection,
  testingRpc,
  testingRpcId,
  networks
} = useBlockchainNetworks();

// Реактивный объект для нового токена авторизации
const newAuthToken = reactive({
  name: '',
  address: '',
  minBalance: '1.0',
  network: 'eth'
});

// Вспомогательная функция для маппинга сетевых ID в форматы токенов авторизации
const getNetworkKeyForAuth = (networkId) => {
  const mapping = {
    'ethereum': 'eth',
    'bsc': 'bsc',
    'polygon': 'polygon',
    'arbitrum': 'arbitrum',
    'sepolia': 'sepolia',
    'goerli': 'goerli',
    'mumbai': 'mumbai',
    'bsc-testnet': 'bsc-testnet',
    'arbitrum-goerli': 'arbitrum-goerli'
  };
  return mapping[networkId] || networkId;
};

// Вычисляемый список сетей для выбора в форме
const networkOptions = computed(() => {
  if (!networks || !Array.isArray(networks.value)) return [];
  
  return networks.value
    .filter(network => {
      // Добавляем все сети из useBlockchainNetworks.js
      return true; // Убираем фильтрацию для отображения всех доступных сетей
    })
    .map(network => ({
      value: getNetworkKeyForAuth(network.value),
      label: network.label
    }));
});

// Загрузка настроек с бэкенда
const loadSettings = async () => {
  isLoading.value = true;
  try {
    // Загрузка RPC конфигураций
    const rpcResponse = await api.get('/api/settings/rpc');
    if (rpcResponse.data && rpcResponse.data.success) {
      securitySettings.rpcConfigs = (rpcResponse.data.data || []).map(rpc => ({
        networkId: rpc.network_id,
        rpcUrl: rpc.rpc_url,
        chainId: rpc.chain_id
      }));
    }
    
    // Загрузка токенов для аутентификации
    const authResponse = await api.get('/api/settings/auth-tokens');
    if (authResponse.data && authResponse.data.success) {
      securitySettings.authTokens = (authResponse.data.data || []).map(token => ({
        name: token.name,
        address: token.address,
        network: token.network,
        minBalance: token.min_balance
      }));
    }
    
    console.log('[SecuritySettingsView] Настройки успешно загружены с бэкенда');
  } catch (error) {
    console.error('[SecuritySettingsView] Ошибка при загрузке настроек:', error);
    
    // Если не удалось загрузить с бэкенда, устанавливаем дефолтные значения
    setDefaultSettings();
    
    alert('Не удалось загрузить настройки с сервера. Загружены значения по умолчанию.');
  } finally {
    isLoading.value = false;
  }
};

// Установка дефолтных значений
const setDefaultSettings = () => {
  securitySettings.rpcConfigs = [];
  securitySettings.authTokens = [];
};

// Сохранение всех настроек безопасности на бэкенд
const saveSecuritySettings = async () => {
  isSaving.value = true;
  try {
    // Подготовка данных для отправки
    const validRpcConfigs = securitySettings.rpcConfigs.filter(
      c => c.networkId && c.rpcUrl
    );
    
    const settingsData = {
      rpcConfigs: validRpcConfigs,
      authTokens: JSON.parse(JSON.stringify(securitySettings.authTokens))
    };
    
    console.log('[SecuritySettingsView] Отправка настроек на сервер:', settingsData);
    
    // Отправка RPC конфигураций
    const rpcResponse = await api.post('/api/settings/rpc', { 
      rpcConfigs: settingsData.rpcConfigs 
    });
    
    // Отправка токенов для аутентификации
    const authResponse = await api.post('/api/settings/auth-tokens', { 
      authTokens: settingsData.authTokens 
    });
    
    if (rpcResponse.data.success && authResponse.data.success) {
      alert('Все настройки безопасности успешно сохранены.');
      eventBus.emit('settings-updated');
      eventBus.emit('auth-settings-saved', { tokens: settingsData.authTokens });
    } else {
      alert('Произошла ошибка при сохранении настроек. Проверьте консоль разработчика.');
    }
  } catch (error) {
    console.error('[SecuritySettingsView] Ошибка при сохранении настроек:', error);
    alert(`Ошибка при сохранении настроек: ${error.message || 'Неизвестная ошибка'}`);
  } finally {
    isSaving.value = false;
  }
};

// Загрузка настроек при монтировании компонента
onMounted(() => {
  loadSettings();
});

// --- Методы для RPC ---
const addRpcConfig = () => {
  const result = validateAndPrepareNetworkConfig();
  if (!result.valid) {
    alert(result.error);
    return;
  }
  const { networkId, rpcUrl, chainId } = result.networkConfig;
  if (securitySettings.rpcConfigs.some(rpc => rpc.networkId === networkId)) {
    alert(`Ошибка: RPC конфигурация для сети с ID '${networkId}' уже существует.`);
    return;
  }
  securitySettings.rpcConfigs.push({ networkId, rpcUrl, chainId });
  resetNetworkEntry();
};

const removeRpcConfig = (index) => {
  securitySettings.rpcConfigs.splice(index, 1);
};

const testRpcHandler = async (rpc) => {
  try {
    const result = await testRpcConnection(rpc.networkId, rpc.rpcUrl);
    if (result.success) {
      alert(result.message);
    } else {
      alert(`Ошибка при подключении к ${rpc.networkId}: ${result.error}`);
    }
  } catch (error) {
    console.error('[SecuritySettingsView] Ошибка при тестировании RPC:', error);
    alert(`Ошибка при тестировании RPC: ${error.message || 'Неизвестная ошибка'}`);
  }
};

// --- Методы для токенов аутентификации ---
const addAuthToken = () => {
  const name = newAuthToken.name.trim();
  const address = newAuthToken.address.trim();
  const minBalance = newAuthToken.minBalance.trim();
  const network = newAuthToken.network;
  if (name && address) {
    if (securitySettings.authTokens.some(token => token.address.toLowerCase() === address.toLowerCase())) {
      alert(`Ошибка: Токен с адресом '${address}' уже добавлен.`);
      return;
    }
    securitySettings.authTokens.push({ name, address, minBalance, network });
    newAuthToken.name = '';
    newAuthToken.address = '';
    newAuthToken.minBalance = '1.0';
    newAuthToken.network = 'eth';
  } else {
    alert('Пожалуйста, заполните название и адрес токена.');
  }
};

const removeAuthToken = (index) => {
  securitySettings.authTokens.splice(index, 1);
};

// provide для дочерних компонентов
provide('rpcConfigs', securitySettings.rpcConfigs);
provide('removeRpcConfig', removeRpcConfig);
provide('addRpcConfig', addRpcConfig);
provide('testRpcHandler', testRpcHandler);
provide('testingRpc', testingRpc);
provide('testingRpcId', testingRpcId);
provide('networkGroups', networkGroups);
provide('networkEntry', networkEntry);
provide('validateAndPrepareNetworkConfig', validateAndPrepareNetworkConfig);
provide('resetNetworkEntry', resetNetworkEntry);
provide('authTokens', securitySettings.authTokens);
provide('removeAuthToken', removeAuthToken);
provide('addAuthToken', addAuthToken);
provide('newAuthToken', newAuthToken);
provide('networks', networks);

const router = useRouter();
const goBack = () => router.push('/settings');
</script>

<style scoped>
.settings-panel {
  padding: var(--block-padding, 20px);
  background-color: var(--color-light, #fff);
  border-radius: var(--radius-md, 8px);
  margin-top: var(--spacing-lg, 20px);
  animation: fadeIn var(--transition-normal, 0.3s);
  position: relative;
}

h2 {
  margin-bottom: var(--spacing-lg, 20px);
  border-bottom: 1px solid var(--color-grey-light, #eee);
  padding-bottom: var(--spacing-md, 15px);
  color: var(--color-dark, #333);
}

h3 {
  margin-bottom: var(--spacing-md, 15px);
  color: var(--color-primary, #4caf50);
}

h4 {
  margin-bottom: var(--spacing-sm, 10px);
  color: var(--color-dark, #333);
}

.settings-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md, 15px);
  margin-bottom: var(--spacing-lg, 20px);
}

.info-card {
  border: 1px solid var(--color-grey-light, #eee);
  border-radius: var(--radius-md, 8px);
  padding: var(--spacing-md, 15px);
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.3s ease, transform 0.3s ease;
}

.info-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.info-row {
  display: flex;
  margin-bottom: var(--spacing-xs, 5px);
}

.info-label {
  font-weight: 500;
  color: var(--color-primary, #4caf50);
  margin-right: var(--spacing-sm, 10px);
  min-width: 80px;
}

.info-value {
  color: var(--color-dark, #333);
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-md, 15px);
}

.detail-panel {
  margin-top: var(--spacing-md, 15px);
  margin-bottom: var(--spacing-lg, 20px);
  padding: var(--spacing-md, 15px);
  border: 1px solid var(--color-grey-light, #eee);
  border-radius: var(--radius-md, 8px);
  background-color: var(--color-light, #fafafa);
  animation: slideDown 0.3s ease;
}

.configs-list {
  margin-bottom: var(--spacing-md, 15px);
}

.config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm, 10px);
  border: 1px solid var(--color-grey-light, #eee);
  border-radius: var(--radius-sm, 4px);
  margin-bottom: var(--spacing-xs, 5px);
  background-color: white;
}

.config-details {
  flex: 1;
}

.config-actions {
  display: flex;
  gap: var(--spacing-sm, 10px);
}

.setting-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 15px);
}

.add-form {
  padding-top: var(--spacing-md, 15px);
  border-top: 1px dashed var(--color-grey-light, #eee);
  margin-top: var(--spacing-md, 15px);
}

.form-group {
  margin-bottom: var(--spacing-sm, 10px);
}

.form-label {
  display: block;
  margin-bottom: var(--spacing-xs, 5px);
  font-weight: 500;
}

.form-control {
  width: 100%;
  max-width: 600px;
  padding: var(--spacing-sm, 10px);
  border: 1px solid var(--color-grey-light, #eee);
  border-radius: var(--radius-sm, 4px);
  font-size: 1rem;
}

small {
  display: block;
  margin-top: var(--spacing-xs, 5px);
  color: var(--color-grey-dark, #777);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: var(--spacing-sm, 10px) var(--spacing-md, 15px);
  border-radius: var(--radius-sm, 4px);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-lg {
  padding: var(--spacing-md, 15px) var(--spacing-lg, 20px);
  font-size: 1.125rem;
}

.btn-primary {
  background-color: var(--color-primary, #4caf50);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: var(--color-primary-dark, #388e3c);
}

.btn-secondary {
  background-color: var(--color-secondary, #2196f3);
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--color-secondary-dark, #1976d2);
}

.btn-info {
  background-color: #17a2b8;
  color: white;
}

.btn-info:hover:not(:disabled) {
  background-color: #138496;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-link {
  background: none;
  border: none;
  padding: 0;
  color: var(--color-primary, #4caf50);
  text-decoration: underline;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-link:hover {
  color: var(--color-primary-dark, #388e3c);
  text-decoration: none;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-md, 8px);
  z-index: 5;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: var(--color-primary, #4caf50);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 10px;
}

.env-note {
  background-color: rgba(33, 150, 243, 0.1);
  border-left: 3px solid var(--color-secondary, #2196f3);
  padding: 10px;
  margin-bottom: 15px;
  border-radius: 0 4px 4px 0;
  color: #0d47a1;
}

.mt-2 {
  margin-top: 10px;
}

.suggestion {
  background-color: rgba(76, 175, 80, 0.1);
  border-left: 3px solid var(--color-primary, #4caf50);
  padding: 6px 10px;
  margin-top: 8px;
  border-radius: 0 4px 4px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideDown {
  from { 
    opacity: 0;
    transform: translateY(-10px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
  z-index: 10;
}
.close-btn:hover {
  color: #333;
}
</style> 