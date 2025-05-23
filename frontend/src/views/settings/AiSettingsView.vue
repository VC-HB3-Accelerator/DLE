<template>
  <div class="ai-settings settings-panel">
    <h2>Интеграции</h2>
    <div class="integration-blocks" v-if="!showProvider && !showEmailSettings && !showTelegramSettings && !showDbSettings">
      <div class="integration-block">
        <h3>OpenAI</h3>
        <p>Интеграция с OpenAI (GPT-4, GPT-3.5 и др.).</p>
        <button class="details-btn" @click="showProvider = 'openai'">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Anthropic</h3>
        <p>Интеграция с Anthropic Claude (Claude 3 и др.).</p>
        <button class="details-btn" @click="showProvider = 'anthropic'">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Google Gemini</h3>
        <p>Интеграция с Google Gemini (Gemini 1.5, 1.0 и др.).</p>
        <button class="details-btn" @click="showProvider = 'google'">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Ollama</h3>
        <p>Локальные open-source модели через Ollama.</p>
        <button class="details-btn" @click="showProvider = 'ollama'">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Telegram</h3>
        <p>Интеграция с Telegram-ботом для уведомлений и авторизации.</p>
        <button class="details-btn" @click="showTelegramSettings = true">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>Email</h3>
        <p>Интеграция с Email для отправки писем и уведомлений.</p>
        <button class="details-btn" @click="showEmailSettings = true">Подробнее</button>
      </div>
      <div class="integration-block">
        <h3>База данных</h3>
        <p>Интеграция с PostgreSQL для хранения данных приложения и управления настройками.</p>
        <button class="details-btn" @click="showDbSettings = true">Подробнее</button>
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
    <TelegramSettingsView v-if="showTelegramSettings" @cancel="showTelegramSettings = false" />
    <EmailSettingsView v-if="showEmailSettings" @cancel="showEmailSettings = false" />
    <DatabaseSettingsView v-if="showDbSettings" @cancel="showDbSettings = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import AIProviderSettings from './AIProviderSettings.vue';
import TelegramSettingsView from './TelegramSettingsView.vue';
import EmailSettingsView from './EmailSettingsView.vue';
import DatabaseSettingsView from './DatabaseSettingsView.vue';
const showProvider = ref(null);
const showTelegramSettings = ref(false);
const showEmailSettings = ref(false);
const showDbSettings = ref(false);

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
</style> 