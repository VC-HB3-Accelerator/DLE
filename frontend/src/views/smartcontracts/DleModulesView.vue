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
  <div class="dle-modules-management">
    <div class="modules-header">
      <h3>🧩 Управление модулями</h3>
      <button class="btn btn-primary" @click="showAddModuleForm = true">
        <i class="fas fa-plus"></i> Добавить модуль
      </button>
    </div>

    <!-- Форма добавления модуля -->
    <div v-if="showAddModuleForm" class="add-module-form">
      <div class="form-header">
        <h4>🧩 Добавить модуль</h4>
        <button class="close-btn" @click="showAddModuleForm = false">×</button>
      </div>
      
      <div class="form-content">
        <!-- Информация о модуле -->
        <div class="form-section">
          <h5>📋 Информация о модуле</h5>
          
          <div class="form-group">
            <label for="moduleId">ID модуля:</label>
            <input 
              type="text" 
              id="moduleId" 
              v-model="newModule.moduleId" 
              class="form-control"
              placeholder="TreasuryModule"
            >
            <small class="form-help">Уникальный идентификатор модуля (например: TreasuryModule)</small>
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
            <small class="form-help">Адрес смарт-контракта модуля</small>
          </div>
          
          <div class="form-group">
            <label for="moduleName">Название модуля:</label>
            <input 
              type="text" 
              id="moduleName" 
              v-model="newModule.name" 
              class="form-control"
              placeholder="Казначейство"
            >
          </div>
          
          <div class="form-group">
            <label for="moduleDescription">Описание модуля:</label>
            <textarea 
              id="moduleDescription" 
              v-model="newModule.description" 
              class="form-control" 
              rows="3"
              placeholder="Описание функциональности модуля..."
            ></textarea>
          </div>
        </div>

        <!-- Выбор типа модуля -->
        <div class="form-section">
          <h5>🔧 Тип модуля</h5>
          
          <div class="module-types">
            <div class="form-group">
              <label for="moduleType">Выберите тип модуля:</label>
              <select id="moduleType" v-model="newModule.type" class="form-control">
                <option value="">-- Выберите тип --</option>
                <option value="treasury">Казначейство</option>
                <option value="voting">Голосование</option>
                <option value="communication">Коммуникации</option>
                <option value="custom">Пользовательский</option>
              </select>
            </div>

            <!-- Специфичные настройки для казначейства -->
            <div v-if="newModule.type === 'treasury'" class="module-settings">
              <h6>Настройки казначейства</h6>
              <div class="form-group">
                <label for="treasuryTokens">Токены для управления:</label>
                <select id="treasuryTokens" v-model="newModule.settings.tokens" multiple class="form-control">
                  <option value="ETH">ETH</option>
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                  <option value="DAI">DAI</option>
                </select>
              </div>
              <div class="form-group">
                <label for="treasuryLimit">Лимит операций:</label>
                <input 
                  type="number" 
                  id="treasuryLimit" 
                  v-model.number="newModule.settings.limit" 
                  class="form-control"
                  placeholder="1000"
                >
              </div>
            </div>

            <!-- Специфичные настройки для голосования -->
            <div v-if="newModule.type === 'voting'" class="module-settings">
              <h6>Настройки голосования</h6>
              <div class="form-group">
                <label for="votingType">Тип голосования:</label>
                <select id="votingType" v-model="newModule.settings.votingType" class="form-control">
                  <option value="simple">Простое большинство</option>
                  <option value="weighted">Взвешенное голосование</option>
                  <option value="quadratic">Квадратичное голосование</option>
                </select>
              </div>
              <div class="form-group">
                <label for="votingDuration">Длительность голосования (дни):</label>
                <input 
                  type="number" 
                  id="votingDuration" 
                  v-model.number="newModule.settings.duration" 
                  class="form-control"
                  min="1"
                  max="30"
                  placeholder="7"
                >
              </div>
            </div>

            <!-- Специфичные настройки для коммуникаций -->
            <div v-if="newModule.type === 'communication'" class="module-settings">
              <h6>Настройки коммуникаций</h6>
              <div class="form-group">
                <label for="communicationChannels">Каналы связи:</label>
                <div class="checkbox-group">
                  <label><input type="checkbox" v-model="newModule.settings.channels.email"> Email</label>
                  <label><input type="checkbox" v-model="newModule.settings.channels.telegram"> Telegram</label>
                  <label><input type="checkbox" v-model="newModule.settings.channels.discord"> Discord</label>
                  <label><input type="checkbox" v-model="newModule.settings.channels.slack"> Slack</label>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Предварительный просмотр -->
        <div class="form-section">
          <h5>👁️ Предварительный просмотр</h5>
          <div class="preview-card">
            <div class="preview-item">
              <strong>ID модуля:</strong> {{ newModule.moduleId || 'Не указан' }}
            </div>
            <div class="preview-item">
              <strong>Адрес:</strong> {{ shortenAddress(newModule.moduleAddress) || 'Не указан' }}
            </div>
            <div class="preview-item">
              <strong>Название:</strong> {{ newModule.name || 'Не указано' }}
            </div>
            <div class="preview-item">
              <strong>Тип:</strong> {{ getModuleTypeName(newModule.type) || 'Не выбран' }}
            </div>
            <div class="preview-item">
              <strong>Описание:</strong> {{ newModule.description || 'Не указано' }}
            </div>
            <div v-if="newModule.type" class="preview-item">
              <strong>Настройки:</strong> {{ getModuleSettingsPreview() }}
            </div>
          </div>
        </div>

        <!-- Действия -->
        <div class="form-actions">
          <button 
            class="btn btn-success" 
            @click="addModule" 
            :disabled="!isFormValid || isAdding"
          >
            <i class="fas fa-plus"></i> 
            {{ isAdding ? 'Добавление...' : 'Добавить модуль' }}
          </button>
          <button class="btn btn-secondary" @click="resetForm">
            <i class="fas fa-undo"></i> Сбросить
          </button>
          <button class="btn btn-danger" @click="showAddModuleForm = false">
            <i class="fas fa-times"></i> Отмена
          </button>
        </div>
      </div>
    </div>

    <!-- Список модулей -->
    <div class="modules-list">
      <div class="list-header">
        <h4>📋 Установленные модули</h4>
        <div class="list-filters">
          <select v-model="typeFilter" class="form-control">
            <option value="">Все типы</option>
            <option value="treasury">Казначейство</option>
            <option value="voting">Голосование</option>
            <option value="communication">Коммуникации</option>
            <option value="custom">Пользовательские</option>
          </select>
        </div>
      </div>

      <div v-if="filteredModules.length === 0" class="no-modules">
        <p>Установленных модулей пока нет</p>
      </div>

      <div v-else class="modules-grid">
        <div 
          v-for="module in filteredModules" 
          :key="module.moduleId" 
          class="module-card"
          :class="module.type"
        >
          <div class="module-header">
            <h5>{{ module.name }}</h5>
            <span class="module-type">{{ getModuleTypeName(module.type) }}</span>
          </div>

          <div class="module-details">
            <div class="detail-item">
              <strong>ID:</strong> {{ module.moduleId }}
            </div>
            <div class="detail-item">
              <strong>Адрес:</strong> {{ shortenAddress(module.moduleAddress) }}
            </div>
            <div class="detail-item">
              <strong>Описание:</strong> {{ module.description }}
            </div>
            <div class="detail-item">
              <strong>Статус:</strong> 
              <span class="module-status" :class="{ 'active': module.isActive }">
                {{ module.isActive ? 'Активен' : 'Неактивен' }}
              </span>
            </div>
          </div>

          <div class="module-actions">
            <button 
              class="btn btn-sm btn-info" 
              @click="viewModuleDetails(module.moduleId)"
            >
              <i class="fas fa-eye"></i> Детали
            </button>
            <button 
              class="btn btn-sm btn-warning" 
              @click="configureModule(module.moduleId)"
            >
              <i class="fas fa-cog"></i> Настроить
            </button>
            <button 
              class="btn btn-sm btn-danger" 
              @click="removeModule(module.moduleId)"
            >
              <i class="fas fa-trash"></i> Удалить
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Доступные модули -->
    <div class="available-modules">
      <h4>📦 Доступные модули</h4>
      <p>Модули, которые можно установить в вашем DLE</p>
      
      <div class="available-modules-grid">
        <div 
          v-for="availableModule in availableModules" 
          :key="availableModule.id" 
          class="available-module-card"
        >
          <div class="module-icon">
            <i :class="availableModule.icon"></i>
          </div>
          <div class="module-info">
            <h6>{{ availableModule.name }}</h6>
            <p>{{ availableModule.description }}</p>
            <div class="module-features">
              <span v-for="feature in availableModule.features" :key="feature" class="feature-tag">
                {{ feature }}
              </span>
            </div>
          </div>
          <div class="module-actions">
            <button 
              class="btn btn-sm btn-success" 
              @click="installAvailableModule(availableModule)"
            >
              <i class="fas fa-download"></i> Установить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthContext } from '@/composables/useAuth';

