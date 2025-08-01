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
    <div class="settings-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Настройки</h1>
          <p>Параметры DLE и конфигурация</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Основные настройки -->
      <div class="main-settings-section">
        <h2>Основные настройки</h2>
        <form @submit.prevent="saveMainSettings" class="settings-form">
          <div class="form-row">
            <div class="form-group">
              <label for="dleName">Название DLE:</label>
              <input 
                id="dleName"
                v-model="mainSettings.name" 
                type="text" 
                placeholder="Введите название DLE"
                required
              >
            </div>
            
            <div class="form-group">
              <label for="dleSymbol">Символ токена:</label>
              <input 
                id="dleSymbol"
                v-model="mainSettings.symbol" 
                type="text" 
                placeholder="MDLE"
                maxlength="10"
                required
              >
            </div>
          </div>
          
          <div class="form-group">
            <label for="dleDescription">Описание:</label>
            <textarea 
              id="dleDescription"
              v-model="mainSettings.description" 
              placeholder="Опишите назначение и деятельность DLE..."
              rows="4"
            ></textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="dleLocation">Местонахождение:</label>
              <input 
                id="dleLocation"
                v-model="mainSettings.location" 
                type="text" 
                placeholder="Страна, город"
                required
              >
            </div>
            
            <div class="form-group">
              <label for="dleWebsite">Веб-сайт:</label>
              <input 
                id="dleWebsite"
                v-model="mainSettings.website" 
                type="url" 
                placeholder="https://example.com"
              >
            </div>
          </div>
          
          <button type="submit" class="btn-primary" :disabled="isSaving">
            {{ isSaving ? 'Сохранение...' : 'Сохранить настройки' }}
          </button>
        </form>
      </div>

      <!-- Настройки безопасности -->
      <div class="security-settings-section">
        <h2>Настройки безопасности</h2>
        <form @submit.prevent="saveSecuritySettings" class="settings-form">
          <div class="form-row">
            <div class="form-group">
              <label for="minQuorum">Минимальный кворум (%):</label>
              <input 
                id="minQuorum"
                v-model="securitySettings.minQuorum" 
                type="number" 
                min="1" 
                max="100"
                placeholder="51"
                required
              >
              <span class="input-hint">Минимальный процент токенов для принятия решений</span>
            </div>
            
            <div class="form-group">
              <label for="maxProposalDuration">Максимальная длительность предложения (дни):</label>
              <input 
                id="maxProposalDuration"
                v-model="securitySettings.maxProposalDuration" 
                type="number" 
                min="1" 
                max="365"
                placeholder="7"
                required
              >
              <span class="input-hint">Максимальное время жизни предложения</span>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="emergencyThreshold">Порог экстренных действий (%):</label>
              <input 
                id="emergencyThreshold"
                v-model="securitySettings.emergencyThreshold" 
                type="number" 
                min="1" 
                max="100"
                placeholder="75"
                required
              >
              <span class="input-hint">Процент для экстренных действий</span>
            </div>
            
            <div class="form-group">
              <label for="timelockDelay">Задержка таймлока (часы):</label>
              <input 
                id="timelockDelay"
                v-model="securitySettings.timelockDelay" 
                type="number" 
                min="1" 
                max="168"
                placeholder="24"
                required
              >
              <span class="input-hint">Минимальная задержка перед выполнением</span>
            </div>
          </div>
          
          <div class="form-group">
            <label>Дополнительные настройки:</label>
            <div class="checkbox-group">
              <label class="checkbox-item">
                <input 
                  type="checkbox" 
                  v-model="securitySettings.allowDelegation"
                >
                Разрешить делегирование голосов
              </label>
              <label class="checkbox-item">
                <input 
                  type="checkbox" 
                  v-model="securitySettings.requireKYC"
                >
                Требовать KYC для участия
              </label>
              <label class="checkbox-item">
                <input 
                  type="checkbox" 
                  v-model="securitySettings.autoExecute"
                >
                Автоматическое выполнение предложений
              </label>
            </div>
          </div>
          
          <button type="submit" class="btn-primary" :disabled="isSaving">
            {{ isSaving ? 'Сохранение...' : 'Сохранить настройки безопасности' }}
          </button>
        </form>
      </div>

      <!-- Настройки сети -->
      <div class="network-settings-section">
        <h2>Настройки сети</h2>
        <form @submit.prevent="saveNetworkSettings" class="settings-form">
          <div class="form-group">
            <label>Поддерживаемые сети:</label>
            <div class="networks-grid">
              <label 
                v-for="network in availableNetworks" 
                :key="network.id" 
                class="network-checkbox"
              >
                <input 
                  type="checkbox" 
                  :value="network.id" 
                  v-model="networkSettings.enabledNetworks"
                >
                <div class="network-info">
                  <span class="network-name">{{ network.name }}</span>
                  <span class="network-chain-id">Chain ID: {{ network.chainId }}</span>
                </div>
              </label>
            </div>
          </div>
          
          <div class="form-group">
            <label for="defaultNetwork">Сеть по умолчанию:</label>
            <select id="defaultNetwork" v-model="networkSettings.defaultNetwork" required>
              <option value="">Выберите сеть</option>
              <option 
                v-for="network in availableNetworks" 
                :key="network.id"
                :value="network.id"
              >
                {{ network.name }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="rpcEndpoint">RPC Endpoint:</label>
            <input 
              id="rpcEndpoint"
              v-model="networkSettings.rpcEndpoint" 
              type="url" 
              placeholder="https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
            >
            <span class="input-hint">RPC endpoint для подключения к блокчейну</span>
          </div>
          
          <button type="submit" class="btn-primary" :disabled="isSaving">
            {{ isSaving ? 'Сохранение...' : 'Сохранить настройки сети' }}
          </button>
        </form>
      </div>

      <!-- Резервное копирование -->
      <div class="backup-section">
        <h2>Резервное копирование</h2>
        <div class="backup-actions">
          <div class="backup-card">
            <h3>Экспорт настроек</h3>
            <p>Скачайте файл с настройками DLE для резервного копирования</p>
            <button @click="exportSettings" class="btn-secondary">
              Экспортировать
            </button>
          </div>
          
          <div class="backup-card">
            <h3>Импорт настроек</h3>
            <p>Загрузите файл с настройками для восстановления</p>
            <input 
              ref="importFile" 
              type="file" 
              accept=".json"
              @change="importSettings"
              style="display: none"
            >
            <button @click="$refs.importFile.click()" class="btn-secondary">
              Импортировать
            </button>
          </div>
        </div>
      </div>

      <!-- Опасная зона -->
      <div class="danger-zone-section">
        <h2>Опасная зона</h2>
        <div class="danger-actions">
          <div class="danger-card">
            <h3>Сброс настроек</h3>
            <p>Вернуть все настройки к значениям по умолчанию</p>
            <button @click="resetSettings" class="btn-danger">
              Сбросить настройки
            </button>
          </div>
          
          <div class="danger-card">
            <h3>Удаление DLE</h3>
            <p>Полное удаление DLE и всех связанных данных</p>
            <button @click="deleteDLE" class="btn-danger">
              Удалить DLE
            </button>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import { useRouter } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';

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

// Состояние
const isSaving = ref(false);

// Основные настройки
const mainSettings = ref({
  name: 'Мое DLE',
  symbol: 'MDLE',
  description: 'Цифровое юридическое лицо для управления активами и принятия решений',
  location: 'Россия, Москва',
  website: 'https://example.com'
});

// Настройки безопасности
const securitySettings = ref({
  minQuorum: 51,
  maxProposalDuration: 7,
  emergencyThreshold: 75,
  timelockDelay: 24,
  allowDelegation: true,
  requireKYC: false,
  autoExecute: false
});

// Настройки сети
const networkSettings = ref({
  enabledNetworks: [1, 137],
  defaultNetwork: 1,
  rpcEndpoint: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID'
});

// Доступные сети
const availableNetworks = ref([
  { id: 1, name: 'Ethereum Mainnet', chainId: 1 },
  { id: 137, name: 'Polygon', chainId: 137 },
  { id: 56, name: 'BSC', chainId: 56 },
  { id: 42161, name: 'Arbitrum', chainId: 42161 },
  { id: 10, name: 'Optimism', chainId: 10 }
]);

// Методы
const saveMainSettings = async () => {
  if (isSaving.value) return;
  
  try {
    isSaving.value = true;
    
    // Здесь будет логика сохранения основных настроек
    // console.log('Сохранение основных настроек:', mainSettings.value);
    
    // Временная логика
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    alert('Основные настройки успешно сохранены!');
    
  } catch (error) {
          // console.error('Ошибка сохранения основных настроек:', error);
    alert('Ошибка при сохранении настроек');
  } finally {
    isSaving.value = false;
  }
};

const saveSecuritySettings = async () => {
  if (isSaving.value) return;
  
  try {
    isSaving.value = true;
    
    // Здесь будет логика сохранения настроек безопасности
    // console.log('Сохранение настроек безопасности:', securitySettings.value);
    
    // Временная логика
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    alert('Настройки безопасности успешно сохранены!');
    
  } catch (error) {
          // console.error('Ошибка сохранения настроек безопасности:', error);
    alert('Ошибка при сохранении настроек безопасности');
  } finally {
    isSaving.value = false;
  }
};

const saveNetworkSettings = async () => {
  if (isSaving.value) return;
  
  try {
    isSaving.value = true;
    
    // Здесь будет логика сохранения настроек сети
    // console.log('Сохранение настроек сети:', networkSettings.value);
    
    // Временная логика
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    alert('Настройки сети успешно сохранены!');
    
  } catch (error) {
          // console.error('Ошибка сохранения настроек сети:', error);
    alert('Ошибка при сохранении настроек сети');
  } finally {
    isSaving.value = false;
  }
};

const exportSettings = () => {
  const settings = {
    main: mainSettings.value,
    security: securitySettings.value,
    network: networkSettings.value,
    exportDate: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dle-settings-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  alert('Настройки успешно экспортированы!');
};

const importSettings = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const settings = JSON.parse(e.target.result);
      
      if (settings.main) mainSettings.value = settings.main;
      if (settings.security) securitySettings.value = settings.security;
      if (settings.network) networkSettings.value = settings.network;
      
      alert('Настройки успешно импортированы!');
    } catch (error) {
      // console.error('Ошибка импорта настроек:', error);
      alert('Ошибка при импорте настроек');
    }
  };
  reader.readAsText(file);
};

