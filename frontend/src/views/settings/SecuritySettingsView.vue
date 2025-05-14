<template>
  <div class="security-settings settings-panel">
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
    
    <!-- Раскрывающиеся настройки RPC -->
    <div v-if="showRpcSettings" class="detail-panel">
      <h3>Настройки RPC Провайдеров</h3>
      <p class="env-note">Эти настройки сохраняются в .env файле на бэкенде.</p>
      
      <!-- Список добавленных RPC -->
      <div v-if="securitySettings.rpcConfigs.length > 0" class="configs-list">
        <h4>Добавленные RPC конфигурации:</h4>
        <div v-for="(rpc, index) in securitySettings.rpcConfigs" :key="index" class="config-item">
          <div class="config-details">
            <div><strong>ID Сети:</strong> {{ rpc.networkId }}</div>
            <div><strong>URL:</strong> {{ rpc.rpcUrl }}</div>
            <div v-if="rpc.chainId"><strong>Chain ID:</strong> {{ rpc.chainId }}</div>
          </div>
          <div class="config-actions">
            <button class="btn btn-info" @click="testRpcHandler(rpc)" :disabled="testingRpc && testingRpcId === rpc.networkId">
              <i class="fas" :class="testingRpc && testingRpcId === rpc.networkId ? 'fa-spinner fa-spin' : 'fa-check-circle'"></i>
              {{ testingRpc && testingRpcId === rpc.networkId ? 'Проверка...' : 'Тест' }}
            </button>
            <button class="btn btn-danger" @click="removeRpcConfig(index)">
              <i class="fas fa-trash"></i> Удалить
            </button>
          </div>
        </div>
      </div>
      <p v-else>Нет добавленных RPC конфигураций.</p>

      <!-- Форма добавления нового RPC -->
      <div class="setting-form add-form">
        <h4>Добавить новую RPC конфигурацию:</h4>
        <div class="form-group">
          <label class="form-label" for="newRpcNetworkId">ID Сети:</label>
          <select id="newRpcNetworkId" v-model="networkEntry.networkId" class="form-control">
            <optgroup v-for="(group, groupIndex) in networkGroups" :key="groupIndex" :label="group.label">
              <option v-for="option in group.options" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </optgroup>
          </select>
          <div v-if="networkEntry.networkId === 'custom'" class="mt-2">
            <label class="form-label" for="customNetworkId">Пользовательский ID:</label>
            <input type="text" id="customNetworkId" v-model="networkEntry.customNetworkId" class="form-control" placeholder="Введите ID сети">
            
            <label class="form-label mt-2" for="customChainId">Chain ID:</label>
            <input type="number" id="customChainId" v-model="networkEntry.customChainId" class="form-control" placeholder="Например, 1 для Ethereum">
            <small>Chain ID - уникальный идентификатор блокчейн-сети (целое число)</small>
          </div>
          <small>ID сети должен совпадать со значением в выпадающем списке сетей при создании DLE</small>
        </div>
        <div class="form-group">
          <label class="form-label" for="newRpcUrl">RPC URL:</label>
          <input type="text" id="newRpcUrl" v-model="networkEntry.rpcUrl" class="form-control" placeholder="https://...">
          <!-- Предложение URL на основе выбранной сети -->
          <small v-if="defaultRpcUrlSuggestion" class="suggestion">
            Предложение: {{ defaultRpcUrlSuggestion }}
            <button class="btn-link" @click="useDefaultRpcUrl">Использовать</button>
          </small>
        </div>
        <button class="btn btn-secondary" @click="addRpcConfig">Добавить RPC</button>
      </div>
    </div>
    
    <!-- Раскрывающиеся настройки Аутентификации -->
    <div v-if="showAuthSettings" class="detail-panel">
      <h3>Настройки Аутентификации</h3>
      <p class="env-note">Эти настройки сохраняются в .env файле на бэкенде.</p>
      
      <!-- Список токенов для проверки баланса -->
      <div v-if="securitySettings.authTokens.length > 0" class="configs-list">
        <h4>Токены для проверки при авторизации:</h4>
        <div v-for="(token, index) in securitySettings.authTokens" :key="index" class="config-item">
          <div class="config-details">
            <div><strong>Название:</strong> {{ token.name }}</div>
            <div><strong>Адрес:</strong> {{ token.address }}</div>
            <div><strong>Сеть:</strong> {{ token.network }}</div>
            <div><strong>Мин. баланс:</strong> {{ token.minBalance }}</div>
          </div>
          <button class="btn btn-danger" @click="removeAuthToken(index)">
            <i class="fas fa-trash"></i> Удалить
          </button>
        </div>
      </div>
      <p v-else>Нет добавленных токенов для проверки при авторизации.</p>

      <!-- Форма добавления нового токена для авторизации -->
      <div class="setting-form add-form">
        <h4>Добавить новый токен для проверки при авторизации:</h4>
        <div class="form-group">
          <label class="form-label" for="newTokenName">Название токена:</label>
          <input type="text" id="newTokenName" v-model="newAuthToken.name" class="form-control" placeholder="Например, MyToken">
        </div>
        <div class="form-group">
          <label class="form-label" for="newTokenAddress">Адрес контракта:</label>
          <input type="text" id="newTokenAddress" v-model="newAuthToken.address" class="form-control" placeholder="0x...">
        </div>
        <div class="form-group">
          <label class="form-label" for="newTokenNetwork">Сеть:</label>
          <select id="newTokenNetwork" v-model="newAuthToken.network" class="form-control">
            <option v-for="option in networkOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="newTokenMinBalance">Минимальный баланс:</label>
          <input type="text" id="newTokenMinBalance" v-model="newAuthToken.minBalance" class="form-control" placeholder="1.0">
          <small>Минимальный баланс токена для успешной авторизации</small>
        </div>
        <button class="btn btn-secondary" @click="addAuthToken">Добавить токен</button>
      </div>
    </div>
    
    <div class="sub-settings-panel save-panel">
      <button class="btn btn-primary btn-lg" @click="saveSecuritySettings" :disabled="isSaving">
        <span v-if="isSaving">
          <i class="fas fa-spinner fa-spin"></i>
          Сохранение...
        </span>
        <span v-else>Сохранить все настройки</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, computed } from 'vue';
