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
    <div class="timelock-module-deploy">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Деплой TimelockModule</h1>
          <p>Задержки исполнения - безопасность критических операций через таймлоки</p>
          <p v-if="dleAddress" class="dle-address">
            <strong>DLE:</strong> {{ dleAddress }}
          </p>
        </div>
        <button class="close-btn" @click="router.push('/management/modules')">×</button>
      </div>

      <!-- Информация о модуле -->
      <div class="module-info">
        <div class="info-card">
          <h3>⏰ TimelockModule</h3>
          <div class="info-grid">
            <div class="info-item">
              <strong>Назначение:</strong> Безопасность критических операций
            </div>
            <div class="info-item">
              <strong>Функции:</strong> Настраиваемые таймлоки, отмена предложений, аудит
            </div>
            <div class="info-item">
              <strong>Безопасность:</strong> Задержки исполнения для защиты от атак
            </div>
          </div>
        </div>
      </div>

      <!-- Форма деплоя модуля во всех сетях -->
      <div class="deploy-form">
        <div class="form-header">
          <h3>🌐 Деплой TimelockModule во всех сетях</h3>
          <p>Деплой модуля временных задержек во всех 4 сетях одновременно</p>
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
            <h4>⚙️ Настройки TimelockModule:</h4>
            
            <div class="settings-form">
              <div class="form-row">
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
                
                <div class="form-group">
                  <label for="defaultDelay">Стандартная задержка (дни):</label>
                  <input 
                    type="number" 
                    id="defaultDelay" 
                    v-model="moduleSettings.defaultDelay" 
                    class="form-control"
                    min="1"
                    max="30"
                    placeholder="2"
                  >
                  <small class="form-help">Стандартная задержка для операций (1-30 дней)</small>
                </div>
              </div>
              
              <div class="form-row">
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
                
                <div class="form-group">
                  <label for="maxDelay">Максимальная задержка (дни):</label>
                  <input 
                    type="number" 
                    id="maxDelay" 
                    v-model="moduleSettings.maxDelay" 
                    class="form-control"
                    min="1"
                    max="365"
                    placeholder="30"
                  >
                  <small class="form-help">Максимальная задержка для операций (1-365 дней)</small>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-group">
                  <label for="minDelay">Минимальная задержка (часы):</label>
                  <input 
                    type="number" 
                    id="minDelay" 
                    v-model="moduleSettings.minDelay" 
                    class="form-control"
                    min="1"
                    max="720"
                    placeholder="24"
                  >
                  <small class="form-help">Минимальная задержка для операций (1-720 часов)</small>
                </div>
                
                <div class="form-group">
                  <label for="maxOperations">Максимум операций в очереди:</label>
                  <input 
                    type="number" 
                    id="maxOperations" 
                    v-model="moduleSettings.maxOperations" 
                    class="form-control"
                    min="10"
                    max="1000"
                    placeholder="100"
                  >
                  <small class="form-help">Максимальное количество операций в очереди (10-1000)</small>
                </div>
              </div>
              
              <!-- Дополнительные настройки таймлока -->
              <div class="advanced-settings">
                <h5>🔧 Дополнительные настройки таймлока:</h5>
                
                <div class="form-group">
                  <label for="criticalOperations">Критические операции (JSON формат):</label>
                  <textarea 
                    id="criticalOperations" 
                    v-model="moduleSettings.criticalOperations" 
                    class="form-control" 
                    rows="3"
                    placeholder='["0x12345678", "0x87654321"]'
                  ></textarea>
                  <small class="form-help">Селекторы функций, которые считаются критическими (JSON массив)</small>
                </div>
                
                <div class="form-group">
                  <label for="emergencyOperations">Экстренные операции (JSON формат):</label>
                  <textarea 
                    id="emergencyOperations" 
                    v-model="moduleSettings.emergencyOperations" 
                    class="form-control" 
                    rows="3"
                    placeholder='["0xabcdef12", "0x21fedcba"]'
                  ></textarea>
                  <small class="form-help">Селекторы функций для экстренных операций (JSON массив)</small>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="operationDelays">Задержки для операций (JSON формат):</label>
                    <textarea 
                      id="operationDelays" 
                      v-model="moduleSettings.operationDelays" 
                      class="form-control" 
                      rows="4"
                      placeholder='{"0x12345678": 86400, "0x87654321": 172800}'
                    ></textarea>
                    <small class="form-help">Кастомные задержки для конкретных операций (селектор => секунды)</small>
                  </div>
                  
                  <div class="form-group">
                    <label for="autoExecuteEnabled">Автоисполнение включено:</label>
                    <select 
                      id="autoExecuteEnabled" 
                      v-model="moduleSettings.autoExecuteEnabled" 
                      class="form-control"
                    >
                      <option value="true">Включено</option>
                      <option value="false">Отключено</option>
                    </select>
                    <small class="form-help">Автоматическое исполнение операций после истечения задержки</small>
                  </div>
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="cancellationWindow">Окно отмены (часы):</label>
                    <input 
                      type="number" 
                      id="cancellationWindow" 
                      v-model="moduleSettings.cancellationWindow" 
                      class="form-control"
                      min="1"
                      max="168"
                      placeholder="24"
                    >
                    <small class="form-help">Время, в течение которого можно отменить операцию (1-168 часов)</small>
                  </div>
                  
                  <div class="form-group">
                    <label for="executionWindow">Окно исполнения (часы):</label>
                    <input 
                      type="number" 
                      id="executionWindow" 
                      v-model="moduleSettings.executionWindow" 
                      class="form-control"
                      min="1"
                      max="168"
                      placeholder="48"
                    >
                    <small class="form-help">Время, в течение которого можно исполнить операцию (1-168 часов)</small>
                  </div>
                </div>
                
                <div class="form-group">
                  <label for="timelockDescription">Описание таймлока:</label>
                  <textarea 
                    id="timelockDescription" 
                    v-model="moduleSettings.timelockDescription" 
                    class="form-control" 
                    rows="2"
                    placeholder="Описание таймлока DLE для безопасности операций..."
                  ></textarea>
                  <small class="form-help">Описание таймлока для документации</small>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Кнопка деплоя -->
          <div class="deploy-actions">
            <button 
              class="btn btn-primary btn-large deploy-module" 
              @click="deployTimelockModule"
              :disabled="isDeploying || !dleAddress"
            >
              <i class="fas fa-rocket" :class="{ 'fa-spin': isDeploying }"></i>
              {{ isDeploying ? 'Деплой модуля...' : 'Деплой TimelockModule' }}
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
  chainId: 11155111,
  defaultDelay: 2, // days
  emergencyDelay: 30, // minutes
  maxDelay: 30, // days
  minDelay: 24, // hours
  
  // Дополнительные настройки
  maxOperations: 100,
  criticalOperations: '',
  emergencyOperations: '',
  operationDelays: '',
  autoExecuteEnabled: 'true',
  cancellationWindow: 24, // hours
  executionWindow: 48, // hours
  timelockDescription: ''
});