const resetSettings = () => {
  if (!confirm('Вы уверены, что хотите сбросить все настройки к значениям по умолчанию?')) {
    return;
  }
  
  // Сброс к значениям по умолчанию
  mainSettings.value = {
    name: 'Мое DLE',
    symbol: 'MDLE',
    description: 'Цифровое юридическое лицо для управления активами и принятия решений',
    location: 'Россия, Москва',
    website: 'https://example.com'
  };
  
  securitySettings.value = {
    minQuorum: 51,
    maxProposalDuration: 7,
    emergencyThreshold: 75,
    timelockDelay: 24,
    allowDelegation: true,
    requireKYC: false,
    autoExecute: false
  };
  
  networkSettings.value = {
    enabledNetworks: [1, 137],
    defaultNetwork: 1,
    rpcEndpoint: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID'
  };
  
  alert('Настройки сброшены к значениям по умолчанию!');
};

const deleteDLE = () => {
  if (!confirm('ВНИМАНИЕ! Это действие необратимо. Вы уверены, что хотите удалить DLE и все связанные данные?')) {
    return;
  }
  
  if (!confirm('Это действие нельзя отменить. Подтвердите удаление еще раз.')) {
    return;
  }
  
  // Здесь будет логика удаления DLE
      // console.log('Удаление DLE...');
  alert('DLE будет удален. Это действие может занять некоторое время.');
};
</script>

