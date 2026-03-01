<!--
  Copyright (c) 2024-2026 Тарабанов Александр Викторович
  All rights reserved.
  
  This software is proprietary and confidential.
  Unauthorized copying, modification, or distribution is prohibited.
  
  For licensing inquiries: info@hb3-accelerator.com
  Website: https://hb3-accelerator.com
  GitHub: https://github.com/VC-HB3-Accelerator
-->

<template>
  <div class="ollama-model-manager">
    <h3>Управление локальными моделями</h3>
    
    <!-- Статус подключения -->
    <div class="connection-status">
      <div class="status-indicator" :class="{ connected: isConnected }">
        {{ isConnected ? '🟢 Подключено' : '🔴 Не подключено' }}
      </div>
      <button @click="checkConnection" :disabled="checking">
        {{ checking ? 'Проверка...' : 'Проверить подключение' }}
      </button>
    </div>

    <!-- Установленные модели -->
    <div class="installed-models" v-if="isConnected">
      <h4>Установленные модели</h4>
      <div v-if="installedModels.length === 0" class="no-models">
        Нет установленных моделей
      </div>
      <div v-else class="models-list">
        <div v-for="model in installedModels" :key="model.name" class="model-item">
          <div class="model-info">
            <div class="model-name">{{ model.name }}</div>
            <div class="model-size">{{ formatSize(model.size) }}</div>
            <div class="model-modified">{{ formatDate(model.modified) }}</div>
          </div>
          <div class="model-actions">
            <button @click="removeModel(model.name)" :disabled="removing === model.name" class="remove-btn">
              {{ removing === model.name ? 'Удаление...' : 'Удалить' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Поиск и установка моделей -->
    <div class="model-search" v-if="isConnected">
      <h4>Установить новую модель</h4>
      <div class="search-form">
        <input 
          v-model="searchQuery" 
          placeholder="Введите название модели (например: qwen2.5:7b, llama2:7b)"
          @keyup.enter="searchModels"
        />
        <button @click="searchModels" :disabled="searching || !searchQuery">
          {{ searching ? 'Поиск...' : 'Найти' }}
        </button>
      </div>
      
      <!-- Популярные модели -->
      <div class="popular-models">
        <h5>Популярные модели:</h5>
        <div class="popular-list">
          <button 
            v-for="model in popularModels" 
            :key="model"
            @click="installModel(model)"
            :disabled="installing === model"
            class="popular-model-btn"
          >
            {{ installing === model ? 'Установка...' : model }}
          </button>
        </div>
      </div>
    </div>

    <!-- Инструкции -->
    <div class="instructions" v-if="!isConnected">
      <h4>Как установить Ollama</h4>
      <div class="instruction-steps">
        <div class="step">
          <strong>1. Установите Ollama:</strong>
          <a href="https://ollama.ai/download" target="_blank" class="download-link">
            Скачать с официального сайта
          </a>
        </div>
        <div class="step">
          <strong>2. Запустите Ollama:</strong>
          <code>ollama serve</code>
        </div>
        <div class="step">
          <strong>3. Установите модель:</strong>
          <code>ollama pull qwen2.5:7b</code>
        </div>
        <div class="step">
          <strong>4. Проверьте подключение:</strong>
          Нажмите кнопку "Проверить подключение" выше
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const isConnected = ref(false);
const checking = ref(false);
const installedModels = ref([]);
const searchQuery = ref('');
const searching = ref(false);
const installing = ref('');
const removing = ref('');

const popularModels = [
  'qwen2.5:7b',
  'llama2:7b',
  'mistral:7b',
  'codellama:7b',
  'llama2:13b',
  'qwen2.5:14b'
];

// Проверка подключения к Ollama
async function checkConnection() {
  checking.value = true;
  try {
    const response = await axios.get('/ollama/status');
    isConnected.value = response.data.connected;
    if (isConnected.value) {
      await loadInstalledModels();
    }
  } catch (error) {
            // console.error('Ошибка проверки подключения:', error);
    isConnected.value = false;
  } finally {
    checking.value = false;
  }
}

// Загрузка установленных моделей
async function loadInstalledModels() {
  try {
    const response = await axios.get('/ollama/models');
    installedModels.value = response.data.models || [];
  } catch (error) {
            // console.error('Ошибка загрузки моделей:', error);
  }
}

// Поиск моделей
async function searchModels() {
  if (!searchQuery.value.trim()) return;
  
  searching.value = true;
  try {
    // Здесь можно добавить поиск моделей в реестре Ollama
    // Пока просто устанавливаем модель напрямую
    await installModel(searchQuery.value.trim());
  } catch (error) {
            // console.error('Ошибка поиска моделей:', error);
  } finally {
    searching.value = false;
  }
}

// Установка модели
async function installModel(modelName) {
  installing.value = modelName;
  try {
    await axios.post('/ollama/install', { model: modelName });
    await loadInstalledModels();
    searchQuery.value = '';
  } catch (error) {
            // console.error('Ошибка установки модели:', error);
  } finally {
    installing.value = '';
  }
}

// Удаление модели
async function removeModel(modelName) {
  removing.value = modelName;
  try {
    await axios.delete(`/ollama/models/${encodeURIComponent(modelName)}`);
    await loadInstalledModels();
  } catch (error) {
            // console.error('Ошибка удаления модели:', error);
  } finally {
    removing.value = '';
  }
}

// Форматирование размера
function formatSize(bytes) {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Форматирование даты
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

onMounted(() => {
  checkConnection();
});
</script>

<style scoped>
.ollama-model-manager {
  background: #fff;
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-top: 20px;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: var(--radius-md);
}

.status-indicator {
  font-weight: bold;
}

.status-indicator.connected {
  color: #28a745;
}

.status-indicator:not(.connected) {
  color: #dc3545;
}

.installed-models {
  margin-bottom: 30px;
}

.no-models {
  color: #6c757d;
  font-style: italic;
  padding: 20px;
  text-align: center;
  background: #f8f9fa;
  border-radius: var(--radius-md);
}

.models-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: var(--radius-md);
  border: 1px solid #e9ecef;
}

.model-info {
  flex: 1;
}

.model-name {
  font-weight: bold;
  margin-bottom: 5px;
}

.model-size, .model-modified {
  font-size: 0.9em;
  color: #6c757d;
}

.remove-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9em;
}

.remove-btn:hover:not(:disabled) {
  background: #c82333;
}

.remove-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.model-search {
  margin-bottom: 30px;
}

.search-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.search-form input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ced4da;
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.search-form button {
  padding: 10px 20px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.search-form button:hover:not(:disabled) {
  background: var(--color-primary-dark);
}

.search-form button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.popular-models h5 {
  margin-bottom: 10px;
  color: #495057;
}

.popular-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.popular-model-btn {
  padding: 8px 16px;
  background: #e9ecef;
  border: 1px solid #ced4da;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.2s;
}

.popular-model-btn:hover:not(:disabled) {
  background: #dee2e6;
  border-color: #adb5bd;
}

.popular-model-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.instructions {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: var(--radius-md);
  padding: 20px;
}

.instruction-steps {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.step code {
  background: #e9ecef;
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  font-family: 'Courier New', monospace;
  font-size: 0.9em;
}

.download-link {
  color: var(--color-primary);
  text-decoration: none;
}

.download-link:hover {
  text-decoration: underline;
}

h3, h4, h5 {
  margin-bottom: 15px;
  color: #212529;
}

h3 {
  font-size: 1.5em;
}

h4 {
  font-size: 1.2em;
}

h5 {
  font-size: 1em;
}
</style> 