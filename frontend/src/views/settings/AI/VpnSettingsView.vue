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
  <BaseLayout>
    <div class="vpn-settings-block panel page-with-close">
      <PageCloseButton fallback="/settings/ai" />
      <h2>{{ t('settings.ai.vpn.pageTitle') }}</h2>
      <p class="desc">{{ t('settings.ai.vpn.description') }}</p>

      <form class="vpn-form" @submit.prevent="onSave">
        <div class="form-group">
          <label class="proxy-toggle">
            <input v-model="proxyEnabled" type="checkbox" />
            <span>{{ t('settings.ai.vpn.enabled') }}</span>
          </label>
          <p class="form-hint">{{ t('settings.ai.vpn.hint') }}</p>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('settings.ai.vpn.targetsLabel') }}</label>
          <p class="form-hint">{{ t('settings.ai.vpn.targetsHint') }}</p>
          <label class="proxy-toggle target-toggle">
            <input v-model="proxyOpenai" type="checkbox" :disabled="!proxyEnabled" />
            <span>{{ t('settings.ai.vpn.targetOpenai') }}</span>
          </label>
          <label class="proxy-toggle target-toggle">
            <input v-model="proxyTelegram" type="checkbox" :disabled="!proxyEnabled" />
            <span>{{ t('settings.ai.vpn.targetTelegram') }}</span>
          </label>
        </div>

        <div class="form-group">
          <label class="form-label">{{ t('settings.ai.providerSettings.blancUrl') }}</label>
          <input
            v-model="blancSubscriptionUrl"
            type="text"
            class="form-control"
            :disabled="!proxyEnabled"
            :placeholder="t('settings.ai.providerSettings.blancUrlPlaceholder')"
            autocomplete="off"
          />
          <p v-if="blancMetaText" class="form-hint proxy-meta">{{ blancMetaText }}</p>
        </div>

        <details class="proxy-advanced">
          <summary>{{ t('settings.ai.providerSettings.manualProxySummary') }}</summary>
          <label class="form-label">{{ t('settings.ai.providerSettings.proxyUrl') }}</label>
          <input
            v-model="proxyUrl"
            type="text"
            class="form-control"
            :disabled="!proxyEnabled"
            :placeholder="t('settings.ai.providerSettings.proxyUrlPlaceholder')"
            autocomplete="off"
          />
        </details>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ t('common.save') }}</button>
          <button type="button" class="btn btn-ghost" :disabled="verifying || !proxyEnabled" @click="onVerify">
            {{ verifying ? t('settings.ai.vpn.verifying') : t('settings.ai.vpn.verify') }}
          </button>
        </div>

        <div v-if="saveStatus === true" class="alert alert-success">{{ t('settings.ai.providerSettings.saved') }}</div>
        <div v-if="saveStatus === false" class="alert alert-danger">
          {{ t('settings.ai.providerSettings.errorPrefix') }} {{ saveError }}
        </div>
        <div v-if="verifyStatus === true" class="alert alert-success">{{ t('settings.ai.vpn.verifyOk') }}</div>
        <div v-if="verifyStatus === false" class="alert alert-danger">
          {{ t('settings.ai.providerSettings.errorPrefix') }} {{ verifyError }}
        </div>
      </form>
    </div>
  </BaseLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import BaseLayout from '@/components/BaseLayout.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';

const { t } = useI18n();

const PROVIDER = 'openai';

const proxyEnabled = ref(false);
const proxyOpenai = ref(false);
const proxyTelegram = ref(false);
const blancSubscriptionUrl = ref('');
const proxyUrl = ref('');
const blancMeta = ref(null);
const apiKey = ref('');
const baseUrl = ref('');
const selectedModel = ref('');
const embeddingModel = ref('');

const saving = ref(false);
const saveStatus = ref(null);
const saveError = ref('');
const verifying = ref(false);
const verifyStatus = ref(null);
const verifyError = ref('');

