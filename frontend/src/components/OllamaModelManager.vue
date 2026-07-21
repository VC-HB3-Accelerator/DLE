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
    <h3>{{ t('ai.ollama.title') }}</h3>
    
    <!-- Статус подключения -->
    <div class="connection-status">
      <div class="status-indicator" :class="{ connected: isConnected }">
        {{ isConnected ? t('ai.ollama.connected') : t('ai.ollama.disconnected') }}
      </div>
      <button @click="checkConnection" :disabled="checking">
        {{ checking ? t('ai.ollama.checking') : t('ai.ollama.checkConnection') }}
      </button>
    </div>

    <!-- Установленные модели -->
    <div class="installed-models" v-if="isConnected">
      <div class="memory-header">
        <h4>{{ t('ai.ollama.installedModels') }}</h4>
        <button
          type="button"
          class="clear-memory-btn"
          :disabled="!loadedInMemory.length || clearingMemory"
          @click="unloadAllMemory"
        >
          {{ clearingMemory ? t('ai.ollama.clearingMemory') : t('ai.ollama.clearAllMemory') }}
        </button>
      </div>
      <p v-if="preloadModel" class="preload-hint">
        {{ t('ai.ollama.preloadOnRestart', { model: preloadModel }) }}
      </p>
      <p v-if="actionError" class="action-error">{{ actionError }}</p>
      <div v-if="loadedInMemory.length" class="memory-loaded-list">
        <span class="memory-loaded-label">{{ t('ai.ollama.inMemoryNow') }}:</span>
        <span v-for="m in loadedInMemory" :key="m.name" class="memory-chip">{{ m.name }}</span>
      </div>
      <div v-if="installedModels.length === 0" class="no-models">
        {{ t('ai.ollama.noModels') }}
      </div>
      <div v-else class="models-list">
        <div v-for="model in installedModels" :key="model.name" class="model-item">
          <div class="model-info">
            <div class="model-name">{{ model.name }}</div>
            <div class="model-size">{{ formatSize(model.size) }}</div>
            <div class="model-modified">{{ formatDate(model.modified) }}</div>
          </div>
          <div class="model-actions">
            <button
              type="button"
              @click="loadIntoMemory(model.name)"
              :disabled="memoryAction === model.name || isInMemory(model.name)"
              class="load-memory-btn"
            >
              {{ memoryAction === model.name ? t('ai.ollama.loadingMemory') : t('ai.ollama.loadIntoMemory') }}
            </button>
            <button
              type="button"
              @click="unloadFromMemory(model.name)"
              :disabled="memoryAction === model.name || !isInMemory(model.name)"
              class="unload-memory-btn"
            >
              {{ memoryAction === model.name ? t('ai.ollama.unloadingMemory') : t('ai.ollama.unloadFromMemory') }}
            </button>
            <button @click="removeModel(model.name)" :disabled="removing === model.name" class="remove-btn">
              {{ removing === model.name ? t('ai.ollama.removing') : t('ai.ollama.removeFromDisk') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Поиск и установка моделей -->
    <div class="model-search" v-if="isConnected">
      <h4>{{ t('ai.ollama.installNew') }}</h4>
      <div class="search-form">
        <input 
          v-model="searchQuery" 
          :placeholder="t('ai.ollama.modelPlaceholder')"
          @keyup.enter="searchModels"
        />
        <button @click="searchModels" :disabled="searching || searchQuery.trim().length < 2">
          {{ searching ? t('ai.ollama.searching') : t('ai.ollama.find') }}
        </button>
      </div>
      <div v-if="searchResults.length" class="search-results">
        <h5>{{ t('ai.ollama.searchResults') }}</h5>
        <div class="popular-list">
          <button
            v-for="model in searchResults"
            :key="model"
            type="button"
            class="popular-model-btn"
            @click="installModel(model)"
            :disabled="installing === model"
          >
            {{ installing === model ? t('ai.ollama.installing') : model }}
          </button>
        </div>
      </div>
      <p v-else-if="searchAttempted && !searching" class="search-empty">
        {{ t('ai.ollama.searchNoResults') }}
      </p>
      
      <!-- Популярные модели -->
      <div class="popular-models">
        <h5>{{ t('ai.ollama.popularModels') }}</h5>
        <div class="popular-list">
          <button 
            v-for="model in popularModels" 
            :key="model"
            @click="installModel(model)"
            :disabled="installing === model"
            class="popular-model-btn"
          >
            {{ installing === model ? t('ai.ollama.installing') : model }}
          </button>
        </div>
      </div>
    </div>

    <!-- Инструкции -->
    <div class="instructions" v-if="!isConnected">
      <h4>{{ t('ai.ollama.howToInstall') }}</h4>
      <div class="instruction-steps">
        <div class="step">
          <strong>{{ t('ai.ollama.step1') }}</strong>
          <a href="https://ollama.ai/download" target="_blank" class="download-link">
            {{ t('ai.ollama.downloadLink') }}
          </a>
        </div>
        <div class="step">
          <strong>{{ t('ai.ollama.step2') }}</strong>
          <code>ollama serve</code>
        </div>
        <div class="step">
          <strong>{{ t('ai.ollama.step3') }}</strong>
          <code>ollama pull qwen2.5:1.5b</code>
        </div>
        <div class="step">
          <strong>{{ t('ai.ollama.step4') }}</strong>
          {{ t('ai.ollama.step4Hint') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';

const { t, tm, locale } = useI18n();

const isConnected = ref(false);
const checking = ref(false);
const installedModels = ref([]);
const searchQuery = ref('');
const searching = ref(false);
const installing = ref('');
const removing = ref('');
const memoryAction = ref('');
const clearingMemory = ref(false);
const loadedInMemory = ref([]);
const preloadModel = ref('');
const actionError = ref('');
const searchResults = ref([]);
const searchAttempted = ref(false);

function setActionError(message) {
  actionError.value = message || '';
}

function extractErrorMessage(error) {
  return error?.response?.data?.error
    || error?.response?.data?.message
    || error?.message
    || t('ai.ollama.actionFailed');
}

const popularModels = [
  'qwen2.5:1.5b',
  'llama2:7b',
  'mistral:7b',
  'codellama:7b',
  'llama2:13b',
  'qwen2.5:14b'
];

async function checkConnection() {
  checking.value = true;
  try {
    const response = await axios.get('/ollama/status');
    isConnected.value = response.data.connected;
    if (isConnected.value) {
      await loadInstalledModels();
      await loadMemoryStatus();
    }
  } catch (error) {
    isConnected.value = false;
  } finally {
    checking.value = false;
  }
}

async function loadMemoryStatus() {
  try {
    const response = await axios.get('/ollama/memory/loaded');
    loadedInMemory.value = response.data.loaded || [];
    preloadModel.value = response.data.preloadModel || '';
  } catch (error) {
    loadedInMemory.value = [];
    preloadModel.value = '';
  }
}

function isInMemory(modelName) {
  return loadedInMemory.value.some((m) => {
    const loaded = m.name || '';
    if (loaded === modelName) return true;
    if (loaded.startsWith(`${modelName}:`)) return true;
    if (modelName.startsWith(`${loaded}:`)) return true;
    return false;
  });
}

async function loadIntoMemory(modelName) {
  memoryAction.value = modelName;
  setActionError('');
  try {
    const { data } = await axios.post('/ollama/memory/load', { model: modelName });
    loadedInMemory.value = data.loaded || [];
    preloadModel.value = data.preloadModel || modelName;
  } catch (error) {
    setActionError(extractErrorMessage(error));
  } finally {
    memoryAction.value = '';
  }
}

async function unloadFromMemory(modelName) {
  memoryAction.value = modelName;
  setActionError('');
  try {
    const { data } = await axios.post('/ollama/memory/unload', { model: modelName });
    loadedInMemory.value = data.loaded || [];
    await loadMemoryStatus();
  } catch (error) {
    setActionError(extractErrorMessage(error));
  } finally {
    memoryAction.value = '';
  }
}

async function unloadAllMemory() {
  clearingMemory.value = true;
  setActionError('');
  try {
    const { data } = await axios.post('/ollama/memory/unload-all');
    loadedInMemory.value = data.loaded || [];
  } catch (error) {
    setActionError(extractErrorMessage(error));
  } finally {
    clearingMemory.value = false;
  }
}

async function loadInstalledModels() {
  try {
    const response = await axios.get('/ollama/models');
    installedModels.value = response.data.models || [];
  } catch (error) {
    // ignore
  }
}

async function searchModels() {
  const q = searchQuery.value.trim();
  if (q.length < 2) return;

  searching.value = true;
  searchAttempted.value = true;
  setActionError('');
  try {
    const { data } = await axios.get('/ollama/search', { params: { query: q } });
    searchResults.value = data.models || [];
  } catch (error) {
    searchResults.value = [];
    setActionError(extractErrorMessage(error));
  } finally {
    searching.value = false;
  }
}

async function installModel(modelName) {
  const name = String(modelName || '').trim();
  if (!name || name.length < 3) {
    setActionError(t('ai.ollama.invalidModelName'));
    return;
  }

  installing.value = name;
  setActionError('');
  try {
    await axios.post('/ollama/install', { model: name });
    await loadInstalledModels();
    searchQuery.value = '';
    searchResults.value = [];
    searchAttempted.value = false;
  } catch (error) {
    setActionError(extractErrorMessage(error));
  } finally {
    installing.value = '';
  }
}

async function removeModel(modelName) {
  removing.value = modelName;
  setActionError('');
  try {
    await axios.delete(`/ollama/models/${encodeURIComponent(modelName)}`);
    await loadInstalledModels();
    await loadMemoryStatus();
  } catch (error) {
    setActionError(extractErrorMessage(error));
  } finally {
    removing.value = '';
  }
}

function formatSize(bytes) {
  if (bytes === 0) return t('ai.ollama.zeroBytes');
  const k = 1024;
  const sizes = tm('ai.ollama.sizeUnits');
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const dateLocale = locale.value === 'ru' ? 'ru-RU' : 'en-US';
  return date.toLocaleDateString(dateLocale, {
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

.model-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.action-error {
  color: #b71c1c;
  font-size: 0.9rem;
  margin: 0 0 12px;
}

.search-empty {
  font-size: 0.9rem;
  color: #666;
  margin: 8px 0 16px;
}

.search-results {
  margin-bottom: 16px;
}

.memory-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.memory-header h4 {
  margin-bottom: 0;
}

.preload-hint {
  font-size: 0.9em;
  color: #495057;
  margin-bottom: 10px;
}

.memory-loaded-list {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #e8f4fd;
  border-radius: var(--radius-md);
}

.memory-loaded-label {
  font-weight: 600;
  font-size: 0.9em;
}

.memory-chip {
  background: #fff;
  border: 1px solid #b8daff;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 0.85em;
}

.load-memory-btn,
.unload-memory-btn,
.clear-memory-btn {
  border: none;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.85em;
}

.load-memory-btn {
  background: #28a745;
  color: #fff;
}

.unload-memory-btn {
  background: #6c757d;
  color: #fff;
}

.clear-memory-btn {
  background: #f8f9fa;
  border: 1px solid #ced4da;
  color: #212529;
}

.load-memory-btn:disabled,
.unload-memory-btn:disabled,
.clear-memory-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
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
