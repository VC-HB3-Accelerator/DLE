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
  <div class="ai-settings settings-panel" style="position:relative">
    <button class="close-btn" @click="$router.push('/settings')">×</button>
    <h2>{{ t('settings.ai.integrations') }}</h2>
    <div class="integration-blocks" v-if="!showProvider && !showEmailSettings && !showTelegramSettings && !showDbSettings">
      <div class="integration-block">
        <h3>{{ t('settings.ai.openai.title') }}</h3>
        <p>{{ t('settings.ai.openai.description') }}</p>
        <button class="details-btn" @click="goTo('/settings/ai/openai')">{{ t('common.details') }}</button>
      </div>
      <div class="integration-block">
        <h3>{{ t('settings.ai.ollama.title') }}</h3>
        <p>{{ t('settings.ai.ollama.description') }}</p>
        <button class="details-btn" @click="goTo('/settings/ai/ollama')">{{ t('common.details') }}</button>
      </div>
      <div class="integration-block">
        <h3>{{ t('settings.ai.telegram.title') }}</h3>
        <p>{{ t('settings.ai.telegram.description') }}</p>
        <button class="details-btn" @click="goTo('/settings/ai/telegram')">{{ t('common.details') }}</button>
      </div>
      <div class="integration-block">
        <h3>{{ t('settings.ai.email.title') }}</h3>
        <p>{{ t('settings.ai.email.description') }}</p>
        <button class="details-btn" @click="goTo('/settings/ai/email')">{{ t('common.details') }}</button>
      </div>
      <div class="integration-block">
        <h3>{{ t('settings.ai.database.title') }}</h3>
        <p>{{ t('settings.ai.database.description') }}</p>
        <button class="details-btn" @click="goTo('/settings/ai/database')">{{ t('common.details') }}</button>
      </div>
      <div class="integration-block">
        <h3>{{ t('settings.ai.assistant.title') }}</h3>
        <p>{{ t('settings.ai.assistant.description') }}</p>
        <button class="details-btn" @click="goTo('/settings/ai/assistant')">{{ t('common.details') }}</button>
      </div>
    </div>
    <AIProviderSettings
      v-if="showProvider"
      :provider="showProvider"
      :label="providerLabels[showProvider].label"
      :description="providerLabels[showProvider].description"
      :apiKeyPlaceholder="providerLabels[showProvider].apiKeyPlaceholder"
      :baseUrlPlaceholder="providerLabels[showProvider].baseUrlPlaceholder"
      :showApiKey="providerLabels[showProvider].showApiKey"
      :showBaseUrl="providerLabels[showProvider].showBaseUrl"
      @cancel="showProvider = null"
    />
    <NoAccessModal 
      :show="showNoAccessModal" 
      :title="t('settings.accessRestricted')"
      :message="t('settings.ai.adminOnly')"
      @close="closeNoAccessModal" 
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AIProviderSettings from './AIProviderSettings.vue';
import { usePermissions } from '@/composables/usePermissions';
import { useAuthContext } from '@/composables/useAuth';
import NoAccessModal from '@/components/NoAccessModal.vue';

const { t } = useI18n();
const router = useRouter();
const { checkAuth, checkUserAccessLevel, address, isAuthenticated } = useAuthContext();

onMounted(async () => {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }

  window.addEventListener('clear-application-data', () => {
    console.log('[AiSettingsView] Clearing AI settings data');
  });
  
  window.addEventListener('refresh-application-data', () => {
    console.log('[AiSettingsView] Refreshing AI settings data');
  });
});

const showProvider = ref(null);
const showTelegramSettings = ref(false);
const showEmailSettings = ref(false);
const showDbSettings = ref(false);
const showNoAccessModal = ref(false);

const { canManageSettings } = usePermissions();

const providerLabels = computed(() => ({
  openai: {
    label: t('settings.ai.openai.label'),
    description: t('settings.ai.openai.providerDescription'),
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    showApiKey: true,
    showBaseUrl: true,
  },
  anthropic: {
    label: 'Anthropic API Key',
    description: 'Enter Anthropic API Key and (optional) Base URL.',
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://api.anthropic.com/v1',
    showApiKey: true,
    showBaseUrl: true,
  },
  google: {
    label: 'Google Gemini API Key',
    description: 'Enter Google Gemini API Key and (optional) Base URL.',
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
    showApiKey: true,
    showBaseUrl: true,
  },
  ollama: {
    label: t('settings.ai.ollama.label'),
    description: t('settings.ai.ollama.providerDescription'),
    apiKeyPlaceholder: '',
    baseUrlPlaceholder: 'http://localhost:11434',
    showApiKey: false,
    showBaseUrl: true,
  },
}));

async function goTo(path) {
  await checkAuth();
  if (isAuthenticated.value && address.value) {
    await checkUserAccessLevel(address.value);
  }

  if (!canManageSettings.value) {
    showNoAccessModal.value = true;
    return;
  }
  router.push(path);
}

function closeNoAccessModal() {
  showNoAccessModal.value = false;
}
</script>

<style scoped>
.settings-panel {
  padding: var(--block-padding);
  background-color: var(--color-light);
  border-radius: var(--radius-md);
  margin-top: var(--spacing-lg);
  animation: fadeIn var(--transition-normal);
}
.integration-blocks {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}
.integration-block {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  padding: 2rem;
  min-width: 260px;
  flex: 1 1 300px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.details-btn {
  margin-top: 1.5rem;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.5rem 1.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s;
}
.details-btn:hover {
  background: var(--color-primary-dark);
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.close-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  background: none;
  border: none;
  font-size: 2rem;
  cursor: pointer;
  color: #bbb;
  transition: color 0.2s;
  z-index: 10;
}
.close-btn:hover {
  color: #333;
}
</style>
