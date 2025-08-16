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
    <div class="module-deploy-page">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>🔥 Деплой BurnModule</h1>
          <p>Модуль для сжигания токенов DLE через governance</p>
          <div v-if="selectedDle" class="dle-info">
            <span class="dle-name">{{ selectedDle.name }} ({{ selectedDle.symbol }})</span>
            <span class="dle-address">{{ selectedDle.dleAddress }}</span>
          </div>
        </div>
        <button class="close-btn" @click="router.push(`/management/modules?address=${route.query.address}`)">×</button>
      </div>

      <!-- Описание модуля -->
      <div class="module-description">
        <div class="description-card">
          <h3>📋 Описание BurnModule</h3>
          <div class="description-content">
            <p><strong>BurnModule</strong> - это модуль для управления сжиганием токенов DLE через систему governance.</p>
            
            <h4>🔧 Функциональность:</h4>
            <ul>
              <li><strong>Сжигание токенов:</strong> Уменьшение общего предложения токенов DLE</li>
              <li><strong>Governance:</strong> Все операции требуют голосования и кворума</li>
              <li><strong>Безопасность:</strong> Контролируемое сжигание через коллективные решения</li>
              <li><strong>Прозрачность:</strong> Все операции записываются в блокчейн</li>
            </ul>

            <h4>⚠️ Важные особенности:</h4>
            <ul>
              <li>Сжигание токенов возможно только через предложения и голосование</li>
              <li>Можно сжигать токены из казны DLE или от имени участников</li>
              <li>Все операции требуют достижения кворума</li>
              <li>История всех сжиганий сохраняется в блокчейне</li>
              <li>Сжигание необратимо - токены уничтожаются навсегда</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Форма деплоя -->
      <div class="deploy-form-section">
        <div class="form-header">
          <h3>⚙️ Настройки деплоя</h3>
          <p>Настройте параметры для деплоя BurnModule</p>
        </div>
        
        <form @submit.prevent="deployModule" class="deploy-form">
          <div class="form-row">
            <div class="form-group">
              <label for="moduleName">Название модуля:</label>
              <input 
                id="moduleName"
                v-model="deployData.moduleName" 
                type="text" 
                placeholder="BurnModule" 
                required
              />
            </div>
            
            <div class="form-group">
              <label for="moduleVersion">Версия модуля:</label>
              <input 
                id="moduleVersion"
                v-model="deployData.moduleVersion" 
                type="text" 
                placeholder="1.0.0" 
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="moduleDescription">Описание модуля:</label>
            <textarea 
              id="moduleDescription"
              v-model="deployData.moduleDescription" 
              placeholder="Модуль для сжигания токенов DLE через governance..." 
              rows="3"
              required
            ></textarea>
          </div>

          <div class="form-group">
            <label for="maxBurnPerProposal">Максимальное сжигание за одно предложение:</label>
            <input 
              id="maxBurnPerProposal"
              v-model="deployData.maxBurnPerProposal" 
              type="number" 
              min="1" 
              step="1"
              placeholder="1000000" 
              required
            />
            <small class="form-help">Максимальное количество токенов, которое можно сжечь за одно предложение</small>
          </div>

          <div class="form-group">
            <label for="burnCooldown">Кулдаун между сжиганиями (часы):</label>
            <input 
              id="burnCooldown"
              v-model="deployData.burnCooldown" 
              type="number" 
              min="0" 
              step="1"
              placeholder="24" 
              required
            />
            <small class="form-help">Минимальное время между успешными сжиганиями токенов</small>
          </div>

          <div class="form-group">
            <label for="allowTreasuryBurn">Разрешить сжигание из казны:</label>
            <select 
              id="allowTreasuryBurn"
              v-model="deployData.allowTreasuryBurn" 
              required
            >
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </select>
            <small class="form-help">Разрешить сжигание токенов из казны DLE</small>
          </div>

          <div class="form-group">
            <label for="allowUserBurn">Разрешить сжигание от участников:</label>
            <select 
              id="allowUserBurn"
              v-model="deployData.allowUserBurn" 
              required
            >
              <option value="true">Да</option>
              <option value="false">Нет</option>
            </select>
            <small class="form-help">Разрешить сжигание токенов от имени участников DLE</small>
          </div>

          <div class="form-group">
            <label for="deployDescription">Описание предложения для деплоя:</label>
            <textarea 
              id="deployDescription"
              v-model="deployData.deployDescription" 
              placeholder="Предложение о деплое BurnModule для управления сжиганием токенов DLE..." 
              rows="3"
              required
            ></textarea>
          </div>

          <div class="form-group">
            <label for="votingDuration">Длительность голосования (часы):</label>
            <input 
              id="votingDuration"
              v-model="deployData.votingDuration" 
              type="number" 
              min="1" 
              max="168"
              placeholder="24" 
              required
            />
            <small class="form-help">Время для голосования по предложению деплоя (1-168 часов)</small>
          </div>

          <button type="submit" class="btn-primary" :disabled="isDeploying">
            {{ isDeploying ? 'Деплой...' : 'Деплой BurnModule' }}
          </button>
          
          <!-- Статус деплоя -->
          <div v-if="deployStatus" class="deploy-status">
            <p class="status-message">{{ deployStatus }}</p>
          </div>
        </form>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseLayout from '../../../components/BaseLayout.vue';
