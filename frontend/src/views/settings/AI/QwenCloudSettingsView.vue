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
    <div class="qwencloud-settings-block panel page-with-close">
      <PageCloseButton fallback="/settings/ai" />
      <h2>{{ t('settings.ai.qwencloud.pageTitle') }}</h2>
      <AIProviderSettings
        class="qwencloud-provider"
        provider="qwencloud"
        :label="t('settings.ai.qwencloud.label')"
        :description="t('settings.ai.qwencloud.providerDescription')"
        api-key-placeholder="sk-..."
        base-url-placeholder="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
        :show-api-key="true"
        :show-base-url="true"
        :show-proxy="false"
        :show-heading="false"
      />
    </div>
  </BaseLayout>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import BaseLayout from '@/components/BaseLayout.vue';
import AIProviderSettings from '@/views/settings/AIProviderSettings.vue';
import PageCloseButton from '@/components/PageCloseButton.vue';

const { t } = useI18n();
</script>

<style scoped>
.qwencloud-settings-block {
  margin-top: var(--spacing-lg);
  margin-bottom: var(--spacing-lg);
  width: 100%;
  position: relative;
  color: var(--color-text);
  overflow: visible;
}

.page-with-close {
  position: relative;
}

h2 {
  margin: 0 0 var(--spacing-md);
  padding-right: 36px;
  color: var(--color-text);
}

:deep(.qwencloud-provider.ai-provider-settings) {
  max-width: 640px;
  margin-top: 0;
  padding: 0;
  background: transparent;
  box-shadow: none;
  border: none;
}

@media (max-width: 768px) {
  .qwencloud-settings,
  .settings-panel {
    max-width: 100%;
    box-sizing: border-box;
  }
}
</style>
