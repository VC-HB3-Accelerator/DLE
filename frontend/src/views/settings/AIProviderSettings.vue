<template>
  <div class="ai-provider-settings settings-panel">
    <h2>{{ label }}</h2>
    <p class="desc">{{ description }}</p>
    <form @submit.prevent="onSave">
      <div v-if="showApiKey">
        <label>API Key:</label>
        <input type="password" v-model="apiKey" :placeholder="apiKeyPlaceholder" />
        <button type="button" class="verify-btn" @click="onVerify" :disabled="verifying">Verify</button>
        <span v-if="verifyStatus === true" class="ok">✔️</span>
        <span v-if="verifyStatus === false" class="error">Ошибка: {{ verifyError }}</span>
      </div>
      <div v-if="showBaseUrl">
        <label>Base URL:</label>
        <input type="text" v-model="baseUrl" :placeholder="baseUrlPlaceholder" />
      </div>
      <div v-if="models.length">
        <label>Модель (LLM):</label>
        <select v-model="selectedModel">
          <option v-for="model in models" :key="model.id || model.name || model" :value="model.id || model.name || model">
            {{ model.id || model.name || model }}
          </option>
        </select>
      </div>
      <div v-if="embeddingModels.length">
        <label>Embeddings-модель:</label>
        <select v-model="selectedEmbeddingModel">
          <option v-for="model in embeddingModels" :key="model.id || model.name || model" :value="model.id || model.name || model">
            {{ model.id || model.name || model }}
          </option>
        </select>
      </div>
      <div class="actions">
        <button type="submit" :disabled="saving">Сохранить</button>
        <button type="button" @click="onDelete" v-if="hasSettings">Удалить ключ</button>
        <button type="button" @click="$emit('cancel')">Закрыть</button>
      </div>
      <div v-if="saveStatus === true" class="ok">Сохранено!</div>
      <div v-if="saveStatus === false" class="error">Ошибка: {{ saveError }}</div>
    </form>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';
const props = defineProps({
  provider: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  showApiKey: { type: Boolean, default: true },
  showBaseUrl: { type: Boolean, default: true },
  apiKeyPlaceholder: { type: String, default: '' },
  baseUrlPlaceholder: { type: String, default: '' },
});

const apiKey = ref('');
const baseUrl = ref('');
const selectedModel = ref('');
const selectedEmbeddingModel = ref('');
const models = ref([]);
const embeddingModels = ref([]);
const hasSettings = ref(false);
const verifying = ref(false);
const verifyStatus = ref(null);
const verifyError = ref('');
const saving = ref(false);
const saveStatus = ref(null);
const saveError = ref('');

async function loadSettings() {
  try {
    const { data } = await axios.get(`/settings/ai-settings/${props.provider}`);
    if (data.settings) {
      apiKey.value = data.settings.api_key || '';
      baseUrl.value = data.settings.base_url || '';
      selectedModel.value = data.settings.selected_model || '';
      selectedEmbeddingModel.value = data.settings.embedding_model || '';
      hasSettings.value = true;
      if (apiKey.value || props.provider === 'ollama') {
        await loadModels();
        await loadEmbeddingModels();
      }
    } else {
      hasSettings.value = false;
    }
  } catch (e) {
    hasSettings.value = false;
  }
}

async function loadModels() {
  try {
    const { data } = await axios.get(`/settings/ai-settings/${props.provider}/models`);
    models.value = data.models || [];
    if (!selectedModel.value && models.value.length) {
      const first = models.value[0];
      selectedModel.value = first.id || first.name || first;
    }
  } catch (e) {
    models.value = [];
  }
}

async function loadEmbeddingModels() {
  try {
    const { data } = await axios.get(`/settings/ai-settings/${props.provider}/models`);
    embeddingModels.value = (data.models || []).filter(m => {
      const name = m.id || m.name || m;
      return name && name.toLowerCase().includes('embed');
    });
    if (!selectedEmbeddingModel.value && embeddingModels.value.length) {
      const first = embeddingModels.value[0];
      selectedEmbeddingModel.value = first.id || first.name || first;
    }
  } catch (e) {
    embeddingModels.value = [];
  }
}

async function onVerify() {
  verifying.value = true;
  verifyStatus.value = null;
  verifyError.value = '';
  try {
    const { data } = await axios.post(`/settings/ai-settings/${props.provider}/verify`, {
      api_key: apiKey.value,
      base_url: baseUrl.value,
    });
    verifyStatus.value = data.success;
    if (data.success) {
      await loadModels();
    }
  } catch (e) {
    verifyStatus.value = false;
    verifyError.value = e.response?.data?.error || e.message;
  } finally {
    verifying.value = false;
  }
}

async function onSave() {
  saving.value = true;
  saveStatus.value = null;
  saveError.value = '';
  try {
    await axios.put(`/settings/ai-settings/${props.provider}`, {
      api_key: apiKey.value,
      base_url: baseUrl.value,
      selected_model: selectedModel.value,
      embedding_model: selectedEmbeddingModel.value,
    });
    saveStatus.value = true;
    hasSettings.value = true;
  } catch (e) {
    saveStatus.value = false;
    saveError.value = e.response?.data?.error || e.message;
  } finally {
    saving.value = false;
  }
}

async function onDelete() {
  await axios.delete(`/settings/ai-settings/${props.provider}`);
  apiKey.value = '';
  baseUrl.value = '';
  selectedModel.value = '';
  selectedEmbeddingModel.value = '';
  models.value = [];
  embeddingModels.value = [];
  hasSettings.value = false;
}

onMounted(loadSettings);
watch([apiKey, baseUrl], () => {
  verifyStatus.value = null;
  verifyError.value = '';
  saveStatus.value = null;
  saveError.value = '';
});
</script>

<style scoped>
.ai-provider-settings.settings-panel {
  padding: var(--block-padding);
  /* background-color: var(--color-light); */
  /* border-radius: var(--radius-md); */
  /* box-shadow: 0 2px 8px rgba(0,0,0,0.08); */
  margin-top: var(--spacing-lg);
  max-width: 500px;
}
.desc {
  color: #666;
  margin-bottom: 1rem;
}
label {
  display: block;
  margin-bottom: 0.3rem;
  font-weight: 500;
}
input[type="password"], input[type="text"], select {
  width: 100%;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 1rem;
  margin-bottom: 1rem;
}
.verify-btn {
  margin-left: 0.5rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.4rem 1.2rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.verify-btn:hover {
  background: var(--color-primary-dark);
}
.actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}
.ok {
  color: #2cae4f;
  margin-left: 1rem;
}
.error {
  color: #d32f2f;
  margin-left: 1rem;
}
</style> 