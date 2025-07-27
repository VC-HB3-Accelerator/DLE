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
    <div class="modules-container">
      <!-- Заголовок -->
      <div class="page-header">
        <div class="header-content">
          <h1>Модули DLE</h1>
          <p>Установка, настройка и управление модулями</p>
        </div>
        <button class="close-btn" @click="router.push('/management')">×</button>
      </div>

      <!-- Доступные модули -->
      <div class="available-modules-section">
        <h2>Доступные модули</h2>
        <div class="modules-grid">
          <div 
            v-for="module in availableModules" 
            :key="module.id" 
            class="module-card"
            :class="{ 'module-installed': module.installed }"
          >
            <div class="module-header">
              <h3>{{ module.name }}</h3>
              <span class="module-version">v{{ module.version }}</span>
            </div>
            <p class="module-description">{{ module.description }}</p>
            <div class="module-features">
              <span 
                v-for="feature in module.features" 
                :key="feature" 
                class="feature-tag"
              >
                {{ feature }}
              </span>
            </div>
            <div class="module-actions">
              <button 
                v-if="!module.installed"
                @click="installModule(module.id)"
                class="btn-primary"
                :disabled="isInstalling"
              >
                {{ isInstalling ? 'Установка...' : 'Установить' }}
              </button>
              <button 
                v-else
                @click="openModuleInterface(module)"
                class="btn-secondary"
              >
                Управление
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Установленные модули -->
      <div class="installed-modules-section">
        <h2>Установленные модули</h2>
        <div v-if="installedModules.length === 0" class="empty-state">
          <p>Нет установленных модулей</p>
        </div>
        <div v-else class="installed-modules-list">
          <div 
            v-for="module in installedModules" 
            :key="module.address" 
            class="installed-module-card"
          >
            <div class="module-info">
              <div class="module-header">
                <h3>{{ module.name }}</h3>
                <span class="module-status" :class="module.status">
                  {{ getStatusText(module.status) }}
                </span>
              </div>
              <p class="module-description">{{ module.description }}</p>
              <p class="module-address">Адрес: {{ formatAddress(module.address) }}</p>
              <p class="module-version">Версия: {{ module.version }}</p>
            </div>
            <div class="module-actions">
              <button @click="openModuleInterface(module)" class="btn-secondary">
                Управление
              </button>
              <button @click="configureModule(module)" class="btn-secondary">
                Настройки
              </button>
              <button @click="uninstallModule(module.address)" class="btn-danger">
                Удалить
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Модальное окно настройки модуля -->
      <div v-if="showConfigModal" class="modal-overlay" @click="showConfigModal = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Настройки модуля {{ selectedModule?.name }}</h3>
            <button @click="showConfigModal = false" class="close-btn">✕</button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="saveModuleConfig" class="config-form">
              <div 
                v-for="setting in selectedModule?.configSettings" 
                :key="setting.key"
                class="form-group"
              >
                <label :for="setting.key">{{ setting.label }}:</label>
                <input 
                  v-if="setting.type === 'text'"
                  :id="setting.key"
                  v-model="moduleConfig[setting.key]"
                  type="text"
                  :placeholder="setting.placeholder"
                  required
                >
                <input 
                  v-else-if="setting.type === 'number'"
                  :id="setting.key"
                  v-model="moduleConfig[setting.key]"
                  type="number"
                  :min="setting.min"
                  :max="setting.max"
                  :placeholder="setting.placeholder"
                  required
                >
                <select 
                  v-else-if="setting.type === 'select'"
                  :id="setting.key"
                  v-model="moduleConfig[setting.key]"
                  required
                >
                  <option value="">Выберите значение</option>
                  <option 
                    v-for="option in setting.options" 
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </option>
                </select>
                <span class="setting-hint">{{ setting.hint }}</span>
              </div>
              
              <div class="form-actions">
                <button type="button" @click="showConfigModal = false" class="btn-secondary">
                  Отмена
                </button>
                <button type="submit" class="btn-primary" :disabled="isSavingConfig">
                  {{ isSavingConfig ? 'Сохранение...' : 'Сохранить' }}
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
const isInstalling = ref(false);
const isSavingConfig = ref(false);
const showConfigModal = ref(false);
const selectedModule = ref(null);
const moduleConfig = ref({});