const props = defineProps({
  dleAddress: { type: String, required: true },
  dleContract: { type: Object, required: true }
});

const { address } = useAuthContext();

// Состояние формы
const showAddModuleForm = ref(false);
const isAdding = ref(false);
const typeFilter = ref('');

// Новый модуль
const newModule = ref({
  moduleId: '',
  moduleAddress: '',
  name: '',
  description: '',
  type: '',
  settings: {
    tokens: [],
    limit: 0,
    votingType: 'simple',
    duration: 7,
    channels: {
      email: false,
      telegram: false,
      discord: false,
      slack: false
    }
  }
});

// Установленные модули
const modules = ref([]);

// Доступные модули
const availableModules = ref([
  {
    id: 'treasury',
    name: 'Казначейство',
    description: 'Управление финансами DLE, прием и отправка токенов',
    icon: 'fas fa-coins',
    features: ['Управление токенами', 'Бюджетирование', 'Отчетность'],
    type: 'treasury'
  },
  {
    id: 'hierarchical-voting',
    name: 'Иерархическое голосование',
    description: 'Продвинутая система голосования с иерархией',
    icon: 'fas fa-sitemap',
    features: ['Иерархия', 'Взвешенное голосование', 'Делегирование'],
    type: 'voting'
  },
  {
    id: 'communication',
    name: 'Коммуникации',
    description: 'Система уведомлений и коммуникаций',
    icon: 'fas fa-comments',
    features: ['Уведомления', 'Каналы связи', 'Автоматизация'],
    type: 'communication'
  },
  {
    id: 'analytics',
    name: 'Аналитика',
    description: 'Аналитические инструменты для DLE',
    icon: 'fas fa-chart-line',
    features: ['Статистика', 'Графики', 'Отчеты'],
    type: 'custom'
  }
]);

