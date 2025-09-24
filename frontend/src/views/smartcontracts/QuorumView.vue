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
    <div class="quorum-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Кворум</h1>
          <p>Настройки голосования и кворума</p>
        </div>
        <button class="close-btn" @click="goBackToBlocks">×</button>
      </div>

      <!-- Текущие настройки -->
      <div class="current-settings-section">
        <h2>Текущие настройки</h2>
        <div class="settings-grid">
          <div class="setting-card">
            <h3>Процент кворума</h3>
            <p class="setting-value">{{ currentQuorum }}%</p>
            <p class="setting-description">Минимальный процент токенов для принятия решения</p>
          </div>
          <div class="setting-card">
            <h3>Задержка голосования</h3>
            <p class="setting-value">{{ votingDelay }} блоков</p>
            <p class="setting-description">Время между созданием и началом голосования</p>
          </div>
          <div class="setting-card">
            <h3>Период голосования</h3>
            <p class="setting-value">{{ votingPeriod }} блоков</p>
            <p class="setting-description">Длительность периода голосования</p>
          </div>
          <div class="setting-card">
            <h3>Порог предложений</h3>
            <p class="setting-value">{{ proposalThreshold }} токенов</p>
            <p class="setting-description">Минимальное количество токенов для создания предложения</p>
          </div>
        </div>
      </div>

      <!-- Изменение настроек -->
      <div class="change-settings-section">
        <h2>Изменить настройки</h2>
        <form @submit.prevent="updateSettings" class="settings-form">
          <div class="form-row">
            <div class="form-group">
              <label for="newQuorum">Новый процент кворума:</label>
              <input 
                id="newQuorum"
                v-model="newSettings.quorumPercentage" 
                type="number" 
                min="1" 
                max="100"
                placeholder="51"
                required
              >
              <span class="input-hint">% (от 1 до 100)</span>
            </div>
            
            <div class="form-group">
              <label for="newVotingDelay">Новая задержка голосования:</label>
              <input 
                id="newVotingDelay"
                v-model="newSettings.votingDelay" 
                type="number" 
                min="0"
                placeholder="1"
                required
              >
              <span class="input-hint">блоков</span>
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="newVotingPeriod">Новый период голосования:</label>
              <input 
                id="newVotingPeriod"
                v-model="newSettings.votingPeriod" 
                type="number" 
                min="1"
                placeholder="45818"
                required
              >
              <span class="input-hint">блоков (~1 неделя)</span>
            </div>
            
            <div class="form-group">
              <label for="newProposalThreshold">Новый порог предложений:</label>
              <input 
                id="newProposalThreshold"
                v-model="newSettings.proposalThreshold" 
                type="number" 
                min="0"
                placeholder="100"
                required
              >
              <span class="input-hint">токенов</span>
            </div>
          </div>
          
          <div class="form-group">
            <label for="changeReason">Причина изменения:</label>
            <textarea 
              id="changeReason"
              v-model="newSettings.reason" 
              placeholder="Опишите причину изменения настроек..."
              rows="4"
              required
            ></textarea>
          </div>
          
          <button type="submit" class="btn-primary" :disabled="isUpdating">
            {{ isUpdating ? 'Обновление...' : 'Обновить настройки' }}
          </button>
        </form>
      </div>

      <!-- История изменений -->
      <div class="history-section">
        <h2>История изменений</h2>
        <div v-if="settingsHistory.length === 0" class="empty-state">
          <p>Нет истории изменений настроек</p>
        </div>
        <div v-else class="history-list">
          <div 
            v-for="change in settingsHistory" 
            :key="change.id" 
            class="history-item"
          >
            <div class="history-header">
              <h3>Изменение #{{ change.id }}</h3>
              <span class="change-date">{{ formatDate(change.timestamp) }}</span>
            </div>
            <div class="change-details">
              <p><strong>Причина:</strong> {{ change.reason }}</p>
              <div class="changes-list">
                <div v-if="change.quorumChange" class="change-item">
                  <span class="change-label">Кворум:</span>
                  <span class="change-value">{{ change.quorumChange.from }}% → {{ change.quorumChange.to }}%</span>
                </div>
                <div v-if="change.votingDelayChange" class="change-item">
                  <span class="change-label">Задержка голосования:</span>
                  <span class="change-value">{{ change.votingDelayChange.from }} → {{ change.votingDelayChange.to }} блоков</span>
                </div>
                <div v-if="change.votingPeriodChange" class="change-item">
                  <span class="change-label">Период голосования:</span>
                  <span class="change-value">{{ change.votingPeriodChange.from }} → {{ change.votingPeriodChange.to }} блоков</span>
                </div>
                <div v-if="change.proposalThresholdChange" class="change-item">
                  <span class="change-label">Порог предложений:</span>
                  <span class="change-value">{{ change.proposalThresholdChange.from }} → {{ change.proposalThresholdChange.to }} токенов</span>
                </div>
              </div>
            </div>
            <div class="change-author">
              <span>Автор: {{ formatAddress(change.author) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import { getGovernanceParams } from '../../services/dleV2Service.js';
import { getQuorumAt, getVotingPowerAt } from '../../services/proposalsService.js';

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

// Получаем адрес DLE из URL
const dleAddress = computed(() => {
  return route.query.address;
});

// Функция возврата к блокам управления
const goBackToBlocks = () => {
  if (dleAddress.value) {
    router.push(`/management/dle-blocks?address=${dleAddress.value}`);
  } else {
    router.push('/management');
  }
};

// Состояние
const isUpdating = ref(false);

// Текущие настройки
const currentQuorum = ref(51);
const votingDelay = ref(1);
const votingPeriod = ref(45818);
const proposalThreshold = ref(100);

// Новые настройки
const newSettings = ref({
  quorumPercentage: '',
  votingDelay: '',
  votingPeriod: '',
  proposalThreshold: '',
  reason: ''
});

// История изменений (загружается из блокчейна)
const settingsHistory = ref([]);

// Методы
const updateSettings = async () => {
  if (isUpdating.value) return;
  
  try {
    isUpdating.value = true;
    
    // Здесь будет логика обновления настроек в смарт-контракте
    // console.log('Обновление настроек:', newSettings.value);
    
    // Временная логика
    const change = {
      id: settingsHistory.value.length + 1,
      timestamp: Date.now(),
      reason: newSettings.value.reason,
      author: '0x' + Math.random().toString(16).substr(2, 40)
    };
    
    // Добавляем изменения в историю
    if (newSettings.value.quorumPercentage && newSettings.value.quorumPercentage !== currentQuorum.value) {
      change.quorumChange = { from: currentQuorum.value, to: parseInt(newSettings.value.quorumPercentage) };
      currentQuorum.value = parseInt(newSettings.value.quorumPercentage);
    }
    
    if (newSettings.value.votingDelay && newSettings.value.votingDelay !== votingDelay.value) {
      change.votingDelayChange = { from: votingDelay.value, to: parseInt(newSettings.value.votingDelay) };
      votingDelay.value = parseInt(newSettings.value.votingDelay);
    }
    
    if (newSettings.value.votingPeriod && newSettings.value.votingPeriod !== votingPeriod.value) {
      change.votingPeriodChange = { from: votingPeriod.value, to: parseInt(newSettings.value.votingPeriod) };
      votingPeriod.value = parseInt(newSettings.value.votingPeriod);
    }
    
    if (newSettings.value.proposalThreshold && newSettings.value.proposalThreshold !== proposalThreshold.value) {
      change.proposalThresholdChange = { from: proposalThreshold.value, to: parseInt(newSettings.value.proposalThreshold) };
      proposalThreshold.value = parseInt(newSettings.value.proposalThreshold);
    }
    
    settingsHistory.value.unshift(change);
    
    // Сброс формы
    newSettings.value = {
      quorumPercentage: '',
      votingDelay: '',
      votingPeriod: '',
      proposalThreshold: '',
      reason: ''
    };
    
    alert('Настройки успешно обновлены!');
    
  } catch (error) {
          // console.error('Ошибка обновления настроек:', error);
    alert('Ошибка при обновлении настроек');
  } finally {
    isUpdating.value = false;
  }
};

const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

const formatDate = (timestamp) => {
  return new Date(timestamp).toLocaleString('ru-RU');
};
</script>

<style scoped>
.quorum-container {
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
.current-settings-section,
.change-settings-section,
.history-section {
  margin-bottom: 40px;
}

.current-settings-section h2,
.change-settings-section h2,
.history-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Текущие настройки */
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

.setting-card {
  background: #f8f9fa;
  padding: 25px;
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--color-primary);
}

.setting-card h3 {
  color: var(--color-primary);
  margin-bottom: 15px;
  font-size: 1.1rem;
  font-weight: 600;
}

.setting-value {
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0 0 10px 0;
  color: var(--color-primary);
}

.setting-description {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  margin: 0;
  line-height: 1.4;
}

/* Форма настроек */
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

/* История изменений */
.history-list {
  display: grid;
  gap: 20px;
}

.history-item {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.history-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.history-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.2rem;
}

.change-date {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
}

.change-details {
  margin-bottom: 15px;
}

.change-details p {
  margin: 0 0 15px 0;
  font-size: 0.95rem;
}

.changes-list {
  display: grid;
  gap: 8px;
}

.change-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: var(--radius-sm);
}

.change-label {
  font-weight: 600;
  color: var(--color-grey-dark);
  font-size: 0.9rem;
}

.change-value {
  font-weight: 600;
  color: var(--color-primary);
  font-size: 0.9rem;
}

.change-author {
  font-size: 0.8rem;
  color: var(--color-grey-dark);
  font-family: monospace;
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

/* Состояния */
.empty-state {
  text-align: center;
  padding: 60px;
  color: var(--color-grey-dark);
  background: #f8f9fa;
  border-radius: var(--radius-lg);
  border: 2px dashed #dee2e6;
}

.empty-state p {
  margin: 0;
  font-size: 1.1rem;
}

/* Адаптивность */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .change-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
}
</style> 