// Функция деплоя TimelockModule
async function deployTimelockModule() {
  try {
    isDeploying.value = true;
    deploymentProgress.value = {
      message: 'Инициализация деплоя...',
      percentage: 0
    };
    
    console.log('[TimelockModuleDeployView] Начинаем деплой TimelockModule для DLE:', dleAddress.value);
    
    // Вызываем API для деплоя модуля во всех сетях
    const response = await fetch('/api/dle-modules/deploy-timelock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dleAddress: dleAddress.value,
        moduleType: 'timelock',
        settings: {
          // Основные параметры
          chainId: moduleSettings.value.chainId,
          defaultDelay: moduleSettings.value.defaultDelay * 24 * 60 * 60, // конвертируем дни в секунды
          emergencyDelay: moduleSettings.value.emergencyDelay * 60, // конвертируем минуты в секунды
          maxDelay: moduleSettings.value.maxDelay * 24 * 60 * 60, // конвертируем дни в секунды
          minDelay: moduleSettings.value.minDelay * 60 * 60, // конвертируем часы в секунды
          
          // Дополнительные настройки
          maxOperations: parseInt(moduleSettings.value.maxOperations),
          criticalOperations: moduleSettings.value.criticalOperations ? JSON.parse(moduleSettings.value.criticalOperations) : [],
          emergencyOperations: moduleSettings.value.emergencyOperations ? JSON.parse(moduleSettings.value.emergencyOperations) : [],
          operationDelays: moduleSettings.value.operationDelays ? JSON.parse(moduleSettings.value.operationDelays) : {},
          autoExecuteEnabled: moduleSettings.value.autoExecuteEnabled === 'true',
          cancellationWindow: moduleSettings.value.cancellationWindow * 60 * 60, // конвертируем часы в секунды
          executionWindow: moduleSettings.value.executionWindow * 60 * 60, // конвертируем часы в секунды
          timelockDescription: moduleSettings.value.timelockDescription
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('[TimelockModuleDeployView] Деплой успешно запущен:', result);
      
      // Обновляем прогресс
      deploymentProgress.value = {
        message: 'Деплой запущен успешно! Проверьте логи для отслеживания прогресса.',
        percentage: 100
      };
      
      alert('✅ Деплой TimelockModule запущен во всех сетях!');
      
      // Перенаправляем обратно к модулям
      setTimeout(() => {
        router.push(`/management/modules?address=${dleAddress.value}`);
      }, 2000);
      
    } else {
      throw new Error(result.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    console.error('[TimelockModuleDeployView] Ошибка деплоя:', error);
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
  console.log('[TimelockModuleDeployView] Страница загружена');
});
</script>

<style scoped>
.timelock-module-deploy {
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
