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
    <div class="reader-module-deploy">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Деплой DLEReader</h1>
          <p>API для чтения данных DLE - получение информации о контракте и предложениях</p>
          <p v-if="dleAddress" class="dle-address">
            <strong>DLE:</strong> {{ dleAddress }}
          </p>
        </div>
        <button class="close-btn" @click="router.push('/management/modules')">×</button>
      </div>

      <!-- Информация о модуле -->
      <div class="module-info">
        <div class="info-card">
          <h3>📊 DLEReader</h3>
          <div class="info-grid">
            <div class="info-item">
              <strong>Назначение:</strong> Чтение данных DLE контракта
            </div>
            <div class="info-item">
              <strong>Функции:</strong> API для предложений, голосования, статистики
            </div>
            <div class="info-item">
              <strong>Безопасность:</strong> Только чтение, не изменяет состояние
            </div>
          </div>
        </div>
      </div>

      <!-- Форма деплоя модуля администратором -->
      <div v-if="canManageSettings" class="deploy-form">
        <div class="form-header">
          <h3>🔧 Деплой DLEReader администратором</h3>
          <p>Администратор деплоит модуль, затем создает предложение для добавления в DLE</p>
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
            <h4>⚙️ Настройки DLEReader:</h4>
            
            <div class="settings-form">
              <!-- Поля администратора -->
              <div class="admin-section">
                <h5>🔐 Настройки администратора:</h5>
                
                <div class="form-row">
                  <div class="form-group">
                    <label for="adminPrivateKey">Приватный ключ администратора:</label>
                    <input 
                      type="password" 
                      id="adminPrivateKey" 
                      v-model="moduleSettings.adminPrivateKey" 
                      class="form-control"
                      placeholder="0x..."
                      required
                    >
                    <small class="form-help">Приватный ключ для деплоя модуля (администратор платит газ)</small>
                  </div>
                  
                  <div class="form-group">
                    <label for="etherscanApiKey">Etherscan API ключ:</label>
                    <input 
                      type="text" 
                      id="etherscanApiKey" 
                      v-model="moduleSettings.etherscanApiKey" 
                      class="form-control"
                      placeholder="YourAPIKey..."
                    >
                    <small class="form-help">API ключ для автоматической верификации контрактов</small>
                  </div>
                </div>
              </div>
              
              
              <div class="simple-info">
                <h5>📋 Информация о DLEReader:</h5>
                <div class="info-text">
                  <p><strong>DLEReader</strong> - это простой read-only модуль, который:</p>
                  <ul>
                    <li>✅ Только читает данные из DLE контракта</li>
                    <li>✅ Не изменяет состояние блокчейна</li>
                    <li>✅ Предоставляет API для получения информации</li>
                    <li>✅ Безопасен для обновления</li>
                  </ul>
                  <p><strong>Конструктор принимает только один параметр:</strong> адрес DLE контракта</p>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Кнопка деплоя -->
          <div class="deploy-actions">
            <button 
              class="btn btn-primary btn-large deploy-module" 
              @click="deployDLEReader"
              :disabled="isDeploying || !dleAddress || !isFormValid"
            >
              <i class="fas fa-rocket" :class="{ 'fa-spin': isDeploying }"></i>
              {{ isDeploying ? 'Деплой модуля...' : 'Деплой DLEReader' }}
            </button>
            
            <div v-if="!isFormValid && !isDeploying" class="form-validation-info">
              <i class="fas fa-exclamation-triangle"></i>
              <span>Заполните приватный ключ и API ключ для деплоя</span>
            </div>
            
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

      <!-- Сообщение для пользователей без прав доступа -->
      <div v-if="!canManageSettings" class="no-access-message">
        <div class="message-content">
          <h3>🔒 Нет прав доступа</h3>
          <p>У вас нет прав для деплоя смарт-контрактов. Только пользователи с ролью Editor могут выполнять деплой.</p>
          <button class="btn btn-secondary" @click="router.push('/management/modules')">
            ← Вернуться к модулям
          </button>
        </div>
      </div>

    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../../components/BaseLayout.vue';
import { usePermissions } from '@/composables/usePermissions';

// Props
const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const route = useRoute();
const { canEdit, canManageSettings } = usePermissions();

// Состояние
const isLoading = ref(false);
const dleAddress = ref(route.query.address || null);
const isDeploying = ref(false);
const deploymentProgress = ref(null);

// Настройки модуля
const moduleSettings = ref({
  // Поля администратора
  adminPrivateKey: '',
  etherscanApiKey: ''
});

// Проверка валидности формы
const isFormValid = computed(() => {
  return moduleSettings.value.adminPrivateKey && moduleSettings.value.etherscanApiKey;
});