<style scoped>
.settings-container {
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 20px;
  margin-bottom: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 40px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content {
  flex-grow: 1;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 10px 0;
}

.page-header p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
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
  flex-shrink: 0;
}

.close-btn:hover {
  background: #f0f0f0;
  color: #333;
}

/* Секции */
.main-settings-section,
.security-settings-section,
.network-settings-section,
.backup-section,
.danger-zone-section {
  margin-bottom: 40px;
}

.main-settings-section h2,
.security-settings-section h2,
.network-settings-section h2,
.backup-section h2,
.danger-zone-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Формы настроек */
.settings-form {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.form-group label {
  font-weight: 600;
  color: var(--color-grey-dark);
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.input-hint {
  font-size: 0.8rem;
  color: var(--color-grey-dark);
  margin-top: 4px;
}

/* Чекбоксы */
.checkbox-group {
  display: grid;
  gap: 15px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 10px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.checkbox-item:hover {
  background: #e9ecef;
}

.checkbox-item input[type="checkbox"] {
  width: auto;
}

/* Сети */
.networks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.network-checkbox {
  display: flex;
  align-items: center;
  gap: 15px;
  cursor: pointer;
  padding: 15px;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.network-checkbox:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.network-checkbox input[type="checkbox"] {
  width: auto;
}

.network-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.network-name {
  font-weight: 600;
  color: var(--color-primary);
}

.network-chain-id {
  font-size: 0.8rem;
  color: var(--color-grey-dark);
}

/* Резервное копирование */
.backup-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.backup-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  text-align: center;
}

.backup-card h3 {
  color: var(--color-primary);
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.backup-card p {
  color: var(--color-grey-dark);
  margin-bottom: 20px;
  line-height: 1.5;
}

/* Опасная зона */
.danger-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.danger-card {
  background: #fff5f5;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #fed7d7;
  text-align: center;
}

.danger-card h3 {
  color: #c53030;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.danger-card p {
  color: var(--color-grey-dark);
  margin-bottom: 20px;
  line-height: 1.5;
}

/* Кнопки */
.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--color-secondary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-secondary:hover {
  background: var(--color-secondary-dark);
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.btn-danger:hover {
  background: #c82333;
}

/* Адаптивность */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .networks-grid {
    grid-template-columns: 1fr;
  }
  
  .backup-actions,
  .danger-actions {
    grid-template-columns: 1fr;
  }
}
</style> 