// Доступные модули (временные данные)
const availableModules = ref([
  {
    id: 'treasury',
    name: 'Казначейство',
    version: '1.0.0',
    description: 'Управление средствами и активами DLE',
    features: ['Мультивалютность', 'Автоматизация', 'Отчетность'],
    installed: true,
    configSettings: [
      {
        key: 'maxWithdrawal',
        label: 'Максимальная сумма вывода',
        type: 'number',
        min: 0,
        max: 1000000,
        placeholder: '10000',
        hint: 'Максимальная сумма для однократного вывода средств'
      },
      {
        key: 'approvalRequired',
        label: 'Требуется одобрение',
        type: 'select',
        options: [
          { value: 'true', label: 'Да' },
          { value: 'false', label: 'Нет' }
        ],
        hint: 'Требуется ли одобрение для операций с казной'
      }
    ]
  },
  {
    id: 'governance',
    name: 'Расширенное управление',
    version: '2.1.0',
    description: 'Дополнительные функции голосования и управления',
    features: ['Делегирование', 'Взвешенное голосование', 'Автоматизация'],
    installed: false,
    configSettings: [
      {
        key: 'delegationEnabled',
        label: 'Включить делегирование',
        type: 'select',
        options: [
          { value: 'true', label: 'Да' },
          { value: 'false', label: 'Нет' }
        ],
        hint: 'Разрешить делегирование голосов'
      }
    ]
  },
  {
    id: 'compliance',
    name: 'Соответствие требованиям',
    version: '1.2.0',
    description: 'Модуль для обеспечения соответствия нормативным требованиям',
    features: ['KYC/AML', 'Отчетность', 'Аудит'],
    installed: false,
    configSettings: [
      {
        key: 'kycRequired',
        label: 'Требуется KYC',
        type: 'select',
        options: [
          { value: 'true', label: 'Да' },
          { value: 'false', label: 'Нет' }
        ],
        hint: 'Требуется ли прохождение KYC для участия'
      }
    ]
  }
]);

// Установленные модули (временные данные)
const installedModules = ref([
  {
    name: 'Казначейство',
    description: 'Управление средствами и активами DLE',
    address: '0x1234567890123456789012345678901234567890',
    version: '1.0.0',
    status: 'active',
    configSettings: availableModules.value[0].configSettings
  }
]);

// Методы
const installModule = async (moduleId) => {
  if (isInstalling.value) return;
  
  try {
    isInstalling.value = true;
    
    // Здесь будет логика установки модуля
    console.log('Установка модуля:', moduleId);
    
    // Временная логика
    const module = availableModules.value.find(m => m.id === moduleId);
    if (module) {
      module.installed = true;
      
      // Добавляем в список установленных
      installedModules.value.push({
        name: module.name,
        description: module.description,
        address: '0x' + Math.random().toString(16).substr(2, 40),
        version: module.version,
        status: 'active',
        configSettings: module.configSettings
      });
    }
    
    alert('Модуль успешно установлен!');
    
  } catch (error) {
    console.error('Ошибка установки модуля:', error);
    alert('Ошибка при установке модуля');
  } finally {
    isInstalling.value = false;
  }
};

const uninstallModule = async (moduleAddress) => {
  if (!confirm('Вы уверены, что хотите удалить этот модуль?')) return;
  
  try {
    // Здесь будет логика удаления модуля
    console.log('Удаление модуля:', moduleAddress);
    
    // Временная логика
    installedModules.value = installedModules.value.filter(m => m.address !== moduleAddress);
    
    // Обновляем статус в доступных модулях
    const module = availableModules.value.find(m => m.name === 'Казначейство');
    if (module) {
      module.installed = false;
    }
    
    alert('Модуль успешно удален!');
    
  } catch (error) {
    console.error('Ошибка удаления модуля:', error);
    alert('Ошибка при удалении модуля');
  }
};