// Вычисляемые свойства
const isFormValid = computed(() => {
  return (
    newModule.value.moduleId &&
    newModule.value.moduleAddress &&
    newModule.value.name &&
    newModule.value.type
  );
});

const filteredModules = computed(() => {
  if (!typeFilter.value) return modules.value;
  return modules.value.filter(m => m.type === typeFilter.value);
});

// Функции
function getModuleTypeName(type) {
  const types = {
    'treasury': 'Казначейство',
    'voting': 'Голосование',
    'communication': 'Коммуникации',
    'custom': 'Пользовательский'
  };
  return types[type] || 'Неизвестный тип';
}

function getModuleSettingsPreview() {
  const settings = newModule.value.settings;
  
  switch (newModule.value.type) {
    case 'treasury':
      return `Токены: ${settings.tokens.join(', ') || 'Не выбраны'}, Лимит: ${settings.limit}`;
    case 'voting':
      return `Тип: ${settings.votingType}, Длительность: ${settings.duration} дней`;
    case 'communication':
      const channels = Object.entries(settings.channels)
        .filter(([_, enabled]) => enabled)
        .map(([name, _]) => name);
      return `Каналы: ${channels.join(', ') || 'Не выбраны'}`;
    default:
      return 'Нет настроек';
  }
}

function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Добавление модуля
async function addModule() {
  if (!isFormValid.value) {
    alert('Пожалуйста, заполните все обязательные поля');
    return;
  }

  isAdding.value = true;
  
  try {
    // Вызов смарт-контракта
    const tx = await props.dleContract.addModule(
      newModule.value.moduleId,
      newModule.value.moduleAddress
    );
    
    await tx.wait();
    
    // Обновляем список модулей
    await loadModules();
    
    // Сбрасываем форму
    resetForm();
    showAddModuleForm.value = false;
    
    alert('✅ Модуль успешно добавлен!');
    
  } catch (error) {
    console.error('Ошибка при добавлении модуля:', error);
    alert('❌ Ошибка при добавлении модуля: ' + error.message);
  } finally {
    isAdding.value = false;
  }
}

