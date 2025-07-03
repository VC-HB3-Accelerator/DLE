<template>
  <div class="ai-settings settings-panel" style="position:relative">
    <button class="close-btn" @click="$router.push('/settings')">×</button>
    <h2>Интеграции</h2>
    <div class="integration-blocks" v-if="!showProvider && !showEmailSettings && !showTelegramSettings && !showDbSettings">
      <div class="integration-block">
        <h3>OpenAI</h3>
        <p>Интеграция с OpenAI (GPT-4, GPT-3.5 и др.).</p>
        <button class="details-btn" @click="goTo('/settings/ai/openai')">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Ollama</h3>
        <p>Локальные open-source модели через Ollama.</p>
        <button class="details-btn" @click="goTo('/settings/ai/ollama')">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Telegram</h3>
        <p>Интеграция с Telegram-ботом для уведомлений и авторизации.</p>
        <button class="details-btn" @click="goTo('/settings/ai/telegram')">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Email</h3>
        <p>Интеграция с Email для отправки писем и уведомлений.</p>
        <button class="details-btn" @click="goTo('/settings/ai/email')">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>База данных</h3>
        <p>Интеграция с PostgreSQL для хранения данных приложения и управления настройками.</p>
        <button class="details-btn" @click="goTo('/settings/ai/database')">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>ИИ-ассистент</h3>
        <p>Настройки поведения, языков, моделей и правил работы ассистента.</p>
        <button class="details-btn" @click="goTo('/settings/ai/assistant')">Подробнее</button>
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
    <NoAccessModal :show="showNoAccessModal" @close="closeNoAccessModal" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import AIProviderSettings from './AIProviderSettings.vue';
import { useAuthContext } from '@/composables/useAuth';
import NoAccessModal from '@/components/NoAccessModal.vue';

const showProvider = ref(null);
const showTelegramSettings = ref(false);
const showEmailSettings = ref(false);
const showDbSettings = ref(false);
const showAiAssistantSettings = ref(false);
const showNoAccessModal = ref(false);

const { isAdmin } = useAuthContext();

const providerLabels = {
  openai: {
    label: 'OpenAI API Key',
    description: 'Введите OpenAI API Key и (опционально) Base URL для кастомных endpoint.',
    apiKeyPlaceholder: 'sk-...',
    baseUrlPlaceholder: 'https://api.openai.com/v1',
    showApiKey: true,
    showBaseUrl: true,
  },
  anthropic: {
    label: 'Anthropic API Key',
    description: 'Введите Anthropic API Key и (опционально) Base URL.',
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://api.anthropic.com/v1',
    showApiKey: true,
    showBaseUrl: true,
  },
  google: {
    label: 'Google Gemini API Key',
    description: 'Введите Google Gemini API Key и (опционально) Base URL.',
    apiKeyPlaceholder: '...',
    baseUrlPlaceholder: 'https://generativelanguage.googleapis.com/v1beta',
    showApiKey: true,
    showBaseUrl: true,
  },
  ollama: {
    label: 'Ollama (локальные модели)',
    description: 'Настройка Ollama для локальных open-source моделей. Ключ не требуется.',
    apiKeyPlaceholder: '',
    baseUrlPlaceholder: 'http://localhost:11434',
    showApiKey: false,
    showBaseUrl: true,
  },
};

function goTo(path) {
  if (!isAdmin.value) {
    showNoAccessModal.value = true;
    return;
  }
  window.location.href = path;
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