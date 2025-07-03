<template>
  <BaseLayout>
    <div class="ollama-settings-block">
      <button class="close-btn" @click="goBack">×</button>
      <h2>Ollama: интеграция и настройки</h2>
      <AIProviderSettings
        provider="ollama"
        label="Ollama (локальные модели)"
        description="Настройка Ollama для локальных open-source моделей. Ключ не требуется."
        apiKeyPlaceholder=""
        baseUrlPlaceholder="http://localhost:11434"
        :showApiKey="false"
        :showBaseUrl="true"
      />
    </div>
  </BaseLayout>
</template>

<script setup>
import BaseLayout from '@/components/BaseLayout.vue';
import AIProviderSettings from '@/views/settings/AIProviderSettings.vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const goBack = () => router.push('/settings/ai');
</script>

<style scoped>
.ollama-settings-block {
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-top: 20px;
  margin-bottom: 20px;
  width: 100%;
  position: relative;
  overflow-x: auto;
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
}
.close-btn:hover {
  color: #333;
}
h2 {
  margin-bottom: 0;
}
.ai-provider-settings.settings-panel {
  background: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
  margin-top: 0 !important;
  max-width: 100% !important;
  padding: 0 !important;
}
</style> 