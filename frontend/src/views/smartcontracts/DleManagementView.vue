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
    <div class="dle-management-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Управление DLE</h1>
          <p>Интеграция с другими DLE и участие в кворумах</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Карточки DLE -->
      <div class="dle-cards">
        <div 
          v-for="dle in dleList" 
          :key="dle.address" 
          class="dle-card"
          @click="openDleInterface(dle)"
        >
          <div class="dle-card-header">
            <h3>{{ dle.name }}</h3>
            <button 
              @click.stop="removeDle(dle.address)" 
              class="remove-btn"
              title="Удалить DLE"
            >
              🗑️
            </button>
          </div>
          <div class="dle-card-content">
            <p class="dle-address">Адрес: {{ formatAddress(dle.address) }}</p>
            <p class="dle-location">Местонахождение: {{ dle.location }}</p>
          </div>
        </div>

        <!-- Кнопка добавления нового DLE -->
        <div class="dle-card add-dle-card" @click="showAddDleForm = true">
          <div class="add-dle-content">
            <div class="add-icon">+</div>
            <h3>Добавить DLE</h3>
            <p>Подключить новый DLE для управления</p>
          </div>
        </div>
      </div>

      <!-- Модальное окно добавления DLE -->
      <div v-if="showAddDleForm" class="modal-overlay" @click="showAddDleForm = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Добавить новый DLE</h3>
            <button @click="showAddDleForm = false" class="close-btn">✕</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="addNewDle" class="add-dle-form">
              <div class="form-group">
                <label for="dleName">Название DLE:</label>
                <input 
                  id="dleName"
                  v-model="newDle.name" 
                  type="text" 
                  placeholder="Введите название DLE"
                  required
                >
              </div>
              
              <div class="form-group">
                <label for="dleAddress">Адрес контракта:</label>
                <input 
                  id="dleAddress"
                  v-model="newDle.address" 
                  type="text" 
                  placeholder="0x..."
                  required
                >
              </div>
              
              <div class="form-group">
                <label for="dleLocation">Местонахождение:</label>
                <input 
                  id="dleLocation"
                  v-model="newDle.location" 
                  type="text" 
                  placeholder="Страна, город"
                  required
                >
              </div>
              
              <div class="form-actions">
                <button type="button" @click="showAddDleForm = false" class="btn-secondary">
                  Отмена
                </button>
                <button type="submit" class="btn-primary">
                  Добавить DLE
                </button>
              </div>
            </form>
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
const showAddDleForm = ref(false);
const newDle = ref({
  name: '',
  address: '',
  location: ''
});

// Список DLE (временные данные для демонстрации)
const dleList = ref([
  {
    name: 'test2 (test2)',
    address: '0xef49...dfD8',
    location: '245000, 中国, 黄山市'
  },
  {
    name: 'My DLE',
    address: '0x1234...5678',
    location: '101000, Россия, Москва'
  }
]);

// Методы
const formatAddress = (address) => {
  if (!address) return '';
  if (address.length <= 10) return address;
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};

const addNewDle = () => {
  if (!newDle.value.name || !newDle.value.address || !newDle.value.location) {
    return;
  }
  
  dleList.value.push({
    name: newDle.value.name,
    address: newDle.value.address,
    location: newDle.value.location
  });
  
  // Сброс формы
  newDle.value = {
    name: '',
    address: '',
    location: ''
  };
  
  showAddDleForm.value = false;
};

const removeDle = (address) => {
  dleList.value = dleList.value.filter(dle => dle.address !== address);
};

const openDleInterface = (dle) => {
  // Здесь будет логика открытия интерфейса DLE
  // Вариант 1: Новая вкладка с внешним сайтом
  // window.open(`https://example.com/dle/${dle.address}`, '_blank');
  
  // Вариант 2: Встроенный интерфейс в текущей вкладке
  router.push(`/management/dle/${dle.address}`);
};
</script>

<style scoped>
.dle-management-container {
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

/* Карточки DLE */
.dle-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.dle-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 1.5rem;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
  cursor: pointer;
  min-height: 150px;
  display: flex;
  flex-direction: column;
}

.dle-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.dle-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.dle-card-header h3 {
  color: var(--color-primary);
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
}

.remove-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.remove-btn:hover {
  background: #ffebee;
}

.dle-card-content {
  flex-grow: 1;
}

.dle-address {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  margin: 0 0 0.5rem 0;
}

.dle-location {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  margin: 0;
}

/* Карточка добавления */
.add-dle-card {
  border: 2px dashed #dee2e6;
  background: #f8f9fa;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.add-dle-card:hover {
  border-color: var(--color-primary);
  background: #f0f8ff;
}

.add-dle-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.add-icon {
  font-size: 2rem;
  color: var(--color-primary);
  font-weight: bold;
}

.add-dle-content h3 {
  color: var(--color-primary);
  margin: 0;
  font-size: 1.2rem;
}

.add-dle-content p {
  color: var(--color-grey-dark);
  margin: 0;
  font-size: 0.9rem;
}

/* Модальное окно */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  color: var(--color-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-grey-dark);
  padding: 4px;
}

.modal-body {
  padding: 1.5rem;
}

/* Форма */
.add-dle-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  color: var(--color-grey-dark);
}

.form-group input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}

.btn-secondary {
  background: var(--color-secondary);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: var(--color-secondary-dark);
}

/* Адаптивность */
@media (max-width: 768px) {
  .dle-cards {
    grid-template-columns: 1fr;
  }
  
  .dle-card {
    padding: 1rem;
  }
  
  .form-actions {
    flex-direction: column;
  }
}
</style> 