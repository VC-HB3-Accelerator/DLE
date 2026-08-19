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
  <div class="ai-provider-settings">
    <h2 v-if="showHeading">{{ label }}</h2>
    <p v-if="description" class="desc">{{ description }}</p>
    <form class="provider-form" @submit.prevent="onSave">
      <div v-if="showApiKey" class="form-group">
        <label class="form-label">{{ $t('settings.ai.providerSettings.apiKey') }}</label>
        <div class="api-key-row">
          <input type="password" v-model="apiKey" class="form-control" :placeholder="apiKeyPlaceholder" autocomplete="off" />
          <button type="button" class="btn btn-primary btn-sm verify-btn" @click="onVerify" :disabled="verifying">
            {{ $t('settings.ai.providerSettings.verify') }}
          </button>
        </div>
        <span v-if="verifyStatus === true" class="alert alert-success verify-status">{{ $t('settings.ai.providerSettings.saved') }}</span>
        <span v-if="verifyStatus === false" class="alert alert-danger verify-status">
          {{ $t('settings.ai.providerSettings.errorPrefix') }} {{ verifyError }}
        </span>
      </div>
      <div v-if="showBaseUrl" class="form-group">
        <label class="form-label">{{ $t('settings.ai.providerSettings.baseUrl') }}</label>
        <input type="text" v-model="baseUrl" class="form-control" :placeholder="baseUrlPlaceholder" />
      </div>
      <div v-if="showProxy" class="proxy-block form-group">
        <label class="proxy-toggle">
          <input type="checkbox" v-model="proxyEnabled" />
          <span>{{ $t('settings.ai.providerSettings.blancEnabled') }}</span>
        </label>
        <p class="form-hint">{{ $t('settings.ai.providerSettings.blancHint') }}</p>
        <label class="form-label">{{ $t('settings.ai.providerSettings.blancUrl') }}</label>
        <input
          type="text"
          v-model="blancSubscriptionUrl"
          class="form-control"
          :disabled="!proxyEnabled"
          :placeholder="$t('settings.ai.providerSettings.blancUrlPlaceholder')"
          autocomplete="off"
        />
        <p v-if="blancMetaText" class="form-hint proxy-meta">{{ blancMetaText }}</p>
        <details class="proxy-advanced">
          <summary>{{ $t('settings.ai.providerSettings.manualProxySummary') }}</summary>
          <label class="form-label">{{ $t('settings.ai.providerSettings.proxyUrl') }}</label>
          <input
            type="text"
            v-model="proxyUrl"
            class="form-control"
            :disabled="!proxyEnabled"
            :placeholder="$t('settings.ai.providerSettings.proxyUrlPlaceholder')"
            autocomplete="off"
          />
        </details>
      </div>
      <div v-if="models.length" class="form-group">
        <label class="form-label">{{ $t('settings.ai.providerSettings.llmModel') }}</label>
        <select v-model="selectedModel" class="form-control">
          <option v-for="model in models" :key="model.id || model.name || model" :value="model.id || model.name || model">
            {{ model.id || model.name || model }}
          </option>
        </select>
      </div>
      <div v-else-if="showApiKey" class="form-group">
        <label class="form-label">{{ $t('settings.ai.providerSettings.llmModel') }}</label>
        <input
          type="text"
          v-model="selectedModel"
          class="form-control"
          :placeholder="provider === 'qwencloud' ? 'qwen-plus' : (provider === 'deepseek' ? 'deepseek-chat' : 'model-id')"
          autocomplete="off"
        />
      </div>
      <div v-if="embeddingModels.length" class="form-group">
        <label class="form-label">{{ $t('settings.ai.providerSettings.embeddingModel') }}</label>
        <select v-model="selectedEmbeddingModel" class="form-control">
          <option
            v-for="model in embeddingModels"
            :key="model.id || model.name || model"
            :value="model.id || model.name || model"
          >
            {{ model.id || model.name || model }}
          </option>
        </select>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ $t('common.save') }}</button>
        <button type="button" class="btn btn-danger" v-if="hasSettings" @click="onDelete">
          {{ $t('settings.ai.providerSettings.deleteKey') }}
        </button>
      </div>
      <div v-if="saveStatus === true" class="alert alert-success">{{ $t('settings.ai.providerSettings.saved') }}</div>
      <div v-if="saveStatus === false" class="alert alert-danger">
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
  showHeading: { type: Boolean, default: false },
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
    const { data } = await axios.get('/settings/embedding-models');
    const all = data.models || [];
    embeddingModels.value = all.filter((m) => {
      const name = m.id || m.name || m;
      if (!name) return false;
      if (props.provider && m.provider && m.provider !== props.provider) return false;
      return true;
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
      const body = {
        api_key: apiKey.value,
        base_url: baseUrl.value,
        selected_model: selectedModel.value,
      };
      if (props.showProxy) {
        body.proxy_url = proxyUrl.value;
        body.proxy_enabled = proxyEnabled.value;
        body.blanc_subscription_url = blancSubscriptionUrl.value;
      }
      const response = await axios.post(`/settings/ai-settings/${props.provider}/verify`, body);
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
    const body = {
      api_key: apiKey.value,
      base_url: baseUrl.value,
      selected_model: selectedModel.value,
      embedding_model: selectedEmbeddingModel.value,
    };
    // Не затирать VPN-поля, если блок прокси на этой странице скрыт
    if (props.showProxy) {
      body.proxy_url = proxyUrl.value;
      body.proxy_enabled = proxyEnabled.value;
      body.blanc_subscription_url = blancSubscriptionUrl.value;
    }
    const { data } = await axios.put(`/settings/ai-settings/${props.provider}`, body);
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
  // Удаляем только ключ/модели провайдера, VPN (Blanc) оставляем
  const body = {
    api_key: '',
    base_url: baseUrl.value,
    selected_model: '',
    embedding_model: '',
  };
  if (props.showProxy) {
    body.proxy_url = '';
    body.proxy_enabled = false;
    body.blanc_subscription_url = '';
    body.proxy_openai = false;
    body.proxy_telegram = false;
  }
  await axios.put(`/settings/ai-settings/${props.provider}`, body);
  apiKey.value = '';
  selectedModel.value = '';
  selectedEmbeddingModel.value = '';
  models.value = [];
  embeddingModels.value = [];
  if (props.showProxy) {
    proxyUrl.value = '';
    blancSubscriptionUrl.value = '';
    blancMeta.value = null;
    proxyEnabled.value = false;
  }
  hasSettings.value = Boolean(baseUrl.value) || props.provider === 'ollama';
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
.ai-provider-settings {
  padding: 0;
  margin: 0;
  max-width: 640px;
  background: transparent;
  color: var(--color-text);
}

.desc {
  color: var(--theme-text-muted, var(--color-text-light));
  margin: 0 0 var(--spacing-lg);
  line-height: 1.4;
}

.api-key-row {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.api-key-row .form-control {
  flex: 1;
}

.verify-btn {
  flex-shrink: 0;
}

.verify-status {
  display: block;
  margin-top: var(--spacing-sm);
}

.proxy-block {
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
}

.proxy-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
}

.proxy-toggle input[type='checkbox'] {
  width: auto;
  margin: 0;
}

.proxy-meta {
  color: var(--color-primary);
}

.proxy-advanced {
  margin: var(--spacing-sm) 0 0;
  font-size: var(--font-size-sm);
}

.proxy-advanced summary {
  cursor: pointer;
  color: var(--color-text-light);
  margin-bottom: var(--spacing-sm);
}

@media (max-width: 768px) {
  .ai-provider-settings {
    max-width: 100%;
    box-sizing: border-box;
  }

  .api-key-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