// Удаление модуля
async function removeModule(moduleId) {
  if (!confirm(`Удалить модуль "${moduleId}"?`)) return;
  
  try {
    const tx = await props.dleContract.removeModule(moduleId);
    await tx.wait();
    
    await loadModules();
    alert('✅ Модуль успешно удален!');
    
  } catch (error) {
    console.error('Ошибка при удалении модуля:', error);
    alert('❌ Ошибка при удалении модуля: ' + error.message);
  }
}

// Установка доступного модуля
async function installAvailableModule(availableModule) {
  // Здесь должна быть логика установки модуля
  // Например, деплой модуля и добавление в DLE
  console.log('Установка модуля:', availableModule);
  alert(`Модуль "${availableModule.name}" будет установлен`);
}

// Загрузка модулей
async function loadModules() {
  try {
    // Здесь должен быть вызов API или смарт-контракта для загрузки модулей
    // Пока используем заглушку
    modules.value = [];
  } catch (error) {
    console.error('Ошибка при загрузке модулей:', error);
  }
}

function resetForm() {
  newModule.value = {
    moduleId: '',
    moduleAddress: '',
    name: '',
    description: '',
    type: '',
    settings: {
      tokens: [],
      limit: 0,
      votingType: 'simple',
      duration: 7,
      channels: {
        email: false,
        telegram: false,
        discord: false,
        slack: false
      }
    }
  };
}

function viewModuleDetails(moduleId) {
  // Открыть модальное окно с деталями модуля
  console.log('Просмотр деталей модуля:', moduleId);
}

function configureModule(moduleId) {
  // Открыть форму настройки модуля
  console.log('Настройка модуля:', moduleId);
}

onMounted(() => {
  loadModules();
});
</script>

<style scoped>
.dle-modules-management {
  padding: 1rem;
}

.modules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.add-module-form {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
}

.form-section {
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.form-section:last-child {
  border-bottom: none;
}

.form-section h5 {
  color: #333;
  margin-bottom: 1rem;
}

.module-types {
  margin-top: 1rem;
}

.module-settings {
  margin-top: 1rem;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 6px;
}

.module-settings h6 {
  color: #333;
  margin-bottom: 1rem;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.preview-card {
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 1rem;
}

.preview-item {
  margin-bottom: 0.5rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

.modules-list {
  margin-top: 2rem;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.module-card {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
}

.module-card.treasury {
  border-left: 4px solid #28a745;
}

.module-card.voting {
  border-left: 4px solid #007bff;
}

.module-card.communication {
  border-left: 4px solid #ffc107;
}

.module-card.custom {
  border-left: 4px solid #6c757d;
}

.module-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.module-header h5 {
  margin: 0;
  color: #333;
}

.module-type {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  background: #e9ecef;
  color: #495057;
}

.module-details {
  margin-bottom: 1rem;
}

.detail-item {
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.module-status {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
}

.module-status.active {
  background: #d4edda;
  color: #155724;
}

.module-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.no-modules {
  text-align: center;
  padding: 2rem;
  color: #666;
}

.available-modules {
  margin-top: 3rem;
}

.available-modules h4 {
  margin-bottom: 1rem;
}

.available-modules p {
  color: #666;
  margin-bottom: 2rem;
}

.available-modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.available-module-card {
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  background: #fff;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.module-icon {
  width: 50px;
  height: 50px;
  background: #f8f9fa;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #007bff;
  font-size: 1.5rem;
  flex-shrink: 0;
}

.module-info {
  flex-grow: 1;
}

.module-info h6 {
  margin: 0 0 0.5rem 0;
  color: #333;
}

.module-info p {
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: #666;
}

.module-features {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.feature-tag {
  background: #e9ecef;
  color: #495057;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

.form-help {
  font-size: 0.9rem;
  color: #666;
  margin-top: 0.25rem;
}
</style> 