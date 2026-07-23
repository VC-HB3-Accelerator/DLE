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
  <div class="ai-provider-settings settings-panel">
    <h2 v-if="showHeading">{{ label }}</h2>
    <p v-if="description" class="desc">{{ description }}</p>
    <form class="provider-form" @submit.prevent="onSave">
      <div v-if="showApiKey" class="field">
        <label>{{ $t('settings.ai.providerSettings.apiKey') }}</label>
        <div class="api-key-row">
          <input type="password" v-model="apiKey" :placeholder="apiKeyPlaceholder" autocomplete="off" />
          <button type="button" class="verify-btn" @click="onVerify" :disabled="verifying">
            {{ $t('settings.ai.providerSettings.verify') }}
          </button>
        </div>
        <span v-if="verifyStatus === true" class="ok">✔️</span>
        <span v-if="verifyStatus === false" class="error">
          {{ $t('settings.ai.providerSettings.errorPrefix') }} {{ verifyError }}
        </span>
      </div>
      <div v-if="showBaseUrl" class="field">
        <label>{{ $t('settings.ai.providerSettings.baseUrl') }}</label>
        <input type="text" v-model="baseUrl" :placeholder="baseUrlPlaceholder" />
      </div>
      <div v-if="showProxy" class="proxy-block field">
        <label class="proxy-toggle">
          <input type="checkbox" v-model="proxyEnabled" />
          <span>{{ $t('settings.ai.providerSettings.blancEnabled') }}</span>
        </label>
        <p class="proxy-hint">{{ $t('settings.ai.providerSettings.blancHint') }}</p>
        <label>{{ $t('settings.ai.providerSettings.blancUrl') }}</label>
        <input
          type="text"
          v-model="blancSubscriptionUrl"
          :disabled="!proxyEnabled"
          :placeholder="$t('settings.ai.providerSettings.blancUrlPlaceholder')"
          autocomplete="off"
        />
        <p v-if="blancMetaText" class="proxy-meta">{{ blancMetaText }}</p>
        <details class="proxy-advanced">
          <summary>{{ $t('settings.ai.providerSettings.manualProxySummary') }}</summary>
          <label>{{ $t('settings.ai.providerSettings.proxyUrl') }}</label>
          <input
            type="text"
            v-model="proxyUrl"
            :disabled="!proxyEnabled"
            :placeholder="$t('settings.ai.providerSettings.proxyUrlPlaceholder')"
            autocomplete="off"
          />
        </details>
      </div>
      <div v-if="models.length" class="field">
        <label>{{ $t('settings.ai.providerSettings.llmModel') }}</label>
        <select v-model="selectedModel">
          <option v-for="model in models" :key="model.id || model.name || model" :value="model.id || model.name || model">
            {{ model.id || model.name || model }}
          </option>
        </select>
      </div>
      <div v-if="embeddingModels.length" class="field">
        <label>{{ $t('settings.ai.providerSettings.embeddingModel') }}</label>
        <select v-model="selectedEmbeddingModel">
          <option
            v-for="model in embeddingModels"
            :key="model.id || model.name || model"
            :value="model.id || model.name || model"
          >
            {{ model.id || model.name || model }}
          </option>
        </select>
      </div>
      <div class="actions">
        <button type="submit" :disabled="saving">{{ $t('common.save') }}</button>
        <button type="button" v-if="hasSettings" @click="onDelete">
          {{ $t('settings.ai.providerSettings.deleteKey') }}
        </button>
        <button type="button" @click="$emit('cancel')">{{ $t('common.close') }}</button>
      </div>
      <div v-if="saveStatus === true" class="ok">{{ $t('settings.ai.providerSettings.saved') }}</div>
      <div v-if="saveStatus === false" class="error">
        {{ $t('settings.ai.providerSettings.errorPrefix') }} {{ saveError }}
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';

const { t } = useI18n();

const props = defineProps({
  provider: { type: String, required: true },
  label: { type: String, required: true },
  description: { type: String, default: '' },
  showApiKey: { type: Boolean, default: true },
  showBaseUrl: { type: Boolean, default: true },
  showProxy: { type: Boolean, default: false },
  showHeading: { type: Boolean, default: true },
  apiKeyPlaceholder: { type: String, default: '' },
  baseUrlPlaceholder: { type: String, default: '' },
});

defineEmits(['cancel']);

const apiKey = ref('');
const baseUrl = ref('');
const proxyUrl = ref('');
const blancSubscriptionUrl = ref('');
const blancMeta = ref(null);
const proxyEnabled = ref(false);
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

const blancMetaText = computed(() => {
  if (!blancMeta.value) return '';
  try {
    return t('settings.ai.providerSettings.blancMeta', {
      name: blancMeta.value.name || blancMeta.value.address || '—',
      total: blancMeta.value.nodesTotal || 0,
    });
  } catch {
    return '';
  }
});

async function loadSettings() {
  try {
    const { data } = await axios.get(`/settings/ai-settings/${props.provider}`);
    if (data.settings) {
      apiKey.value = data.settings.api_key || '';
      baseUrl.value = data.settings.base_url || '';
      proxyUrl.value = data.settings.proxy_url || '';
      blancSubscriptionUrl.value = data.settings.blanc_subscription_url || '';
      proxyEnabled.value = Boolean(data.settings.proxy_enabled);
      selectedModel.value = data.settings.selected_model || '';
      selectedEmbeddingModel.value = data.settings.embedding_model || '';
      hasSettings.value = true;
      blancMeta.value = data.blanc || null;
      if (apiKey.value || props.provider === 'ollama') {
        await loadModels();
        await loadEmbeddingModels();
      }
    } else {
      hasSettings.value = false;
      if (props.provider === 'ollama') {
        await loadDefaultBaseUrl();
      }
    }
  } catch (e) {
    hasSettings.value = false;
    if (props.provider === 'ollama') {
      await loadDefaultBaseUrl();
    }
  }
}

