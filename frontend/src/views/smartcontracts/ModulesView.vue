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
    <div class="modules-management">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Модули DLE</h1>
          <p v-if="selectedDle">{{ selectedDle.name }} ({{ selectedDle.symbol }}) - {{ selectedDle.dleAddress }}</p>
          <p v-else-if="isLoadingDle">Загрузка...</p>
          <p v-else>DLE не выбран</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Информация о модулях -->
      <div class="modules-info">
        <div class="info-card">
          <h3>📊 Информация о модулях</h3>
          <div class="info-grid">
            <div class="info-item">
              <strong>Всего модулей:</strong> {{ modulesCount }}
            </div>
            <div class="info-item">
              <strong>Активных модулей:</strong> {{ activeModulesCount }}
            </div>
            <div class="info-item">
              <strong>Неактивных модулей:</strong> {{ inactiveModulesCount }}
            </div>
          </div>
        </div>
      </div>

      <!-- Форма добавления модуля -->
      <div class="add-module-form">
        <div class="form-header">
          <h3>➕ Добавить модуль</h3>
          <p>Создать предложение для добавления нового модуля</p>
        </div>
        
        <div class="form-content">
          <div class="form-row">
            <div class="form-group">
              <label for="moduleId">ID модуля:</label>
              <input 
                type="text" 
                id="moduleId" 
                v-model="newModule.moduleId" 
                class="form-control"
                placeholder="0x..."
              >
              <small class="form-help">Уникальный идентификатор модуля (bytes32)</small>
            </div>
            
            <div class="form-group">
              <label for="moduleAddress">Адрес модуля:</label>
              <input 
                type="text" 
                id="moduleAddress" 
                v-model="newModule.moduleAddress" 
                class="form-control"
                placeholder="0x..."
              >
              <small class="form-help">Адрес контракта модуля</small>
            </div>
          </div>
          
          <div class="form-group">
            <label for="moduleDescription">Описание предложения:</label>
            <textarea 
              id="moduleDescription" 
              v-model="newModule.description" 
              class="form-control" 
              rows="3"
              placeholder="Описание предложения для добавления модуля..."
            ></textarea>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="moduleDuration">Продолжительность голосования (сек):</label>
              <input 
                type="number" 
                id="moduleDuration" 
                v-model="newModule.duration" 
                class="form-control"
                placeholder="86400"
              >
              <small class="form-help">Время голосования в секундах (86400 = 1 день)</small>
            </div>
            
            <div class="form-group">
              <label for="moduleChainId">ID сети:</label>
              <input 
                type="number" 
                id="moduleChainId" 
                v-model="newModule.chainId" 
                class="form-control"
                placeholder="11155111"
              >
              <small class="form-help">ID сети (11155111 = Sepolia)</small>
            </div>
          </div>
          
          <div class="form-actions">
            <button 
              class="btn btn-primary" 
              @click="handleCreateAddModuleProposal"
              :disabled="!isFormValid || isCreating"
            >
              <i class="fas fa-plus"></i> 
              {{ isCreating ? 'Создание предложения...' : 'Создать предложение' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Список модулей -->
      <div class="modules-list">
        <div class="list-header">
          <h3>📋 Модули DLE</h3>
          <button class="btn btn-sm btn-outline-secondary" @click="loadModules" :disabled="isLoadingModules">
            <i class="fas fa-sync-alt" :class="{ 'fa-spin': isLoadingModules }"></i> Обновить
          </button>
        </div>

        <div v-if="isLoadingModules" class="loading-modules">
          <p>Загрузка модулей...</p>
        </div>

        <div v-else-if="modules.length === 0" class="no-modules">
          <p>Модулей пока нет</p>
          <p>Используйте форму выше для добавления первого модуля</p>
        </div>

        <div v-else class="modules-grid">
          <div 
            v-for="module in modules" 
            :key="module.moduleId" 
            class="module-card"
            :class="{ 'active': module.isActive, 'inactive': !module.isActive }"
          >
            <div class="module-header">
              <h5>{{ module.moduleId }}</h5>
              <span class="module-status" :class="{ 'active': module.isActive, 'inactive': !module.isActive }">
                {{ module.isActive ? 'Активен' : 'Неактивен' }}
              </span>
            </div>

            <div class="module-details">
              <div class="detail-item">
                <strong>Адрес:</strong> 
                <a 
                  :href="`https://sepolia.etherscan.io/address/${module.moduleAddress}`" 
                  target="_blank" 
                  class="address-link"
                >
                  {{ shortenAddress(module.moduleAddress) }}
                  <i class="fas fa-external-link-alt"></i>
                </a>
              </div>
            </div>

            <div class="module-actions">
              <button 
                v-if="module.isActive"
                class="btn btn-sm btn-danger" 
                @click="handleCreateRemoveModuleProposal(module.moduleId)"
                :disabled="isRemoving === module.moduleId"
              >
                <i class="fas fa-trash"></i> 
                {{ isRemoving === module.moduleId ? 'Создание предложения...' : 'Удалить' }}
              </button>
              <button 
                v-else
                class="btn btn-sm btn-success" 
                @click="activateModule(module.moduleId)"
                :disabled="isActivating === module.moduleId"
              >
                <i class="fas fa-check"></i> 
                {{ isActivating === module.moduleId ? 'Активация...' : 'Активировать' }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </BaseLayout>
</template>

<script setup>
import { defineProps, defineEmits, ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import BaseLayout from '../../components/BaseLayout.vue';
import { 
  createAddModuleProposal,
  createRemoveModuleProposal,
  isModuleActive,
  getModuleAddress,
  getAllModules
} from '../../services/modulesService.js';
import api from '../../api/axios';

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
const selectedDle = ref(null);
const isLoadingDle = ref(false);
const modules = ref([]);
const isLoadingModules = ref(false);
const isCreating = ref(false);
const isRemoving = ref(null);
const isActivating = ref(null);

// Форма нового модуля
const newModule = ref({
  moduleId: '',
  moduleAddress: '',
  description: '',
  duration: 86400,
  chainId: 11155111
});

// Вычисляемые свойства
const isFormValid = computed(() => {
  return newModule.value.moduleId && 
         newModule.value.moduleAddress && 
         newModule.value.description &&
         newModule.value.duration > 0 &&
         newModule.value.chainId > 0;
});

const modulesCount = computed(() => modules.value.length);
const activeModulesCount = computed(() => modules.value.filter(m => m.isActive).length);
const inactiveModulesCount = computed(() => modules.value.filter(m => !m.isActive).length);

// Загрузка данных DLE
async function loadDleData() {
  try {
    isLoadingDle.value = true;
    const dleAddress = route.query.address;
    
    if (!dleAddress) {
      console.error('Адрес DLE не указан');
      return;
    }

    console.log('[ModulesView] Загрузка данных DLE:', dleAddress);
    
    // Читаем данные из блокчейна
    const response = await api.post('/blockchain/read-dle-info', {
      dleAddress: dleAddress
    });
    
    if (response.data.success) {
      selectedDle.value = response.data.data;
      console.log('[ModulesView] Данные DLE загружены:', selectedDle.value);
    } else {
      console.error('[ModulesView] Ошибка загрузки DLE:', response.data.error);
    }
  } catch (error) {
    console.error('[ModulesView] Ошибка загрузки DLE:', error);
  } finally {
    isLoadingDle.value = false;
  }
}

// Загрузка модулей
async function loadModules() {
  try {
    isLoadingModules.value = true;
    const dleAddress = route.query.address;
    
    if (!dleAddress) {
      console.error('Адрес DLE не указан');
      return;
    }

    console.log('[ModulesView] Загрузка модулей для DLE:', dleAddress);
    
    // Загружаем модули через modulesService
    const modulesResponse = await getAllModules(dleAddress);
    
    if (modulesResponse.success) {
      modules.value = modulesResponse.data.modules || [];
      console.log('[ModulesView] Модули загружены:', modules.value);
    } else {
      console.error('[ModulesView] Ошибка загрузки модулей:', modulesResponse.error);
      modules.value = [];
    }
    
  } catch (error) {
    console.error('[ModulesView] Ошибка загрузки модулей:', error);
    modules.value = [];
  } finally {
    isLoadingModules.value = false;
  }
}

// Создание предложения добавления модуля
async function handleCreateAddModuleProposal() {
  try {
    isCreating.value = true;
    const dleAddress = route.query.address;
    
    if (!dleAddress) {
      alert('Адрес DLE не указан');
      return;
    }

    console.log('[ModulesView] Создание предложения добавления модуля:', newModule.value);
    
    // Создаем предложение через modulesService
    const result = await createAddModuleProposal(dleAddress, {
      description: newModule.value.description,
      duration: newModule.value.duration,
      moduleId: newModule.value.moduleId,
      moduleAddress: newModule.value.moduleAddress,
      chainId: newModule.value.chainId
    });
    
    if (result.success) {
      console.log('[ModulesView] Предложение создано:', result);
      alert('✅ Предложение для добавления модуля создано!');
      
      // Очищаем форму
      newModule.value = {
        moduleId: '',
        moduleAddress: '',
        description: '',
        duration: 86400,
        chainId: 11155111
      };
      
      // Перезагружаем модули
      await loadModules();
    } else {
      alert('❌ Ошибка создания предложения: ' + result.error);
    }
    
  } catch (error) {
    console.error('[ModulesView] Ошибка создания предложения:', error);
    alert('❌ Ошибка создания предложения: ' + error.message);
  } finally {
    isCreating.value = false;
  }
}

// Создание предложения удаления модуля
async function handleCreateRemoveModuleProposal(moduleId) {
  try {
    isRemoving.value = moduleId;
    const dleAddress = route.query.address;
    
    if (!dleAddress) {
      alert('Адрес DLE не указан');
      return;
    }

    console.log('[ModulesView] Создание предложения удаления модуля:', moduleId);
    
    // Создаем предложение через modulesService
    const result = await createRemoveModuleProposal(dleAddress, {
      description: `Удаление модуля ${moduleId}`,
      duration: 86400, // 1 день
      moduleId: moduleId,
      chainId: 11155111 // Sepolia
    });
    
    if (result.success) {
      console.log('[ModulesView] Предложение удаления создано:', result);
      alert('✅ Предложение для удаления модуля создано!');
      
      // Перезагружаем модули
      await loadModules();
    } else {
      alert('❌ Ошибка создания предложения: ' + result.error);
    }
    
  } catch (error) {
    console.error('[ModulesView] Ошибка создания предложения удаления:', error);
    alert('❌ Ошибка создания предложения: ' + error.message);
  } finally {
    isRemoving.value = null;
  }
}

// Активация модуля (заглушка)
async function activateModule(moduleId) {
  try {
    isActivating.value = moduleId;
    console.log('[ModulesView] Активация модуля:', moduleId);
    
    // Здесь нужно будет реализовать активацию модуля
    alert('Функция активации модуля будет реализована позже');
    
  } catch (error) {
    console.error('[ModulesView] Ошибка активации модуля:', error);
    alert('❌ Ошибка активации модуля: ' + error.message);
  } finally {
    isActivating.value = null;
  }
}

// Утилиты
function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Инициализация
onMounted(() => {
  loadDleData();
  loadModules();
});
</script>

<style scoped>
.modules-management {
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

/* Информация о модулях */
.modules-info {
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
}

.info-item {
  padding: 10px;
  background: white;
  border-radius: var(--radius-sm);
  border: 1px solid #dee2e6;
}

/* Форма добавления модуля */
.add-module-form {
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
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
}

.form-actions {
  margin-top: 20px;
}

/* Список модулей */
.modules-list {
  background: white;
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid #e9ecef;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.list-header h3 {
  margin: 0;
  color: var(--color-primary);
}

.loading-modules,
.no-modules {
  text-align: center;
  padding: 40px;
  color: #666;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.module-card {
  border: 1px solid #e9ecef;
  border-radius: var(--radius-md);
  padding: 15px;
  transition: all 0.2s;
}

.module-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.module-card.active {
  border-color: #28a745;
  background: #f8fff9;
}

.module-card.inactive {
  border-color: #dc3545;
  background: #fff8f8;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.module-header h5 {
  margin: 0;
  font-size: 14px;
  font-family: monospace;
  word-break: break-all;
}

.module-status {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
}

.module-status.active {
  background: #d4edda;
  color: #155724;
}

.module-status.inactive {
  background: #f8d7da;
  color: #721c24;
}

.module-details {
  margin-bottom: 15px;
}

.detail-item {
  margin-bottom: 5px;
  font-size: 14px;
}

.detail-item strong {
  color: #333;
}

.address-link {
  color: var(--color-primary);
  text-decoration: none;
  font-family: monospace;
}

.address-link:hover {
  text-decoration: underline;
}

.module-actions {
  display: flex;
  gap: 10px;
}

/* Кнопки */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.btn-success {
  background: #28a745;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #218838;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-outline-secondary {
  background: transparent;
  color: #6c757d;
  border: 1px solid #6c757d;
}

.btn-outline-secondary:hover:not(:disabled) {
  background: #6c757d;
  color: white;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 12px;
}

/* Адаптивность */
@media (max-width: 768px) {
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .modules-grid {
    grid-template-columns: 1fr;
  }
  
  .info-grid {
    grid-template-columns: 1fr;
  }
}
</style>
