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
    <div class="treasury-module-deploy">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Деплой TreasuryModule</h1>
          <p>Казначейство DLE - управление финансами, депозиты, выводы, дивиденды</p>
          <p v-if="dleAddress" class="dle-address">
            <strong>DLE:</strong> {{ dleAddress }}
          </p>
        </div>
        <button class="close-btn" @click="router.push('/management/modules')">×</button>
      </div>

      <!-- Информация о модуле -->
      <div class="module-info">
        <div class="info-card">
          <h3>💰 TreasuryModule</h3>
          <div class="info-grid">
            <div class="info-item">
              <strong>Назначение:</strong> Управление финансами DLE
            </div>
            <div class="info-item">
              <strong>Функции:</strong> Депозиты, выводы, дивиденды, бюджетирование
            </div>
            <div class="info-item">
              <strong>Безопасность:</strong> Все операции через голосование
            </div>
          </div>
        </div>
      </div>

      <!-- Форма деплоя модуля во всех сетях -->
      <div class="deploy-form">
        <div class="form-header">
          <h3>🌐 Деплой TreasuryModule во всех сетях</h3>
          <p>Деплой модуля казначейства во всех 4 сетях одновременно</p>
        </div>
        
        <div class="form-content">
          <!-- Информация о сетях -->
          <div class="networks-info">
            <h4>📡 Сети для деплоя:</h4>
            <div class="networks-list">
              <div class="network-item">
                <span class="network-name">Sepolia</span>
                <span class="network-chain-id">Chain ID: 11155111</span>
              </div>
              <div class="network-item">
                <span class="network-name">Holesky</span>
                <span class="network-chain-id">Chain ID: 17000</span>
              </div>
              <div class="network-item">
                <span class="network-name">Arbitrum Sepolia</span>
                <span class="network-chain-id">Chain ID: 421614</span>
              </div>
              <div class="network-item">
                <span class="network-name">Base Sepolia</span>
                <span class="network-chain-id">Chain ID: 84532</span>
              </div>
            </div>
          </div>
          
          <!-- Настройки модуля -->
          <div class="module-settings">
            <h4>⚙️ Настройки TreasuryModule:</h4>
            
            <div class="settings-form">
              <div class="form-row">
                 <div class="form-group">
                   <label for="emergencyAdmin">Адрес экстренного администратора:</label>
                   <input 
                     type="text" 
                     id="emergencyAdmin" 
                     v-model="moduleSettings.emergencyAdmin" 
                     class="form-control"
                     placeholder="0x..."
                     required
                   >
                   <small class="form-help">Адрес экстренного администратора для управления модулем</small>
                 </div>
                 
                 <div class="form-group">
                   <label for="chainId">ID сети:</label>
                   <select 
                     id="chainId" 
                     v-model="moduleSettings.chainId" 
                     class="form-control"
                     required
                   >
                     <option value="11155111">Sepolia (11155111)</option>
                     <option value="17000">Holesky (17000)</option>
                     <option value="421614">Arbitrum Sepolia (421614)</option>
                     <option value="84532">Base Sepolia (84532)</option>
                   </select>
                   <small class="form-help">ID сети для деплоя модуля</small>
                 </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="defaultDelay">Стандартная задержка (часы):</label>
                  <input 
                    type="number" 
                    id="defaultDelay" 
                    v-model="moduleSettings.defaultDelay" 
                    class="form-control"
                    min="1"
                    max="720"
                    placeholder="24"
                  >
                  <small class="form-help">Стандартная задержка для операций (1-720 часов)</small>
                </div>
                
                <div class="form-group">
                  <label for="emergencyDelay">Экстренная задержка (минуты):</label>
                  <input 
                    type="number" 
                    id="emergencyDelay" 
                    v-model="moduleSettings.emergencyDelay" 
                    class="form-control"
                    min="5"
                    max="1440"
                    placeholder="30"
                  >
                  <small class="form-help">Экстренная задержка для критических операций (5-1440 минут)</small>
                </div>
              </div>
              
              <div class="form-group">
                <label for="supportedTokens">Поддерживаемые токены (адреса через запятую):</label>
                <textarea 
                  id="supportedTokens" 
                  v-model="moduleSettings.supportedTokens" 
                  class="form-control" 
                  rows="3"
                  placeholder="0x1234..., 0x5678..., 0x9abc..."
                ></textarea>
                <small class="form-help">Адреса ERC20 токенов, которые будет поддерживать казначейство (через запятую)</small>
              </div>
              
              <div class="form-group">
                <label for="gasPaymentTokens">Токены для оплаты газа (адреса через запятую):</label>
                <textarea 
                  id="gasPaymentTokens" 
                  v-model="moduleSettings.gasPaymentTokens" 
                  class="form-control" 
                  rows="2"
                  placeholder="0x1234..., 0x5678..."
                ></textarea>
                <small class="form-help">Токены, которыми можно оплачивать газ (через запятую)</small>
              </div>
              
              <!-- Дополнительные настройки казны -->
              <div class="advanced-settings">
                <h5>🔧 Дополнительные настройки казны:</h5>
                
                 <div class="form-row">
                   <div class="form-group">
                     <label for="paymasterAddress">Адрес Paymaster:</label>
                     <input 
                       type="text" 
                       id="paymasterAddress" 
                       v-model="moduleSettings.paymasterAddress" 
                       class="form-control"
                       placeholder="0x..."
                     >
                     <small class="form-help">Адрес Paymaster для ERC-4337 (оплата газа любым токеном)</small>
                   </div>
                   
                   <div class="form-group">
                     <label for="maxBatchTransfers">Максимум batch переводов:</label>
                     <input 
                       type="number" 
                       id="maxBatchTransfers" 
                       v-model="moduleSettings.maxBatchTransfers" 
                       class="form-control"
                       min="1"
                       max="100"
                       placeholder="50"
                     >
                     <small class="form-help">Максимальное количество переводов в batch операции (1-100)</small>
                   </div>
                 </div>
                
                 <div class="form-row">
                   <div class="form-group">
                     <label for="gasTokenRates">Курсы токенов для газа (JSON формат):</label>
                     <textarea 
                       id="gasTokenRates" 
                       v-model="moduleSettings.gasTokenRates" 
                       class="form-control" 
                       rows="3"
                       placeholder='{"0x1234...": "1000000000000000000", "0x5678...": "2000000000000000000"}'
                     ></textarea>
                     <small class="form-help">Курсы обмена токенов на нативную монету (JSON формат)</small>
                   </div>
                   
                   <div class="form-group">
                     <label for="emergencyThreshold">Порог экстренных операций (ETH):</label>
                     <input 
                       type="number" 
                       id="emergencyThreshold" 
                       v-model="moduleSettings.emergencyThreshold" 
                       class="form-control"
                       min="0"
                       step="0.001"
                       placeholder="1.0"
                     >
                     <small class="form-help">Порог для экстренных операций в ETH</small>
                   </div>
                 </div>
                
                <div class="form-group">
                  <label for="initialTokens">Начальные токены для добавления (JSON формат):</label>
                  <textarea 
                    id="initialTokens" 
                    v-model="moduleSettings.initialTokens" 
                    class="form-control" 
                    rows="4"
                    placeholder='[{"address": "0x1234...", "symbol": "USDC", "decimals": 6}, {"address": "0x5678...", "symbol": "USDT", "decimals": 6}]'
                  ></textarea>
                  <small class="form-help">Токены для автоматического добавления при деплое (JSON массив)</small>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="autoRefreshBalances">Автообновление балансов:</label>
                    <select 
                      id="autoRefreshBalances" 
                      v-model="moduleSettings.autoRefreshBalances" 
                      class="form-control"
                    >
                      <option value="true">Включено</option>
                      <option value="false">Отключено</option>
                    </select>
                    <small class="form-help">Автоматическое обновление балансов токенов</small>
                  </div>
                  
                  <div class="form-group">
                    <label for="batchTransferEnabled">Batch переводы включены:</label>
                    <select 
                      id="batchTransferEnabled" 
                      v-model="moduleSettings.batchTransferEnabled" 
                      class="form-control"
                    >
                      <option value="true">Включено</option>
                      <option value="false">Отключено</option>
                    </select>
                    <small class="form-help">Разрешить batch операции переводов</small>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="treasuryDescription">Описание казны:</label>
                  <textarea 
                    id="treasuryDescription" 
                    v-model="moduleSettings.treasuryDescription" 
                    class="form-control" 
                    rows="2"
                    placeholder="Описание казны DLE для управления финансами..."
                  ></textarea>
                  <small class="form-help">Описание казны для документации</small>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Кнопка деплоя -->
          <div class="deploy-actions">
            <button 
              class="btn btn-primary btn-large deploy-module" 
              @click="deployTreasuryModule"
              :disabled="isDeploying || !dleAddress"
            >
              <i class="fas fa-rocket" :class="{ 'fa-spin': isDeploying }"></i>
              {{ isDeploying ? 'Деплой модуля...' : 'Деплой TreasuryModule' }}
            </button>
            
            <div v-if="deploymentProgress" class="deployment-progress">
              <div class="progress-info">
                <span>{{ deploymentProgress.message }}</span>
                <span class="progress-percentage">{{ deploymentProgress.percentage }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: deploymentProgress.percentage + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../../components/BaseLayout.vue';

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
const route = useRoute();

// Состояние
const isLoading = ref(false);
const dleAddress = ref(route.query.address || null);
const isDeploying = ref(false);
const deploymentProgress = ref(null);

// Настройки модуля
const moduleSettings = ref({
  // Основные параметры
  emergencyAdmin: '',
  chainId: 11155111,
  defaultDelay: 24, // hours
  emergencyDelay: 30, // minutes
  
  // Токены
  supportedTokens: '',
  gasPaymentTokens: '',
  initialTokens: '',
  
  // Дополнительные настройки
  paymasterAddress: '',
  maxBatchTransfers: 50,
  gasTokenRates: '',
  emergencyThreshold: 1.0,
  autoRefreshBalances: 'true',
  batchTransferEnabled: 'true',
  treasuryDescription: ''
});

// Функция деплоя TreasuryModule
async function deployTreasuryModule() {
  try {
    isDeploying.value = true;
    deploymentProgress.value = {
      message: 'Инициализация деплоя...',
      percentage: 0
    };
    
    console.log('[TreasuryModuleDeployView] Начинаем деплой TreasuryModule для DLE:', dleAddress.value);
    
    // Вызываем API для деплоя модуля во всех сетях
    const response = await fetch('/api/dle-modules/deploy-treasury', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dleAddress: dleAddress.value,
        moduleType: 'treasury',
        settings: {
          // Основные параметры
          emergencyAdmin: moduleSettings.value.emergencyAdmin,
          chainId: moduleSettings.value.chainId,
          defaultDelay: moduleSettings.value.defaultDelay,
          emergencyDelay: moduleSettings.value.emergencyDelay,
          
          // Токены
          supportedTokens: moduleSettings.value.supportedTokens.split(',').map(addr => addr.trim()).filter(addr => addr),
          gasPaymentTokens: moduleSettings.value.gasPaymentTokens.split(',').map(addr => addr.trim()).filter(addr => addr),
          initialTokens: moduleSettings.value.initialTokens ? JSON.parse(moduleSettings.value.initialTokens) : [],
          
          // Дополнительные настройки
          paymasterAddress: moduleSettings.value.paymasterAddress,
          maxBatchTransfers: parseInt(moduleSettings.value.maxBatchTransfers),
          gasTokenRates: moduleSettings.value.gasTokenRates ? JSON.parse(moduleSettings.value.gasTokenRates) : {},
          emergencyThreshold: parseFloat(moduleSettings.value.emergencyThreshold),
          autoRefreshBalances: moduleSettings.value.autoRefreshBalances === 'true',
          batchTransferEnabled: moduleSettings.value.batchTransferEnabled === 'true',
          treasuryDescription: moduleSettings.value.treasuryDescription
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('[TreasuryModuleDeployView] Деплой успешно запущен:', result);
      
      // Обновляем прогресс
      deploymentProgress.value = {
        message: 'Деплой запущен успешно! Проверьте логи для отслеживания прогресса.',
        percentage: 100
      };
      
      alert('✅ Деплой TreasuryModule запущен во всех сетях!');
      
      // Перенаправляем обратно к модулям
      setTimeout(() => {
        router.push(`/management/modules?address=${dleAddress.value}`);
      }, 2000);
      
    } else {
      throw new Error(result.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    console.error('[TreasuryModuleDeployView] Ошибка деплоя:', error);
    alert('❌ Ошибка деплоя: ' + error.message);
    
    deploymentProgress.value = {
      message: 'Ошибка деплоя: ' + error.message,
      percentage: 0
    };
  } finally {
    isDeploying.value = false;
  }
}

// Инициализация
onMounted(() => {
  console.log('[TreasuryModuleDeployView] Страница загружена');
});
</script>

<style scoped>
.treasury-module-deploy {
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
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.page-header h1 {
  color: var(--color-primary);
  font-size: 2rem;
  margin: 0;
}

.page-header p {
  margin: 10px 0 0 0;
  color: #666;
}

.dle-address {
  margin-top: 10px !important;
  font-family: monospace;
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
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

/* Форма деплоя */
.deploy-form {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 30px;
  border: 1px solid #e9ecef;
}

.form-header h3 {
  margin: 0 0 10px 0;
  color: var(--color-primary);
}

.form-header p {
  margin: 0 0 20px 0;
  color: #666;
}

.networks-info,
.module-settings {
  margin-bottom: 20px;
  padding: 15px;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
}

.settings-form {
  margin-top: 15px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(var(--color-primary-rgb), 0.1);
}

.form-help {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

/* Дополнительные настройки */
.advanced-settings {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.advanced-settings h5 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
  font-size: 1.1rem;
  font-weight: 600;
}

.advanced-settings .form-row {
  margin-bottom: 15px;
}

.advanced-settings .form-group {
  margin-bottom: 15px;
}

.advanced-settings .form-group:last-child {
  margin-bottom: 0;
}

.networks-info h4,
.deploy-parameters h4 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}

.networks-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.network-item {
  display: flex;
  flex-direction: column;
  padding: 10px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
}

.network-name {
  font-weight: 600;
  color: var(--color-primary);
}

.network-chain-id {
  font-size: 12px;
  color: #666;
  font-family: monospace;
}

.parameter-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.parameter-item:last-child {
  border-bottom: none;
}

.parameter-item label {
  font-weight: 500;
  color: #333;
}

.parameter-value {
  font-family: monospace;
  color: var(--color-primary);
  background: #f8f9fa;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.deploy-actions {
  text-align: center;
  margin-top: 20px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  transition: all 0.3s;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-primary-dark), var(--color-primary));
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-large {
  padding: 16px 32px;
  font-size: 18px;
}

.deployment-progress {
  margin-top: 20px;
  padding: 15px;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-percentage {
  font-weight: 600;
  color: var(--color-primary);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-primary-dark));
  transition: width 0.3s ease;
}

/* Информация о модуле */
.module-info {
  margin-bottom: 30px;
}

.info-card {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid #e9ecef;
}

.info-card h3 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
}

.info-item {
  padding: 10px;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
}

.info-item strong {
  color: var(--color-primary);
}

/* Плейсхолдер для формы */
.deploy-form-placeholder {
  background: #f8f9fa;
  border-radius: var(--radius-md);
  padding: 40px;
  text-align: center;
  border: 2px dashed #dee2e6;
}

.placeholder-content h3 {
  color: var(--color-primary);
  margin-bottom: 10px;
}

.placeholder-content p {
  color: #666;
  margin: 0;
}

/* Адаптивность */
@media (max-width: 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }
}
</style>