async function loadDefaultBaseUrl() {
  try {
    const { data } = await axios.get('/ollama/default-base-url');
    baseUrl.value = data.baseUrl || props.baseUrlPlaceholder || '';
  } catch (e) {
    console.error('Error loading default base URL:', e);
    baseUrl.value = props.baseUrlPlaceholder || '';
  }
}

async function loadModels() {
  try {
    let data;
    if (props.provider === 'ollama') {
      const response = await axios.get('/ollama/models');
      data = { models: response.data.models.map((m) => ({ id: m.name, name: m.name })) };
    } else {
      const response = await axios.get(`/settings/ai-settings/${props.provider}/models`);
      data = response.data;
    }

    models.value = data.models || [];
    if (!selectedModel.value && models.value.length) {
      const first = models.value[0];
      selectedModel.value = first.id || first.name || first;
    }
  } catch (e) {
    console.error('Error loading models:', e);
    models.value = [];
  }
}

async function loadEmbeddingModels() {
  try {
    let data;
    if (props.provider === 'ollama') {
      const response = await axios.get('/ollama/models');
      data = { models: response.data.models.map((m) => ({ id: m.name, name: m.name })) };
    } else {
      const response = await axios.get(`/settings/ai-settings/${props.provider}/models`);
      data = response.data;
    }

    embeddingModels.value = (data.models || []).filter((m) => {
      const name = m.id || m.name || m;
      return name && String(name).toLowerCase().includes('embed');
    });
    if (!selectedEmbeddingModel.value && embeddingModels.value.length) {
      const first = embeddingModels.value[0];
      selectedEmbeddingModel.value = first.id || first.name || first;
    }
  } catch (e) {
    console.error('Error loading embedding models:', e);
    embeddingModels.value = [];
  }
}

async function onVerify() {
  verifying.value = true;
  verifyStatus.value = null;
  verifyError.value = '';
  try {
    let data;
    if (props.provider === 'ollama') {
      const response = await axios.get('/ollama/status');
      data = { success: response.data.connected };
    } else {
      const response = await axios.post(`/settings/ai-settings/${props.provider}/verify`, {
        api_key: apiKey.value,
        base_url: baseUrl.value,
        proxy_url: proxyUrl.value,
        proxy_enabled: proxyEnabled.value,
        blanc_subscription_url: blancSubscriptionUrl.value,
      });
      data = response.data;
      if (data.blanc) blancMeta.value = data.blanc;
    }

    verifyStatus.value = data.success;
    if (data.success) {
      await loadModels();
      await loadEmbeddingModels();
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
    const { data } = await axios.put(`/settings/ai-settings/${props.provider}`, {
      api_key: apiKey.value,
      base_url: baseUrl.value,
      selected_model: selectedModel.value,
      embedding_model: selectedEmbeddingModel.value,
      proxy_url: proxyUrl.value,
      proxy_enabled: proxyEnabled.value,
      blanc_subscription_url: blancSubscriptionUrl.value,
    });
    saveStatus.value = true;
    hasSettings.value = true;
    if (data?.blanc) blancMeta.value = data.blanc;
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
  proxyUrl.value = '';
  blancSubscriptionUrl.value = '';
  blancMeta.value = null;
  proxyEnabled.value = false;
  selectedModel.value = '';
  selectedEmbeddingModel.value = '';
  models.value = [];
  embeddingModels.value = [];
  hasSettings.value = false;
}

onMounted(loadSettings);
watch([apiKey, baseUrl, proxyUrl, proxyEnabled, blancSubscriptionUrl], () => {
  verifyStatus.value = null;
  verifyError.value = '';
  saveStatus.value = null;
  saveError.value = '';
});
</script>

<style scoped>
.ai-provider-settings.settings-panel {
  padding: var(--block-padding, 1rem);
  margin-top: var(--spacing-lg, 1rem);
  max-width: 640px;
  color: #222;
}

.desc {
  color: #555;
  margin: 0 0 1rem;
  line-height: 1.4;
}

.field {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.35rem;
  font-weight: 500;
  color: #222;
}

.api-key-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.api-key-row input {
  flex: 1;
}

input[type='password'],
input[type='text'],
select {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 1rem;
  color: #222;
  background: #fff;
  margin-bottom: 0;
}

input:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.proxy-block {
  padding-top: 0.75rem;
  border-top: 1px solid #eee;
}

.proxy-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  margin-bottom: 0.4rem;
}

.proxy-toggle input[type='checkbox'] {
  width: auto;
  margin: 0;
}

.proxy-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: #666;
  line-height: 1.35;
}

.proxy-meta {
  margin: 0.35rem 0 0.75rem;
  font-size: 0.85rem;
  color: #2cae4f;
}

.proxy-advanced {
  margin: 0.5rem 0 0;
  font-size: 0.9rem;
}

.proxy-advanced summary {
  cursor: pointer;
  color: #666;
  margin-bottom: 0.5rem;
}

.verify-btn {
  flex-shrink: 0;
  background: var(--color-primary, #2cae4f);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.45rem 1rem;
  cursor: pointer;
  font-size: 0.95rem;
}

.verify-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.actions button {
  padding: 0.45rem 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #f7f7f7;
  cursor: pointer;
  color: #222;
}

.actions button[type='submit'] {
  background: var(--color-primary, #2cae4f);
  border-color: var(--color-primary, #2cae4f);
  color: #fff;
}

.ok {
  color: #2cae4f;
  margin-top: 0.5rem;
}

.error {
  color: #d32f2f;
  margin-top: 0.5rem;
  display: inline-block;
}
</style>