import api from '@/api/axios';
import useBlockchainNetworks from '@/composables/useBlockchainNetworks';

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
  defaultRpcUrlSuggestion, 
  useDefaultRpcUrl,
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
      securitySettings.rpcConfigs = rpcResponse.data.data || [];
    }
    
    // Загрузка токенов для аутентификации
    const authResponse = await api.get('/api/settings/auth-tokens');
    if (authResponse.data && authResponse.data.success) {
      securitySettings.authTokens = authResponse.data.data || [];
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
  securitySettings.rpcConfigs = [
    { networkId: 'ethereum', rpcUrl: 'https://mainnet.infura.io/v3/YOUR_API_KEY' },
    { networkId: 'sepolia', rpcUrl: 'https://sepolia.infura.io/v3/YOUR_API_KEY' },
    { networkId: 'bsc', rpcUrl: 'https://bsc-dataseed1.binance.org' },
    { networkId: 'arbitrum', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
    { networkId: 'polygon', rpcUrl: 'https://polygon-rpc.com' }
  ];
  
  securitySettings.authTokens = [
    { name: 'Ethereum Token', address: '0xd95a45fc46a7300e6022885afec3d618d7d3f27c', network: 'eth', minBalance: '1.0' },
    { name: 'BSC Token', address: '0x4B294265720B09ca39BFBA18c7E368413c0f68eB', network: 'bsc', minBalance: '10.0' },
    { name: 'Arbitrum Token', address: '0xdce769b847a0a697239777d0b1c7dd33b6012ba0', network: 'arbitrum', minBalance: '0.5' },
    { name: 'Custom Token', address: '0x351f59de4fedbdf7601f5592b93db3b9330c1c1d', network: 'eth', minBalance: '5.0' }
  ];
};

// Функция добавления новой RPC конфигурации
const addRpcConfig = () => {
  const result = validateAndPrepareNetworkConfig();
  
  if (!result.valid) {
    alert(result.error);
    return;
  }
  
  const { networkId, rpcUrl, chainId } = result.networkConfig;
  
  // Проверка на дубликат ID
  if (securitySettings.rpcConfigs.some(rpc => rpc.networkId === networkId)) {
    alert(`Ошибка: RPC конфигурация для сети с ID '${networkId}' уже существует.`);
    return;
  }
  
  securitySettings.rpcConfigs.push({ networkId, rpcUrl, chainId });
  
  // Очистка полей ввода
  resetNetworkEntry();
};

// Функция удаления RPC конфигурации
const removeRpcConfig = (index) => {
  securitySettings.rpcConfigs.splice(index, 1);
};

// Функция добавления нового токена для авторизации
const addAuthToken = () => {
  const name = newAuthToken.name.trim();
  const address = newAuthToken.address.trim();
  const minBalance = newAuthToken.minBalance.trim();
  const network = newAuthToken.network;
  
  if (name && address) {
    // Проверка на дубликат адреса
    if (securitySettings.authTokens.some(token => token.address.toLowerCase() === address.toLowerCase())) {
      alert(`Ошибка: Токен с адресом '${address}' уже добавлен.`);
      return;
    }
    
    securitySettings.authTokens.push({ name, address, minBalance, network });
    
    // Очистка полей ввода
    newAuthToken.name = '';
    newAuthToken.address = '';
    newAuthToken.minBalance = '1.0';
    newAuthToken.network = 'eth';
  } else {
    alert('Пожалуйста, заполните название и адрес токена.');
  }
};

// Функция удаления токена авторизации
const removeAuthToken = (index) => {
  securitySettings.authTokens.splice(index, 1);
};

// Сохранение всех настроек безопасности на бэкенд
const saveSecuritySettings = async () => {
  isSaving.value = true;
  try {
    // Подготовка данных для отправки
    const settingsData = {
      rpcConfigs: JSON.parse(JSON.stringify(securitySettings.rpcConfigs)),
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

// Функция-обработчик для тестирования RPC соединения
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

// Загрузка настроек при монтировании компонента
onMounted(() => {
  loadSettings();
});
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

.save-panel {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-lg, 20px);
  padding-top: var(--spacing-md, 15px);
  border-top: 1px solid var(--color-grey-light, #eee);
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
</style> 