const configureModule = (module) => {
  selectedModule.value = module;
  moduleConfig.value = {};
  showConfigModal.value = true;
};

const saveModuleConfig = async () => {
  if (isSavingConfig.value) return;
  
  try {
    isSavingConfig.value = true;
    
    // Здесь будет логика сохранения конфигурации
    console.log('Сохранение конфигурации:', moduleConfig.value);
    
    alert('Конфигурация успешно сохранена!');
    showConfigModal.value = false;
    
  } catch (error) {
    console.error('Ошибка сохранения конфигурации:', error);
    alert('Ошибка при сохранении конфигурации');
  } finally {
    isSavingConfig.value = false;
  }
};

const openModuleInterface = (module) => {
  // Здесь будет логика открытия интерфейса модуля
  console.log('Открытие интерфейса модуля:', module);
  alert(`Открытие интерфейса модуля ${module.name}`);
};

const getStatusText = (status) => {
  const statusMap = {
    'active': 'Активен',
    'inactive': 'Неактивен',
    'error': 'Ошибка',
    'updating': 'Обновляется'
  };
  return statusMap[status] || status;
};

const formatAddress = (address) => {
  if (!address) return '';
  return address.substring(0, 6) + '...' + address.substring(address.length - 4);
};
</script>

<style scoped>
.modules-container {
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
.available-modules-section,
.installed-modules-section {
  margin-bottom: 40px;
}

.available-modules-section h2,
.installed-modules-section h2 {
  color: var(--color-primary);
  margin-bottom: 20px;
  font-size: 1.8rem;
}

/* Сетка модулей */
.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
  gap: 20px;
}

.module-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.module-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.module-card.module-installed {
  border-left: 4px solid #28a745;
  background: #f8fff9;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.module-header h3 {
  margin: 0;
  color: var(--color-primary);
  font-size: 1.3rem;
}

.module-version {
  background: var(--color-primary);
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.module-description {
  color: var(--color-grey-dark);
  margin: 0 0 15px 0;
  line-height: 1.5;
}

.module-features {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.feature-tag {
  background: #e9ecef;
  color: var(--color-grey-dark);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.module-actions {
  display: flex;
  gap: 10px;
}

/* Установленные модули */
.installed-modules-list {
  display: grid;
  gap: 20px;
}

.installed-module-card {
  background: white;
  padding: 25px;
  border-radius: var(--radius-lg);
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.installed-module-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.module-info {
  margin-bottom: 20px;
}

.module-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
}

.module-status.active {
  background: #d4edda;
  color: #155724;
}

.module-status.inactive {
  background: #f8d7da;
  color: #721c24;
}

.module-status.error {
  background: #f8d7da;
  color: #721c24;
}

.module-status.updating {
  background: #fff3cd;
  color: #856404;
}

.module-address {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  margin: 8px 0;
}

.module-version {
  font-size: 0.9rem;
  color: var(--color-grey-dark);
  margin: 0;
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
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
  margin: 0;
  color: var(--color-primary);
}

.modal-body {
  padding: 20px;
}

/* Форма конфигурации */
.config-form {
  display: flex;
  flex-direction: column;
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
.form-group select {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: var(--radius-sm);
  font-size: 1rem;
}

.setting-hint {
  font-size: 0.8rem;
  color: var(--color-grey-dark);
  margin-top: 4px;
}

.form-actions {
  display: flex;
  gap: 15px;
  justify-content: flex-end;
  margin-top: 20px;
}

/* Кнопки */
.btn-primary {
  background: var(--color-primary);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9rem;
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
  .modules-grid {
    grid-template-columns: 1fr;
  }
  
  .module-actions {
    flex-direction: column;
  }
  
  .form-actions {
    flex-direction: column;
  }
}
</style> 