const blancMetaText = computed(() => {
  if (!blancMeta.value) return '';
  return t('settings.ai.providerSettings.blancMeta', {
    name: blancMeta.value.name || blancMeta.value.address || '—',
    total: blancMeta.value.nodesTotal || 0,
  });
});

async function loadSettings() {
  try {
    const { data } = await axios.get(`/settings/ai-settings/${PROVIDER}`);
    if (data.settings) {
      apiKey.value = data.settings.api_key || '';
      baseUrl.value = data.settings.base_url || '';
      selectedModel.value = data.settings.selected_model || '';
      embeddingModel.value = data.settings.embedding_model || '';
      proxyUrl.value = data.settings.proxy_url || '';
      blancSubscriptionUrl.value = data.settings.blanc_subscription_url || '';
      proxyEnabled.value = Boolean(data.settings.proxy_enabled);
      proxyOpenai.value = Boolean(data.settings.proxy_openai);
      proxyTelegram.value = Boolean(data.settings.proxy_telegram);
      blancMeta.value = data.blanc || null;
    }
  } catch (e) {
    console.warn('[VpnSettings] load failed', e);
  }
}

function payload() {
  return {
    api_key: apiKey.value,
    base_url: baseUrl.value,
    selected_model: selectedModel.value,
    embedding_model: embeddingModel.value,
    proxy_url: proxyUrl.value,
    proxy_enabled: proxyEnabled.value,
    blanc_subscription_url: blancSubscriptionUrl.value,
    proxy_openai: proxyOpenai.value,
    proxy_telegram: proxyTelegram.value,
  };
}

async function onSave() {
  saving.value = true;
  saveStatus.value = null;
  saveError.value = '';
  verifyStatus.value = null;
  try {
    const { data } = await axios.put(`/settings/ai-settings/${PROVIDER}`, payload());
    saveStatus.value = true;
    if (data?.blanc) blancMeta.value = data.blanc;
  } catch (e) {
    saveStatus.value = false;
    saveError.value = e.response?.data?.error || e.message;
  } finally {
    saving.value = false;
  }
}

async function onVerify() {
  verifying.value = true;
  verifyStatus.value = null;
  verifyError.value = '';
  try {
    const { data } = await axios.post(`/settings/ai-settings/${PROVIDER}/verify`, payload());
    verifyStatus.value = Boolean(data.success);
    if (data.blanc) blancMeta.value = data.blanc;
    if (!data.success) {
      verifyError.value = data.error || t('settings.ai.vpn.verifyFail');
    }
  } catch (e) {
    verifyStatus.value = false;
    verifyError.value = e.response?.data?.error || e.message;
  } finally {
    verifying.value = false;
  }
}

onMounted(loadSettings);
watch([proxyEnabled, proxyOpenai, proxyTelegram, blancSubscriptionUrl, proxyUrl], () => {
  saveStatus.value = null;
  verifyStatus.value = null;
});
</script>

<style scoped>
.vpn-settings-block {
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  width: 100%;
  position: relative;
  color: var(--color-text);
}

.page-with-close {
  position: relative;
}

h2 {
  margin: 0 0 var(--spacing-sm);
  padding-right: 36px;
}

.desc {
  color: var(--color-text-light);
  margin: 0 0 var(--spacing-lg);
  line-height: 1.4;
  max-width: 640px;
}

.vpn-form {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.proxy-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-weight: 500;
}

.proxy-toggle input[type='checkbox'] {
  width: auto;
  margin: 0;
}

.target-toggle {
  margin-top: var(--spacing-xs);
  font-weight: 400;
}

.proxy-meta {
  color: var(--color-primary);
}

.proxy-advanced {
  font-size: var(--font-size-sm);
}

.proxy-advanced summary {
  cursor: pointer;
  color: var(--color-text-light);
  margin-bottom: var(--spacing-sm);
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

@media (max-width: 768px) {
  .vpn-form {
    max-width: 100%;
  }
}
</style>
