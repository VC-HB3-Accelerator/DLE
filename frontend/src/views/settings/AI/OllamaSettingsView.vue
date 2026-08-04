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
    <div class="ollama-settings-block panel page-with-close">
      <PageCloseButton fallback="/settings/ai" />
      <h2>{{ $t('settings.ai.ollama.pageTitle') }}</h2>
      <AIProviderSettings
        provider="ollama"
        :label="$t('settings.ai.ollama.label')"
        :description="t('settings.ai.ollama.providerDescription')"
        apiKeyPlaceholder=""
        baseUrlPlaceholder="http://localhost:11434"
        :showApiKey="false"
        :showBaseUrl="true"
      />
      <OllamaModelManager />
    </div>
  </BaseLayout>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import BaseLayout from '@/components/BaseLayout.vue';
import AIProviderSettings from '@/views/settings/AIProviderSettings.vue';
import OllamaModelManager from '@/components/OllamaModelManager.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';
</script>

<style scoped>
.ollama-settings-block {
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  width: 100%;
  position: relative;
  overflow-x: auto;
}

.page-with-close {
  position: relative;
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
  border: none !important;
}

@media (max-width: 768px) {
  .ai-provider-settings.settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