import api from '../../../api/axios';

// Props
const props = defineProps({
  isAuthenticated: {
    type: Boolean,
    default: false
  },
  identities: {
    type: Array,
    default: () => []
  },
  tokenBalances: {
    type: Object,
    default: () => ({})
  },
  isLoadingTokens: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['auth-action-completed']);

// Router
const route = useRoute();
const router = useRouter();

// Состояние
const isDeploying = ref(false);
const deployStatus = ref('');
const selectedDle = ref(null);
const isLoadingDle = ref(false);

// Данные для деплоя
const deployData = ref({
  moduleName: 'BurnModule',
  moduleVersion: '1.0.0',
  moduleDescription: 'Модуль для сжигания токенов DLE через governance',
  maxBurnPerProposal: 1000000,
  burnCooldown: 24,
  allowTreasuryBurn: 'true',
  allowUserBurn: 'true',
  deployDescription: 'Предложение о деплое BurnModule для управления сжиганием токенов DLE',
  votingDuration: 24
});

// Получаем адрес DLE из URL
const dleAddress = computed(() => route.query.address);

// Загрузка данных DLE
const loadDleData = async () => {
  if (!dleAddress.value) return;
  
  try {
    isLoadingDle.value = true;
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress.value
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
    }
  } catch (error) {
    console.error('Ошибка загрузки данных DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
};

// Функция деплоя модуля
const deployModule = async () => {
  if (isDeploying.value) return;
  
  try {
    isDeploying.value = true;
    deployStatus.value = 'Подготовка к деплою...';
    
    // Здесь будет логика деплоя модуля
    console.log('Деплой BurnModule:', deployData.value);
    
    // Временная заглушка
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    deployStatus.value = 'Модуль успешно развернут!';
    
    // Очищаем статус через 3 секунды
    setTimeout(() => {
      deployStatus.value = '';
    }, 3000);
    
    alert('BurnModule успешно развернут!');
    
  } catch (error) {
    console.error('Ошибка деплоя модуля:', error);
    deployStatus.value = 'Ошибка деплоя модуля';
    
    setTimeout(() => {
      deployStatus.value = '';
    }, 3000);
    
    alert('Ошибка при деплое модуля');
  } finally {
    isDeploying.value = false;
  }
};

// Загружаем данные при монтировании
onMounted(() => {
  loadDleData();
});
</script>

<style scoped>
.module-deploy-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.header-content h1 {
  color: var(--color-primary);
  font-size: 2.5rem;
  margin: 0 0 10px 0;
}

.header-content p {
  color: var(--color-grey-dark);
  font-size: 1.1rem;
  margin: 0 0 15px 0;
}

.dle-info {
  display: flex;
  gap: 15px;
  align-items: center;
}

.dle-name {
  font-weight: 600;
  color: var(--color-primary);
}

.dle-address {
  font-family: monospace;
  color: var(--color-grey-dark);
  font-size: 0.9rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 2rem;
  color: var(--color-grey-dark);
  cursor: pointer;
  padding: 5px;
}

.close-btn:hover {
  color: var(--color-primary);
}

.module-description {
  margin-bottom: 30px;
}

.description-card {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
}

.description-card h3 {
  color: var(--color-primary);
  margin: 0 0 20px 0;
}

.description-content h4 {
  color: var(--color-grey-dark);
  margin: 20px 0 10px 0;
}

.description-content ul {
  margin: 10px 0;
  padding-left: 20px;
}

.description-content li {
  margin: 5px 0;
  line-height: 1.5;
}

.deploy-form-section {
  background: white;
  padding: 30px;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.form-header {
  margin-bottom: 25px;
}

.form-header h3 {
  color: var(--color-primary);
  margin: 0 0 10px 0;
}

.form-header p {
  color: var(--color-grey-dark);
  margin: 0;
}

.deploy-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  min-height: 80px;
}

.form-help {
  font-size: 0.85rem;
  color: var(--color-grey-dark);
  font-style: italic;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 15px 30px;
  border-radius: var(--radius-sm);
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.deploy-status {
  margin-top: 20px;
  padding: 15px;
  background: #e8f5e8;
  border-radius: var(--radius-sm);
  border-left: 4px solid #28a745;
}

.status-message {
  margin: 0;
  font-weight: 600;
  color: #28a745;
}

@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .dle-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
}
</style>
