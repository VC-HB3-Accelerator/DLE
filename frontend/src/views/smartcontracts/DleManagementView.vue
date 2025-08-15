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
    <div class="dle-management">
      <div class="management-header">
        <h3>🏢 Управление DLE</h3>
        <p>Добавление DLE контрактов администраторами</p>
      </div>

      <!-- Форма добавления DLE -->
      <div class="add-dle-form">
        <div class="form-header">
          <h4>➕ Добавить новый DLE</h4>
        </div>
        
        <div class="form-content">
          <div class="form-group">
            <label for="dleLink">Ссылка на DLE контракт:</label>
            <input 
              type="text" 
              id="dleLink" 
              v-model="newDle.link" 
              class="form-control"
              placeholder="https://sepolia.etherscan.io/address/0x..."
            >
            <small class="form-help">Вставьте ссылку на Etherscan или другой блокчейн-эксплорер</small>
          </div>
          
          <div class="form-group">
            <label for="dleName">Название DLE:</label>
            <input 
              type="text" 
              id="dleName" 
              v-model="newDle.name" 
              class="form-control"
              placeholder="Название DLE"
            >
          </div>
          
          <div class="form-group">
            <label for="dleDescription">Описание:</label>
            <textarea 
              id="dleDescription" 
              v-model="newDle.description" 
              class="form-control" 
              rows="3"
              placeholder="Краткое описание DLE..."
            ></textarea>
          </div>
          
          <div class="form-actions">
            <button 
              class="btn btn-primary" 
              @click="addDle"
              :disabled="!isFormValid || isAdding"
            >
              <i class="fas fa-plus"></i> 
              {{ isAdding ? 'Добавление...' : 'Добавить DLE' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Список добавленных DLE -->
      <div class="dles-list">
        <div class="list-header">
          <h4>📋 Добавленные DLE</h4>
        </div>

        <div v-if="dles.length === 0" class="no-dles">
          <p>Добавленных DLE пока нет</p>
          <p>Используйте форму выше для добавления первого DLE</p>
        </div>

        <div v-else class="dles-grid">
          <div 
            v-for="dle in dles" 
            :key="dle.id" 
            class="dle-card"
          >
            <div class="dle-header">
              <h5>{{ dle.name }}</h5>
              <span class="dle-status">Добавлен</span>
            </div>

            <div class="dle-details">
              <div class="detail-item">
                <strong>Описание:</strong> {{ dle.description }}
              </div>
              <div class="detail-item">
                <strong>Ссылка:</strong> 
                <a :href="dle.link" target="_blank" class="dle-link">
                  {{ shortenUrl(dle.link) }}
                </a>
              </div>
              <div class="detail-item">
                <strong>Добавлен:</strong> {{ formatDate(dle.addedAt) }}
              </div>
            </div>

            <div class="dle-actions">
              <button 
                class="btn btn-sm btn-primary" 
                @click="openDle(dle.link)"
              >
                <i class="fas fa-external-link-alt"></i> Открыть
              </button>
              <button 
                class="btn btn-sm btn-danger" 
                @click="removeDle(dle.id)"
              >
                <i class="fas fa-trash"></i> Удалить
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseLayout>
</template>

<script setup>
import { ref, computed, onMounted, defineProps, defineEmits } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthContext } from '@/composables/useAuth';
import BaseLayout from '../../components/BaseLayout.vue';

const props = defineProps({
  isAuthenticated: Boolean,
  identities: Array,
  tokenBalances: Object,
  isLoadingTokens: Boolean
});

const emit = defineEmits(['auth-action-completed']);

const router = useRouter();
const { address } = useAuthContext();

// Состояние формы
const isAdding = ref(false);

// Новый DLE
const newDle = ref({
  link: '',
  name: '',
  description: ''
});

// Список DLE
const dles = ref([]);

// Вычисляемые свойства
const isFormValid = computed(() => {
  return newDle.value.link && newDle.value.name;
});

// Функции
function shortenUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return `${urlObj.hostname}${urlObj.pathname.substring(0, 20)}...`;
  } catch {
    return url.substring(0, 50) + '...';
  }
}

function formatDate(date) {
  if (!date) return '';
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function addDle() {
  if (!isFormValid.value) {
    alert('Пожалуйста, заполните все обязательные поля');
    return;
  }

  isAdding.value = true;
  
  try {
    // Создаем новый DLE
    const dle = {
      id: Date.now(),
      link: newDle.value.link,
      name: newDle.value.name,
      description: newDle.value.description,
      addedAt: new Date().toISOString()
    };
    
    // Добавляем в список
    dles.value.unshift(dle);
    
    // Сохраняем в localStorage
    saveDlesToStorage();
    
    // Сбрасываем форму
    newDle.value = {
      link: '',
      name: '',
      description: ''
    };
    
    alert('✅ DLE успешно добавлен!');
    
  } catch (error) {
    console.error('Ошибка при добавлении DLE:', error);
    alert('❌ Ошибка при добавлении DLE: ' + error.message);
  } finally {
    isAdding.value = false;
  }
}

function removeDle(dleId) {
  if (!confirm('Удалить этот DLE?')) return;
  
  try {
    dles.value = dles.value.filter(dle => dle.id !== dleId);
    saveDlesToStorage();
    alert('✅ DLE успешно удален!');
  } catch (error) {
    console.error('Ошибка при удалении DLE:', error);
    alert('❌ Ошибка при удалении DLE: ' + error.message);
  }
}

function openDle(link) {
  window.open(link, '_blank');
}

function saveDlesToStorage() {
  try {
    localStorage.setItem('admin-dles', JSON.stringify(dles.value));
  } catch (error) {
    console.error('Ошибка при сохранении DLE:', error);
  }
}

function loadDlesFromStorage() {
  try {
    const saved = localStorage.getItem('admin-dles');
    if (saved) {
      dles.value = JSON.parse(saved);
    }
  } catch (error) {
    console.error('Ошибка при загрузке DLE:', error);
  }
}

onMounted(() => {
  loadDlesFromStorage();
});
</script>

<style scoped>
.dle-management {
  padding: 1rem;
}

.management-header {
  margin-bottom: 2rem;
  text-align: center;
}

.management-header h3 {
  color: var(--color-primary);
  margin-bottom: 0.5rem;
}

.add-dle-form {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.form-header {
  margin-bottom: 1rem;
}

.form-header h4 {
  margin: 0;
  color: var(--color-primary);
}

.form-content {
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
  color: #333;
}

.form-control {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-control:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-help {
  color: #666;
  font-size: 0.875rem;
}

.form-actions {
  margin-top: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.dles-list {
  margin-top: 2rem;
}

.list-header {
  margin-bottom: 1rem;
}

.list-header h4 {
  color: var(--color-primary);
  margin: 0;
}

.no-dles {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.dles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 1.5rem;
}

.dle-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e9ecef;
}

.dle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.dle-header h5 {
  margin: 0;
  color: var(--color-primary);
}

.dle-status {
  background: #28a745;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
}

.dle-details {
  margin-bottom: 1rem;
}

.detail-item {
  margin-bottom: 0.5rem;
}

.detail-item strong {
  color: #333;
}

.dle-link {
  color: var(--color-primary);
  text-decoration: none;
}

.dle-link:hover {
  text-decoration: underline;
}

.dle-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
}
</style> 