// Функция деплоя DLEReader
async function deployDLEReader() {
  if (!canManageSettings.value) {
    alert('У вас нет прав для деплоя смарт-контрактов');
    return;
  }
  
  try {
    isDeploying.value = true;
    deploymentProgress.value = {
      message: 'Инициализация деплоя...',
      percentage: 0
    };
    
    console.log('[DLEReaderDeployView] Начинаем деплой DLEReader для DLE:', dleAddress.value);
    
    // Вызываем API для деплоя модуля администратором
    const response = await fetch('/api/dle-modules/deploy-reader-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dleAddress: dleAddress.value,
        moduleType: 'reader',
        adminPrivateKey: moduleSettings.value.adminPrivateKey,
        etherscanApiKey: moduleSettings.value.etherscanApiKey,
        settings: {
          // Используем настройки по умолчанию
          useDefaultSettings: true
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('[DLEReaderDeployView] Деплой успешно запущен:', result);
      
      // Обновляем прогресс
      deploymentProgress.value = {
        message: 'Деплой запущен успешно! Проверьте логи для отслеживания прогресса.',
        percentage: 100
      };
      
      // Показываем детальную информацию о деплое
      const deployInfo = result.data || {};
      const deployedAddresses = deployInfo.addresses || [];
      
      let successMessage = '✅ DLEReader успешно задеплоен!\n\n';
      successMessage += `📊 Детали деплоя:\n`;
      successMessage += `• DLE: ${dleAddress.value}\n`;
      successMessage += `• Тип модуля: DLEReader\n`;
      successMessage += `• Адрес модуля: ${deployInfo.moduleAddress || 'Не указан'}\n`;
      
      if (deployedAddresses.length > 0) {
        successMessage += `\n🌐 Задеплоенные адреса:\n`;
        deployedAddresses.forEach((addr, index) => {
          successMessage += `${index + 1}. ${addr.network}: ${addr.address}\n`;
        });
      }
      
      successMessage += `\n📝 Следующий шаг: Создайте предложение для добавления модуля в DLE через governance.`;
      
      alert(successMessage);
      
      // Перенаправляем обратно к модулям
      setTimeout(() => {
        router.push(`/management/modules?address=${dleAddress.value}`);
      }, 3000);
      
    } else {
      throw new Error(result.error || 'Неизвестная ошибка');
    }
    
  } catch (error) {
    console.error('[DLEReaderDeployView] Ошибка деплоя:', error);
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
  console.log('[DLEReaderDeployView] Страница загружена');
});
</script>

<style scoped>
.reader-module-deploy {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--radius-lg);
  color: white;
}

.header-content h1 {
  margin: 0 0 10px 0;
  font-size: 2rem;
  font-weight: 700;
}

.header-content p {
  margin: 0 0 5px 0;
  opacity: 0.9;
  font-size: 1.1rem;
}

.dle-address {
  font-family: 'Courier New', monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  margin-top: 10px;
}

.close-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  color: white;
}

/* Информация о модуле */
.module-info {
  margin-bottom: 30px;
}

.info-card {
  background: white;
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid #e9ecef;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.info-card h3 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
  font-size: 1.5rem;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 15px;
}

.info-item {
  padding: 10px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  border-left: 4px solid var(--color-primary);
}

.info-item strong {
  color: var(--color-primary);
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

/* Настройки отображения данных */
.data-display-settings {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.data-display-settings h5 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
  font-size: 1.1rem;
  font-weight: 600;
}

.data-display-settings .form-row {
  margin-bottom: 15px;
}

.data-display-settings .form-group {
  margin-bottom: 15px;
}

.data-display-settings .form-group:last-child {
  margin-bottom: 0;
}

/* Секция администратора */
.admin-section {
  margin-bottom: 20px;
  padding: 20px;
  background: #fff3cd;
  border-radius: var(--radius-sm);
  border: 1px solid #ffeaa7;
}

.admin-section h5 {
  margin: 0 0 15px 0;
  color: #856404;
  font-size: 1.1rem;
  font-weight: 600;
}

/* Простая информация */
.simple-info {
  margin-top: 20px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
  border: 1px solid #e9ecef;
}

.simple-info h5 {
  margin: 0 0 15px 0;
  color: var(--color-primary);
  font-size: 1.1rem;
  font-weight: 600;
}

.info-text {
  color: #666;
  line-height: 1.6;
}

.info-text p {
  margin: 0 0 10px 0;
}

.info-text ul {
  margin: 10px 0;
  padding-left: 20px;
}

.info-text li {
  margin: 5px 0;
  color: #555;
}

.info-text strong {
  color: var(--color-primary);
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

/* Сети */
.networks-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.network-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  font-family: 'Courier New', monospace;
}

/* Сообщение об отсутствии прав доступа */
.no-access-message {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: var(--radius-md);
  padding: 30px;
  margin: 20px 0;
  text-align: center;
}

.message-content h3 {
  color: #856404;
  margin-bottom: 15px;
  font-size: 1.4em;
}

.message-content p {
  color: #856404;
  margin-bottom: 20px;
  font-size: 1.1em;
  line-height: 1.5;
}

.message-content .btn {
  background: #6c757d;
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.message-content .btn:hover {
  background: #5a6268;
}
</style>
